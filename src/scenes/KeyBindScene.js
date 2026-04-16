import Phaser from 'phaser';
import { SCREEN, COLORS } from '../config/Constants.js';
import { ACTIONS, keyBindings, keyCodeToName } from '../config/KeyBindings.js';

const STYLE_LABEL = { fontFamily: 'monospace', fontSize: '16px', color: '#00aa55' };
const STYLE_KEY   = { fontFamily: 'monospace', fontSize: '16px', color: COLORS.ECG_CORE,
                      backgroundColor: '#001a0d', padding: { x: 12, y: 6 } };
const STYLE_WAIT  = { fontFamily: 'monospace', fontSize: '16px', color: '#ffff00',
                      backgroundColor: '#1a1400', padding: { x: 12, y: 6 } };

export class KeyBindScene extends Phaser.Scene {
  constructor() {
    super({ key: 'KeyBindScene' });
    this._waiting  = null;   // action being rebound
    this._keyTexts = {};     // action → Phaser Text object
  }

  create() {
    const cx = SCREEN.WIDTH  / 2;
    const cy = SCREEN.HEIGHT / 2;

    // Background
    const g = this.add.graphics();
    g.fillStyle(0x000000, 1);
    g.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);
    g.lineStyle(1, 0x00ff88, 0.04);
    for (let y = 0; y < SCREEN.HEIGHT; y += 4) {
      g.moveTo(0, y); g.lineTo(SCREEN.WIDTH, y);
    }
    g.strokePath();

    // Header
    this.add.text(cx, 90, 'KEY BINDINGS', {
      fontFamily: 'monospace', fontSize: '36px', color: COLORS.ECG_CORE,
      stroke: '#003322', strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(cx, 140, 'Click an action · Press the new key · ESC to cancel', {
      fontFamily: 'monospace', fontSize: '13px', color: '#005533',
    }).setOrigin(0.5);

    // Border box
    const bx = cx - 280, bw = 560, bh = 260;
    const by = 190;
    const box = this.add.graphics();
    box.lineStyle(1, 0x00ff88, 0.3);
    box.strokeRect(bx, by, bw, bh);
    box.fillStyle(0x001a0d, 0.35);
    box.fillRect(bx, by, bw, bh);

    // Rows for each action
    const actions = Object.entries(ACTIONS);
    actions.forEach(([action, meta], i) => {
      const y = by + 50 + i * 72;
      this.add.text(bx + 30, y, meta.label, STYLE_LABEL).setOrigin(0, 0.5);

      const keyText = this.add.text(bx + bw - 30, y, keyCodeToName(keyBindings.get(action)), STYLE_KEY)
        .setOrigin(1, 0.5)
        .setInteractive({ useHandCursor: true });

      keyText.on('pointerover',  () => { if (this._waiting !== action) keyText.setAlpha(0.75); });
      keyText.on('pointerout',   () => keyText.setAlpha(1));
      keyText.on('pointerdown',  () => this._startRebind(action));

      this._keyTexts[action] = keyText;
    });

    // Reset button
    const resetBtn = this.add.text(cx - 130, 510, '[ RESET DEFAULTS ]', {
      fontFamily: 'monospace', fontSize: '15px', color: '#ff4400',
      backgroundColor: '#110000', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    resetBtn.on('pointerdown', () => {
      keyBindings.reset();
      this._waiting = null;
      for (const [action, text] of Object.entries(this._keyTexts)) {
        text.setText(keyCodeToName(keyBindings.get(action)));
        text.setStyle(STYLE_KEY);
      }
    });

    // Back button
    const backBtn = this.add.text(cx + 130, 510, '[ BACK TO MENU ]', {
      fontFamily: 'monospace', fontSize: '15px', color: COLORS.ECG_CORE,
      backgroundColor: '#001a0d', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('MenuScene'));

    // Keyboard shortcuts
    this.add.text(cx, 570, '[ESC] cancel rebind  ·  [BACKSPACE] back to menu', {
      fontFamily: 'monospace', fontSize: '11px', color: '#004422',
    }).setOrigin(0.5);

    // Global keydown listener for rebinding
    this._onKeyDown = this._handleKeyDown.bind(this);
    this.input.keyboard.on('keydown', this._onKeyDown);
    this.input.keyboard.once('keydown-BACKSPACE', () => this.scene.start('MenuScene'));
  }

  _startRebind(action) {
    // Cancel previous waiting state
    if (this._waiting) {
      this._keyTexts[this._waiting].setText(keyCodeToName(keyBindings.get(this._waiting)));
      this._keyTexts[this._waiting].setStyle(STYLE_KEY);
    }

    this._waiting = action;
    this._keyTexts[action].setText('PRESS A KEY...');
    this._keyTexts[action].setStyle(STYLE_WAIT);

    // Pulse animation
    this.tweens.add({
      targets: this._keyTexts[action],
      alpha: 0.4,
      duration: 350,
      yoyo: true,
      repeat: -1,
    });
  }

  _handleKeyDown(event) {
    if (!this._waiting) return;

    if (event.keyCode === 27) {
      // ESC — cancel without rebinding
      const action = this._waiting;
      this._waiting = null;
      this.tweens.killTweensOf(this._keyTexts[action]);
      this._keyTexts[action].setText(keyCodeToName(keyBindings.get(action)));
      this._keyTexts[action].setStyle(STYLE_KEY).setAlpha(1);
      return;
    }

    const action = this._waiting;
    this._waiting = null;
    this.tweens.killTweensOf(this._keyTexts[action]);

    keyBindings.set(action, event.keyCode);
    this._keyTexts[action].setText(keyCodeToName(event.keyCode));
    this._keyTexts[action].setStyle(STYLE_KEY).setAlpha(1);
  }

  shutdown() {
    this.input.keyboard.off('keydown', this._onKeyDown);
  }
}
