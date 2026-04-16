import { PHYSICS, ECG_ZONES } from '../config/Constants.js';
import { clamp } from '../utils/MathUtils.js';

export class ECGPhysics {
  constructor() {
    this.position      = 0;   // -1.0 (top) to +1.0 (bottom), 0 = center
    this.velocity      = 0;
    this._prevPosition = 0;
    this._lastInput    = null;
    this._holdTarget   = null;  // normalized zone-center position during holds

    // Noise overlay for chaos effects (set externally)
    this.noiseAmplitude = 0;
  }

  /**
   * During an active hold the spring blends the player's input target with the
   * zone centre, keeping the ECG line visually "inside" the hold band.
   */
  setHoldZone(zone) {
    if (zone === 'UP')        this._holdTarget = -0.83;
    else if (zone === 'DOWN') this._holdTarget =  0.83;
    else                      this._holdTarget =  0.0;   // CENTER
  }

  clearHoldZone() {
    this._holdTarget = null;
  }

  update(delta, inputState) {
    this._prevPosition = this.position;   // save before physics step
    this._lastInput    = inputState;
    const dt = delta / 16.667; // normalize to 60fps units

    // Determine spring target from input
    let target = 0.0;
    if (inputState.up)        target = -1.0;
    else if (inputState.down) target =  1.0;
    // else target stays 0.0 (spring returns to center)

    // During a hold: blend toward zone centre so the line stays inside the band
    if (this._holdTarget !== null) {
      target = target * 0.5 + this._holdTarget * 0.5;
    }

    // Spring: pull velocity toward target
    const springForce = (target - this.position) * PHYSICS.SPRING_STIFFNESS * dt;
    this.velocity += springForce;

    // Damping (frame-rate aware)
    this.velocity *= Math.pow(PHYSICS.DAMPING, dt);

    // Integrate
    this.position += this.velocity * dt;
    this.position = clamp(this.position, -1.0, 1.0);
  }

  /** Returns true if the Space (CENTER_HOLD) key is currently held. */
  isCenterHeld() {
    return this._lastInput?.center ?? false;
  }

  /**
   * Returns true if the given input key is currently held.
   * Key names match InputSystem.getState(): 'up', 'down', 'center'.
   */
  isKeyHeld(key) {
    return this._lastInput?.[key] ?? false;
  }

  /** Returns the pixel Y position for the line center */
  getPixelY(screenHeight) {
    const noise = this.noiseAmplitude > 0
      ? (Math.random() * 2 - 1) * this.noiseAmplitude
      : 0;
    return (screenHeight / 2) + (this.position * PHYSICS.ECG_AMPLITUDE_PX) + noise;
  }

  /** Returns 'UP' | 'CENTER' | 'DOWN' */
  getZone() {
    const p = this.position;
    if (p <= ECG_ZONES.UP.max)                                 return 'UP';
    if (p >= ECG_ZONES.DOWN.min)                               return 'DOWN';
    return 'CENTER';
  }

  /** Returns true if the ECG line entered `zone` this frame (was outside last frame) */
  didEnterZone(zone) {
    const prev = this._zoneOf(this._prevPosition);
    return this.getZone() === zone && prev !== zone;
  }

  _zoneOf(p) {
    if (p <= ECG_ZONES.UP.max)   return 'UP';
    if (p >= ECG_ZONES.DOWN.min) return 'DOWN';
    return 'CENTER';
  }

  getState() {
    return {
      position: this.position,
      velocity: this.velocity,
      zone:     this.getZone(),
    };
  }

  reset() {
    this.position       = 0;
    this.velocity       = 0;
    this._prevPosition  = 0;
    this._lastInput     = null;
    this.noiseAmplitude = 0;
    this._holdTarget    = null;
  }
}
