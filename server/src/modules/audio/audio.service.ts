import { DatabaseSync as Database } from 'node:sqlite';
import crypto from 'crypto';

export interface AudioTrack {
  id: string;
  campaign_id: string;
  title: string;
  youtube_url: string;
  youtube_video_id: string;
  added_by: string;
  added_by_username?: string;
  is_playing: number;
  volume: number;
  created_at: string;
}

export class AudioService {
  constructor(private db: Database) {}

  public static extractYouTubeId(url: string): string | null {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();

    // Direct 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    // Standard YouTube URL formats
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = trimmed.match(regExp);
    return match ? match[1] : null;
  }

  listTracks(campaignId: string): { tracks: AudioTrack[]; currentTrack: AudioTrack | null } {
    const rows = this.db.prepare(`
      SELECT a.*, u.username as added_by_username
      FROM campaign_audio_tracks a
      LEFT JOIN users u ON a.added_by = u.id
      WHERE a.campaign_id = ?
      ORDER BY a.created_at ASC
    `).all(campaignId) as any[];

    const tracks: AudioTrack[] = rows.map(r => ({
      id: r.id,
      campaign_id: r.campaign_id,
      title: r.title,
      youtube_url: r.youtube_url,
      youtube_video_id: r.youtube_video_id,
      added_by: r.added_by,
      added_by_username: r.added_by_username || 'Aventureiro',
      is_playing: Number(r.is_playing) || 0,
      volume: Number(r.volume) || 80,
      created_at: r.created_at
    }));

    const currentTrack = tracks.find(t => t.is_playing === 1) || null;

    return { tracks, currentTrack };
  }

  addTrack(campaignId: string, userId: string, data: { title: string; youtube_url: string; volume?: number }): AudioTrack {
    if (!data.title || !data.title.trim()) {
      throw new Error('O título da trilha de áudio é obrigatório.');
    }
    if (!data.youtube_url || !data.youtube_url.trim()) {
      throw new Error('O link do YouTube é obrigatório.');
    }

    const videoId = AudioService.extractYouTubeId(data.youtube_url);
    if (!videoId) {
      throw new Error('Link do YouTube inválido. Forneça uma URL válida ou ID do vídeo.');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const volume = typeof data.volume === 'number' && data.volume >= 0 && data.volume <= 100 ? data.volume : 80;

    this.db.prepare(`
      INSERT INTO campaign_audio_tracks (
        id, campaign_id, title, youtube_url, youtube_video_id, added_by, is_playing, volume, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(id, campaignId, data.title.trim(), data.youtube_url.trim(), videoId, userId, volume, now);

    return {
      id,
      campaign_id: campaignId,
      title: data.title.trim(),
      youtube_url: data.youtube_url.trim(),
      youtube_video_id: videoId,
      added_by: userId,
      is_playing: 0,
      volume,
      created_at: now
    };
  }

  playTrack(campaignId: string, trackId: string): AudioTrack {
    const existing = this.db.prepare(`
      SELECT * FROM campaign_audio_tracks WHERE id = ? AND campaign_id = ?
    `).get(trackId, campaignId) as any;

    if (!existing) {
      throw new Error('Trilha sonora não encontrada nesta campanha.');
    }

    // Atomic transaction: stop all, then activate this one
    this.db.exec('BEGIN TRANSACTION;');
    try {
      this.db.prepare(`
        UPDATE campaign_audio_tracks SET is_playing = 0 WHERE campaign_id = ?
      `).run(campaignId);

      this.db.prepare(`
        UPDATE campaign_audio_tracks SET is_playing = 1 WHERE id = ? AND campaign_id = ?
      `).run(trackId, campaignId);

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    return {
      ...existing,
      is_playing: 1,
      volume: Number(existing.volume) || 80
    };
  }

  pauseTrack(campaignId: string): void {
    this.db.prepare(`
      UPDATE campaign_audio_tracks SET is_playing = 0 WHERE campaign_id = ?
    `).run(campaignId);
  }

  deleteTrack(campaignId: string, trackId: string): void {
    const res = this.db.prepare(`
      DELETE FROM campaign_audio_tracks WHERE id = ? AND campaign_id = ?
    `).run(trackId, campaignId);

    if (res.changes === 0) {
      throw new Error('Trilha de áudio não encontrada para exclusão.');
    }
  }
}
