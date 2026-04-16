import { SCREEN, PHYSICS, NOTE_COLORS, HOLD } from '../config/Constants.js';

const LOOKAHEAD_MS    = 2000;
const MIN_HOLD_BAR_W  = 40;
const LABEL_POOL_SIZE = 20;   // note head labels + transition badges
const BAR_H           = 14;   // hold bar height (px)

// ── Pure helpers ──────────────────────────────────────────────────────────────

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

function drawTriangleUp(g, cx, cy, sz) {
  g.fillTriangle(cx, cy - sz, cx - sz, cy + sz, cx + sz, cy + sz);
}
function drawTriangleDown(g, cx, cy, sz) {
  g.fillTriangle(cx, cy + sz, cx - sz, cy - sz, cx + sz, cy - sz);
}
function strokeTriangleUp(g, cx, cy, sz) {
  g.strokeTriangle(cx, cy - sz, cx - sz, cy + sz, cx + sz, cy + sz);
}
function strokeTriangleDown(g, cx, cy, sz) {
  g.strokeTriangle(cx, cy + sz, cx - sz, cy - sz, cx + sz, cy - sz);
}

/** Default required keys for a zone (mirrors BeatEvaluator logic). */
function defaultKeysForZone(zone) {
  if (zone === 'UP')     return ['up'];
  if (zone === 'DOWN')   return ['down'];
  if (zone === 'CENTER') return ['center'];
  return [];
}

function segmentKeys(seg) {
  return seg.keys?.length ? seg.keys : defaultKeysForZone(seg.zone);
}

/** True if prev→next is a partial transition (at least one key shared). */
function isPartialTransition(prevSeg, nextSeg) {
  const prev = segmentKeys(prevSeg);
  const next = segmentKeys(nextSeg);
  return prev.some(k => next.includes(k));
}

/** Human-readable key label for a keys array: 'A', 'D', 'SPC', 'SPC+A', etc. */
function formatKeyLabel(keys) {
  return keys.map(k => {
    if (k === 'up')     return 'A';
    if (k === 'down')   return 'D';
    if (k === 'center') return 'SPC';
    return k.toUpperCase();
  }).join('+');
}

/** Note head label for a single zone. CENTER taps need no label. */
function zoneLabelText(zone, isHold) {
  if (zone === 'UP')     return 'A';
  if (zone === 'DOWN')   return 'D';
  if (zone === 'CENTER') return isHold ? 'SPC' : '';
  return '';
}

/** Convert 0xRRGGBB number to '#rrggbb' string for Phaser Text style. */
function hexToCSS(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}

/** Width of the transition grace window in screen pixels. */
function graceWidthPx() {
  return (HOLD.TRANSITION_GRACE_MS / LOOKAHEAD_MS) * (SCREEN.WIDTH - SCREEN.JUDGMENT_X);
}

// ── GhostLine ─────────────────────────────────────────────────────────────────

export class GhostLine {
  constructor(scene, beatmapSystem) {
    this._scene         = scene;
    this._beatmapSystem = beatmapSystem;
    this._graphics      = scene.add.graphics();

    this._labelPool  = [];
    this._labelUsed  = 0;
    for (let i = 0; i < LABEL_POOL_SIZE; i++) {
      this._labelPool.push(
        scene.add.text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize:   '11px',
          color:      '#ffffff',
          align:      'center',
        }).setOrigin(0.5, 0.5).setDepth(12).setVisible(false)
      );
    }
  }

  update(songTimeMs, holdState = null) {
    const g = this._graphics;
    g.clear();
    this._resetLabels();

    // Judgment line
    g.lineStyle(1, 0x00ff88, 0.35);
    g.beginPath();
    g.moveTo(SCREEN.JUDGMENT_X, 0);
    g.lineTo(SCREEN.JUDGMENT_X, SCREEN.HEIGHT);
    g.strokePath();

    if (holdState) {
      this._drawActiveHold(g, songTimeMs, holdState);
    }

    const upcoming = this._beatmapSystem.getUpcomingBeats(LOOKAHEAD_MS);
    for (const { beat, msUntil } of upcoming) {
      // Hide notes that fall within the active hold window
      if (holdState) {
        const holdEnd = holdState.beat.timeMs + holdState.beat.holdMs;
        if (beat !== holdState.beat &&
            beat.timeMs >= holdState.beat.timeMs &&
            beat.timeMs <= holdEnd) continue;
      }

      const progress = 1 - (msUntil / LOOKAHEAD_MS);
      const alpha    = 0.25 + progress * 0.70;
      const tickX    = SCREEN.JUDGMENT_X + (1 - progress) * (SCREEN.WIDTH - SCREEN.JUDGMENT_X);
      const hasSegs  = beat.holdMs > 0 && beat.holdSegments?.length > 1;

      if (hasSegs) {
        this._drawSegmentedHoldNote(g, beat, tickX, alpha, msUntil);
      } else {
        const targetY = zoneToPixelY(beat.zone, SCREEN.HEIGHT);
        const color   = NOTE_COLORS[beat.zone] ?? 0xffffff;
        if (beat.holdMs > 0) this._drawSimpleHoldBar(g, beat, tickX, targetY, color, alpha, msUntil);
        this._drawApproachLane(g, targetY, color, alpha);
        this._drawNoteHead(g, beat, tickX, targetY, color, alpha);
        this._drawNoteLabel(beat.zone, beat.holdMs > 0, tickX, targetY, alpha);
      }
    }
  }

  // ── Active hold ──────────────────────────────────────────────────────────────

  _drawActiveHold(g, songTimeMs, holdState) {
    const { beat, progress, segmentIdx } = holdState;
    const segments = beat.holdSegments?.length
      ? beat.holdSegments
      : [{ offsetMs: 0, zone: beat.zone }];
    const elapsed = progress * beat.holdMs;

    const currentSeg  = segments[segmentIdx];
    const currentZone = currentSeg.zone;
    const currentColor = NOTE_COLORS[currentZone] ?? 0xffffff;
    const targetY     = zoneToPixelY(currentZone, SCREEN.HEIGHT);

    // Background zone band
    g.fillStyle(currentColor, 0.07);
    g.fillRect(SCREEN.JUDGMENT_X, targetY - 18, SCREEN.WIDTH - SCREEN.JUDGMENT_X, 36);

    if (segments.length > 1) {
      this._drawActiveSegmentedBar(g, songTimeMs, beat, segments, elapsed, progress, segmentIdx);
    } else {
      // Simple progress bar
      const maxBarW = Math.max(MIN_HOLD_BAR_W,
        (beat.holdMs / LOOKAHEAD_MS) * (SCREEN.WIDTH - SCREEN.JUDGMENT_X));
      const barW = maxBarW * (1 - progress);
      if (barW > 1) {
        g.fillStyle(currentColor, 0.55);
        g.fillRect(SCREEN.JUDGMENT_X, targetY - BAR_H / 2, barW, BAR_H);
        g.fillStyle(currentColor, 0.90);
        g.fillRect(SCREEN.JUDGMENT_X + barW - 3, targetY - BAR_H / 2, 3, BAR_H);
        g.lineStyle(1, currentColor, 0.85);
        g.strokeRect(SCREEN.JUDGMENT_X, targetY - BAR_H / 2, barW, BAR_H);
      }
    }

    // Pulsing anchor
    const pulse = 0.5 + 0.5 * Math.sin(songTimeMs * 0.015);
    g.lineStyle(2, currentColor, 0.5 + 0.4 * pulse);
    g.strokeCircle(SCREEN.JUDGMENT_X, targetY, 10 + pulse * 4);
  }

  _drawActiveSegmentedBar(g, _songTimeMs, beat, segments, elapsed, totalProgress, currentSegIdx) {
    const totalW     = Math.max(MIN_HOLD_BAR_W,
      (beat.holdMs / LOOKAHEAD_MS) * (SCREEN.WIDTH - SCREEN.JUDGMENT_X));
    const remainingW = totalW * (1 - totalProgress);
    const remainingMs = beat.holdMs - elapsed;

    for (let i = 0; i < segments.length; i++) {
      const seg    = segments[i];
      const segEnd = i + 1 < segments.length ? segments[i + 1].offsetMs : beat.holdMs;

      const futureStart = Math.max(seg.offsetMs, elapsed);
      if (futureStart >= segEnd) continue;

      const xStart = SCREEN.JUDGMENT_X +
        ((futureStart - elapsed) / remainingMs) * remainingW;
      const xEnd   = SCREEN.JUDGMENT_X +
        ((segEnd - elapsed) / remainingMs) * remainingW;
      const segW   = Math.max(0, xEnd - xStart);
      if (segW <= 0) continue;

      const color     = NOTE_COLORS[seg.zone] ?? 0xffffff;
      const segY      = zoneToPixelY(seg.zone, SCREEN.HEIGHT);
      const isCurrent = i === currentSegIdx;

      g.fillStyle(color, isCurrent ? 0.72 : 0.42);
      g.fillRect(xStart, segY - BAR_H / 2, segW, BAR_H);
      g.lineStyle(1, color, isCurrent ? 0.92 : 0.55);
      g.strokeRect(xStart, segY - BAR_H / 2, segW, BAR_H);

      // Transition gate at boundary
      if (i + 1 < segments.length) {
        const nextSeg  = segments[i + 1];
        const partial  = isPartialTransition(seg, nextSeg);
        const nextKeys = segmentKeys(nextSeg);
        const nextColor = NOTE_COLORS[nextSeg.zone] ?? 0xffffff;
        const nextY    = zoneToPixelY(nextSeg.zone, SCREEN.HEIGHT);

        // How far is the boundary from the judgment cursor (0 = right at cursor)
        const msToGate   = segEnd - elapsed;
        const approachT  = Math.max(0, 1 - msToGate / 500); // ramp up in last 500ms
        const gateAlpha  = 0.55 + 0.40 * approachT;

        this._drawTransitionGate(g, xEnd, seg, nextSeg, segY, nextY, gateAlpha, partial);

        // Key badge above the gate
        const badgeY = Math.min(segY, nextY) - BAR_H / 2 - 14;
        this._drawBadge(
          formatKeyLabel(nextKeys), xEnd, badgeY,
          gateAlpha, hexToCSS(partial ? 0xffffff : nextColor),
          partial ? '10px' : '12px',
        );
      }
    }
  }

  // ── Approaching (not yet hit) segmented hold note ─────────────────────────

  _drawSegmentedHoldNote(g, beat, tickX, alpha, msUntil) {
    const segments = beat.holdSegments;

    for (let i = 0; i < segments.length; i++) {
      const seg    = segments[i];
      const segEnd = i + 1 < segments.length ? segments[i + 1].offsetMs : beat.holdMs;

      const segHeadMs = msUntil + seg.offsetMs;
      const segTailMs = msUntil + segEnd;

      if (segHeadMs < -LOOKAHEAD_MS) continue;
      if (segHeadMs > LOOKAHEAD_MS)  continue;

      const headX = SCREEN.JUDGMENT_X +
        (segHeadMs / LOOKAHEAD_MS) * (SCREEN.WIDTH - SCREEN.JUDGMENT_X);
      const tailX = Math.min(
        SCREEN.JUDGMENT_X + (segTailMs / LOOKAHEAD_MS) * (SCREEN.WIDTH - SCREEN.JUDGMENT_X),
        SCREEN.WIDTH,
      );
      const clampedHead = Math.max(headX, SCREEN.JUDGMENT_X);
      const barW        = Math.max(0, tailX - clampedHead);

      const color   = NOTE_COLORS[seg.zone] ?? 0xffffff;
      const targetY = zoneToPixelY(seg.zone, SCREEN.HEIGHT);

      if (barW > 0) {
        g.fillStyle(color, Math.max(0.28, alpha * 0.60));
        g.fillRect(clampedHead, targetY - BAR_H / 2, barW, BAR_H);
        g.lineStyle(1.5, color, Math.max(0.50, alpha * 0.80));
        g.strokeRect(clampedHead, targetY - BAR_H / 2, barW, BAR_H);
      }

      // Transition gate at segment boundary
      if (i + 1 < segments.length) {
        const nextSeg   = segments[i + 1];
        const partial   = isPartialTransition(seg, nextSeg);
        const nextKeys  = segmentKeys(nextSeg);
        const nextColor = NOTE_COLORS[nextSeg.zone] ?? 0xffffff;
        const nextY     = zoneToPixelY(nextSeg.zone, SCREEN.HEIGHT);

        const gateAlpha = Math.max(0.30, alpha * 0.85);

        this._drawTransitionGate(g, tailX, seg, nextSeg, targetY, nextY, gateAlpha, partial);

        // Key badge above the gate
        const badgeY = Math.min(targetY, nextY) - BAR_H / 2 - 14;
        this._drawBadge(
          formatKeyLabel(nextKeys), tailX, badgeY,
          Math.max(0.55, alpha), hexToCSS(partial ? 0xdddddd : nextColor),
          partial ? '10px' : '12px',
        );
      }
    }

    // Tail cap
    const tailMs = msUntil + beat.holdMs;
    if (tailMs <= LOOKAHEAD_MS) {
      const lastSeg   = segments[segments.length - 1];
      const lastY     = zoneToPixelY(lastSeg.zone, SCREEN.HEIGHT);
      const lastColor = NOTE_COLORS[lastSeg.zone] ?? 0xffffff;
      const tailX     = SCREEN.JUDGMENT_X +
        (tailMs / LOOKAHEAD_MS) * (SCREEN.WIDTH - SCREEN.JUDGMENT_X);
      g.fillStyle(lastColor, alpha * 0.85);
      g.fillRect(tailX - 4, lastY - BAR_H / 2 - 3, 4, BAR_H + 6);
    }

    // Note head at first segment
    const firstSeg = segments[0];
    const headY    = zoneToPixelY(firstSeg.zone, SCREEN.HEIGHT);
    const headColor = NOTE_COLORS[firstSeg.zone] ?? 0xffffff;
    this._drawApproachLane(g, headY, headColor, alpha);
    this._drawNoteHead(g, beat, tickX, headY, headColor, alpha);
    this._drawNoteLabel(firstSeg.zone, true, tickX, headY, alpha);
  }

  // ── Transition gate ───────────────────────────────────────────────────────

  /**
   * Draws the visual "gate" where a segment transition must happen.
   *
   * Partial (add/remove one key, e.g. SPC → SPC+A):
   *   - Soft blended gate, white outer line, no hard color shift
   *
   * Total (completely switch keys, e.g. D → SPC):
   *   - Bold gate in next segment's color with a connector line to new zone
   */
  _drawTransitionGate(g, gateX, fromSeg, toSeg, fromY, toY, alpha, partial) {
    const graceW   = graceWidthPx();
    const fromColor = NOTE_COLORS[fromSeg.zone] ?? 0xffffff;
    const toColor   = NOTE_COLORS[toSeg.zone]   ?? 0xffffff;
    const minY = Math.min(fromY, toY) - BAR_H / 2 - 4;
    const maxY = Math.max(fromY, toY) + BAR_H / 2 + 4;

    if (partial) {
      // Partial: soft shaded zone where both keys overlap
      g.fillStyle(0xffffff, alpha * 0.12);
      g.fillRect(gateX - graceW / 2, minY, graceW, maxY - minY);
      // White center tick
      g.lineStyle(2, 0xffffff, alpha * 0.85);
      g.beginPath();
      g.moveTo(gateX, minY);
      g.lineTo(gateX, maxY);
      g.strokePath();
    } else {
      // Total: shaded entry zone in the new color
      g.fillStyle(toColor, alpha * 0.18);
      g.fillRect(gateX - graceW / 2, minY, graceW, maxY - minY);
      // Left edge in current color, right edge in next color
      g.lineStyle(2, fromColor, alpha * 0.60);
      g.beginPath();
      g.moveTo(gateX - graceW / 2, minY);
      g.lineTo(gateX - graceW / 2, maxY);
      g.strokePath();
      g.lineStyle(2.5, toColor, alpha * 0.95);
      g.beginPath();
      g.moveTo(gateX + graceW / 2, minY);
      g.lineTo(gateX + graceW / 2, maxY);
      g.strokePath();

      // Connector arrow/line between zones when they differ vertically
      if (fromY !== toY) {
        g.lineStyle(1.5, toColor, alpha * 0.55);
        g.beginPath();
        g.moveTo(gateX, fromY);
        g.lineTo(gateX, toY);
        g.strokePath();
        // Arrow tip
        const dir = toY > fromY ? 1 : -1;
        g.fillStyle(toColor, alpha * 0.75);
        g.fillTriangle(
          gateX, toY + dir * 6,
          gateX - 5, toY - dir * 3,
          gateX + 5, toY - dir * 3,
        );
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _drawSimpleHoldBar(g, beat, tickX, targetY, color, alpha, msUntil) {
    const tailMs = msUntil + beat.holdMs;
    const tailRaw = SCREEN.JUDGMENT_X +
      (tailMs / LOOKAHEAD_MS) * (SCREEN.WIDTH - SCREEN.JUDGMENT_X);
    const tailX = Math.min(tailRaw, SCREEN.WIDTH);
    const barW  = Math.max(0, tailX - tickX);
    if (barW <= 0) return;

    g.fillStyle(color, Math.max(0.30, alpha * 0.60));
    g.fillRect(tickX, targetY - BAR_H / 2, barW, BAR_H);
    g.lineStyle(1.5, color, Math.max(0.50, alpha * 0.80));
    g.strokeRect(tickX, targetY - BAR_H / 2, barW, BAR_H);
    g.fillStyle(color, alpha * 0.85);
    g.fillRect(tailX - 4, targetY - BAR_H / 2 - 3, 4, BAR_H + 6);
  }

  _drawApproachLane(g, targetY, color, alpha) {
    g.lineStyle(1, color, 0.06 + alpha * 0.14);
    this._drawDashedLine(g, SCREEN.JUDGMENT_X, targetY, SCREEN.WIDTH, targetY, 10, 8);
  }

  _drawNoteHead(g, beat, tickX, targetY, color, alpha) {
    const SZ = beat.holdMs > 0 ? 13 : 11;
    if (beat.holdMs > 0) {
      g.lineStyle(2, color, Math.max(0.35, alpha * 0.65));
      const RSZ = SZ + 5;
      if (beat.zone === 'UP')        strokeTriangleUp(g, tickX, targetY, RSZ);
      else if (beat.zone === 'DOWN') strokeTriangleDown(g, tickX, targetY, RSZ);
      else                           g.strokeCircle(tickX, targetY, RSZ);
    }
    g.fillStyle(color, alpha);
    if (beat.zone === 'UP')        drawTriangleUp(g, tickX, targetY, SZ);
    else if (beat.zone === 'DOWN') drawTriangleDown(g, tickX, targetY, SZ);
    else                           g.fillCircle(tickX, targetY, SZ);
  }

  /** Label inside the note head (small black text). */
  _drawNoteLabel(zone, isHold, x, y, alpha) {
    const text = zoneLabelText(zone, isHold);
    if (!text) return;
    this._acquireLabel(text, x, y, Math.min(1, alpha * 1.4), '#000000', '11px');
  }

  /** Label above/near a transition gate. */
  _drawBadge(text, x, y, alpha, colorCSS, fontSize) {
    if (!text) return;
    this._acquireLabel(text, x, y, Math.min(1, alpha), colorCSS, fontSize);
  }

  _acquireLabel(text, x, y, alpha, colorCSS, fontSize) {
    if (this._labelUsed >= this._labelPool.length) return;
    const label = this._labelPool[this._labelUsed++];
    label.setText(text);
    label.setPosition(x, y);
    label.setAlpha(alpha);
    label.setStyle({ color: colorCSS, fontSize });
    label.setVisible(true);
  }

  _resetLabels() {
    for (let i = 0; i < this._labelUsed; i++) {
      this._labelPool[i].setVisible(false);
    }
    this._labelUsed = 0;
  }

  _drawDashedLine(g, x1, y1, x2, y2, dashLen, gapLen) {
    let x = x1, drawing = true;
    while (x < x2) {
      const seg = drawing ? dashLen : gapLen;
      const end = Math.min(x + seg, x2);
      if (drawing) {
        g.beginPath();
        g.moveTo(x, y1);
        g.lineTo(end, y2);
        g.strokePath();
      }
      x += seg;
      drawing = !drawing;
    }
  }

  destroy() {
    this._graphics.destroy();
    for (const label of this._labelPool) label.destroy();
  }
}
