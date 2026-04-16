import Phaser from 'phaser';
import { SCREEN, PHYSICS, HOLD, NOTE_COLORS } from '../config/Constants.js';
import { EventBus }        from '../utils/EventBus.js';

// ── Transition key-label helpers ────────────────────────────────────────────
function _defaultKeysForZone(zone) {
  if (zone === 'UP')     return ['up'];
  if (zone === 'DOWN')   return ['down'];
  if (zone === 'CENTER') return ['center'];
  return [];
}
function _formatTransitionLabel(keys) {
  return (keys || []).map(k => {
    if (k === 'up')     return 'A';
    if (k === 'down')   return 'D';
    if (k === 'center') return 'SPACE';
    return k.toUpperCase();
  }).join('+');
}

import { InputSystem }    from '../systems/InputSystem.js';
import { ECGPhysics }     from '../systems/ECGPhysics.js';
import { BeatmapSystem }  from '../systems/BeatmapSystem.js';
import { BeatEvaluator }  from '../systems/BeatEvaluator.js';
import { ChaosSystem }    from '../systems/ChaosSystem.js';

import { AudioManager }   from '../audio/AudioManager.js';
import { BeatClock }      from '../audio/BeatClock.js';

import { ECGRenderer }    from '../ui/ECGRenderer.js';
import { GhostLine }      from '../ui/GhostLine.js';
import { HUD }            from '../ui/HUD.js';
import { ChaosEffects }   from '../ui/ChaosEffects.js';

import { BeatmapValidator } from '../data/BeatmapValidator.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this._gameOver = false;
  }

  init(data) {
    this._beatmapData = data.beatmap;
    this._patientName = data.patientName || 'UNKNOWN';
    this._gameOver    = false;
  }

  create() {
    // Validate beatmap
    const validation = BeatmapValidator.validate(this._beatmapData);
    if (!validation.valid) {
      console.error('[GameScene] Invalid beatmap:', validation.errors);
    }
    if (validation.warnings.length) {
      console.warn('[GameScene] Beatmap warnings:', validation.warnings);
    }

    // Background
    this._drawBackground();

    // --- Systems ---
    this._inputSystem   = new InputSystem(this);
    this._ecgPhysics    = new ECGPhysics();
    this._audioManager  = new AudioManager(this._beatmapData);
    this._beatClock     = new BeatClock(this._beatmapData);
    this._beatmapSystem = new BeatmapSystem(this._beatmapData);
    this._beatEvaluator = new BeatEvaluator(this._beatmapSystem, this._ecgPhysics);
    this._chaosSystem   = new ChaosSystem();

    // --- UI (order matters for depth) ---
    this._ecgRenderer  = new ECGRenderer(this);
    this._ghostLine    = new GhostLine(this, this._beatmapSystem);
    this._chaosEffects = new ChaosEffects(this, this._chaosSystem, this._ecgPhysics, this._ecgRenderer);
    this._hud          = new HUD(this, this._patientName);

    // --- Events ---
    EventBus.on('beat:evaluated',    this._onBeatEvaluated,    this);
    EventBus.on('chaos:flatline',    this._onFlatline,         this);
    EventBus.on('hold:segmentChange',this._onSegmentChange,    this);

    // --- Pause key ---
    this._pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this._pauseKey.on('down', this._togglePause, this);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P)
      .on('down', this._togglePause, this);

    // --- Transition flash label (shown at judgment cursor on segment change) ---
    this._transitionLabel = this.add.text(SCREEN.JUDGMENT_X, SCREEN.HEIGHT / 2 - 50, '', {
      fontFamily: 'monospace', fontSize: '22px', color: '#00ffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0).setDepth(20);

    // --- Countdown then start audio ---
    this._countingDown = true;
    this._startCountdown();
  }

  update(time, delta) {
    if (this._gameOver)    return;
    if (this._countingDown) return;
    if (!this._audioManager.isReady()) return;  // wait for audio to start playing

    const songTimeMs = this._audioManager.getCurrentTime();

    // Systems
    this._inputSystem.update();
    const inputState = this._inputSystem.getState();
    this._ecgPhysics.update(delta, inputState);
    this._beatmapSystem.update(songTimeMs);
    this._beatEvaluator.update(songTimeMs);
    this._chaosSystem.update(delta);

    // Push ECG sample after physics
    const pixelY = this._ecgPhysics.getPixelY(SCREEN.HEIGHT);
    this._ecgRenderer.pushSample(pixelY);
    this._ecgRenderer.update({ pixelY }, this._chaosSystem.getLevel());

    // UI
    const lineY = this._ecgPhysics.getPixelY(SCREEN.HEIGHT);
    this._ghostLine.update(songTimeMs, this._beatEvaluator.getHoldState(), lineY);
    this._chaosEffects.update(delta);
    this._hud.update(
      this._chaosSystem.getState(),
      this._beatEvaluator.getStats(),
      this._beatClock,
      songTimeMs,
    );

    // Track completion
    if (this._beatEvaluator.isFinished() && !this._gameOver) {
      this._endGame('complete');
    }
  }

  _startCountdown() {
    const cx = SCREEN.WIDTH  / 2;
    const cy = SCREEN.HEIGHT / 2;

    const style = {
      fontFamily: 'monospace',
      fontSize:   '96px',
      color:      '#00ff88',
      stroke:     '#000000',
      strokeThickness: 4,
    };

    const txt = this.add.text(cx, cy, '3', style).setOrigin(0.5).setDepth(50).setAlpha(0);

    const showTick = (label, onDone) => {
      txt.setText(label);
      txt.setScale(1.5);
      txt.setAlpha(1);
      this.tweens.add({
        targets:  txt,
        scaleX:   1,
        scaleY:   1,
        alpha:    0,
        duration: 800,
        ease:     'Quad.easeIn',
        onComplete: onDone,
      });
    };

    showTick('3', () =>
      this.time.delayedCall(200, () =>
        showTick('2', () =>
          this.time.delayedCall(200, () =>
            showTick('1', () =>
              this.time.delayedCall(200, () => {
                style.color = '#ffffff';
                txt.setStyle(style);
                showTick('GO!', () => {
                  txt.destroy();
                  this._countingDown = false;
                  this._audioManager.startTrack();
                });
              })
            )
          )
        )
      )
    );
  }

  _onBeatEvaluated({ result, beat, stats }) {
    this._chaosSystem.onBeatResult(result);
    this._hud.showJudgement(result);

    // Hold zone — keep ECG spring biased toward zone centre during holds
    if ((result === 'PERFECT' || result === 'GOOD') && beat.holdMs > 0) {
      this._ecgPhysics.setHoldZone(beat.zone);
    } else if (result === 'HOLD_COMPLETE' || result === 'HOLD_BREAK') {
      this._ecgPhysics.clearHoldZone();
    }

    // Missed / broken note — leave a fading ghost at the judgment cursor
    if (result === 'MISS' || result === 'HOLD_BREAK') {
      const t = this._audioManager.getCurrentTime();
      this._ghostLine.pushMissed(beat, t);
    }

    // Hit particles on successful hits
    if (result === 'PERFECT' || result === 'GOOD' || result === 'HOLD_COMPLETE') {
      this._spawnHitParticles(beat.zone);
    }

    // SFX
    if (result === 'PERFECT' || result === 'HOLD_COMPLETE') {
      this._audioManager.playSFX('perfect');
    } else if (result === 'GOOD') {
      this._audioManager.playSFX('good');
    } else {
      this._audioManager.playSFX('miss');
    }
  }

  _onSegmentChange({ beat, segmentIdx, zone }) {
    // Short accent beep to signal the hold path changed
    this._audioManager.playSFX('good');

    // Keep spring biased toward the new segment's zone centre
    this._ecgPhysics.setHoldZone(zone);

    // Flash "→ KEY" at the judgment cursor so the player knows what to press
    const segments = beat.holdSegments?.length ? beat.holdSegments : [{ zone: beat.zone }];
    const seg      = segments[segmentIdx];
    const keys     = seg.keys?.length ? seg.keys : _defaultKeysForZone(seg.zone);
    const label    = _formatTransitionLabel(keys);
    const zoneColor = NOTE_COLORS[zone] ?? 0x00ffff;
    const css = '#' + zoneColor.toString(16).padStart(6, '0');

    this._transitionLabel.setText(`→ ${label}`);
    this._transitionLabel.setColor(css);
    this._transitionLabel.setAlpha(1);
    this.tweens.killTweensOf(this._transitionLabel);
    this.tweens.add({
      targets:  this._transitionLabel,
      alpha:    0,
      duration: HOLD.TRANSITION_GRACE_MS,
      ease:     'Linear',
    });
  }

  _togglePause() {
    if (this._gameOver) return;
    this._audioManager.pauseTrack();
    this.scene.pause();
    this.scene.launch('PauseScene', {
      audioManager: this._audioManager,
      beatmap:      this._beatmapData,
      patientName:  this._patientName,
    });
  }

  _onFlatline() {
    if (this._gameOver) return;
    this._gameOver = true;

    this._audioManager.stopTrack();
    this._audioManager.playSFX('flatline');

    this.time.delayedCall(2600, () => {
      this._endGame('flatline');
    });
  }

  _endGame(reason) {
    this._gameOver = true;
    this._audioManager.stopTrack();
    EventBus.off('beat:evaluated',     this._onBeatEvaluated, this);
    EventBus.off('chaos:flatline',     this._onFlatline,      this);
    EventBus.off('hold:segmentChange', this._onSegmentChange, this);

    const stats = this._beatEvaluator.getStats();

    this.scene.start('GameOverScene', {
      reason,
      stats,
      patientName: this._patientName,
      timestamp:   new Date(),
      beatmap:     this._beatmapData,
    });
  }

  /** Burst of small colored circles flying outward from the judgment cursor. */
  _spawnHitParticles(zone) {
    const half = SCREEN.HEIGHT / 2;
    const amp  = PHYSICS.ECG_AMPLITUDE_PX;
    let cy;
    if (zone === 'UP')        cy = half - amp * 0.66;
    else if (zone === 'DOWN') cy = half + amp * 0.66;
    else                      cy = half;

    const cx    = SCREEN.JUDGMENT_X;
    const color = NOTE_COLORS[zone] ?? 0x00ff88;
    const count = 10;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 55 + Math.random() * 70;
      const size  = 2 + Math.random() * 2;
      const dot   = this.add.graphics().setDepth(25);
      dot.fillStyle(color, 1.0);
      dot.fillCircle(0, 0, size);
      dot.setPosition(cx, cy);
      this.tweens.add({
        targets:  dot,
        x:        cx + Math.cos(angle) * speed,
        y:        cy + Math.sin(angle) * speed * 0.65,
        alpha:    0,
        scaleX:   0.1,
        scaleY:   0.1,
        duration: 300 + Math.random() * 150,
        ease:     'Quad.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  _drawBackground() {
    const g = this.add.graphics();

    // Scanlines only on history side (left of judgment line)
    g.lineStyle(1, 0x00ff88, 0.025);
    for (let y = 0; y < SCREEN.HEIGHT; y += 4) {
      g.moveTo(0, y);
      g.lineTo(SCREEN.JUDGMENT_X, y);
    }
    g.strokePath();

    // Center guide line across full width (very faint)
    g.lineStyle(1, 0x00ff88, 0.07);
    g.moveTo(0, SCREEN.HEIGHT / 2);
    g.lineTo(SCREEN.WIDTH, SCREEN.HEIGHT / 2);
    g.strokePath();

    // Zone boundary lines across full width (match ECG_ZONES thresholds ±0.66)
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

  shutdown() {
    EventBus.off('beat:evaluated',     this._onBeatEvaluated, this);
    EventBus.off('chaos:flatline',     this._onFlatline,      this);
    EventBus.off('hold:segmentChange', this._onSegmentChange, this);
    if (this._audioManager) this._audioManager.destroy();
  }
}
