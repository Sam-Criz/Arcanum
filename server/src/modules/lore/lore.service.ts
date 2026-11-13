import { DatabaseSync as Database } from 'node:sqlite';
import crypto from 'crypto';

export interface CharacterLoreEntry {
  id: string;
  campaign_id: string;
  character_id: string;
  author_user_id: string;
  author_username?: string;
  title: string;
  content: string;
  visibility: 'private_gm' | 'public';
  created_at: string;
  updated_at: string;
}

export class LoreService {
  constructor(private db: Database) {}

  private getCharacter(campaignId: string, characterId: string): any {
    const char = this.db.prepare(`
      SELECT * FROM characters WHERE id = ? AND campaign_id = ?
    `).get(characterId, campaignId) as any;

    if (!char) {
      throw new Error('Personagem não encontrado nesta campanha.');
    }
    return char;
  }

  listLore(campaignId: string, characterId: string, userId: string, isMaster: boolean): CharacterLoreEntry[] {
    const char = this.getCharacter(campaignId, characterId);
    const isOwner = char.user_id === userId;

    let query = `
      SELECT l.*, u.username as author_username
      FROM character_lore_entries l
      LEFT JOIN users u ON l.author_user_id = u.id
      WHERE l.campaign_id = ? AND l.character_id = ?
    `;

    // Se NÃO for nem o dono da ficha nem o mestre, filtra estritamente as entradas públicas
    if (!isMaster && !isOwner) {
      query += ` AND l.visibility = 'public'`;
    }

    query += ` ORDER BY l.created_at DESC`;

    const rows = this.db.prepare(query).all(campaignId, characterId) as any[];

    return rows.map(r => ({
      id: r.id,
      campaign_id: r.campaign_id,
      character_id: r.character_id,
      author_user_id: r.author_user_id,
      author_username: r.author_username || 'Desconhecido',
      title: r.title,
      content: r.content,
      visibility: r.visibility as 'private_gm' | 'public',
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
  }

  getLoreById(campaignId: string, characterId: string, loreId: string, userId: string, isMaster: boolean): CharacterLoreEntry {
    const char = this.getCharacter(campaignId, characterId);
    const isOwner = char.user_id === userId;

    const row = this.db.prepare(`
      SELECT l.*, u.username as author_username
      FROM character_lore_entries l
      LEFT JOIN users u ON l.author_user_id = u.id
      WHERE l.id = ? AND l.campaign_id = ? AND l.character_id = ?
    `).get(loreId, campaignId, characterId) as any;

    if (!row) {
      const err: any = new Error('Crônica ou nota de lore não encontrada.');
      err.status = 404;
      throw err;
    }

    // Se for privado e o usuário não for nem mestre nem dono da ficha -> 404 estrito (vazamento zero)
    if (row.visibility === 'private_gm' && !isMaster && !isOwner) {
      const err: any = new Error('Crônica ou nota de lore não encontrada.');
      err.status = 404;
      throw err;
    }

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      character_id: row.character_id,
      author_user_id: row.author_user_id,
      author_username: row.author_username || 'Desconhecido',
      title: row.title,
      content: row.content,
      visibility: row.visibility as 'private_gm' | 'public',
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  createLore(
    campaignId: string,
    characterId: string,
    userId: string,
    isMaster: boolean,
    data: { title: string; content: string; visibility?: 'private_gm' | 'public' }
  ): CharacterLoreEntry {
    const char = this.getCharacter(campaignId, characterId);
    const isOwner = char.user_id === userId;

    if (!isMaster && !isOwner) {
      const err: any = new Error('Apenas o proprietário da ficha ou o Mestre podem adicionar registros de lore a este personagem.');
      err.status = 403;
      throw err;
    }

    if (!data.title || !data.title.trim()) {
      throw new Error('O título do registro de lore é obrigatório.');
    }
    if (data.content === undefined || data.content === null) {
      throw new Error('O conteúdo do registro de lore é obrigatório.');
    }

    const visibility = data.visibility === 'private_gm' ? 'private_gm' : 'public';
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO character_lore_entries (
        id, campaign_id, character_id, author_user_id, title, content, visibility, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, campaignId, characterId, userId, data.title.trim(), data.content, visibility, now, now);

    return {
      id,
      campaign_id: campaignId,
      character_id: characterId,
      author_user_id: userId,
      title: data.title.trim(),
      content: data.content,
      visibility,
      created_at: now,
      updated_at: now
    };
  }

  updateLore(
    campaignId: string,
    characterId: string,
    loreId: string,
    userId: string,
    isMaster: boolean,
    data: { title?: string; content?: string; visibility?: 'private_gm' | 'public' }
  ): CharacterLoreEntry {
    const existing = this.getLoreById(campaignId, characterId, loreId, userId, isMaster);
    const char = this.getCharacter(campaignId, characterId);
    const isOwner = char.user_id === userId;
    const isAuthor = existing.author_user_id === userId;

    if (!isMaster && !isOwner && !isAuthor) {
      const err: any = new Error('Sem permissão para alterar este registro de lore.');
      err.status = 403;
      throw err;
    }

    const newTitle = data.title !== undefined ? data.title.trim() : existing.title;
    if (!newTitle) {
      throw new Error('O título não pode ser vazio.');
    }
    const newContent = data.content !== undefined ? data.content : existing.content;
    const newVisibility = data.visibility !== undefined ? (data.visibility === 'private_gm' ? 'private_gm' : 'public') : existing.visibility;
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE character_lore_entries
      SET title = ?, content = ?, visibility = ?, updated_at = ?
      WHERE id = ? AND campaign_id = ? AND character_id = ?
    `).run(newTitle, newContent, newVisibility, now, loreId, campaignId, characterId);

    return {
      ...existing,
      title: newTitle,
      content: newContent,
      visibility: newVisibility,
      updated_at: now
    };
  }

  deleteLore(campaignId: string, characterId: string, loreId: string, userId: string, isMaster: boolean): void {
    const existing = this.getLoreById(campaignId, characterId, loreId, userId, isMaster);
    const char = this.getCharacter(campaignId, characterId);
    const isOwner = char.user_id === userId;
    const isAuthor = existing.author_user_id === userId;

    if (!isMaster && !isOwner && !isAuthor) {
      const err: any = new Error('Sem permissão para excluir este registro de lore.');
      err.status = 403;
      throw err;
    }

    this.db.prepare(`
      DELETE FROM character_lore_entries WHERE id = ? AND campaign_id = ? AND character_id = ?
    `).run(loreId, campaignId, characterId);
  }
}
