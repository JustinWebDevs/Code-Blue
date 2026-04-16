import Phaser from 'phaser';
import { SCREEN, COLORS } from '../config/Constants.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data) {
    this._reason      = data.reason      || 'flatline';
    this._stats       = data.stats       || { score: 0, perfects: 0, goods: 0, misses: 0, maxCombo: 0 };
    this._patientName = data.patientName || 'UNKNOWN';
    this._timestamp   = data.timestamp   || new Date();
    this._beatmap     = data.beatmap     || null;
  }

  create() {
    const cx = SCREEN.WIDTH  / 2;

    const isFlatline = this._reason === 'flatline';

    // Flashing red background for flatline
    if (isFlatline) {
      this._flash = this.add.rectangle(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT, 0x220000)
        .setOrigin(0)
        .setAlpha(0.6);

      this.tweens.add({
        targets: this._flash,
        alpha: 0.2,
        duration: 600,
        yoyo: true,
        repeat: 3,
        onComplete: () => this._flash.setAlpha(0.3),
      });
    }

    const headerColor = isFlatline ? '#ff2200' : COLORS.ECG_CORE;
    const headerText  = isFlatline ? 'PATIENT DECEASED' : 'PROCEDURE COMPLETE';

    // Header
    this.add.text(cx, 80, headerText, {
      fontFamily: 'monospace',
      fontSize:   '42px',
      color:      headerColor,
    }).setOrigin(0.5);

    // Flat line graphic for flatline
    if (isFlatline) {
      const g = this.add.graphics();
      g.lineStyle(2, 0x00ff88, 0.8);
      g.moveTo(50, 150);
      g.lineTo(SCREEN.WIDTH - 50, 150);
      g.strokePath();
    }

    // Death certificate box
    const boxX = cx - 260;
    const boxY = 170;
    const boxW = 520;
    const boxH = 280;

    const bg = this.add.graphics();
    bg.lineStyle(1, isFlatline ? 0xff2200 : 0x00ff88, 0.5);
    bg.strokeRect(boxX, boxY, boxW, boxH);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(boxX, boxY, boxW, boxH);

    const lineStyle = { fontFamily: 'monospace', fontSize: '14px', color: '#00aa55' };
    const valStyle  = { fontFamily: 'monospace', fontSize: '14px', color: COLORS.ECG_CORE };

    const timeStr = this._timestamp.toTimeString().split(' ')[0];
    const dateStr = this._timestamp.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase();

    const records = [
      ['PATIENT NAME',  this._patientName],
      ['DATE',          dateStr],
      isFlatline
        ? ['TIME OF DEATH', timeStr]
        : ['COMPLETION TIME', timeStr],
      ['CAUSE',         isFlatline ? 'CARDIAC ARREST' : 'SUCCESSFUL STABILIZATION'],
      ['─'.repeat(40), ''],
      ['SCORE',         String(this._stats.score)],
      ['PERFECT',       String(this._stats.perfects)],
      ['GOOD',          String(this._stats.goods)],
      ['MISS',          String(this._stats.misses)],
      ['MAX COMBO',     `×${this._stats.maxCombo}`],
    ];

    records.forEach(([label, value], i) => {
      if (label.startsWith('─')) {
        this.add.text(boxX + 20, boxY + 30 + i * 22, label, { ...lineStyle, color: '#003322' });
        return;
      }
      this.add.text(boxX + 20,  boxY + 30 + i * 22, label + ':', lineStyle);
      this.add.text(boxX + 280, boxY + 30 + i * 22, value,        valStyle);
    });

    // Buttons
    const btnY = 510;

    const retryBtn = this.add.text(cx - 140, btnY, '[ NEW PATIENT ]', {
      fontFamily: 'monospace', fontSize: '18px',
      color: '#000000', backgroundColor: isFlatline ? '#ff2200' : '#00ff88',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    retryBtn.on('pointerdown', () => this.scene.start('GameScene', {
      beatmap:     this._beatmap,
      patientName: this._patientName,
    }));

    const menuBtn = this.add.text(cx + 140, btnY, '[ MAIN MENU ]', {
      fontFamily: 'monospace', fontSize: '18px',
      color: COLORS.ECG_CORE, backgroundColor: '#001a0d',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));

    // Keyboard shortcuts
    this.input.keyboard.once('keydown-R', () => this.scene.start('GameScene', {
      beatmap:     this._beatmap,
      patientName: this._patientName,
    }));
    this.input.keyboard.once('keydown-M', () => this.scene.start('MenuScene'));

    this.add.text(cx, 560, '[R] retry  ·  [M] menu', {
      fontFamily: 'monospace', fontSize: '12px', color: '#005533',
    }).setOrigin(0.5);
  }
}
