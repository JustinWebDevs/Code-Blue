import Phaser from 'phaser';
import { SCREEN, COLORS }  from '../config/Constants.js';
import { BeatDetector }    from '../audio/BeatDetector.js';
import { trackLibrary }    from '../data/TrackLibrary.js';

const TXT_BASE = { fontFamily: 'monospace', color: COLORS.ECG_CORE };

// ── Zone key helper (mirrors BeatDetector / BeatEvaluator) ──────────────────
function _zoneKeys(zone) {
  if (zone === 'UP')     return ['up'];
  if (zone === 'DOWN')   return ['down'];
  if (zone === 'CENTER') return ['center'];
  return [];
}

export class AnalysisScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AnalysisScene' });
    this._fileInput   = null;
    this._beatmap     = null;
    this._blobUrl     = null;
    // Mix sliders — 50 = AUTO (no post-processing change)
    this._noteWeight  = 50;
    this._holdWeight  = 50;
    this._transWeight = 50;
  }

  init(data) {
    this._patientName = data.patientName || 'JOHN DOE';
  }

  create() {
    const cx = SCREEN.WIDTH  / 2;

    // Background
    const g = this.add.graphics();
    g.fillStyle(0x000000, 1);
    g.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);
    g.lineStyle(1, 0x00ff88, 0.03);
    for (let y = 0; y < SCREEN.HEIGHT; y += 4) {
      g.moveTo(0, y); g.lineTo(SCREEN.WIDTH, y);
    }
    g.strokePath();

    // Title
    this.add.text(cx, 58, 'SIGNAL ACQUISITION', { ...TXT_BASE, fontSize: '36px',
      stroke: '#003322', strokeThickness: 3 }).setOrigin(0.5);

    this.add.text(cx, 98, 'Load an audio file to generate a beatmap automatically', {
      ...TXT_BASE, fontSize: '13px', color: '#00aa55' }).setOrigin(0.5);

    // Info box (compact)
    const bx = cx - 300;
    const infoBox = this.add.graphics();
    infoBox.lineStyle(1, 0x00ff88, 0.25);
    infoBox.strokeRect(bx, 118, 600, 100);
    infoBox.fillStyle(0x001a0d, 0.3);
    infoBox.fillRect(bx, 118, 600, 100);

    this.add.text(cx, 140, 'HOW IT WORKS', { ...TXT_BASE, fontSize: '12px', color: '#00aa55' }).setOrigin(0.5);
    this.add.text(cx, 163, [
      'The algorithm decodes your audio and analyzes the frequency spectrum',
      'Bass hits  →  DOWN   ·   Mid transients  →  CENTER   ·   Treble hits  →  UP',
      'Supported: MP3 · WAV · OGG',
    ].join('\n'), {
      fontFamily: 'monospace', fontSize: '12px', color: '#004422',
      align: 'center', lineSpacing: 5,
    }).setOrigin(0.5);

    // ── Mix sliders ──────────────────────────────────────────────────────────
    const sliderBox = this.add.graphics();
    sliderBox.lineStyle(1, 0x00ff88, 0.18);
    sliderBox.strokeRect(bx, 228, 600, 110);
    sliderBox.fillStyle(0x001a0d, 0.25);
    sliderBox.fillRect(bx, 228, 600, 110);

    this.add.text(cx, 244, 'BEAT MIX  (← less · AUTO · more →)', {
      ...TXT_BASE, fontSize: '11px', color: '#007744',
    }).setOrigin(0.5);

    this._makeSlider(cx, 270, 'NOTAS',        this._noteWeight,  v => { this._noteWeight  = v; });
    this._makeSlider(cx, 300, 'HOLDS',        this._holdWeight,  v => { this._holdWeight  = v; });
    this._makeSlider(cx, 330, 'TRANSICIONES', this._transWeight, v => { this._transWeight = v; });

    // File select button
    this._selectBtn = this.add.text(cx, 375, '[ SELECT AUDIO FILE ]', {
      ...TXT_BASE, fontSize: '22px',
      backgroundColor: '#002211', padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this._selectBtn.on('pointerover',  () => this._selectBtn.setStyle({ backgroundColor: '#003a1e' }));
    this._selectBtn.on('pointerout',   () => this._selectBtn.setStyle({ backgroundColor: '#002211' }));
    this._selectBtn.on('pointerdown',  () => this._fileInput.click());

    // Pulse on the button
    this.tweens.add({
      targets: this._selectBtn, scaleX: 1.02, scaleY: 1.02,
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Progress area (hidden until analysis starts)
    this._progressGroup = this.add.group();

    const progLabel = this.add.text(cx, 440, '', {
      ...TXT_BASE, fontSize: '13px', color: '#00aa55'
    }).setOrigin(0.5);
    this._progressGroup.add(progLabel);
    this._statusText = progLabel;

    const barBg = this.add.rectangle(cx, 466, 500, 8, 0x002211).setOrigin(0.5);
    this._progressGroup.add(barBg);

    const barFill = this.add.rectangle(cx - 250, 466, 0, 8, 0x00ff88).setOrigin(0, 0.5);
    this._progressGroup.add(barFill);
    this._progressBar = barFill;

    this._progressGroup.setVisible(false);

    // Results area (hidden until done)
    this._resultsText = this.add.text(cx, 510, '', {
      ...TXT_BASE, fontSize: '14px', color: '#00aa55', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);

    this._startBtn = this.add.text(cx, 575, '[ BEGIN PROCEDURE ]', {
      ...TXT_BASE, fontSize: '22px',
      color: '#000000', backgroundColor: '#00ff88', padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this._startBtn.setVisible(false);

    this._startBtn.on('pointerover',  () => this._startBtn.setStyle({ backgroundColor: '#00ffaa' }));
    this._startBtn.on('pointerout',   () => this._startBtn.setStyle({ backgroundColor: '#00ff88' }));
    this._startBtn.on('pointerdown',  () => this._launchGame());

    // Back button (always visible)
    const backBtn = this.add.text(cx, 625, '[ BACK TO MENU ]', {
      fontFamily: 'monospace', fontSize: '13px', color: '#005533',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
    this.input.keyboard.once('keydown-ESC', () => this.scene.start('MenuScene'));

    // Hidden DOM file input
    this._fileInput = document.createElement('input');
    this._fileInput.type   = 'file';
    this._fileInput.accept = 'audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg';
    this._fileInput.style.display = 'none';
    document.body.appendChild(this._fileInput);

    this._fileInput.addEventListener('change', () => {
      const file = this._fileInput.files[0];
      if (file) this._runAnalysis(file);
    });
  }

  // ── Slider helper ───────────────────────────────────────────────────────────
  /**
   * Creates a single labeled horizontal slider.
   * @param {number} cx        center X of the track
   * @param {number} y         vertical position
   * @param {string} label     text to the left
   * @param {number} defVal    initial value 0–100
   * @param {Function} onChange called with new value (0–100) on change
   */
  _makeSlider(cx, y, label, defVal, onChange) {
    const TRACK_W = 220;
    const trackX  = cx - TRACK_W / 2;

    // Label
    this.add.text(trackX - 10, y, label, {
      ...TXT_BASE, fontSize: '11px', color: '#007744',
    }).setOrigin(1, 0.5);

    // Track background
    const trackGfx = this.add.graphics();
    trackGfx.lineStyle(1, 0x00ff44, 0.30);
    trackGfx.strokeRect(trackX, y - 5, TRACK_W, 10);
    trackGfx.fillStyle(0x001208, 0.6);
    trackGfx.fillRect(trackX, y - 5, TRACK_W, 10);
    // Centre "AUTO" tick
    trackGfx.lineStyle(1, 0x00ff44, 0.25);
    trackGfx.beginPath();
    trackGfx.moveTo(trackX + TRACK_W / 2, y - 9);
    trackGfx.lineTo(trackX + TRACK_W / 2, y + 9);
    trackGfx.strokePath();

    // Draggable handle
    const handle = this.add.rectangle(
      trackX + (defVal / 100) * TRACK_W, y, 14, 22, 0x00ff88, 1,
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Value display
    const valText = this.add.text(trackX + TRACK_W + 12, y,
      defVal === 50 ? 'AUTO' : String(defVal), {
      ...TXT_BASE, fontSize: '11px', color: '#007744',
    }).setOrigin(0, 0.5);

    // Drag via pointer tracking (no Phaser drag plugin needed)
    let dragging = false;
    handle.on('pointerdown', () => { dragging = true; });
    this.input.on('pointerup',   () => { dragging = false; });
    this.input.on('pointermove', (pointer) => {
      if (!dragging || !pointer.isDown) return;
      const newX = Phaser.Math.Clamp(pointer.x, trackX, trackX + TRACK_W);
      handle.x   = newX;
      const val  = Math.round(((newX - trackX) / TRACK_W) * 100);
      valText.setText(val === 50 ? 'AUTO' : String(val));
      onChange(val);
    });

    // Also allow clicking anywhere on the track to jump the handle
    const hitZone = this.add.zone(cx, y, TRACK_W, 20).setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', (pointer) => {
      const newX = Phaser.Math.Clamp(pointer.x, trackX, trackX + TRACK_W);
      handle.x   = newX;
      const val  = Math.round(((newX - trackX) / TRACK_W) * 100);
      valText.setText(val === 50 ? 'AUTO' : String(val));
      onChange(val);
    });
  }

  // ── Analysis ────────────────────────────────────────────────────────────────
  async _runAnalysis(file) {
    this._selectBtn.disableInteractive().setAlpha(0.4);
    this.tweens.killTweensOf(this._selectBtn);
    this._startBtn.setVisible(false);
    this._resultsText.setText('');
    this._progressGroup.setVisible(true);

    if (this._blobUrl) {
      URL.revokeObjectURL(this._blobUrl);
      this._blobUrl = null;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const detector    = new BeatDetector();

      const rawBeats = await detector.analyze(arrayBuffer, (progress, status) => {
        this._progressBar.width = 500 * progress;
        this._statusText.setText(status || '');
      });

      // Apply user-configured beat mix
      const beats = this._postProcessBeats(rawBeats);

      const bpm  = detector.estimateBpm(beats);
      this._blobUrl = URL.createObjectURL(file);
      const title   = file.name.replace(/\.[^.]+$/, '');

      const mimeMap = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
                        'audio/wav': 'wav',  'audio/wave': 'wav',
                        'audio/ogg': 'ogg',  'audio/vorbis': 'ogg' };
      const audioFormat = mimeMap[file.type] ?? 'mp3';

      this._beatmap = {
        version: '1.0.0',
        meta: {
          id:          `auto_${Date.now()}`,
          title,
          artist:      'Unknown',
          bpm,
          offset:      0,
          audioFile:   this._blobUrl,
          audioFormat: [audioFormat],
          author:      'auto',
        },
        timing: { baseBpm: bpm, segments: [{ startMs: 0, bpm }] },
        beats,
        events: [],
      };

      const dur   = beats.length ? (beats[beats.length - 1].timeMs / 1000).toFixed(1) : 0;
      const up    = beats.filter(b => b.zone === 'UP').length;
      const ctr   = beats.filter(b => b.zone === 'CENTER').length;
      const down  = beats.filter(b => b.zone === 'DOWN').length;
      const holds = beats.filter(b => b.holdMs > 0).length;
      const trans = beats.filter(b => b.holdSegments?.length > 1).length;

      this._resultsText.setText([
        `"${title}"  ·  ~${bpm} BPM  ·  ${dur}s`,
        `${beats.length} beats  ·  UP:${up}  CTR:${ctr}  DOWN:${down}  HOLDS:${holds}  TRANS:${trans}`,
      ].join('\n'));

      trackLibrary.saveTrack(arrayBuffer, this._beatmap).catch(err => {
        console.warn('[AnalysisScene] Could not save to library:', err);
      });

      this._startBtn.setVisible(true);
      this._selectBtn.setInteractive({ useHandCursor: true }).setAlpha(1);

    } catch (err) {
      this._statusText.setText(`ERROR: ${err.message}`);
      this._selectBtn.setInteractive({ useHandCursor: true }).setAlpha(1);
      console.error('[AnalysisScene]', err);
    }
  }

  // ── Beat post-processor ────────────────────────────────────────────────────
  /**
   * Adjusts the auto-detected beat mix based on the three sliders.
   * All sliders at 50 = no change (auto behaviour).
   *
   * noteWeight  0-100 → desired fraction of beats that are plain taps
   * holdWeight  0-100 → desired fraction of beats that are holds
   * transWeight 0-100 → probability (0–1) that an eligible hold gets transitions
   */
  _postProcessBeats(beats) {
    const nw = this._noteWeight;
    const hw = this._holdWeight;
    const tw = this._transWeight;

    // Nothing to do?
    if (nw === 50 && hw === 50 && tw === 50) return beats;

    // Work on shallow copies so we don't mutate the originals
    const result = beats.map(b => ({ ...b }));

    // ── Step 1: adjust tap / hold balance ────────────────────────────────────
    if (nw !== hw) {
      const total            = nw + hw;
      const targetTapFrac    = total > 0 ? nw / total : 0.5;
      const currentTapCount  = result.filter(b => b.holdMs === 0).length;
      const currentTapFrac   = currentTapCount / result.length;

      if (targetTapFrac > currentTapFrac) {
        // Convert some holds → taps
        const surplus = Math.round((targetTapFrac - currentTapFrac) * result.length);
        let converted = 0;
        for (const b of result) {
          if (converted >= surplus) break;
          if (b.holdMs > 0) {
            b.holdMs = 0;
            delete b.holdSegments;
            converted++;
          }
        }
      } else if (targetTapFrac < currentTapFrac) {
        // Convert some taps → holds
        const surplus = Math.round((currentTapFrac - targetTapFrac) * result.length);
        let converted = 0;
        for (const b of result) {
          if (converted >= surplus) break;
          if (b.holdMs === 0) {
            b.holdMs = 450 + Math.round(Math.random() * 550);
            converted++;
          }
        }
      }
    }

    // ── Step 2: adjust transition density ────────────────────────────────────
    if (tw !== 50) {
      const transProb = tw / 100;
      for (const b of result) {
        if (b.holdMs < 1200) continue;

        if (Math.random() < transProb) {
          // Add / keep transition
          if (!b.holdSegments?.length) {
            const others = ['UP', 'CENTER', 'DOWN'].filter(z => z !== b.zone);
            const nz     = others[Math.floor(Math.random() * others.length)];
            const split  = Math.round(b.holdMs * (0.40 + Math.random() * 0.25));
            b.holdSegments = [
              { offsetMs: 0,     zone: b.zone, keys: _zoneKeys(b.zone) },
              { offsetMs: split, zone: nz,      keys: _zoneKeys(nz)     },
            ];
          }
        } else if (tw < 50) {
          // Actively remove transitions
          delete b.holdSegments;
        }
      }
    }

    return result;
  }

  _launchGame() {
    if (!this._beatmap) return;
    this.scene.start('GameScene', {
      beatmap:     this._beatmap,
      patientName: this._patientName,
    });
  }

  shutdown() {
    if (this._fileInput) {
      document.body.removeChild(this._fileInput);
      this._fileInput = null;
    }
    // Note: _blobUrl intentionally NOT revoked here — GameScene still needs it.
  }
}
