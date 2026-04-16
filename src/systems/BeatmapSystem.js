export class BeatmapSystem {
  constructor(beatmap) {
    this._beatmap    = beatmap;
    this._beats      = beatmap.beats.slice().sort((a, b) => a.timeMs - b.timeMs);
    this._nextIndex  = 0;
    this._songTimeMs = 0;
  }

  update(songTimeMs) {
    this._songTimeMs = songTimeMs;
  }

  /** Returns the beat currently in or approaching evaluation window, or null */
  getActiveBeat(windowMs = 300) {
    const beat = this._beats[this._nextIndex];
    if (!beat) return null;
    const delta = beat.timeMs - this._songTimeMs;
    return delta <= windowMs ? beat : null;
  }

  /** Called by BeatEvaluator when a beat is judged (pass or miss) */
  advanceBeat() {
    this._nextIndex++;
  }

  isFinished() {
    return this._nextIndex >= this._beats.length;
  }

  getBeatmap()   { return this._beatmap; }
  getBeats()     { return this._beats; }
  getNextIndex() { return this._nextIndex; }

  /** Returns upcoming beats for the ghost line lookahead */
  getUpcomingBeats(lookaheadMs = 2000) {
    const result = [];
    for (let i = this._nextIndex; i < this._beats.length; i++) {
      const beat = this._beats[i];
      if (beat.timeMs - this._songTimeMs > lookaheadMs) break;
      result.push({ beat, msUntil: beat.timeMs - this._songTimeMs });
    }
    return result;
  }
}
