import Phaser from 'phaser';
import { SCREEN, COLORS } from '../config/Constants.js';
import { trackLibrary }   from '../data/TrackLibrary.js';

const PAGE_SIZE  = 6;
const ROW_HEIGHT = 72;

export class LibraryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LibraryScene' });
    this._tracks     = [];
    this._page       = 0;
    this._rowObjects = [];  // Phaser objects for the current page (to rebuild on page turn)
    this._activeBlobUrl = null;
  }

  init(data) {
    this._patientName = data?.patientName || 'JOHN DOE';
  }

  async create() {
    const cx = SCREEN.WIDTH / 2;

    // Background
    const g = this.add.graphics();
    g.fillStyle(0x000000, 1);
    g.fillRect(0, 0, SCREEN.WIDTH, SCREEN.HEIGHT);
    g.lineStyle(1, 0x00ff88, 0.03);
    for (let y = 0; y < SCREEN.HEIGHT; y += 4) {
      g.moveTo(0, y); g.lineTo(SCREEN.WIDTH, y);
    }
    g.strokePath();

    // Header
    this.add.text(cx, 65, 'TRACK LIBRARY', {
      fontFamily: 'monospace', fontSize: '36px', color: COLORS.ECG_CORE,
      stroke: '#003322', strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(cx, 112, 'Tracks saved from audio analysis — no re-upload needed', {
      fontFamily: 'monospace', fontSize: '12px', color: '#00aa55',
    }).setOrigin(0.5);

    // Column headers
    const hStyle = { fontFamily: 'monospace', fontSize: '11px', color: '#005533' };
    this.add.text(80,  148, 'TITLE',    hStyle);
    this.add.text(700, 148, 'BPM',      hStyle);
    this.add.text(760, 148, 'BEATS',    hStyle);
    this.add.text(840, 148, 'ADDED',    hStyle);

    // Divider
    const div = this.add.graphics();
    div.lineStyle(1, 0x00ff88, 0.2);
    div.moveTo(60, 162); div.lineTo(SCREEN.WIDTH - 60, 162); div.strokePath();

    // Pagination controls
    this._prevBtn = this.add.text(cx - 120, 650, '[ < PREV ]', {
      fontFamily: 'monospace', fontSize: '14px', color: '#00aa55',
      backgroundColor: '#001a0d', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this._prevBtn.on('pointerdown', () => this._changePage(-1));

    this._pageText = this.add.text(cx, 650, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#005533',
    }).setOrigin(0.5);

    this._nextBtn = this.add.text(cx + 120, 650, '[ NEXT > ]', {
      fontFamily: 'monospace', fontSize: '14px', color: '#00aa55',
      backgroundColor: '#001a0d', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this._nextBtn.on('pointerdown', () => this._changePage(1));

    // Back button
    const backBtn = this.add.text(cx, 695, '[ BACK TO MENU ]', {
      fontFamily: 'monospace', fontSize: '13px', color: '#004422',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
    this.input.keyboard.once('keydown-ESC', () => this.scene.start('MenuScene'));

    // Load track list
    this._emptyText = this.add.text(cx, 380, '', {
      fontFamily: 'monospace', fontSize: '15px', color: '#004422', align: 'center',
    }).setOrigin(0.5);

    await this._refreshList();
  }

  async _refreshList() {
    try {
      this._tracks = await trackLibrary.listTracks();
      this._tracks.sort((a, b) => b.addedAt - a.addedAt); // newest first
    } catch (e) {
      this._tracks = [];
      console.error('[LibraryScene]', e);
    }
    this._page = 0;
    this._renderPage();
  }

  _renderPage() {
    // Destroy previous rows
    this._rowObjects.forEach(o => o.destroy());
    this._rowObjects = [];

    const cx    = SCREEN.WIDTH / 2;
    const total = this._tracks.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    this._page  = Phaser.Math.Clamp(this._page, 0, pages - 1);

    this._pageText.setText(`${this._page + 1} / ${pages}`);
    this._prevBtn.setAlpha(this._page > 0 ? 1 : 0.3);
    this._nextBtn.setAlpha(this._page < pages - 1 ? 1 : 0.3);

    if (total === 0) {
      this._emptyText.setText('No tracks saved yet.\nGo to LOAD TRACK → analyze an MP3 → it will appear here.');
      return;
    }
    this._emptyText.setText('');

    const start = this._page * PAGE_SIZE;
    const end   = Math.min(start + PAGE_SIZE, total);

    for (let i = start; i < end; i++) {
      const t   = this._tracks[i];
      const row = i - start;
      const y   = 178 + row * ROW_HEIGHT;

      // Row background
      const bg = this.add.graphics();
      bg.fillStyle(row % 2 === 0 ? 0x000d07 : 0x000000, 0.6);
      bg.fillRect(60, y, SCREEN.WIDTH - 120, ROW_HEIGHT - 4);
      this._rowObjects.push(bg);

      // Title (truncated)
      const title = t.title.length > 30 ? t.title.substring(0, 28) + '…' : t.title;
      const titleTxt = this.add.text(80, y + ROW_HEIGHT / 2, title, {
        fontFamily: 'monospace', fontSize: '14px', color: COLORS.ECG_CORE,
      }).setOrigin(0, 0.5);
      this._rowObjects.push(titleTxt);

      // BPM
      const bpmTxt = this.add.text(700, y + ROW_HEIGHT / 2, String(t.bpm), {
        fontFamily: 'monospace', fontSize: '13px', color: '#00aa55',
      }).setOrigin(0, 0.5);
      this._rowObjects.push(bpmTxt);

      // Beat count
      const beatTxt = this.add.text(760, y + ROW_HEIGHT / 2, String(t.beatCount), {
        fontFamily: 'monospace', fontSize: '13px', color: '#00aa55',
      }).setOrigin(0, 0.5);
      this._rowObjects.push(beatTxt);

      // Date added
      const date     = new Date(t.addedAt);
      const dateStr  = `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(2)}`;
      const dateTxt  = this.add.text(840, y + ROW_HEIGHT / 2, dateStr, {
        fontFamily: 'monospace', fontSize: '12px', color: '#005533',
      }).setOrigin(0, 0.5);
      this._rowObjects.push(dateTxt);

      // PLAY button
      const playBtn = this.add.text(SCREEN.WIDTH - 180, y + ROW_HEIGHT / 2, '[ PLAY ]', {
        fontFamily: 'monospace', fontSize: '13px',
        color: '#000000', backgroundColor: '#00ff88',
        padding: { x: 8, y: 5 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      playBtn.on('pointerover',  () => playBtn.setStyle({ backgroundColor: '#00ffaa' }));
      playBtn.on('pointerout',   () => playBtn.setStyle({ backgroundColor: '#00ff88' }));
      playBtn.on('pointerdown',  () => this._playTrack(t.id));
      this._rowObjects.push(playBtn);

      // DELETE button
      const delBtn = this.add.text(SCREEN.WIDTH - 80, y + ROW_HEIGHT / 2, '[ X ]', {
        fontFamily: 'monospace', fontSize: '13px',
        color: '#ff4400', backgroundColor: '#110000',
        padding: { x: 8, y: 5 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      delBtn.on('pointerover',  () => delBtn.setAlpha(0.7));
      delBtn.on('pointerout',   () => delBtn.setAlpha(1));
      delBtn.on('pointerdown',  () => this._deleteTrack(t.id));
      this._rowObjects.push(delBtn);
    }
  }

  _changePage(dir) {
    const pages = Math.max(1, Math.ceil(this._tracks.length / PAGE_SIZE));
    this._page = Phaser.Math.Clamp(this._page + dir, 0, pages - 1);
    this._renderPage();
  }

  async _playTrack(id) {
    try {
      if (this._activeBlobUrl) URL.revokeObjectURL(this._activeBlobUrl);
      const { beatmap, blobUrl } = await trackLibrary.loadTrack(id);
      this._activeBlobUrl = blobUrl;
      this.scene.start('GameScene', { beatmap, patientName: this._patientName });
    } catch (e) {
      console.error('[LibraryScene] Failed to load track:', e);
    }
  }

  async _deleteTrack(id) {
    try {
      await trackLibrary.deleteTrack(id);
      await this._refreshList();
    } catch (e) {
      console.error('[LibraryScene] Failed to delete track:', e);
    }
  }
}
