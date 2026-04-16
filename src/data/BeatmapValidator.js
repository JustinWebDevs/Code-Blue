const VALID_ZONES = new Set(['UP', 'CENTER', 'DOWN']);

export class BeatmapValidator {
  static validate(beatmap) {
    const errors   = [];
    const warnings = [];

    if (!beatmap.version)       errors.push('Missing "version" field');
    if (!beatmap.meta)          errors.push('Missing "meta" object');
    if (!beatmap.timing)        errors.push('Missing "timing" object');
    if (!Array.isArray(beatmap.beats)) errors.push('"beats" must be an array');

    if (errors.length) return { valid: false, errors, warnings };

    if (!beatmap.meta.bpm || beatmap.meta.bpm <= 0) errors.push('meta.bpm must be > 0');
    if (!beatmap.timing.segments?.length)            errors.push('timing.segments must not be empty');

    beatmap.beats.forEach((beat, i) => {
      if (typeof beat.timeMs !== 'number') errors.push(`beats[${i}].timeMs must be a number`);
      if (!VALID_ZONES.has(beat.zone))     errors.push(`beats[${i}].zone "${beat.zone}" invalid`);
    });

    // Check ascending order
    for (let i = 1; i < beatmap.beats.length; i++) {
      if (beatmap.beats[i].timeMs < beatmap.beats[i - 1].timeMs) {
        errors.push(`beats[${i}].timeMs (${beatmap.beats[i].timeMs}) < beats[${i-1}].timeMs (${beatmap.beats[i-1].timeMs}) — must be ascending`);
      }
      const gap = beatmap.beats[i].timeMs - beatmap.beats[i - 1].timeMs;
      if (gap < 100) {
        warnings.push(`beats[${i}] and beats[${i-1}] are only ${gap}ms apart — possible authoring error`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
