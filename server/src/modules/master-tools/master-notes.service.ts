import { DatabaseSync as Database } from 'node:sqlite';
import {
  MasterNote,
  CreateMasterNoteDTO,
  UpdateMasterNoteDTO
} from './master-tools.types';

export class MasterNotesService {
  constructor(private db: Database) {}

  private mapRow(row: any): MasterNote {
    let tags: string[] = [];
    let sharedWith: string[] = [];

    try {
      if (row.tags) tags = JSON.parse(row.tags);
    } catch {}
    try {
      if (row.shared_with_user_ids) sharedWith = JSON.parse(row.shared_with_user_ids);
    } catch {}

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      scene_id: row.scene_id || null,
      entity_type: row.entity_type || null,
      entity_id: row.entity_id || null,
      title: row.title,
      content: row.content,
      category: row.category || 'general',
      tags: Array.isArray(tags) ? tags : [],
      is_private: Number(row.is_private) || 0,
      shared_with_user_ids: Array.isArray(sharedWith) ? sharedWith : [],
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  createNote(campaignId: string, userId: string, data: CreateMasterNoteDTO): MasterNote {
    if (!data.title || !data.title.trim()) {
      throw new Error('O título da nota é obrigatório.');
    }
    if (data.content === undefined || data.content === null) {
      throw new Error('O conteúdo da nota é obrigatório.');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const isPrivate = data.is_private === false || data.is_private === 0 ? 0 : 1;
    const tagsJson = JSON.stringify(data.tags || []);
    const sharedJson = JSON.stringify(data.shared_with_user_ids || []);

    this.db.prepare(`
      INSERT INTO master_notes (
        id, campaign_id, scene_id, entity_type, entity_id,
        title, content, category, tags, is_private,
        shared_with_user_ids, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      campaignId,
      data.scene_id || null,
      data.entity_type || null,
      data.entity_id || null,
      data.title.trim(),
      data.content,
      data.category?.trim() || 'general',
      tagsJson,
      isPrivate,
      sharedJson,
      userId,
      now,
      now
    );

    return this.getNoteById(campaignId, id, userId, true)!;
  }

  getNotes(
    campaignId: string,
    userId: string,
    isMaster: boolean,
    filters?: { sceneId?: string; entityType?: string; entityId?: string; category?: string; tag?: string }
  ): MasterNote[] {
    let sql = `SELECT * FROM master_notes WHERE campaign_id = ?`;
    const params: any[] = [campaignId];

    if (!isMaster) {
      // Security Auditor: Jogador comum só acessa se for pública OU compartilhada com ele explicitamente
      sql += ` AND (is_private = 0 OR shared_with_user_ids LIKE ?)`;
      params.push(`%"${userId}"%`);
    }

    if (filters?.sceneId) {
      sql += ` AND scene_id = ?`;
      params.push(filters.sceneId);
    }
    if (filters?.entityType) {
      sql += ` AND entity_type = ?`;
      params.push(filters.entityType);
    }
    if (filters?.entityId) {
      sql += ` AND entity_id = ?`;
      params.push(filters.entityId);
    }
    if (filters?.category && filters.category !== 'all') {
      sql += ` AND category = ?`;
      params.push(filters.category);
    }
    if (filters?.tag) {
      sql += ` AND tags LIKE ?`;
      params.push(`%"${filters.tag}"%`);
    }

    sql += ` ORDER BY updated_at DESC`;

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getNoteById(campaignId: string, noteId: string, userId: string, isMaster: boolean): MasterNote | null {
    const row = this.db.prepare(`
      SELECT * FROM master_notes WHERE campaign_id = ? AND id = ?
    `).get(campaignId, noteId) as any;

    if (!row) return null;
    const note = this.mapRow(row);

    // Security Auditor: Zero leakage - se jogador comum tentar nota privada sem acesso, responde null (404 no controller)
    if (!isMaster) {
      const isSharedWithUser = note.shared_with_user_ids.includes(userId);
      if (note.is_private && !isSharedWithUser) {
        return null;
      }
    }

    return note;
  }

  updateNote(campaignId: string, noteId: string, data: UpdateMasterNoteDTO, userId: string, isMaster: boolean): MasterNote {
    const existing = this.getNoteById(campaignId, noteId, userId, isMaster);
    if (!existing) {
      throw new Error('Nota não encontrada.');
    }

    // Apenas mestre ou o autor da nota pode editá-la
    if (!isMaster && existing.created_by !== userId) {
      throw new Error('Você não tem permissão para editar esta nota.');
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title.trim());
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content);
    }
    if (data.category !== undefined) {
      updates.push('category = ?');
      params.push(data.category.trim());
    }
    if (data.scene_id !== undefined) {
      updates.push('scene_id = ?');
      params.push(data.scene_id || null);
    }
    if (data.entity_type !== undefined) {
      updates.push('entity_type = ?');
      params.push(data.entity_type || null);
    }
    if (data.entity_id !== undefined) {
      updates.push('entity_id = ?');
      params.push(data.entity_id || null);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(data.tags));
    }
    if (data.is_private !== undefined) {
      updates.push('is_private = ?');
      params.push(data.is_private === true || data.is_private === 1 ? 1 : 0);
    }
    if (data.shared_with_user_ids !== undefined) {
      updates.push('shared_with_user_ids = ?');
      params.push(JSON.stringify(data.shared_with_user_ids));
    }

    const now = new Date().toISOString();
    updates.push('updated_at = ?');
    params.push(now);

    params.push(campaignId, noteId);

    this.db.prepare(`
      UPDATE master_notes
      SET ${updates.join(', ')}
      WHERE campaign_id = ? AND id = ?
    `).run(...params);

    return this.getNoteById(campaignId, noteId, userId, isMaster)!;
  }

  deleteNote(campaignId: string, noteId: string, userId: string, isMaster: boolean): void {
    const existing = this.getNoteById(campaignId, noteId, userId, isMaster);
    if (!existing) {
      throw new Error('Nota não encontrada.');
    }
    if (!isMaster && existing.created_by !== userId) {
      throw new Error('Você não tem permissão para excluir esta nota.');
    }

    this.db.prepare(`
      DELETE FROM master_notes WHERE campaign_id = ? AND id = ?
    `).run(campaignId, noteId);
  }

  shareNote(campaignId: string, noteId: string, userIds: string[], isPrivate?: boolean): MasterNote {
    const existing = this.getNoteById(campaignId, noteId, '', true);
    if (!existing) {
      throw new Error('Nota não encontrada.');
    }

    const now = new Date().toISOString();
    const nextPrivate = isPrivate !== undefined ? (isPrivate ? 1 : 0) : existing.is_private;

    this.db.prepare(`
      UPDATE master_notes
      SET shared_with_user_ids = ?, is_private = ?, updated_at = ?
      WHERE campaign_id = ? AND id = ?
    `).run(JSON.stringify(userIds), nextPrivate, now, campaignId, noteId);

    return this.getNoteById(campaignId, noteId, '', true)!;
  }
}
