import { Howl, Howler } from 'howler';

/**
 * AudioManager — wraps Howler.js.
 * CRITICAL: getCurrentTime() is the single source of truth for all game timing.
 * Never use Date.now() or setTimeout as timing sources elsewhere.
 */
export class AudioManager {
  constructor(beatmap) {
    this._beatmap   = beatmap;
    this._trackHowl = null;
    this._isPlaying = false;
    this._sfxPool   = new Map();
    this._startOffset = 0; // for procedural clock fallback

    this._buildSFX();
  }

  _buildSFX() {
    // All SFX are procedurally generated via Web Audio API
    // Stored as tiny base64 WAV data URIs so no external files needed
    // We'll synthesize them on-demand via Web Audio instead
    this._audioCtx = null;
    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[AudioManager] Web Audio API not available', e);
    }
  }

  startTrack() {
    const audioFile = this._beatmap.meta.audioFile;

    if (!audioFile) {
      // No audio file: drive timing from performance.now()
      this._startOffset = performance.now();
      this._isPlaying   = true;
      this._ready       = true;
      return;
    }

    // Blob URLs from AnalysisScene must be used as-is (no path prefix).
    // Static asset paths get the assets/audio/ prefix.
    const isBlob = audioFile.startsWith('blob:');
    const url    = isBlob ? audioFile : `assets/audio/${audioFile}`;

    // format hint: Howler can't detect format from blob URLs (no extension)
    const fmt = this._beatmap.meta.audioFormat ?? (isBlob ? ['mp3'] : undefined);

    this._ready = false;

    this._trackHowl = new Howl({
      src:   [url],
      html5: isBlob,         // HTML5 Audio for blobs → near-instant start
      ...(fmt ? { format: fmt } : {}),
      onplay: () => {
        this._isPlaying = true;
        this._ready     = true;
      },
      onend:  () => { this._isPlaying = false; },
      onloaderror: (_id, err) => {
        console.error('[AudioManager] Failed to load audio:', err);
        // Graceful fallback: run on procedural clock so game still works
        this._startOffset = performance.now();
        this._isPlaying   = true;
        this._ready       = true;
      },
    });

    this._trackHowl.play();
  }

  /** Returns true once audio has started (or fallback clock is running). */
  isReady() { return this._ready; }

  /** The single source of truth for song position (in ms). */
  getCurrentTime() {
    if (!this._ready) return 0;
    if (this._trackHowl && this._isPlaying) {
      return this._trackHowl.seek() * 1000;
    }
    // Procedural / fallback clock
    if (this._isPlaying) {
      return performance.now() - this._startOffset;
    }
    return 0;
  }

  isPlaying() { return this._isPlaying; }

  stopTrack() {
    if (this._trackHowl) {
      this._trackHowl.stop();
    }
    this._isPlaying = false;
    this._ready     = false;
  }

  pauseTrack() {
    if (this._trackHowl) {
      this._trackHowl.pause();
    } else if (this._isPlaying) {
      // Procedural clock: record the moment we paused
      this._pausedAt = performance.now();
    }
    this._isPlaying = false;
  }

  resumeTrack() {
    if (this._trackHowl) {
      this._trackHowl.play();
      // onplay callback will restore _isPlaying = true
    } else if (this._pausedAt != null) {
      // Shift startOffset so getCurrentTime() continues from where it was
      this._startOffset += performance.now() - this._pausedAt;
      this._pausedAt     = null;
      this._isPlaying    = true;
    }
  }

  // --- SFX synthesis via Web Audio API ---

  playSFX(type) {
    if (!this._audioCtx) return;
    if (this._audioCtx.state === 'suspended') {
      this._audioCtx.resume();
    }

    switch (type) {
      case 'perfect': this._playBeep(880, 0.08, 0.05, 'sine');   break;
      case 'good':    this._playBeep(660, 0.06, 0.07, 'sine');   break;
      case 'miss':    this._playBeep(220, 0.08, 0.12, 'sawtooth'); break;
      case 'alarm':   this._playAlarm();                           break;
      case 'flatline':this._playFlatline();                        break;
    }
  }

  _playBeep(freq, gain, duration, type = 'sine') {
    const ctx = this._audioCtx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type      = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    env.gain.setValueAtTime(gain, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  _playAlarm() {
    const ctx = this._audioCtx;
    const t   = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.setValueAtTime(880, t + 0.1);
    osc.frequency.setValueAtTime(440, t + 0.2);

    env.gain.setValueAtTime(0.1, t);
    env.gain.setValueAtTime(0.0, t + 0.3);

    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  _playFlatline() {
    const ctx = this._audioCtx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    env.gain.setValueAtTime(0.15, ctx.currentTime);
    env.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 2.5);

    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 2.5);
  }

  destroy() {
    if (this._trackHowl) {
      this._trackHowl.stop();
      this._trackHowl.unload();
    }
  }
}
