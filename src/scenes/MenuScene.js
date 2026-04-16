import Phaser from 'phaser';
import { SCREEN, COLORS }             from '../config/Constants.js';
import { keyBindings, keyCodeToName } from '../config/KeyBindings.js';

const DEMO_BEATMAP = {
  version: '1.0.0',
  meta: {
    id: 'demo_001',
    title: 'FLATLINE (Demo)',
    artist: 'Code Blue',
    bpm: 120,
    offset: 500,
    audioFile: null,
    author: 'manual',
  },
  timing: {
    baseBpm: 120,
    segments: [{ startMs: 0, bpm: 120 }],
  },
  beats: [
    // --- INTRO: one beat per second, learn the zones ---
    { id: 'b001', timeMs:  2000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b002', timeMs:  3000, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b003', timeMs:  4000, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b004', timeMs:  5000, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b005', timeMs:  6000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b006', timeMs:  7000, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b007', timeMs:  8000, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b008', timeMs:  9000, zone: 'UP',     intensity: 1.0, holdMs: 0 },

    // --- SECTION 1: 750ms gaps, introduces basic holds ---
    { id: 'b009', timeMs: 11000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b010', timeMs: 11750, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b011', timeMs: 12500, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b012', timeMs: 13250, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b013', timeMs: 14000, zone: 'UP',     intensity: 1.0, holdMs: 600 },
    { id: 'b014', timeMs: 15300, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b015', timeMs: 16100, zone: 'DOWN',   intensity: 1.0, holdMs: 700 },
    { id: 'b016', timeMs: 17500, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b017', timeMs: 18300, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b018', timeMs: 19100, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b019', timeMs: 19900, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },

    // --- SECTION 2: 750-800ms gaps, segmented hold debut ---
    { id: 'b020', timeMs: 21500, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b021', timeMs: 22300, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b022', timeMs: 23100, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b023', timeMs: 23900, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b024', timeMs: 24700, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b025', timeMs: 25500, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    // Segmented hold (TOTAL transition): D → SPC at 1400ms (completely switch keys)
    { id: 'b026', timeMs: 26500, zone: 'DOWN',   intensity: 1.0, holdMs: 2600,
      holdSegments: [
        { offsetMs:    0, zone: 'DOWN',   keys: ['down']   },
        { offsetMs: 1400, zone: 'CENTER', keys: ['center'] },
      ]
    },
    { id: 'b027', timeMs: 29000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b028', timeMs: 29800, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b029', timeMs: 30600, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b030', timeMs: 31400, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b031', timeMs: 32200, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },

    // --- SECTION 3: climax, 500ms, then 3-segment hold finale ---
    { id: 'b032', timeMs: 34000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b033', timeMs: 34500, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b034', timeMs: 35000, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b035', timeMs: 35500, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b036', timeMs: 36000, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b037', timeMs: 36500, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b038', timeMs: 37000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b039', timeMs: 37500, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    // 3-segment hold mixing PARTIAL and TOTAL transitions:
    // SPC → SPC+A (partial: add A) → SPC (partial: release A) → D (total: switch to D)
    // Segmented hold (PARTIAL then TOTAL): SPC → SPC+A (partial add A) → D (total switch)
    { id: 'b040', timeMs: 38500, zone: 'CENTER', intensity: 0.8, holdMs: 3400,
      holdSegments: [
        { offsetMs:    0, zone: 'CENTER', keys: ['center']        },  // hold SPACE
        { offsetMs: 1400, zone: 'UP',     keys: ['center', 'up']  },  // partial: add A
        { offsetMs: 2600, zone: 'DOWN',   keys: ['down']          },  // total: switch to D
      ]
    },
    { id: 'b041', timeMs: 41300, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b042', timeMs: 41800, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b043', timeMs: 42300, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b044', timeMs: 42800, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b045', timeMs: 43300, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b046', timeMs: 43800, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b047', timeMs: 44300, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b048', timeMs: 44800, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b049', timeMs: 45300, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
  ],
  events: [],
};

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this._patientName = 'JOHN DOE';
  }

  create() {
    const cx = SCREEN.WIDTH  / 2;
    const cy = SCREEN.HEIGHT / 2;

    // Background scanline effect
    this._drawScanlines();

    // Title
    this.add.text(cx, 120, 'CODE BLUE', {
      fontFamily: 'monospace',
      fontSize:   '64px',
      color:      COLORS.ECG_CORE,
      stroke:     '#003322',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(cx, 180, 'CARDIAC RHYTHM PROCEDURE', {
      fontFamily: 'monospace',
      fontSize:   '16px',
      color:      '#00aa55',
    }).setOrigin(0.5);

    // Track info box
    this._drawBox(cx - 220, 240, 440, 120);

    this.add.text(cx, 270, DEMO_BEATMAP.meta.title, {
      fontFamily: 'monospace',
      fontSize:   '22px',
      color:      COLORS.ECG_CORE,
    }).setOrigin(0.5);

    this.add.text(cx, 300, `${DEMO_BEATMAP.meta.bpm} BPM  ·  ${DEMO_BEATMAP.beats.length} BEATS  ·  DEMO`, {
      fontFamily: 'monospace',
      fontSize:   '13px',
      color:      '#00aa55',
    }).setOrigin(0.5);

    // Patient name display
    this.add.text(cx, 345, `PATIENT: ${this._patientName}`, {
      fontFamily: 'monospace',
      fontSize:   '13px',
      color:      '#007744',
    }).setOrigin(0.5);

    // Controls reminder — reads from current keybindings
    this._drawBox(cx - 200, 390, 400, 90);
    this.add.text(cx, 408, 'CONTROLS', {
      fontFamily: 'monospace', fontSize: '13px', color: '#007744',
    }).setOrigin(0.5);
    this._drawControlsHint(cx, 430);
    this.add.text(cx, 468, 'Misses accumulate chaos — reach 100% = FLATLINE', {
      fontFamily: 'monospace', fontSize: '11px', color: '#005533',
    }).setOrigin(0.5);

    // Primary start button
    const startBtn = this.add.text(cx, 545, '[ START PROCEDURE ]', {
      fontFamily: 'monospace', fontSize: '26px',
      color: '#000000', backgroundColor: '#00ff88',
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerover',  () => startBtn.setStyle({ backgroundColor: '#00ffaa' }));
    startBtn.on('pointerout',   () => startBtn.setStyle({ backgroundColor: '#00ff88' }));
    startBtn.on('pointerdown',  () => this._startGame());
    this.input.keyboard.once('keydown-ENTER', () => this._startGame());

    // Secondary buttons row (4 buttons at ±300 and ±100 around center)
    const secondaryBtns = [
      { label: '[ TUTORIAL ]',      scene: 'TutorialScene', x: cx - 300 },
      { label: '[ LOAD TRACK ]',    scene: 'AnalysisScene', x: cx - 100 },
      { label: '[ TRACK LIBRARY ]', scene: 'LibraryScene',  x: cx + 100 },
      { label: '[ KEY BINDINGS ]',  scene: 'KeyBindScene',  x: cx + 300 },
    ];

    secondaryBtns.forEach(({ label, scene, x }) => {
      const btn = this.add.text(x, 615, label, {
        fontFamily: 'monospace', fontSize: '14px',
        color: COLORS.ECG_CORE, backgroundColor: '#001a0d',
        padding: { x: 10, y: 7 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerover',  () => btn.setAlpha(0.75));
      btn.on('pointerout',   () => btn.setAlpha(1));
      btn.on('pointerdown',  () => this.scene.start(scene, { patientName: this._patientName }));
    });

    // Pulse on main button
    this.tweens.add({
      targets: startBtn,
      scaleX: 1.03, scaleY: 1.03,
      duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  _startGame() {
    this.scene.start('GameScene', {
      beatmap:     DEMO_BEATMAP,
      patientName: this._patientName,
    });
  }

  _drawControlsHint(cx, y) {
    const up     = keyCodeToName(keyBindings.get('LINE_UP'));
    const down   = keyCodeToName(keyBindings.get('LINE_DOWN'));
    const center = keyCodeToName(keyBindings.get('CENTER_HOLD'));
    this.add.text(cx, y,
      `[${up}] UP   [${down}] DOWN   [${center}] CENTER HOLD`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#005533',
    }).setOrigin(0.5);
  }

  _drawBox(x, y, w, h) {
    const g = this.add.graphics();
    g.lineStyle(1, 0x00ff88, 0.3);
    g.strokeRect(x, y, w, h);
    g.fillStyle(0x001a0d, 0.4);
    g.fillRect(x, y, w, h);
  }

  _drawScanlines() {
    const g = this.add.graphics();
    g.lineStyle(1, 0x00ff88, 0.03);
    for (let y = 0; y < SCREEN.HEIGHT; y += 4) {
      g.moveTo(0, y);
      g.lineTo(SCREEN.WIDTH, y);
    }
    g.strokePath();
  }
}
