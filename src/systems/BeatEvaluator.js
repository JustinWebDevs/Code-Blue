import { TIMING_WINDOWS, SCORE, HOLD } from '../config/Constants.js';
import { EventBus } from '../utils/EventBus.js';

/**
 * Returns the default required keys for a segment zone.
 * A segment may override this by providing an explicit `keys` array.
 * Key names match InputSystem.getState(): 'up', 'down', 'center'.
 */
function defaultKeysForZone(zone) {
  if (zone === 'UP')     return ['up'];
  if (zone === 'DOWN')   return ['down'];
  if (zone === 'CENTER') return ['center'];
  return [];
}

export class BeatEvaluator {
  constructor(beatmapSystem, ecgPhysics) {
    this._beatmapSystem    = beatmapSystem;
    this._ecgPhysics       = ecgPhysics;

    this._activeWindow     = null;
    this._holdState        = null;   // { beat, startMs, segmentIdx, segmentChangedMs }
    this._holdBaseScore    = 0;
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

    // ── Hold phase ──
    if (this._holdState) {
      this._updateHold(songTimeMs);
      this._skipExpiredBeats(songTimeMs);
      return;
    }

    if (this._beatmapSystem.isFinished()) return;

    const beat = this._beatmapSystem.getActiveBeat(TIMING_WINDOWS.GOOD + 20);
    if (!beat) return;

    const delta = songTimeMs - beat.timeMs;

    if (delta >= -(TIMING_WINDOWS.GOOD + 20)) {
      this._activeWindow = beat;
    }
    if (!this._activeWindow) return;

    // ── CENTER notes: position-based ──
    if (beat.zone === 'CENTER') {
      const absDelta = Math.abs(delta);
      if (this._ecgPhysics.getZone() === 'CENTER') {
        if (absDelta <= TIMING_WINDOWS.PERFECT) { this._judge('PERFECT', beat); return; }
        if (delta > TIMING_WINDOWS.PERFECT && delta <= TIMING_WINDOWS.GOOD) {
          this._judge('GOOD', beat); return;
        }
      }
      if (delta > TIMING_WINDOWS.GOOD) this._judge('MISS', beat);
      return;
    }

    // ── UP / DOWN notes: crossing mechanic ──
    if (this._ecgPhysics.didEnterZone(beat.zone)) {
      const absDelta = Math.abs(delta);
      if (absDelta <= TIMING_WINDOWS.PERFECT)     this._judge('PERFECT', beat);
      else if (absDelta <= TIMING_WINDOWS.GOOD)   this._judge('GOOD', beat);
      return;
    }

    if (delta > TIMING_WINDOWS.GOOD) this._judge('MISS', beat);
  }

  // ── Hold update ──
  _updateHold(songTimeMs) {
    const { beat, startMs } = this._holdState;
    const elapsed  = songTimeMs - startMs;
    const progress = Math.min(elapsed / beat.holdMs, 1.0);

    const segments = this._getSegments(beat);

    // Advance segment index when its time arrives
    while (
      this._holdState.segmentIdx + 1 < segments.length &&
      elapsed >= segments[this._holdState.segmentIdx + 1].offsetMs
    ) {
      this._holdState.segmentIdx++;
      this._holdState.segmentChangedMs = songTimeMs;
      EventBus.emit('hold:segmentChange', {
        beat,
        segmentIdx: this._holdState.segmentIdx,
        zone: segments[this._holdState.segmentIdx].zone,
      });
    }

    const currentSeg  = segments[this._holdState.segmentIdx];
    const requiredKeys = this._requiredKeys(currentSeg);

    const inZone  = this._ecgPhysics.getZone() === currentSeg.zone;
    const keysOk  = requiredKeys.every(k => this._ecgPhysics.isKeyHeld(k));

    // Grace window right after a segment transition — give the player time to switch inputs
    const graceElapsed = songTimeMs - this._holdState.segmentChangedMs;
    const inGrace      = graceElapsed < HOLD.TRANSITION_GRACE_MS;

    if (!inZone || !keysOk) {
      if (inGrace) return; // still transitioning — don't break yet
      this._finishHold(progress > 0.30 ? 'HOLD_BREAK' : 'MISS', beat, progress);
      return;
    }

    if (progress >= 1.0) {
      this._finishHold('HOLD_COMPLETE', beat, 1.0);
    }
  }

  // Skip beats whose window expired while we were locked in hold phase
  _skipExpiredBeats(songTimeMs) {
    let beat = this._beatmapSystem.peekBeat();
    while (beat && this._holdState && beat !== this._holdState.beat) {
      if (songTimeMs - beat.timeMs > TIMING_WINDOWS.GOOD) {
        this._beatmapSystem.advanceBeat();
        beat = this._beatmapSystem.peekBeat();
      } else {
        break;
      }
    }
  }

  _finishHold(result, beat, progress) {
    this._holdState = null;

    if (result === 'HOLD_COMPLETE') {
      this._stats.score += Math.floor(this._holdBaseScore * HOLD.COMPLETE_BONUS);
      this._stats.combo++;
    } else {
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

    if (beat.holdMs > 0 && result !== 'MISS') {
      this._holdBaseScore = baseScore;
      this._holdState     = {
        beat,
        startMs:          this._currentSongTimeMs,
        segmentIdx:       0,
        segmentChangedMs: this._currentSongTimeMs,
      };
      this._activeWindow = null;
      EventBus.emit('beat:evaluated', { result, beat, stats: { ...this._stats } });
      return;
    }

    this._activeWindow = null;
    this._beatmapSystem.advanceBeat();
    EventBus.emit('beat:evaluated', { result, beat, stats: { ...this._stats } });
  }

  /** Required input keys for a segment (uses explicit `keys` array or zone default). */
  _requiredKeys(seg) {
    if (seg.keys?.length) return seg.keys;
    return defaultKeysForZone(seg.zone);
  }

  /** Returns hold segments; falls back to a single-segment array for simple holds. */
  _getSegments(beat) {
    if (beat.holdSegments?.length) return beat.holdSegments;
    return [{ offsetMs: 0, zone: beat.zone }];
  }

  /**
   * Returns current hold state for GhostLine.
   * Includes segmentChangedMs so the renderer can show the grace-window indicator.
   */
  getHoldState() {
    if (!this._holdState) return null;
    const { beat, startMs, segmentIdx, segmentChangedMs } = this._holdState;
    const progress = Math.min((this._currentSongTimeMs - startMs) / beat.holdMs, 1.0);
    const segments = this._getSegments(beat);
    const zone     = segments[segmentIdx].zone;
    return { beat, progress, zone, segmentIdx, segmentChangedMs };
  }

  getStats()   { return { ...this._stats }; }
  isFinished() { return this._beatmapSystem.isFinished(); }

  reset() {
    this._activeWindow       = null;
    this._holdState          = null;
    this._holdBaseScore      = 0;
    this._currentSongTimeMs  = 0;
    this._stats = { score: 0, perfects: 0, goods: 0, misses: 0, combo: 0, maxCombo: 0 };
  }
}
