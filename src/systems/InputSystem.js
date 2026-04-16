import { keyBindings } from '../config/KeyBindings.js';

export class InputSystem {
  constructor(scene) {
    this._scene = scene;
    this._buildKeys();
  }

  _buildKeys() {
    // Remove previous keys if rebuilding after a rebind
    if (this._keys) {
      for (const key of Object.values(this._keys)) {
        this._scene.input.keyboard.removeKey(key);
      }
    }
    this._keys = {
      up:     this._scene.input.keyboard.addKey(keyBindings.get('LINE_UP')),
      down:   this._scene.input.keyboard.addKey(keyBindings.get('LINE_DOWN')),
      freeze: this._scene.input.keyboard.addKey(keyBindings.get('FREEZE')),
    };
  }

  /** Call after changing keybindings to pick up new keys. */
  rebuild() { this._buildKeys(); }

  update() {}

  getState() {
    return {
      up:     this._keys.up.isDown,
      down:   this._keys.down.isDown,
      freeze: this._keys.freeze.isDown,
    };
  }

  destroy() {
    for (const key of Object.values(this._keys)) {
      this._scene.input.keyboard.removeKey(key);
    }
  }
}
