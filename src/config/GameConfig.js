import Phaser from 'phaser';
import { BootScene }      from '../scenes/BootScene.js';
import { MenuScene }      from '../scenes/MenuScene.js';
import { GameScene }      from '../scenes/GameScene.js';
import { GameOverScene }  from '../scenes/GameOverScene.js';
import { KeyBindScene }   from '../scenes/KeyBindScene.js';
import { AnalysisScene }  from '../scenes/AnalysisScene.js';
import { PauseScene }     from '../scenes/PauseScene.js';
import { LibraryScene }   from '../scenes/LibraryScene.js';
import { TutorialScene }  from '../scenes/TutorialScene.js';
import { SCREEN }         from './Constants.js';

export const GameConfig = {
  type: Phaser.AUTO,
  width:  SCREEN.WIDTH,
  height: SCREEN.HEIGHT,
  backgroundColor: '#000000',
  parent: 'game-container',
  scene: [BootScene, MenuScene, GameScene, GameOverScene, KeyBindScene, AnalysisScene, PauseScene, LibraryScene, TutorialScene],
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  audio: {
    disableWebAudio: false,
  },
};
