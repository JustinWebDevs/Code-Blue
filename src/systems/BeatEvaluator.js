import { TIMING_WINDOWS, SCORE, HOLD } from '../config/Constants.js';
import { EventBus } from '../utils/EventBus.js';

export class BeatEvaluator {
  constructor(beatmapSystem, ecgPhysics) {
    this._beatmapSystem    = beatmapSystem;
    this._ecgPhysics       = ecgPhysics;

    this._activeWindow     = null;   // beat currently open for evaluation
    this._holdState        = null;   // { beat, startMs, endMs } when hold is active
    this._currentSongTimeMs = 0;

    this._stats = {
      score:    0,
      perfects: 0,
      goods:    0,
      misses:   0,
      combo:    0,
      maxCombo: 0,
    };
  }

  update(songTimeMs) {
    this._currentSongTimeMs = songTimeMs;

    // ── Hold phase: check if player is still holding the zone ──
    if (this._holdState) {
      this._updateHold(songTimeMs);
      return;
    }

    if (this._beatmapSystem.isFinished()) return;

    const beat = this._beatmapSystem.getActiveBeat(TIMING_WINDOWS.GOOD + 20);
    if (!beat) return;

    const delta = songTimeMs - beat.timeMs; // negative = early

    // Open the evaluation window when beat is near
    if (delta >= -(TIMING_WINDOWS.GOOD + 20)) {
      this._activeWindow = beat;
    }
    if (!this._activeWindow) return;

    // ── CENTER notes: position-based evaluation ──
    if (beat.zone === 'CENTER') {
      const absDelta = Math.abs(delta);
      if (this._ecgPhysics.getZone() === 'CENTER') {
        if (absDelta <= TIMING_WINDOWS.PERFECT) {
          this._judge('PERFECT', beat);
          return;
        }
        if (delta > TIMING_WINDOWS.PERFECT && delta <= TIMING_WINDOWS.GOOD) {
          this._judge('GOOD', beat);
          return;
        }
      }
      // Window expired
      if (delta > TIMING_WINDOWS.GOOD) {
        this._judge('MISS', beat);
      }
      return;
    }

    // ── UP / DOWN notes: crossing mechanic ──
    // Score when the ECG line enters the target zone this frame
    if (this._ecgPhysics.didEnterZone(beat.zone)) {
      const absDelta = Math.abs(delta);
      if (absDelta <= TIMING_WINDOWS.PERFECT) {
        this._judge('PERFECT', beat);
      } else if (absDelta <= TIMING_WINDOWS.GOOD) {
        this._judge('GOOD', beat);
      }
      // Crossing outside timing window: don't judge, wait for expiry or another crossing
      return;
    }

    // Window expired — miss
    if (delta > TIMING_WINDOWS.GOOD) {
      this._judge('MISS', beat);
    }
  }

  // ── Hold update: called each frame while _holdState is active ──
  _updateHold(songTimeMs) {
    const { beat, startMs } = this._holdState;
    const elapsed  = songTimeMs - startMs;
    const progress = Math.min(elapsed / beat.holdMs, 1.0);

    // Player left the zone?
    if (this._ecgPhysics.getZone() !== beat.zone) {
      const partial = progress > 0.30;
      this._finishHold(partial ? 'HOLD_BREAK' : 'MISS', beat, progress);
      return;
    }

    // Hold complete
    if (progress >= 1.0) {
      this._finishHold('HOLD_COMPLETE', beat, 1.0);
    }
  }

  _finishHold(result, beat, progress) {
    this._holdState = null;

    // Resolve combo: HOLD_COMPLETE continues the streak, HOLD_BREAK/MISS resets it
    if (result === 'HOLD_COMPLETE') {
      this._stats.score += Math.floor(this._holdBaseScore * HOLD.COMPLETE_BONUS);
      this._stats.combo++;
    } else {
      // HOLD_BREAK or MISS — break the combo
      this._stats.combo = 0;
    }

    this._stats.score    = Math.floor(this._stats.score);
    this._stats.maxCombo = Math.max(this._stats.maxCombo, this._stats.combo);
    this._beatmapSystem.advanceBeat();
    EventBus.emit('beat:evaluated', { result, beat, progress, stats: { ...this._stats } });
  }

  _judge(result, beat) {
    let baseScore = 0;
    switch (result) {
      case 'PERFECT':
        baseScore = Math.floor(SCORE.PERFECT_BASE * (1 + this._stats.combo * 0.1));
        this._stats.score += baseScore;
        this._stats.perfects++;
        // Don't touch combo yet for holds — _finishHold will resolve it
        if (beat.holdMs === 0) this._stats.combo++;
        break;
      case 'GOOD':
        baseScore = Math.floor(SCORE.GOOD_BASE * (1 + this._stats.combo * 0.05));
        this._stats.score += baseScore;
        this._stats.goods++;
        if (beat.holdMs === 0) this._stats.combo++;
        break;
      case 'MISS':
        this._stats.misses++;
        this._stats.combo = 0;
        break;
    }

    this._stats.score    = Math.floor(this._stats.score);
    this._stats.maxCombo = Math.max(this._stats.maxCombo, this._stats.combo);

    // If this beat has a hold and wasn't missed, enter hold phase
    if (beat.holdMs > 0 && result !== 'MISS') {
      this._holdBaseScore = baseScore;
      this._holdState     = { beat, startMs: this._currentSongTimeMs };
      this._activeWindow  = null;
      // Emit the strike result immediately (shows PERFECT/GOOD flash)
      EventBus.emit('beat:evaluated', { result, beat, stats: { ...this._stats } });
      return;
    }

    this._activeWindow = null;
    this._beatmapSystem.advanceBeat();
    EventBus.emit('beat:evaluated', { result, beat, stats: { ...this._stats } });
  }

  /** Returns current hold progress for GhostLine: { beat, progress 0–1, zone } or null */
  getHoldState() {
    if (!this._holdState) return null;
    const { beat, startMs } = this._holdState;
    const progress = Math.min((this._currentSongTimeMs - startMs) / beat.holdMs, 1.0);
    return { beat, progress, zone: beat.zone };
  }

  getStats()   { return { ...this._stats }; }
  isFinished() { return this._beatmapSystem.isFinished(); }

  reset() {
    this._activeWindow      = null;
    this._holdState         = null;
    this._holdBaseScore     = 0;
    this._currentSongTimeMs = 0;
    this._stats = { score: 0, perfects: 0, goods: 0, misses: 0, combo: 0, maxCombo: 0 };
  }
}
