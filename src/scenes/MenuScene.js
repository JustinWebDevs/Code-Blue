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

    // --- SECTION 1: 500ms beat, smooth patterns ---
    { id: 'b009', timeMs: 11000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b010', timeMs: 11500, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b011', timeMs: 12000, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b012', timeMs: 12500, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b013', timeMs: 13000, zone: 'UP',     intensity: 1.0, holdMs: 600 },
    { id: 'b014', timeMs: 13700, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b015', timeMs: 14200, zone: 'DOWN',   intensity: 1.0, holdMs: 700 },
    { id: 'b016', timeMs: 15000, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b017', timeMs: 15000, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b018', timeMs: 15500, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b019', timeMs: 16000, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b020', timeMs: 16500, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b021', timeMs: 17000, zone: 'DOWN',   intensity: 1.0, holdMs: 750 },
    { id: 'b022', timeMs: 17900, zone: 'CENTER', intensity: 0.8, holdMs: 500 },
    { id: 'b023', timeMs: 18550, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b024', timeMs: 18500, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b025', timeMs: 19000, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b026', timeMs: 19500, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },

    // --- SECTION 2: mixed gaps, more unpredictable ---
    { id: 'b027', timeMs: 21000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b028', timeMs: 21750, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b029', timeMs: 22500, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b030', timeMs: 23000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b031', timeMs: 23500, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b032', timeMs: 24000, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b033', timeMs: 24500, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b034', timeMs: 25000, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b035', timeMs: 25500, zone: 'UP',     intensity: 1.0, holdMs: 600 },
    { id: 'b036', timeMs: 26300, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b037', timeMs: 26500, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b038', timeMs: 27000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b039', timeMs: 27500, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b040', timeMs: 28000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b041', timeMs: 28500, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b042', timeMs: 29000, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b043', timeMs: 29500, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b044', timeMs: 30000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b045', timeMs: 30500, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b046', timeMs: 31000, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b047', timeMs: 31500, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b048', timeMs: 32000, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },

    // --- SECTION 3: climax, dense and demanding ---
    { id: 'b049', timeMs: 33500, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b050', timeMs: 34000, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b051', timeMs: 34500, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b052', timeMs: 35000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b053', timeMs: 35500, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b054', timeMs: 36000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b055', timeMs: 36500, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b056', timeMs: 37000, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b057', timeMs: 37500, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b058', timeMs: 38000, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b059', timeMs: 38500, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b060', timeMs: 39000, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b061', timeMs: 39500, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b062', timeMs: 40000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b063', timeMs: 40500, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b064', timeMs: 41000, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b065', timeMs: 41500, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b066', timeMs: 42000, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b067', timeMs: 42500, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
    { id: 'b068', timeMs: 43000, zone: 'UP',     intensity: 1.0, holdMs: 0 },
    { id: 'b069', timeMs: 43500, zone: 'DOWN',   intensity: 1.0, holdMs: 0 },
    { id: 'b070', timeMs: 44000, zone: 'CENTER', intensity: 0.8, holdMs: 0 },
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

    // Secondary buttons row
    const secondaryBtns = [
      { label: '[ LOAD TRACK ]',    scene: 'AnalysisScene', x: cx - 220 },
      { label: '[ TRACK LIBRARY ]', scene: 'LibraryScene',  x: cx       },
      { label: '[ KEY BINDINGS ]',  scene: 'KeyBindScene',  x: cx + 220 },
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
    const freeze = keyCodeToName(keyBindings.get('FREEZE'));
    this.add.text(cx, y,
      `[${up}] UP   [${down}] DOWN   [${freeze}] FREEZE`, {
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
