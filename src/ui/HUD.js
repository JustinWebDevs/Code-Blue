import { SCREEN, COLORS, CHAOS_LEVELS } from '../config/Constants.js';

const BAR_W = 200;
const BAR_H = 10;

export class HUD {
  constructor(scene, patientName) {
    this._scene = scene;

    // --- Stability bar ---
    this._barBg  = scene.add.rectangle(20, 20, BAR_W, BAR_H, 0x002211).setOrigin(0);
    this._bar    = scene.add.rectangle(20, 20, BAR_W, BAR_H, 0x00ff88).setOrigin(0);
    this._barLabel = scene.add.text(20, 33, 'STABILITY', {
      fontFamily: 'monospace', fontSize: '10px', color: '#007744',
    });

    // --- BPM ---
    this._bpmText = scene.add.text(SCREEN.WIDTH / 2, 16, '♥ --- BPM', {
      fontFamily: 'monospace', fontSize: '18px', color: COLORS.ECG_CORE,
    }).setOrigin(0.5, 0);

    // --- Combo ---
    this._comboText = scene.add.text(SCREEN.WIDTH / 2, SCREEN.HEIGHT - 60, '', {
      fontFamily: 'monospace', fontSize: '32px', color: COLORS.ECG_CORE,
    }).setOrigin(0.5);

    // --- Patient name ---
    this._patientText = scene.add.text(SCREEN.WIDTH - 20, 16, `PATIENT: ${patientName}`, {
      fontFamily: 'monospace', fontSize: '13px', color: '#007744',
    }).setOrigin(1, 0);

    // --- Score ---
    this._scoreText = scene.add.text(SCREEN.WIDTH - 20, 36, 'SCORE: 0', {
      fontFamily: 'monospace', fontSize: '13px', color: '#00aa55',
    }).setOrigin(1, 0);

    // --- Judgement flash ---
    this._judgementText = scene.add.text(SCREEN.WIDTH / 2, SCREEN.HEIGHT / 2 - 80, '', {
      fontFamily: 'monospace', fontSize: '28px', color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0);

    // --- Chaos level label ---
    this._chaosLabel = scene.add.text(20, 48, 'STABLE', {
      fontFamily: 'monospace', fontSize: '11px', color: '#007744',
    });

    this._lastCombo = 0;
  }

  update(chaosState, beatStats, beatClock, songTimeMs) {
    // Stability bar
    const stability = 1 - (chaosState.value / 100);
    this._bar.width  = Math.max(0, BAR_W * stability);

    // Bar color
    let barColor = 0x00ff88;
    if (chaosState.value >= 75) barColor = 0xff2200;
    else if (chaosState.value >= 50) barColor = 0xff8800;
    else if (chaosState.value >= 20) barColor = 0xffff00;
    this._bar.setFillStyle(barColor);

    // BPM + heartbeat flash
    const bpm = beatClock.getBpmAt(songTimeMs);
    const phase = beatClock.getPhase(songTimeMs);
    const flash = phase < 0.12;
    this._bpmText.setText(`♥ ${bpm} BPM`);
    this._bpmText.setAlpha(flash ? 1.0 : 0.6);

    // Combo
    if (beatStats.combo !== this._lastCombo) {
      this._lastCombo = beatStats.combo;
      if (beatStats.combo >= 2) {
        this._comboText.setText(`×${beatStats.combo}`);
        this._scene.tweens.add({
          targets: this._comboText,
          scaleX: 1.15, scaleY: 1.15,
          duration: 80, yoyo: true, ease: 'Quad.easeOut',
        });
      } else {
        this._comboText.setText('');
      }
    }

    // Score
    this._scoreText.setText(`SCORE: ${beatStats.score.toLocaleString()}`);

    // Chaos label
    this._chaosLabel.setText(chaosState.level);
    const levelColor = CHAOS_LEVELS[chaosState.level]?.color || 0x00ff88;
    this._chaosLabel.setColor('#' + levelColor.toString(16).padStart(6, '0'));
  }

  showJudgement(result) {
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
      HOLD_BREAK:    '#ff4400',
    };
    this._judgementText.setText(labels[result] ?? result);
    this._judgementText.setColor(colors[result] ?? '#ffffff');
    this._judgementText.setAlpha(1);

    this._scene.tweens.killTweensOf(this._judgementText);
    this._scene.tweens.add({
      targets:  this._judgementText,
      alpha:    0,
      y:        SCREEN.HEIGHT / 2 - 110,
      duration: 500,
      ease:     'Quad.easeIn',
      onComplete: () => {
        this._judgementText.setY(SCREEN.HEIGHT / 2 - 80);
      },
    });
  }

  destroy() {
    [this._barBg, this._bar, this._barLabel, this._bpmText, this._comboText,
     this._patientText, this._scoreText, this._judgementText, this._chaosLabel]
      .forEach(o => o.destroy());
  }
}
