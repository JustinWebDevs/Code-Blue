import { SCREEN, PHYSICS, NOTE_COLORS } from '../config/Constants.js';

const LOOKAHEAD_MS = 2000;
// Minimum on-screen hold bar width so short holds don't disappear
const MIN_HOLD_BAR_W = 40;

function zoneToPixelY(zone, screenHeight) {
  const half = screenHeight / 2;
  const amp  = PHYSICS.ECG_AMPLITUDE_PX;
  switch (zone) {
    case 'UP':     return half - amp * 0.66;
    case 'DOWN':   return half + amp * 0.66;
    case 'CENTER': return half;
    default:       return half;
  }
}

/** Filled ▲ */
function drawTriangleUp(g, cx, cy, sz) {
  g.fillTriangle(cx, cy - sz, cx - sz, cy + sz, cx + sz, cy + sz);
}

/** Filled ▼ */
function drawTriangleDown(g, cx, cy, sz) {
  g.fillTriangle(cx, cy + sz, cx - sz, cy - sz, cx + sz, cy - sz);
}

/** Outlined ▲ (for hold note outer ring) */
function strokeTriangleUp(g, cx, cy, sz) {
  g.strokeTriangle(cx, cy - sz, cx - sz, cy + sz, cx + sz, cy + sz);
}

/** Outlined ▼ */
function strokeTriangleDown(g, cx, cy, sz) {
  g.strokeTriangle(cx, cy + sz, cx - sz, cy - sz, cx + sz, cy - sz);
}

export class GhostLine {
  constructor(scene, beatmapSystem) {
    this._scene         = scene;
    this._beatmapSystem = beatmapSystem;
    this._graphics      = scene.add.graphics();
  }

  /**
   * @param {number} songTimeMs
   * @param {{ beat, progress: number, zone: string }|null} holdState
   */
  update(songTimeMs, holdState = null) {
    const g = this._graphics;
    g.clear();

    // ── Judgment line ──
    g.lineStyle(1, 0x00ff88, 0.35);
    g.beginPath();
    g.moveTo(SCREEN.JUDGMENT_X, 0);
    g.lineTo(SCREEN.JUDGMENT_X, SCREEN.HEIGHT);
    g.strokePath();

    // ── Active hold zone highlight (drawn first so notes appear on top) ──
    if (holdState) {
      const { beat, progress } = holdState;
      const targetY = zoneToPixelY(beat.zone, SCREEN.HEIGHT);
      const color   = NOTE_COLORS[beat.zone] ?? 0xffffff;

      // Glowing band behind the target zone across the full approach area
      const bandH = 36;
      g.fillStyle(color, 0.07);
      g.fillRect(SCREEN.JUDGMENT_X, targetY - bandH / 2, SCREEN.WIDTH - SCREEN.JUDGMENT_X, bandH);

      // Progress bar: starts full-width at JUDGMENT_X, shrinks rightward as hold elapses
      // Width is proportional to holdMs, clamped to a minimum so it's always visible
      const maxBarW = Math.max(MIN_HOLD_BAR_W,
        (beat.holdMs / LOOKAHEAD_MS) * (SCREEN.WIDTH - SCREEN.JUDGMENT_X));
      const barW = maxBarW * (1 - progress);

      if (barW > 1) {
        // Fill
        g.fillStyle(color, 0.55);
        g.fillRect(SCREEN.JUDGMENT_X, targetY - 8, barW, 16);
        // Bright leading edge
        g.fillStyle(color, 0.90);
        g.fillRect(SCREEN.JUDGMENT_X + barW - 3, targetY - 8, 3, 16);
        // Outline
        g.lineStyle(1, color, 0.85);
        g.strokeRect(SCREEN.JUDGMENT_X, targetY - 8, barW, 16);
      }

      // Pulsing anchor circle at JUDGMENT_X — shows player is "connected"
      const pulse = 0.5 + 0.5 * Math.sin(songTimeMs * 0.015);
      g.lineStyle(2, color, 0.5 + 0.4 * pulse);
      g.strokeCircle(SCREEN.JUDGMENT_X, targetY, 10 + pulse * 4);
    }

    // ── Approaching notes ──
    const upcoming = this._beatmapSystem.getUpcomingBeats(LOOKAHEAD_MS);

    for (const { beat, msUntil } of upcoming) {
      const progress = 1 - (msUntil / LOOKAHEAD_MS); // 0 = far right, 1 = at cursor
      const alpha    = 0.25 + progress * 0.70;
      const targetY  = zoneToPixelY(beat.zone, SCREEN.HEIGHT);
      const color    = NOTE_COLORS[beat.zone] ?? 0xffffff;

      // tickX: head of the note, slides from right edge → JUDGMENT_X
      const tickX = SCREEN.JUDGMENT_X + (1 - progress) * (SCREEN.WIDTH - SCREEN.JUDGMENT_X);

      // ── Hold body bar ──
      if (beat.holdMs > 0) {
        // The TAIL arrives holdMs AFTER the head → it's to the RIGHT of the head
        const tailMsUntilArrival = msUntil + beat.holdMs;
        const tailRaw = SCREEN.JUDGMENT_X +
          (tailMsUntilArrival / LOOKAHEAD_MS) * (SCREEN.WIDTH - SCREEN.JUDGMENT_X);
        const tailX = Math.min(tailRaw, SCREEN.WIDTH);
        const barW  = Math.max(0, tailX - tickX);

        if (barW > 0) {
          // Solid filled body
          g.fillStyle(color, Math.max(0.30, alpha * 0.60));
          g.fillRect(tickX, targetY - 7, barW, 14);
          // Bright outline
          g.lineStyle(1.5, color, Math.max(0.50, alpha * 0.80));
          g.strokeRect(tickX, targetY - 7, barW, 14);
          // Bright tail cap
          g.fillStyle(color, alpha * 0.85);
          g.fillRect(tailX - 4, targetY - 10, 4, 20);
        }
      }

      // ── Approach lane guide (subtle dashed line at target Y) ──
      const lineAlpha = 0.06 + progress * 0.14;
      g.lineStyle(1, color, lineAlpha);
      this._drawDashedLine(g, SCREEN.JUDGMENT_X, targetY, SCREEN.WIDTH, targetY, 10, 8);

      // ── Note head shape ──
      const SZ = beat.holdMs > 0 ? 13 : 11; // hold notes are slightly larger

      // For hold notes: draw outer ring first (distinguishes hold from regular)
      if (beat.holdMs > 0) {
        const ringAlpha = Math.max(0.35, alpha * 0.65);
        g.lineStyle(2, color, ringAlpha);
        const RSZ = SZ + 5;
        if (beat.zone === 'UP') {
          strokeTriangleUp(g, tickX, targetY, RSZ);
        } else if (beat.zone === 'DOWN') {
          strokeTriangleDown(g, tickX, targetY, RSZ);
        } else {
          g.strokeCircle(tickX, targetY, RSZ);
        }
      }

      // Filled shape (same for all notes, hold ones are just larger + have ring)
      g.fillStyle(color, alpha);
      if (beat.zone === 'UP') {
        drawTriangleUp(g, tickX, targetY, SZ);
      } else if (beat.zone === 'DOWN') {
        drawTriangleDown(g, tickX, targetY, SZ);
      } else {
        g.fillCircle(tickX, targetY, SZ);
      }
    }
  }

  _drawDashedLine(g, x1, y1, x2, y2, dashLen, gapLen) {
    let x = x1;
    let drawing = true;
    while (x < x2) {
      const segLen = drawing ? dashLen : gapLen;
      const end    = Math.min(x + segLen, x2);
      if (drawing) {
        g.beginPath();
        g.moveTo(x, y1);
        g.lineTo(end, y2);
        g.strokePath();
      }
      x += segLen;
      drawing = !drawing;
    }
  }

  destroy() {
    this._graphics.destroy();
  }
}
