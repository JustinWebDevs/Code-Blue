/**
 * TrackLibrary — persists uploaded tracks (audio + beatmap) in IndexedDB.
 * Audio is stored as ArrayBuffer so it survives page reloads without re-upload.
 *
 * Usage:
 *   await trackLibrary.open();
 *   const id   = await trackLibrary.saveTrack(arrayBuffer, beatmap);
 *   const list = await trackLibrary.listTracks();
 *   const { beatmap, blobUrl } = await trackLibrary.loadTrack(id);
 *   await trackLibrary.deleteTrack(id);
 */

const DB_NAME    = 'CodeBlueDB';
const DB_VERSION = 1;
const STORE      = 'tracks';

class TrackLibrary {
  constructor() {
    this._db = null;
  }

  async open() {
    if (this._db) return;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db    = e.target.result;
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('addedAt', 'addedAt');
      };

      req.onsuccess = (e) => { this._db = e.target.result; resolve(); };
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /**
   * Save a track. Strips blob URL from meta before storing (would be invalid next session).
   * Returns the assigned numeric id.
   */
  async saveTrack(audioArrayBuffer, beatmap) {
    await this.open();

    // Don't store the transient blob URL — we recreate it from the buffer on load
    const cleanMeta = { ...beatmap.meta, audioFile: null };
    const record = {
      title:       beatmap.meta.title,
      bpm:         beatmap.meta.bpm,
      beatCount:   beatmap.beats.length,
      addedAt:     Date.now(),
      audioBuffer: audioArrayBuffer,
      audioFormat: beatmap.meta.audioFormat ?? ['mp3'],
      beatmap:     { ...beatmap, meta: cleanMeta },
    };

    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).add(record);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  /** Returns lightweight metadata list (no audio buffer) for display. */
  async listTracks() {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = (e) => {
        resolve(e.target.result.map(r => ({
          id:        r.id,
          title:     r.title,
          bpm:       r.bpm,
          beatCount: r.beatCount,
          addedAt:   r.addedAt,
        })));
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Load a full track by id.
   * Creates a fresh blob URL from the stored ArrayBuffer.
   * Caller is responsible for revoking blobUrl when done (or just let the session handle it).
   */
  async loadTrack(id) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = (e) => {
        const record = e.target.result;
        if (!record) { reject(new Error(`Track ${id} not found`)); return; }

        const fmt     = record.audioFormat?.[0] ?? 'mp3';
        const mime    = fmt === 'mp3' ? 'audio/mpeg' : `audio/${fmt}`;
        const blob    = new Blob([record.audioBuffer], { type: mime });
        const blobUrl = URL.createObjectURL(blob);

        const beatmap = {
          ...record.beatmap,
          meta: {
            ...record.beatmap.meta,
            audioFile:   blobUrl,
            audioFormat: record.audioFormat,
          },
        };

        resolve({ beatmap, blobUrl });
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteTrack(id) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }
}

export const trackLibrary = new TrackLibrary();
