import { CHAOS, CHAOS_LEVELS } from '../config/Constants.js';
import { EventBus } from '../utils/EventBus.js';
import { clamp, lerp } from '../utils/MathUtils.js';

export class ChaosSystem {
  constructor() {
    this.chaosValue   = 0;
    this.currentLevel = 'STABLE';
    this.missStreak   = 0;
  }

  onBeatResult(result) {
    switch (result) {
      case 'PERFECT':
      case 'HOLD_COMPLETE':
        this.chaosValue += CHAOS.PERFECT_GAIN;
        this.missStreak  = 0;
        break;
      case 'GOOD':
        this.chaosValue += CHAOS.GOOD_GAIN;
        this.missStreak  = 0;
        break;
      case 'HOLD_BREAK':
      case 'MISS':
        this.missStreak++;
        this.chaosValue += CHAOS.MISS_BASE + (this.missStreak * CHAOS.MISS_STREAK);
        break;
    }

    this.chaosValue = clamp(this.chaosValue, 0, 100);
    this._updateLevel();
  }

  update(delta) {
    // Passive decay toward 0 (slower at higher chaos)
    const t = this.chaosValue / 100;
    const decayRate = lerp(CHAOS.PASSIVE_DECAY_MIN, CHAOS.PASSIVE_DECAY_MAX, t);
    this.chaosValue = Math.max(0, this.chaosValue - decayRate * (delta / 16.667));
    this._updateLevel();
  }

  _updateLevel() {
    const levels = ['FLATLINE', 'CRITICAL', 'DANGER', 'UNEASY', 'STABLE'];
    let newLevel = 'STABLE';

    for (const name of levels) {
      if (this.chaosValue >= CHAOS_LEVELS[name].threshold) {
        newLevel = name;
        break;
      }
    }

    if (newLevel !== this.currentLevel) {
      this.currentLevel = newLevel;
      EventBus.emit('chaos:levelChange', { level: newLevel, value: this.chaosValue });
      if (newLevel === 'FLATLINE') {
        EventBus.emit('chaos:flatline');
      }
    }
  }

  getLevel()  { return this.currentLevel; }
  getValue()  { return this.chaosValue; }

  getState() {
    return {
      value: this.chaosValue,
      level: this.currentLevel,
      missStreak: this.missStreak,
    };
  }

  reset() {
    this.chaosValue   = 0;
    this.currentLevel = 'STABLE';
    this.missStreak   = 0;
  }
}
