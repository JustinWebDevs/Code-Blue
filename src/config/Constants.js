export const TIMING_WINDOWS = {
  PERFECT: 40,   // ±40ms
  GOOD:    90,   // ±90ms
};

export const CHAOS_LEVELS = {
  STABLE:   { threshold: 0,   name: 'STABLE',   color: 0x00ff88 },
  UNEASY:   { threshold: 20,  name: 'UNEASY',   color: 0xffff00 },
  DANGER:   { threshold: 50,  name: 'DANGER',   color: 0xff8800 },
  CRITICAL: { threshold: 75,  name: 'CRITICAL', color: 0xff2200 },
  FLATLINE: { threshold: 100, name: 'FLATLINE', color: 0xff0000 },
};

// Normalized position thresholds for zone classification
// position: -1.0 = top, 0 = center, +1.0 = bottom
// Thresholds match the 0.66 factor used in GhostLine.zoneToPixelY so the zone
// boundary aligns exactly with the note head's drawn position.
export const ECG_ZONES = {
  UP:     { min: -1.0,  max: -0.66 },
  CENTER: { min: -0.66, max:  0.66 },
  DOWN:   { min:  0.66, max:  1.0  },
};

export const PHYSICS = {
  // Target-based spring: spring pulls position toward the current target.
  // A held → target -1.0 (top), D held → target +1.0 (bottom), none → target 0 (center).
  SPRING_STIFFNESS: 0.10,  // how fast position chases target (higher = snappier)
  DAMPING:          0.82,  // velocity retention per frame (lower = more drag)
  ECG_AMPLITUDE_PX: 200,   // max pixel deviation from center
};

export const SCORE = {
  PERFECT_BASE: 300,
  GOOD_BASE:    100,
  MISS_BASE:    0,
  COMBO_CAP:    9999,
};

export const CHAOS = {
  MISS_BASE:    8,
  MISS_STREAK:  2,   // extra per consecutive miss
  PERFECT_GAIN: -3,
  GOOD_GAIN:    -1,
  PASSIVE_DECAY_MIN: 0.02,  // at chaos 0
  PASSIVE_DECAY_MAX: 0.005, // at chaos 100
};

export const COLORS = {
  ECG_CORE:    '#00ff88',
  ECG_GLOW_MED:'#00ff8855',
  ECG_GLOW_WIDE:'#00ff8822',
  BACKGROUND:  '#000000',
  GHOST_LINE:  0xffffff,
  HUD_TEXT:    '#00ff88',
};

// Note type colors (used in GhostLine and judgement flash)
export const NOTE_COLORS = {
  UP:     0x00ddff,   // cyan   — press A, line goes up
  CENTER: 0xffffff,   // white  — stay centered
  DOWN:   0xffaa00,   // amber  — press D, line goes down
  HOLD:   0xcc66ff,   // purple — hold body bar tint
};

export const HOLD = {
  COMPLETE_BONUS:       2.0,   // score multiplier for a full hold (strike score × this)
  TRANSITION_GRACE_MS:  300,   // grace window after a segment change — player has this long to reach new zone/keys
};

export const SCREEN = {
  WIDTH:       1280,
  HEIGHT:      720,
  JUDGMENT_X:  960,   // fixed hit cursor: ECG history fills left, beats approach from right
};
