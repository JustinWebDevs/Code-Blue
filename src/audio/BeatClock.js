/**
 * BeatClock — pure query utility, no internal timers.
 * All timing is derived from songTimeMs provided externally
 * (sourced from AudioManager.getCurrentTime()).
 */
export class BeatClock {
  constructor(beatmap) {
    this._segments = beatmap.timing.segments;
    this._offset   = beatmap.meta.offset || 0;
  }

  /** Returns BPM effective at a given song time */
  getBpmAt(songTimeMs) {
    let bpm = this._segments[0].bpm;
    for (const seg of this._segments) {
      if (songTimeMs >= seg.startMs) bpm = seg.bpm;
      else break;
    }
    return bpm;
  }

  /** Beat phase: 0.0 = beat start, 1.0 = next beat */
  getPhase(songTimeMs) {
    const bpm = this.getBpmAt(songTimeMs);
    const msPerBeat = 60000 / bpm;
    const elapsed   = Math.max(0, songTimeMs - this._offset);
    return (elapsed % msPerBeat) / msPerBeat;
  }

  /** Integer beat number from track start */
  getBeatNumber(songTimeMs) {
    const bpm = this.getBpmAt(songTimeMs);
    const msPerBeat = 60000 / bpm;
    return Math.floor(Math.max(0, songTimeMs - this._offset) / msPerBeat);
  }

  /** Milliseconds until the next beat */
  getMsToNextBeat(songTimeMs) {
    const bpm = this.getBpmAt(songTimeMs);
    const msPerBeat = 60000 / bpm;
    const elapsed   = Math.max(0, songTimeMs - this._offset);
    return msPerBeat - (elapsed % msPerBeat);
  }
}
