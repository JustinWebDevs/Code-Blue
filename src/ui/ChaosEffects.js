import { SCREEN } from '../config/Constants.js';
import { randomRange } from '../utils/MathUtils.js';

export class ChaosEffects {
  constructor(scene, chaosSystem, ecgPhysics, ecgRenderer) {
    this._scene      = scene;
    this._chaos      = chaosSystem;
    this._physics    = ecgPhysics;
    this._renderer   = ecgRenderer;

    this._overlay = scene.add.rectangle(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT, 0xff0000)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(10);

    this._glitchTimer = 0;
    this._flashTimer  = 0;
    this._isFlatline  = false;
  }

  update(delta) {
    const level = this._chaos.getLevel();
    const value = this._chaos.getValue();

    // Reset noise
    this._physics.noiseAmplitude = 0;
    this._renderer.glitchOffsetX = 0;
    this._renderer.glitchOffsetY = 0;

    switch (level) {
      case 'UNEASY':
        this._physics.noiseAmplitude = 2;
        this._overlay.setAlpha(0);
        break;

      case 'DANGER':
        this._physics.noiseAmplitude = 5;
        this._glitchTimer += delta;
        if (this._glitchTimer > 400) {
          this._glitchTimer = 0;
          this._renderer.glitchOffsetX = randomRange(-4, 4);
        }
        this._overlay.setAlpha(0);
        break;

      case 'CRITICAL':
        this._physics.noiseAmplitude = 12;
        this._renderer.glitchOffsetY = randomRange(-3, 3);
        this._renderer.glitchOffsetX = randomRange(-8, 8);
        // Subtle red tint
        this._overlay.setAlpha(0.05 + (value - 75) / 100 * 0.1);
        break;

      case 'FLATLINE':
        if (!this._isFlatline) {
          this._isFlatline = true;
          this._startFlatline();
        }
        this._flashTimer += delta;
        const flashAlpha = 0.15 + 0.15 * Math.sin(this._flashTimer * 0.008);
        this._overlay.setAlpha(flashAlpha);
        this._renderer.setFlatline(true);
        break;

      default: // STABLE
        this._overlay.setAlpha(0);
        this._isFlatline = false;
        break;
    }
  }

  _startFlatline() {
    this._scene.tweens.add({
      targets:  this._overlay,
      alpha:    0.3,
      duration: 300,
      yoyo:     true,
      repeat:   2,
    });
  }

  destroy() {
    this._overlay.destroy();
  }
}
