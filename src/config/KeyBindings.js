// Action definitions: default keyCodes + display labels
export const ACTIONS = {
  LINE_UP:   { label: 'LINE UP',   default: 65 },   // A
  LINE_DOWN: { label: 'LINE DOWN', default: 68 },   // D
  FREEZE:    { label: 'FREEZE',    default: 32 },   // SPACE
};

const STORAGE_KEY = 'codeblue_bindings_v1';

// Reverse map: keyCode → display name
const KEY_NAMES = {
  32: 'SPACE', 13: 'ENTER', 27: 'ESC', 8: 'BACKSPACE', 9: 'TAB',
  37: 'LEFT',  38: 'UP',    39: 'RIGHT', 40: 'DOWN',
  16: 'SHIFT', 17: 'CTRL',  18: 'ALT',
  186: ';', 187: '=', 188: ',', 189: '-', 190: '.', 191: '/', 192: '`',
  219: '[', 220: '\\', 221: ']', 222: "'",
};
for (let i = 65;  i <= 90;  i++) KEY_NAMES[i] = String.fromCharCode(i);        // A–Z
for (let i = 48;  i <= 57;  i++) KEY_NAMES[i] = String.fromCharCode(i);        // 0–9
for (let i = 96;  i <= 105; i++) KEY_NAMES[i] = `NUM${i - 96}`;                // Numpad
for (let i = 112; i <= 123; i++) KEY_NAMES[i] = `F${i - 111}`;                 // F1–F12

export function keyCodeToName(code) {
  return KEY_NAMES[code] ?? `KEY(${code})`;
}

class KeyBindings {
  constructor() {
    this._bindings = Object.fromEntries(
      Object.entries(ACTIONS).map(([k, v]) => [k, v.default])
    );
    this._load();
  }

  get(action)          { return this._bindings[action] ?? ACTIONS[action].default; }
  set(action, keyCode) { this._bindings[action] = keyCode; this._save(); }
  getAll()             { return { ...this._bindings }; }

  reset() {
    this._bindings = Object.fromEntries(
      Object.entries(ACTIONS).map(([k, v]) => [k, v.default])
    );
    this._save();
  }

  _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._bindings)); } catch {}
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      for (const k of Object.keys(ACTIONS)) {
        if (typeof parsed[k] === 'number') this._bindings[k] = parsed[k];
      }
    } catch {}
  }
}

export const keyBindings = new KeyBindings();
