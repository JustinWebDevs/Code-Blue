import Phaser from 'phaser';
import { SCREEN, PHYSICS, HOLD, COLORS } from '../config/Constants.js';
import { EventBus }       from '../utils/EventBus.js';
import { InputSystem }    from '../systems/InputSystem.js';
import { ECGPhysics }     from '../systems/ECGPhysics.js';
import { BeatmapSystem }  from '../systems/BeatmapSystem.js';
import { BeatEvaluator }  from '../systems/BeatEvaluator.js';
import { ECGRenderer }    from '../ui/ECGRenderer.js';
import { GhostLine }      from '../ui/GhostLine.js';

// ── Tutorial content ──────────────────────────────────────────────────────────

const SECTIONS = [
  {
    title: '① MOVEMENT — UP & DOWN',
    hint:  '[A] = UP   [D] = DOWN   Release = return to CENTER',
    lines: [
      'Hold [A] to move the ECG line into the UP zone.',
      'Hit UP notes (▲) by crossing into the upper zone.',
      '',
      'Hold [D] to move the ECG line into the DOWN zone.',
      'Hit DOWN notes (▽) by crossing into the lower zone.',
      '',
      '→ 6 notes incoming — try to hit them all.',
    ],
    beats: [
      { id: 'a1', timeMs:  3500, zone: 'UP',   holdMs: 0, intensity: 1 },
      { id: 'a2', timeMs:  5500, zone: 'DOWN',  holdMs: 0, intensity: 1 },
      { id: 'a3', timeMs:  7500, zone: 'UP',    holdMs: 0, intensity: 1 },
      { id: 'a4', timeMs:  9500, zone: 'DOWN',  holdMs: 0, intensity: 1 },
      { id: 'a5', timeMs: 11500, zone: 'UP',    holdMs: 0, intensity: 1 },
      { id: 'a6', timeMs: 13500, zone: 'DOWN',  holdMs: 0, intensity: 1 },
    ],
  },
  {
    title: '② CENTER TAPS',
    hint:  'CENTER (●) notes score automatically when the ECG is near center',
    lines: [
      'CENTER notes score when the ECG line is in the',
      'center zone — no key press needed.',
      '',
      'Release both [A] and [D] to let the spring',
      'pull the line back to center automatically.',
      '',
      '→ 4 center notes incoming.',
    ],
    beats: [
      { id: 'b1', timeMs:  3500, zone: 'CENTER', holdMs: 0, intensity: 0.8 },
      { id: 'b2', timeMs:  5500, zone: 'CENTER', holdMs: 0, intensity: 0.8 },
      { id: 'b3', timeMs:  7500, zone: 'CENTER', holdMs: 0, intensity: 0.8 },
      { id: 'b4', timeMs:  9500, zone: 'CENTER', holdMs: 0, intensity: 0.8 },
    ],
  },
  {
    title: '③ HOLDS',
    hint:  'Keep the key held until the bar is completely filled',
    lines: [
      'Hold notes require you to keep a key pressed',
      'while the bar fills to completion.',
      '',
      'UP hold    → [A] held continuously',
      'DOWN hold  → [D] held continuously',
      'CENTER hold→ [SPACE] held + stay in center zone',
      '             (do NOT hold A or D)',
      '',
      '→ 3 hold notes — one of each type.',
    ],
    beats: [
      { id: 'c1', timeMs:  3500, zone: 'UP',     holdMs: 2000, intensity: 1   },
      { id: 'c2', timeMs:  8000, zone: 'DOWN',   holdMs: 2000, intensity: 1   },
      { id: 'c3', timeMs: 12500, zone: 'CENTER', holdMs: 2000, intensity: 0.8 },
    ],
  },
  {
    title: '④ TOTAL TRANSITION',
    hint:  'At the gate │: release current key + press new one',
    lines: [
      'A segmented hold changes zone mid-hold.',
      'A TOTAL transition = completely switch keys.',
      '',
      'Watch the colored vertical gate (│) on the bar.',
      'When the gate reaches the cursor:',
      '  1. Release the old key',
      '  2. Press the new key',
      '  3. ECG line moves to the new zone',
      '',
      'You have a 0.6 s grace window after the gate.',
      '→ Beat 1: [D]→[SPACE]   Beat 2: [SPACE]→[A]',
    ],
    beats: [
      { id: 'd1', timeMs:  3500, zone: 'DOWN', holdMs: 3200, intensity: 1,
        holdSegments: [
          { offsetMs:    0, zone: 'DOWN',   keys: ['down']   },
          { offsetMs: 1600, zone: 'CENTER', keys: ['center'] },
        ],
      },
      { id: 'd2', timeMs: 10000, zone: 'CENTER', holdMs: 3200, intensity: 0.8,
        holdSegments: [
          { offsetMs:    0, zone: 'CENTER', keys: ['center'] },
          { offsetMs: 1600, zone: 'UP',     keys: ['up']     },
        ],
      },
    ],
  },
  {
    title: '⑤ PARTIAL TRANSITION',
    hint:  'At the gate: ADD a key without releasing the current one',
    lines: [
      'A PARTIAL transition = add or release one key',
      'while keeping another held.',
      '',
      'ADD example: hold [SPACE], then at the gate',
      '  also press [A]. Both held → UP zone.',
      '',
      'RELEASE example: at the next gate,',
      '  release [A] only → back to just [SPACE].',
      '',
      '→ [SPACE] → [SPACE+A] → [SPACE]',
    ],
    beats: [
      { id: 'e1', timeMs: 3500, zone: 'CENTER', holdMs: 4800, intensity: 0.8,
        holdSegments: [
          { offsetMs:    0, zone: 'CENTER', keys: ['center']        },
          { offsetMs: 1800, zone: 'UP',     keys: ['center', 'up']  },
          { offsetMs: 3400, zone: 'CENTER', keys: ['center']        },
        ],
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function _keyLabel(keys) {
  return (keys || []).map(k => {
    if (k === 'up')     return 'A';
    if (k === 'down')   return 'D';
    if (k === 'center') return 'SPC';
    return k.toUpperCase();
  }).join('+');
}

function _defaultKeys(zone) {
  if (zone === 'UP')     return ['up'];
  if (zone === 'DOWN')   return ['down'];
  if (zone === 'CENTER') return ['center'];
  return [];
}

// ── TutorialScene ─────────────────────────────────────────────────────────────

const PANEL_W = 500;
const PANEL_H = 220;

export class TutorialScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TutorialScene' });
    this._sectionIdx = 0;
  }

  create() {
    this._drawBackground();

    // Core systems
    this._inputSystem = new InputSystem(this);
    this._ecgPhysics  = new ECGPhysics();
    this._ecgRenderer = new ECGRenderer(this);

    // GhostLine — beatmap reference is replaced per section
    const dummyBeatmap = { beats: [], events: [], meta: { id: 'tut', title: '', bpm: 120 },
      timing: { baseBpm: 120, segments: [{ startMs: 0, bpm: 120 }] } };
    this._ghostLine = new GhostLine(this, new BeatmapSystem(dummyBeatmap));

    // ── Panel (top-left instruction box) ──────────────────────────────────────
    this._panelGfx = this.add.graphics().setDepth(8);

    this._titleTxt = this.add.text(18, 18, '', {
      fontFamily: 'monospace', fontSize: '15px', color: COLORS.ECG_CORE,
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(9);

    this._linesTxt = this.add.text(18, 42, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#aaffcc',
      lineSpacing: 3,
    }).setDepth(9);

    // Hint bar below panel
    this._hintTxt = this.add.text(18, PANEL_H + 16, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#007744',
    }).setDepth(9);

    // Stats (top-right of panel)
    this._hitsTxt = this.add.text(PANEL_W + 26, 18, '', {
      fontFamily: 'monospace', fontSize: '13px', color: COLORS.ECG_CORE,
    }).setDepth(9);
    this._progressTxt = this.add.text(PANEL_W + 26, 40, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#007744',
    }).setDepth(9);

    // Feedback flash (near judgment cursor, below ECG center)
    this._feedbackTxt = this.add.text(SCREEN.JUDGMENT_X, SCREEN.HEIGHT / 2 - 80, '', {
      fontFamily: 'monospace', fontSize: '28px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0).setDepth(15);

    // Transition key flash
    this._transitionTxt = this.add.text(SCREEN.JUDGMENT_X, SCREEN.HEIGHT / 2 - 44, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#00ffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0).setDepth(15);

    // ── Buttons ───────────────────────────────────────────────────────────────
    const btnBase = { fontFamily: 'monospace', fontSize: '14px',
      color: COLORS.ECG_CORE, backgroundColor: '#001a0d', padding: { x: 10, y: 7 } };

    this._menuBtn = this.add.text(20, SCREEN.HEIGHT - 22, '[ ← MENU ]', {
      ...btnBase, color: '#007744',
    }).setOrigin(0, 1).setInteractive({ useHandCursor: true }).setDepth(10);

    this._prevBtn = this.add.text(SCREEN.WIDTH / 2 - 10, SCREEN.HEIGHT - 22, '[ ← PREV ]', btnBase)
      .setOrigin(1, 1).setInteractive({ useHandCursor: true }).setDepth(10);

    this._nextBtn = this.add.text(SCREEN.WIDTH / 2 + 10, SCREEN.HEIGHT - 22, '[ NEXT → ]', {
      ...btnBase, color: '#00ff88', backgroundColor: '#002211',
    }).setOrigin(0, 1).setInteractive({ useHandCursor: true }).setDepth(10);

    this._restartBtn = this.add.text(SCREEN.WIDTH - 20, SCREEN.HEIGHT - 22, '[ ↺ RETRY ]', {
      ...btnBase, color: '#ffaa00',
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true }).setDepth(10);

    // Hover effects
    for (const btn of [this._menuBtn, this._prevBtn, this._nextBtn, this._restartBtn]) {
      btn.on('pointerover', () => btn.setAlpha(0.7));
      btn.on('pointerout',  () => btn.setAlpha(1));
    }
    this._menuBtn.on('pointerdown',    () => this.scene.start('MenuScene'));
    this._prevBtn.on('pointerdown',    () => this._loadSection(this._sectionIdx - 1));
    this._nextBtn.on('pointerdown',    () => this._nextSection());
    this._restartBtn.on('pointerdown', () => this._loadSection(this._sectionIdx));

    // ESC → back to menu
    this.input.keyboard.once('keydown-ESC', () => this.scene.start('MenuScene'));

    // EventBus
    EventBus.on('beat:evaluated',     this._onBeatEvaluated, this);
    EventBus.on('hold:segmentChange', this._onSegmentChange, this);

    this._loadSection(0);
  }

  // ── Section management ────────────────────────────────────────────────────

  _loadSection(idx) {
    if (idx < 0 || idx >= SECTIONS.length) return;
    this._sectionIdx = idx;
    const sec = SECTIONS[idx];

    this._startTime  = this.time.now;
    this._hitsCount  = 0;
    this._totalBeats = sec.beats.length;

    const beatmap = {
      beats:  sec.beats,
      events: [],
      meta:   { id: 'tutorial_' + idx, title: sec.title, bpm: 120 },
      timing: { baseBpm: 120, segments: [{ startMs: 0, bpm: 120 }] },
    };

    this._beatmapSystem = new BeatmapSystem(beatmap);
    this._beatEvaluator = new BeatEvaluator(this._beatmapSystem, this._ecgPhysics);
    this._ecgPhysics.reset();

    // Swap GhostLine's beatmap reference without recreating the object
    this._ghostLine._beatmapSystem = this._beatmapSystem;

    this._updatePanel(sec);

    this._prevBtn.setVisible(idx > 0);
    const isLast = idx === SECTIONS.length - 1;
    this._nextBtn.setText(isLast ? '[ FINISH ]' : '[ NEXT → ]');
  }

  _updatePanel(sec) {
    this._panelGfx.clear();
    this._panelGfx.fillStyle(0x000000, 0.72);
    this._panelGfx.fillRect(8, 8, PANEL_W, PANEL_H);
    this._panelGfx.lineStyle(1, 0x00ff88, 0.30);
    this._panelGfx.strokeRect(8, 8, PANEL_W, PANEL_H);

    this._titleTxt.setText(sec.title);
    this._linesTxt.setText(sec.lines.join('\n'));
    this._hintTxt.setText('▶  ' + sec.hint);
    this._hitsTxt.setText(`Hits: 0 / ${sec.beats.length}`);
    this._progressTxt.setText(`Section ${this._sectionIdx + 1} / ${SECTIONS.length}`);
  }

  _nextSection() {
    if (this._sectionIdx >= SECTIONS.length - 1) {
      this.scene.start('MenuScene');
    } else {
      this._loadSection(this._sectionIdx + 1);
    }
  }

  // ── Update loop ───────────────────────────────────────────────────────────

  update(time, delta) {
    if (!this._beatmapSystem) return;

    const songTimeMs = time - this._startTime;

    this._inputSystem.update();
    const inputState = this._inputSystem.getState();
    this._ecgPhysics.update(delta, inputState);
    this._beatmapSystem.update(songTimeMs);
    this._beatEvaluator.update(songTimeMs);

    const pixelY = this._ecgPhysics.getPixelY(SCREEN.HEIGHT);
    this._ecgRenderer.pushSample(pixelY);
    this._ecgRenderer.update({ pixelY }, 0);

    const holdState = this._beatEvaluator.getHoldState();
    this._ghostLine.update(songTimeMs, holdState);
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  _onBeatEvaluated({ result }) {
    const labels = {
      PERFECT:       'PERFECT',
      GOOD:          'GOOD',
      MISS:          'MISS',
      HOLD_COMPLETE: 'HOLD!',
      HOLD_BREAK:    'BREAK!',
    };
    const colors = {
      PERFECT:       '#00ffaa',
      GOOD:          '#ffff00',
      MISS:          '#ff4400',
      HOLD_COMPLETE: '#cc66ff',
      HOLD_BREAK:    '#ff6600',
    };

    this._feedbackTxt.setText(labels[result] ?? result);
    this._feedbackTxt.setColor(colors[result] ?? '#ffffff');
    this._feedbackTxt.setAlpha(1);
    this.tweens.killTweensOf(this._feedbackTxt);
    this.tweens.add({
      targets:    this._feedbackTxt,
      alpha:      0,
      y:          SCREEN.HEIGHT / 2 - 110,
      duration:   500,
      ease:       'Quad.easeIn',
      onComplete: () => { this._feedbackTxt.setY(SCREEN.HEIGHT / 2 - 80); },
    });

    const isHit = result === 'PERFECT' || result === 'GOOD' || result === 'HOLD_COMPLETE';
    if (isHit) {
      this._hitsCount++;
      this._hitsTxt.setText(`Hits: ${this._hitsCount} / ${this._totalBeats}`);
    }
  }

  _onSegmentChange({ beat, segmentIdx }) {
    const segments = beat.holdSegments || [{ zone: beat.zone }];
    const seg      = segments[segmentIdx];
    const keys     = seg.keys?.length ? seg.keys : _defaultKeys(seg.zone);
    const label    = _keyLabel(keys);

    this._transitionTxt.setText(`→ ${label}`);
    this._transitionTxt.setAlpha(1);
    this.tweens.killTweensOf(this._transitionTxt);
    this.tweens.add({
      targets:  this._transitionTxt,
      alpha:    0,
      duration: HOLD.TRANSITION_GRACE_MS,
      ease:     'Linear',
    });
  }

  // ── Background ────────────────────────────────────────────────────────────

  _drawBackground() {
    const g = this.add.graphics();

    g.lineStyle(1, 0x00ff88, 0.025);
    for (let y = 0; y < SCREEN.HEIGHT; y += 4) {
      g.moveTo(0, y);
      g.lineTo(SCREEN.JUDGMENT_X, y);
    }
    g.strokePath();

    g.lineStyle(1, 0x00ff88, 0.07);
    g.moveTo(0, SCREEN.HEIGHT / 2);
    g.lineTo(SCREEN.WIDTH, SCREEN.HEIGHT / 2);
    g.strokePath();

    const amp = PHYSICS.ECG_AMPLITUDE_PX;
    const cy  = SCREEN.HEIGHT / 2;
    g.lineStyle(1, 0x00ff88, 0.04);
    [-0.66, 0.66].forEach(t => {
      const y = cy + t * amp;
      g.moveTo(0, y);
      g.lineTo(SCREEN.WIDTH, y);
    });
    g.strokePath();
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  shutdown() {
    EventBus.off('beat:evaluated',     this._onBeatEvaluated, this);
    EventBus.off('hold:segmentChange', this._onSegmentChange, this);
    if (this._ghostLine)    this._ghostLine.destroy();
    if (this._inputSystem)  this._inputSystem.destroy();
  }
}
