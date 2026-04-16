/**
 * BeatDetector — offline audio analysis to generate beatmap beats[].
 *
 * Algorithm:
 *   1. Decode MP3/WAV/OGG to PCM via AudioContext
 *   2. Mix down to mono
 *   3. Chunk into overlapping frames (2048 samples, 512-sample hop)
 *   4. Apply Hann window + in-place radix-2 FFT per frame
 *   5. Compute spectral flux (onset strength) and frequency band energies
 *   6. Peak-pick the onset function with an adaptive local threshold
 *   7. Classify each onset as UP / CENTER / DOWN from band energy ratios
 */

const FRAME_SIZE = 2048;   // must be power of 2
const HOP_SIZE   = 512;
const BATCH_SIZE = 80;     // frames per async yield (keeps UI responsive)

// Onset detection tuning
const THRESHOLD_MULTIPLIER  = 1.6;   // higher = fewer false positives
const THRESHOLD_WINDOW      = 20;    // ±N frames for local mean
const MIN_BEAT_GAP_MS       = 300;   // global minimum ms between any two consecutive beats
const MIN_SAME_ZONE_GAP_MS  = 600;   // minimum ms between two beats in the same zone
const MIN_FIRST_BEAT_MS     = 3000;  // skip any onset before this many ms (start grace period)

// Frequency band boundaries (Hz)
const BAND_LOW_MAX  =  300;
const BAND_MID_MAX  = 4000;
const BAND_HIGH_MAX = 16000;

// Zone classification: minimum fraction of per-band flux to claim a zone
// (tuned so CENTER captures mixed transients, avoiding DOWN bias)
const DOWN_FLUX_MIN = 0.38;   // bass must be ≥38% of total onset flux → DOWN
const UP_FLUX_MIN   = 0.28;   // treble must be ≥28% of total onset flux → UP


// ---------------------------------------------------------------------------
// Radix-2 Cooley-Tukey FFT — in-place, real input only
// re[], im[]: Float32Arrays of length N (power of 2).  im must be zeroed before call.
// ---------------------------------------------------------------------------
function fft(re, im) {
  const N = re.length;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  // Butterfly stages
  for (let s = 2; s <= N; s <<= 1) {
    const half = s >> 1;
    const ang  = Math.PI / half;          // twiddle angle step (forward FFT)
    const wRe0 =  Math.cos(ang);
    const wIm0 = -Math.sin(ang);

    for (let k = 0; k < N; k += s) {
      let wRe = 1, wIm = 0;
      for (let j = 0; j < half; j++) {
        const tRe = wRe * re[k+j+half] - wIm * im[k+j+half];
        const tIm = wRe * im[k+j+half] + wIm * re[k+j+half];
        re[k+j+half] = re[k+j] - tRe;   im[k+j+half] = im[k+j] - tIm;
        re[k+j]     += tRe;              im[k+j]     += tIm;
        const nwRe = wRe*wRe0 - wIm*wIm0;
        wIm = wRe*wIm0 + wIm*wRe0;
        wRe = nwRe;
      }
    }
  }
}

// Precompute Hann window for FRAME_SIZE
const HANN = new Float32Array(FRAME_SIZE);
for (let i = 0; i < FRAME_SIZE; i++) {
  HANN[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FRAME_SIZE - 1)));
}


// Probability that a hold with duration ≥ 1200 ms becomes a transitional hold
const TRANSITION_HOLD_CHANCE = 0.18;
// Minimum hold duration (ms) needed to add a transition segment
const MIN_TRANSITION_HOLD_MS = 1200;

function _defaultKeysForZone(zone) {
  if (zone === 'UP')     return ['up'];
  if (zone === 'DOWN')   return ['down'];
  if (zone === 'CENTER') return ['center'];
  return [];
}

// ---------------------------------------------------------------------------
export class BeatDetector {

  /**
   * @param {ArrayBuffer}  arrayBuffer  Raw audio file bytes
   * @param {Function}     onProgress   (0–1, statusString) → void
   * @returns {Promise<Array>}  beats[] compatible with the beatmap schema
   */
  async analyze(arrayBuffer, onProgress = () => {}) {
    // Step 1 — decode
    onProgress(0.02, 'Decoding audio...');
    let buffer;
    try {
      const ctx = new AudioContext();
      buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      await ctx.close();
    } catch (err) {
      throw new Error(`Audio decode failed: ${err.message}`);
    }

    // Step 2 — mono
    onProgress(0.08, 'Mixing to mono...');
    const mono       = this._toMono(buffer);
    const sampleRate = buffer.sampleRate;

    // Step 3–5 — per-frame spectral analysis
    const features = await this._extractFeatures(mono, sampleRate, p => {
      onProgress(0.10 + p * 0.55, 'Analyzing spectrum...');
    });

    // Step 6 — onset detection
    onProgress(0.66, 'Detecting onsets...');
    const onsets = this._detectOnsets(features);

    // Step 7 — build beats with zone labels
    onProgress(0.85, 'Classifying zones...');
    const beats = this._buildBeats(onsets, features, sampleRate);

    onProgress(1.0, `Done — ${beats.length} beats detected`);
    return beats;
  }

  // Estimate BPM from the average inter-onset interval (median of short gaps)
  estimateBpm(beats) {
    if (beats.length < 4) return 120;
    const gaps = [];
    for (let i = 1; i < beats.length; i++) {
      const g = beats[i].timeMs - beats[i - 1].timeMs;
      if (g > 200 && g < 2000) gaps.push(g);
    }
    if (!gaps.length) return 120;
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    return Math.round(60000 / median);
  }


  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  _toMono(buffer) {
    const L    = buffer.getChannelData(0);
    const R    = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
    const mono = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5;
    return mono;
  }

  async _extractFeatures(mono, sampleRate, onProgress) {
    const totalFrames = Math.floor((mono.length - FRAME_SIZE) / HOP_SIZE);
    const features    = [];

    const re      = new Float32Array(FRAME_SIZE);
    const im      = new Float32Array(FRAME_SIZE);
    let   prevMag = null;

    // Frequency bin boundaries
    const binHz     = sampleRate / FRAME_SIZE;
    const binLowEnd  = Math.max(1, Math.round(BAND_LOW_MAX  / binHz));
    const binMidEnd  = Math.round(BAND_MID_MAX  / binHz);
    const binHighEnd = Math.min(FRAME_SIZE / 2 - 1, Math.round(BAND_HIGH_MAX / binHz));

    for (let batch = 0; batch * BATCH_SIZE < totalFrames; batch++) {
      // Yield to browser so progress bar can update
      await new Promise(r => setTimeout(r, 0));

      const start = batch * BATCH_SIZE;
      const end   = Math.min(start + BATCH_SIZE, totalFrames);

      for (let f = start; f < end; f++) {
        const off = f * HOP_SIZE;

        // Copy windowed frame into re[], zero im[]
        for (let n = 0; n < FRAME_SIZE; n++) {
          re[n] = mono[off + n] * HANN[n];
          im[n] = 0;
        }

        fft(re, im);

        // Magnitude spectrum (first half)
        const mag = new Float32Array(FRAME_SIZE / 2);
        for (let k = 0; k < FRAME_SIZE / 2; k++) {
          mag[k] = Math.sqrt(re[k]*re[k] + im[k]*im[k]);
        }

        // Per-band spectral flux: measures CHANGE in each frequency region.
        // Using flux (not absolute energy) avoids the "bass is always dominant" bias.
        let flux = 0, lowFlux = 0, midFlux = 0, highFlux = 0;
        if (prevMag) {
          for (let k = 1;         k <  binLowEnd;  k++) {
            const d = mag[k] - prevMag[k]; if (d > 0) { flux += d; lowFlux  += d; }
          }
          for (let k = binLowEnd; k <  binMidEnd;  k++) {
            const d = mag[k] - prevMag[k]; if (d > 0) { flux += d; midFlux  += d; }
          }
          for (let k = binMidEnd; k <= binHighEnd; k++) {
            const d = mag[k] - prevMag[k]; if (d > 0) { flux += d; highFlux += d; }
          }
        }

        features.push({ flux, lowFlux, midFlux, highFlux });
        prevMag = mag;
      }

      onProgress(end / totalFrames);
    }

    return features;
  }

  _detectOnsets(features) {
    const flux   = features.map(f => f.flux);
    const onsets = [];

    for (let i = 2; i < flux.length - 2; i++) {
      // Must be a local peak
      if (flux[i] <= flux[i - 1] || flux[i] <= flux[i + 1]) continue;

      // Adaptive threshold: local mean × multiplier
      const lo  = Math.max(0, i - THRESHOLD_WINDOW);
      const hi  = Math.min(flux.length - 1, i + THRESHOLD_WINDOW);
      let   sum = 0;
      for (let j = lo; j <= hi; j++) sum += flux[j];
      const threshold = (sum / (hi - lo + 1)) * THRESHOLD_MULTIPLIER;

      if (flux[i] > threshold) onsets.push(i);
    }

    return onsets;
  }

  _buildBeats(onsets, features, sampleRate) {
    const hopMs     = (HOP_SIZE / sampleRate) * 1000;
    const beats     = [];
    let   lastMs    = -MIN_BEAT_GAP_MS;
    let   lastZone  = null;
    let   lastZoneMs = { UP: -MIN_SAME_ZONE_GAP_MS, CENTER: -MIN_SAME_ZONE_GAP_MS, DOWN: -MIN_SAME_ZONE_GAP_MS };
    let   beatIndex = 1;

    for (const frameIdx of onsets) {
      const timeMs = Math.round(frameIdx * hopMs);

      // Grace period: skip onsets too close to the start of the track
      if (timeMs < MIN_FIRST_BEAT_MS) continue;

      // Enforce global minimum gap between any two beats
      if (timeMs - lastMs < MIN_BEAT_GAP_MS) continue;

      const { lowFlux, midFlux, highFlux } = features[frameIdx];
      const zone = this._classifyZone(lowFlux, midFlux, highFlux);

      // Enforce minimum gap between consecutive same-zone beats
      if (timeMs - lastZoneMs[zone] < MIN_SAME_ZONE_GAP_MS) continue;

      lastMs             = timeMs;
      lastZoneMs[zone]   = timeMs;
      lastZone           = zone;

      // Detect hold duration: scan forward for sustained flux above a floor
      const sustainFloor  = features[frameIdx].flux * 0.35;
      const maxLookFrames = Math.round(1500 / hopMs);
      let holdFrames = 0;
      for (let f = frameIdx + 2; f < Math.min(frameIdx + maxLookFrames, features.length); f++) {
        if (features[f].flux < sustainFloor) break;
        holdFrames++;
      }
      const rawHoldMs = holdFrames * hopMs;
      const holdMs    = rawHoldMs >= 500 ? Math.round(rawHoldMs / 50) * 50 : 0;

      // Optionally upgrade long holds to transitional holds
      let holdSegments;
      if (holdMs >= MIN_TRANSITION_HOLD_MS && Math.random() < TRANSITION_HOLD_CHANCE) {
        const others   = ['UP', 'CENTER', 'DOWN'].filter(z => z !== zone);
        const nextZone = others[Math.floor(Math.random() * others.length)];
        // Split point: 40–65 % through the hold
        const splitMs  = Math.round(holdMs * (0.40 + Math.random() * 0.25));
        holdSegments = [
          { offsetMs: 0,       zone,     keys: _defaultKeysForZone(zone)     },
          { offsetMs: splitMs, zone: nextZone, keys: _defaultKeysForZone(nextZone) },
        ];
      }

      const beat = {
        id:        `b${String(beatIndex++).padStart(3, '0')}`,
        timeMs,
        zone,
        intensity: 1.0,
        holdMs,
      };
      if (holdSegments) beat.holdSegments = holdSegments;
      beats.push(beat);
    }

    return beats;
  }

  _classifyZone(lowFlux, midFlux, highFlux) {
    const total = lowFlux + midFlux + highFlux + 1e-9;
    const lr    = lowFlux  / total;  // fraction of onset energy in bass band
    const mr    = midFlux  / total;  // fraction in mid band
    const hr    = highFlux / total;  // fraction in high band

    // Classify by whichever band carries the most onset energy
    if (lr >= mr && lr >= hr && lr > 0.38) return 'DOWN';    // clear bass onset
    if (hr >= mr && hr >= lr && hr > 0.28) return 'UP';      // clear treble onset
    return 'CENTER';                                           // mid-dominant or mixed
  }
}
