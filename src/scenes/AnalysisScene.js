import Phaser from 'phaser';
import { SCREEN, COLORS }  from '../config/Constants.js';
import { BeatDetector }    from '../audio/BeatDetector.js';
import { trackLibrary }    from '../data/TrackLibrary.js';

const TXT_BASE = { fontFamily: 'monospace', color: COLORS.ECG_CORE };

export class AnalysisScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AnalysisScene' });
    this._fileInput   = null;
    this._beatmap     = null;
    this._blobUrl     = null;
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
    this.add.text(cx, 80, 'SIGNAL ACQUISITION', { ...TXT_BASE, fontSize: '36px',
      stroke: '#003322', strokeThickness: 3 }).setOrigin(0.5);

    this.add.text(cx, 130, 'Load an audio file to generate a beatmap automatically', {
      ...TXT_BASE, fontSize: '13px', color: '#00aa55' }).setOrigin(0.5);

    // Info box
    const bx = cx - 300;
    const infoBox = this.add.graphics();
    infoBox.lineStyle(1, 0x00ff88, 0.25);
    infoBox.strokeRect(bx, 170, 600, 120);
    infoBox.fillStyle(0x001a0d, 0.3);
    infoBox.fillRect(bx, 170, 600, 120);

    this.add.text(cx, 195, 'HOW IT WORKS', { ...TXT_BASE, fontSize: '12px', color: '#00aa55' }).setOrigin(0.5);
    this.add.text(cx, 220, [
      'The algorithm decodes your audio and analyzes the frequency spectrum',
      'Bass hits  →  DOWN   ·   Mid transients  →  CENTER   ·   Treble hits  →  UP',
      'Supported: MP3 · WAV · OGG',
    ].join('\n'), {
      fontFamily: 'monospace', fontSize: '12px', color: '#004422',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);

    // File select button
    this._selectBtn = this.add.text(cx, 360, '[ SELECT AUDIO FILE ]', {
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

    const barBg = this.add.rectangle(cx, 470, 500, 8, 0x002211).setOrigin(0.5);
    this._progressGroup.add(barBg);

    const barFill = this.add.rectangle(cx - 250, 470, 0, 8, 0x00ff88).setOrigin(0, 0.5);
    this._progressGroup.add(barFill);
    this._progressBar = barFill;

    this._progressGroup.setVisible(false);

    // Results area (hidden until done)
    this._resultsText = this.add.text(cx, 530, '', {
      ...TXT_BASE, fontSize: '14px', color: '#00aa55', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);

    this._startBtn = this.add.text(cx, 610, '[ BEGIN PROCEDURE ]', {
      ...TXT_BASE, fontSize: '22px',
      color: '#000000', backgroundColor: '#00ff88', padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this._startBtn.setVisible(false);

    this._startBtn.on('pointerover',  () => this._startBtn.setStyle({ backgroundColor: '#00ffaa' }));
    this._startBtn.on('pointerout',   () => this._startBtn.setStyle({ backgroundColor: '#00ff88' }));
    this._startBtn.on('pointerdown',  () => this._launchGame());

    // Back button (always visible)
    const backBtn = this.add.text(cx, 660, '[ BACK TO MENU ]', {
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

  async _runAnalysis(file) {
    // Disable file picker while running
    this._selectBtn.disableInteractive().setAlpha(0.4);
    this.tweens.killTweensOf(this._selectBtn);
    this._startBtn.setVisible(false);
    this._resultsText.setText('');
    this._progressGroup.setVisible(true);

    // Revoke previous blob URL if any
    if (this._blobUrl) {
      URL.revokeObjectURL(this._blobUrl);
      this._blobUrl = null;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const detector    = new BeatDetector();

      const beats = await detector.analyze(arrayBuffer, (progress, status) => {
        this._progressBar.width = 500 * progress;
        this._statusText.setText(status || '');
      });

      const bpm  = detector.estimateBpm(beats);
      this._blobUrl = URL.createObjectURL(file);

      const title = file.name.replace(/\.[^.]+$/, '');

      // Map browser MIME type → Howler format string
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
          audioFormat: [audioFormat],   // Howler format hint for blob URLs
          author:      'auto',
        },
        timing: {
          baseBpm:  bpm,
          segments: [{ startMs: 0, bpm }],
        },
        beats,
        events: [],
      };

      // Show results
      const dur  = beats.length ? (beats[beats.length - 1].timeMs / 1000).toFixed(1) : 0;
      const up   = beats.filter(b => b.zone === 'UP').length;
      const ctr  = beats.filter(b => b.zone === 'CENTER').length;
      const down = beats.filter(b => b.zone === 'DOWN').length;

      this._resultsText.setText([
        `"${title}"  ·  ~${bpm} BPM  ·  ${dur}s`,
        `${beats.length} beats detected  ·  UP: ${up}  CENTER: ${ctr}  DOWN: ${down}`,
      ].join('\n'));

      // Auto-save to library (fire-and-forget; don't block the UI)
      trackLibrary.saveTrack(arrayBuffer, this._beatmap).catch(err => {
        console.warn('[AnalysisScene] Could not save to library:', err);
      });

      this._startBtn.setVisible(true);

      // Re-enable file picker for re-analysis
      this._selectBtn.setInteractive({ useHandCursor: true }).setAlpha(1);

    } catch (err) {
      this._statusText.setText(`ERROR: ${err.message}`);
      this._selectBtn.setInteractive({ useHandCursor: true }).setAlpha(1);
      console.error('[AnalysisScene]', err);
    }
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
    // Note: _blobUrl is intentionally NOT revoked here so GameScene can use it.
    // It will be revoked on the next analysis run.
  }
}
