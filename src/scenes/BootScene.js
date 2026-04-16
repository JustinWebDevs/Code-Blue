import Phaser from 'phaser';
import { SCREEN, COLORS } from '../config/Constants.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this._createLoadingBar();

    this.load.on('progress', (value) => {
      this._updateLoadingBar(value);
    });

    // Placeholder: future audio/font assets loaded here
    // this.load.audio('track_001', 'assets/audio/music/track_001.mp3');
    // this.load.json('beatmap_001', 'assets/beatmaps/track_001.json');
  }

  create() {
    this.scene.start('MenuScene');
  }

  _createLoadingBar() {
    const cx = SCREEN.WIDTH / 2;
    const cy = SCREEN.HEIGHT / 2;

    this._title = this.add.text(cx, cy - 60, 'CODE BLUE', {
      fontFamily: 'monospace',
      fontSize:   '32px',
      color:      COLORS.ECG_CORE,
    }).setOrigin(0.5);

    this._barBg = this.add.rectangle(cx, cy + 20, 400, 6, 0x003322);
    this._bar   = this.add.rectangle(cx - 200, cy + 20, 0, 6, 0x00ff88).setOrigin(0, 0.5);

    this._status = this.add.text(cx, cy + 45, 'INITIALIZING...', {
      fontFamily: 'monospace',
      fontSize:   '12px',
      color:      '#00aa55',
    }).setOrigin(0.5);
  }

  _updateLoadingBar(value) {
    this._bar.width = 400 * value;
    const pct = Math.floor(value * 100);
    this._status.setText(`LOADING... ${pct}%`);
  }
}
