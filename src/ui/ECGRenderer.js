import { SCREEN, PHYSICS } from '../config/Constants.js';

const BUFFER_SIZE = 512;

export class ECGRenderer {
  constructor(scene) {
    this._scene    = scene;
    this._graphics = scene.add.graphics();
    this._buffer   = new Float32Array(BUFFER_SIZE).fill(SCREEN.HEIGHT / 2);
    this._head     = 0;

    // Glitch state (set by ChaosEffects)
    this.glitchOffsetX = 0;
    this.glitchOffsetY = 0;
    this._flatline     = false;
  }

  update(physicsState, chaosLevel) {
    this._draw();
  }

  pushSample(pixelY) {
    const y = this._flatline ? SCREEN.HEIGHT / 2 : pixelY;
    this._buffer[this._head % BUFFER_SIZE] = y;
    this._head++;
  }

  _draw() {
    const g = this._graphics;
    g.clear();

    if (this._flatline) {
      this._drawFlatLine();
      return;
    }

    // ECG history fills from x=0 to JUDGMENT_X; newest sample is at the judgment cursor
    const W     = SCREEN.JUDGMENT_X;
    const xStep = W / BUFFER_SIZE;

    // Draw triple-pass glow
    const passes = [
      { width: 8, alpha: 0.12, color: 0x00ff88 },
      { width: 4, alpha: 0.35, color: 0x00ff88 },
      { width: 1, alpha: 1.0,  color: 0x00ff88 },
    ];

    for (const pass of passes) {
      g.lineStyle(pass.width, pass.color, pass.alpha);
      g.beginPath();

      for (let i = 0; i < BUFFER_SIZE; i++) {
        const idx = (this._head + i) % BUFFER_SIZE;
        const x   = i * xStep + this.glitchOffsetX;
        const y   = this._buffer[idx] + this.glitchOffsetY;

        if (i === 0) g.moveTo(x, y);
        else         g.lineTo(x, y);
      }
      g.strokePath();
    }

    // Cursor dot at judgment line showing current live position
    const currentY = this._buffer[(this._head - 1 + BUFFER_SIZE) % BUFFER_SIZE] + this.glitchOffsetY;
    const cx       = SCREEN.JUDGMENT_X + this.glitchOffsetX;
    g.lineStyle(4, 0x00ff88, 0.35);
    g.strokeCircle(cx, currentY, 7);
    g.lineStyle(1.5, 0x00ff88, 1.0);
    g.strokeCircle(cx, currentY, 4);
  }

  _drawFlatLine() {
    const g  = this._graphics;
    const cy = SCREEN.HEIGHT / 2;

    g.lineStyle(8, 0x00ff88, 0.10);
    g.beginPath(); g.moveTo(0, cy); g.lineTo(SCREEN.WIDTH, cy); g.strokePath();

    g.lineStyle(3, 0x00ff88, 0.5);
    g.beginPath(); g.moveTo(0, cy); g.lineTo(SCREEN.WIDTH, cy); g.strokePath();

    g.lineStyle(1, 0x00ff88, 1.0);
    g.beginPath(); g.moveTo(0, cy); g.lineTo(SCREEN.WIDTH, cy); g.strokePath();
  }

  setFlatline(active) {
    this._flatline = active;
  }

  destroy() {
    this._graphics.destroy();
  }
}
