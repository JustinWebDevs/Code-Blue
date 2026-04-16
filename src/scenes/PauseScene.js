import Phaser from 'phaser';
import { SCREEN, COLORS } from '../config/Constants.js';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PauseScene' });
  }

  init(data) {
    this._audioManager = data.audioManager;
    this._beatmap      = data.beatmap;
    this._patientName  = data.patientName;
  }

  create() {
    const cx = SCREEN.WIDTH  / 2;
    const cy = SCREEN.HEIGHT / 2;

    // Dimmed overlay
    this.add.rectangle(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT, 0x000000, 0.65).setOrigin(0);

    // Panel
    const pw = 420, ph = 300;
    const px = cx - pw / 2, py = cy - ph / 2;
    const panel = this.add.graphics();
    panel.lineStyle(1, 0x00ff88, 0.5);
    panel.strokeRect(px, py, pw, ph);
    panel.fillStyle(0x000d07, 0.95);
    panel.fillRect(px, py, pw, ph);

    this.add.text(cx, py + 40, '// PAUSED //', {
      fontFamily: 'monospace', fontSize: '28px', color: COLORS.ECG_CORE,
    }).setOrigin(0.5);

    this.add.text(cx, py + 80, `PATIENT: ${this._patientName}`, {
      fontFamily: 'monospace', fontSize: '13px', color: '#00aa55',
    }).setOrigin(0.5);

    // Buttons
    const btns = [
      { label: '[ RESUME ]',     key: 'R', action: () => this._resume() },
      { label: '[ RESTART ]',    key: 'T', action: () => this._restart() },
      { label: '[ MAIN MENU ]',  key: 'M', action: () => this._quit() },
    ];

    btns.forEach(({ label, key, action }, i) => {
      const y = py + 145 + i * 52;
      const btn = this.add.text(cx, y, label, {
        fontFamily: 'monospace', fontSize: '20px',
        color: COLORS.ECG_CORE, backgroundColor: '#001a0d',
        padding: { x: 16, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerover',  () => btn.setStyle({ backgroundColor: '#003322' }));
      btn.on('pointerout',   () => btn.setStyle({ backgroundColor: '#001a0d' }));
      btn.on('pointerdown',  action);

      this.input.keyboard.once(`keydown-${key}`, action);
    });

    this.add.text(cx, py + ph - 24, '[R] resume  ·  [T] restart  ·  [M] menu', {
      fontFamily: 'monospace', fontSize: '11px', color: '#004422',
    }).setOrigin(0.5);

    // ESC also resumes
    this.input.keyboard.once('keydown-ESC', () => this._resume());
  }

  _resume() {
    this._audioManager.resumeTrack();
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  _restart() {
    this._audioManager.stopTrack();
    this.scene.stop('GameScene');
    this.scene.stop();
    this.scene.start('GameScene', {
      beatmap:     this._beatmap,
      patientName: this._patientName,
    });
  }

  _quit() {
    this._audioManager.stopTrack();
    this.scene.stop('GameScene');
    this.scene.stop();
    this.scene.start('MenuScene');
  }
}
