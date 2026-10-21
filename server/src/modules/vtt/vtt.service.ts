import { sanitizeNpcDataForPlayer } from '../bestiary/bestiary.service';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { CharacterService } from '../characters/character.service';

export interface Scene {
  id: string;
  campaign_id: string;
  name: string;
  image_url: string | null;
  grid_type: 'square' | 'none' | 'hex';
  grid_size: number;
  grid_scale: number;
  grid_scale_unit: string;
  grid_color: string;
  grid_opacity: number;
  width: number;
  height: number;
  is_active: boolean;
  fog_enabled: boolean;
  fog_data: any[];
  created_at: string;
  updated_at: string;
}

export interface Token {
  id: string;
  campaign_id: string;
  scene_id: string;
  character_id: string | null;
  name: string;
  avatar_url: string | null;
  x: number;
  y: number;
  size: number;
  rotation: number;
  is_visible: boolean;
  is_locked: boolean;
  color: string;
  current_hp: number | null;
  max_hp: number | null;
  hp_percent?: number | null;
  hp_status?: string | null;
  notes: string;
  source_creature_id?: string | null;
  npc_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Metadata útil para o cliente
  owner_user_id?: string | null;
}

export class VttService {
  constructor(
    private db: DatabaseSync,
    private characterService?: CharacterService
  ) {}

  // ==========================================
  // CENAS (SCENES)
  // ==========================================

  getScenes(campaignId: string): Scene[] {
    const rows = this.db.prepare(`
      SELECT * FROM scenes 
      WHERE campaign_id = ? 
      ORDER BY created_at ASC
    `).all(campaignId) as any[];

    return rows.map(r => this.mapScene(r));
  }

  getSceneById(campaignId: string, sceneId: string): Scene | null {
    const row = this.db.prepare(`
      SELECT * FROM scenes 
      WHERE campaign_id = ? AND id = ?
    `).get(campaignId, sceneId) as any;

    return row ? this.mapScene(row) : null;
  }

  getActiveScene(campaignId: string): Scene | null {
    let row = this.db.prepare(`
      SELECT * FROM scenes 
      WHERE campaign_id = ? AND is_active = 1
      LIMIT 1
    `).get(campaignId) as any;

    if (!row) {
      // Fallback para a primeira cena da campanha se nenhuma estiver explicitamente ativa
      row = this.db.prepare(`
        SELECT * FROM scenes 
        WHERE campaign_id = ? 
        ORDER BY created_at ASC 
        LIMIT 1
      `).get(campaignId) as any;
    }

    return row ? this.mapScene(row) : null;
  }

  createScene(campaignId: string, data: {
    name: string;
    image_url?: string | null;
    grid_type?: 'square' | 'none' | 'hex';
    grid_size?: number;
    grid_scale?: number;
    grid_scale_unit?: string;
    grid_color?: string;
    grid_opacity?: number;
    width?: number;
    height?: number;
    is_active?: boolean;
    fog_enabled?: boolean;
    fog_data?: any[];
  }): Scene {
    const id = crypto.randomUUID();
    const name = data.name.trim();
    if (!name) throw new Error('O nome da cena é obrigatório.');

    // Se a nova cena for ativa, desativa as demais
    if (data.is_active) {
      this.db.prepare(`UPDATE scenes SET is_active = 0 WHERE campaign_id = ?`).run(campaignId);
    } else {
      // Se não há nenhuma cena na campanha, torna esta a ativa
      const countRow = this.db.prepare(`SELECT COUNT(*) as c FROM scenes WHERE campaign_id = ?`).get(campaignId) as any;
      if (countRow.c === 0) {
        data.is_active = true;
      }
    }

    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO scenes (
        id, campaign_id, name, image_url, grid_type, grid_size, grid_scale, 
        grid_scale_unit, grid_color, grid_opacity, width, height, 
        is_active, fog_enabled, fog_data_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      campaignId,
      name,
      data.image_url || null,
      data.grid_type || 'square',
      data.grid_size || 50,
      data.grid_scale || 1.5,
      data.grid_scale_unit || 'm',
      data.grid_color || '#ffffff',
      data.grid_opacity ?? 0.3,
      data.width || 2000,
      data.height || 2000,
      data.is_active ? 1 : 0,
      data.fog_enabled ? 1 : 0,
      JSON.stringify(data.fog_data || []),
      now,
      now
    );

    return this.getSceneById(campaignId, id)!;
  }

  updateScene(campaignId: string, sceneId: string, data: {
    name?: string;
    image_url?: string | null;
    grid_type?: 'square' | 'none' | 'hex';
    grid_size?: number;
    grid_scale?: number;
    grid_scale_unit?: string;
    grid_color?: string;
    grid_opacity?: number;
    width?: number;
    height?: number;
    is_active?: boolean;
    fog_enabled?: boolean;
    fog_data?: any[];
  }): Scene {
    const existing = this.getSceneById(campaignId, sceneId);
    if (!existing) throw new Error('Cena não encontrada.');

    if (data.is_active) {
      this.db.prepare(`UPDATE scenes SET is_active = 0 WHERE campaign_id = ?`).run(campaignId);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new Error('O nome da cena não pode ser vazio.');
      updates.push('name = ?');
      params.push(name);
    }
    if (data.image_url !== undefined) {
      updates.push('image_url = ?');
      params.push(data.image_url);
    }
    if (data.grid_type !== undefined) {
      updates.push('grid_type = ?');
      params.push(data.grid_type);
    }
    if (data.grid_size !== undefined) {
      updates.push('grid_size = ?');
      params.push(Math.max(10, Math.min(500, data.grid_size)));
    }
    if (data.grid_scale !== undefined) {
      updates.push('grid_scale = ?');
      params.push(data.grid_scale);
    }
    if (data.grid_scale_unit !== undefined) {
      updates.push('grid_scale_unit = ?');
      params.push(data.grid_scale_unit);
    }
    if (data.grid_color !== undefined) {
      updates.push('grid_color = ?');
      params.push(data.grid_color);
    }
    if (data.grid_opacity !== undefined) {
      updates.push('grid_opacity = ?');
      params.push(Math.max(0, Math.min(1, data.grid_opacity)));
    }
    if (data.width !== undefined) {
      updates.push('width = ?');
      params.push(Math.max(500, Math.min(10000, data.width)));
    }
    if (data.height !== undefined) {
      updates.push('height = ?');
      params.push(Math.max(500, Math.min(10000, data.height)));
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(data.is_active ? 1 : 0);
    }
    if (data.fog_enabled !== undefined) {
      updates.push('fog_enabled = ?');
      params.push(data.fog_enabled ? 1 : 0);
    }
    if (data.fog_data !== undefined) {
      updates.push('fog_data_json = ?');
      params.push(JSON.stringify(data.fog_data));
    }

    updates.push("updated_at = datetime('now')");
    params.push(campaignId, sceneId);

    this.db.prepare(`
      UPDATE scenes 
      SET ${updates.join(', ')} 
      WHERE campaign_id = ? AND id = ?
    `).run(...params);

    return this.getSceneById(campaignId, sceneId)!;
  }

  setActiveScene(campaignId: string, sceneId: string): Scene {
    const scene = this.getSceneById(campaignId, sceneId);
    if (!scene) throw new Error('Cena não encontrada.');

    this.db.prepare(`UPDATE scenes SET is_active = 0 WHERE campaign_id = ?`).run(campaignId);
    this.db.prepare(`UPDATE scenes SET is_active = 1, updated_at = datetime('now') WHERE campaign_id = ? AND id = ?`).run(campaignId, sceneId);

    return this.getSceneById(campaignId, sceneId)!;
  }

  deleteScene(campaignId: string, sceneId: string): void {
    const existing = this.getSceneById(campaignId, sceneId);
    if (!existing) throw new Error('Cena não encontrada.');

    this.db.prepare(`DELETE FROM scenes WHERE campaign_id = ? AND id = ?`).run(campaignId, sceneId);

    // Se a cena removida era a ativa, ativa a primeira que restar
    if (existing.is_active) {
      const remaining = this.db.prepare(`
        SELECT id FROM scenes WHERE campaign_id = ? ORDER BY created_at ASC LIMIT 1
      `).get(campaignId) as any;
      if (remaining) {
        this.db.prepare(`UPDATE scenes SET is_active = 1 WHERE campaign_id = ? AND id = ?`).run(campaignId, remaining.id);
      }
    }
  }

  // ==========================================
  // TOKENS (VTT TOKENS)
  // ==========================================

  getTokens(campaignId: string, sceneId: string, isMaster: boolean, userId?: string): Token[] {
    let sql = `
      SELECT t.*, c.user_id as character_owner_id
      FROM tokens t
      LEFT JOIN characters c ON c.id = t.character_id
      WHERE t.campaign_id = ? AND t.scene_id = ?
    `;
    const params: any[] = [campaignId, sceneId];

    if (!isMaster) {
      // Jogadores comuns só visualizam tokens com is_visible = 1
      // (Tokens ocultos pelo mestre são protegidos no backend contra inspeção de DOM/Network)
      sql += ` AND t.is_visible = 1`;
    }

    sql += ` ORDER BY t.created_at ASC`;

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapToken(r, isMaster));
  }

  getTokenById(campaignId: string, tokenId: string, isMaster: boolean = true): Token | null {
    const row = this.db.prepare(`
      SELECT t.*, c.user_id as character_owner_id
      FROM tokens t
      LEFT JOIN characters c ON c.id = t.character_id
      WHERE t.campaign_id = ? AND t.id = ?
    `).get(campaignId, tokenId) as any;

    if (!row) return null;
    if (!isMaster && row.is_visible === 0) return null;
    return this.mapToken(row, isMaster);
  }

  createToken(campaignId: string, sceneId: string, data: {
    character_id?: string | null;
    source_creature_id?: string | null;
    name?: string;
    avatar_url?: string | null;
    x?: number;
    y?: number;
    size?: number;
    rotation?: number;
    is_visible?: boolean;
    is_locked?: boolean;
    color?: string;
    current_hp?: number | null;
    max_hp?: number | null;
    notes?: string;
    npc_data?: Record<string, any>;
  }): Token {
    const scene = this.getSceneById(campaignId, sceneId);
    if (!scene) throw new Error('Cena não encontrada.');

    let name = data.name?.trim();
    let avatarUrl: string | null = data.avatar_url || null;
    let currentHp = data.current_hp ?? null;
    let maxHp = data.max_hp ?? null;

    if (data.character_id && this.characterService) {
      const char = this.characterService.getCharacterById(campaignId, data.character_id);
      if (char) {
        if (!name) name = char.name;
        if (!avatarUrl) avatarUrl = char.avatar_url || null;
        // Tentar obter HP das variáveis computadas da ficha
        const cd = char.computed_data || {};
        if (currentHp === null) {
          currentHp = cd.vida_atual ?? cd.pv_atual ?? cd.vida ?? cd.pv ?? cd.hp ?? null;
        }
        if (maxHp === null) {
          maxHp = cd.vida_maxima ?? cd.pv_maximo ?? cd.vida_max ?? cd.pv_max ?? cd.max_hp ?? null;
        }
      }
    }

    if (currentHp === null && data.npc_data?.current_hp !== undefined) {
      currentHp = Number(data.npc_data.current_hp);
    }
    if (maxHp === null && data.npc_data?.max_hp !== undefined) {
      maxHp = Number(data.npc_data.max_hp);
    }

    if (!name) {
      name = 'Token';
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const npcData = data.npc_data || {};

    this.db.prepare(`
      INSERT INTO tokens (
        id, campaign_id, scene_id, character_id, source_creature_id, name, avatar_url,
        x, y, size, rotation, is_visible, is_locked, color,
        current_hp, max_hp, notes, npc_data_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      campaignId,
      sceneId,
      data.character_id || null,
      data.source_creature_id || null,
      name,
      avatarUrl,
      data.x ?? 0,
      data.y ?? 0,
      data.size ?? 1,
      data.rotation ?? 0,
      data.is_visible !== undefined ? (data.is_visible ? 1 : 0) : 1,
      data.is_locked ? 1 : 0,
      data.color || '#4f46e5',
      currentHp,
      maxHp,
      data.notes || '',
      JSON.stringify(npcData),
      now,
      now
    );

    return this.getTokenById(campaignId, id, true)!;
  }

  updateToken(
    campaignId: string, 
    tokenId: string, 
    data: {
      x?: number;
      y?: number;
      size?: number;
      rotation?: number;
      name?: string;
      avatar_url?: string | null;
      is_visible?: boolean;
      is_locked?: boolean;
      color?: string;
      current_hp?: number | null;
      max_hp?: number | null;
      notes?: string;
      npc_data?: Record<string, any>;
    }, 
    userId: string, 
    isMaster: boolean
  ): Token {
    const existing = this.getTokenById(campaignId, tokenId);
    if (!existing) throw new Error('Token não encontrado.');

    // Verificação de permissões:
    // Se não for mestre, o usuário SÓ pode mover tokens vinculados ao seu próprio personagem
    if (!isMaster) {
      if (!existing.character_id || existing.owner_user_id !== userId) {
        throw new Error('Você não tem permissão para mover ou alterar este token.');
      }
      if (existing.is_locked) {
        throw new Error('Este token está bloqueado para movimentação.');
      }
      // Jogador comum NÃO pode alterar visibilidade, travamento, hp ou notas pelo update de token
      if (data.is_visible !== undefined || data.is_locked !== undefined) {
        throw new Error('Apenas o mestre pode alterar as propriedades de visibilidade e travamento do token.');
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.x !== undefined) {
      updates.push('x = ?');
      params.push(data.x);
    }
    if (data.y !== undefined) {
      updates.push('y = ?');
      params.push(data.y);
    }
    if (data.rotation !== undefined) {
      updates.push('rotation = ?');
      params.push(data.rotation);
    }

    // Propriedades administrativas restritas ao Mestre
    if (isMaster) {
      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name.trim() || 'Token');
      }
      if (data.avatar_url !== undefined) {
        updates.push('avatar_url = ?');
        params.push(data.avatar_url);
      }
      if (data.size !== undefined) {
        updates.push('size = ?');
        params.push(Math.max(0.5, Math.min(10, data.size)));
      }
      if (data.is_visible !== undefined) {
        updates.push('is_visible = ?');
        params.push(data.is_visible ? 1 : 0);
      }
      if (data.is_locked !== undefined) {
        updates.push('is_locked = ?');
        params.push(data.is_locked ? 1 : 0);
      }
      if (data.color !== undefined) {
        updates.push('color = ?');
        params.push(data.color);
      }
      if (data.current_hp !== undefined) {
        updates.push('current_hp = ?');
        params.push(data.current_hp);
      }
      if (data.max_hp !== undefined) {
        updates.push('max_hp = ?');
        params.push(data.max_hp);
      }
      if (data.notes !== undefined) {
        updates.push('notes = ?');
        params.push(data.notes);
      }
      if (data.npc_data !== undefined) {
        updates.push('npc_data_json = ?');
        params.push(JSON.stringify(data.npc_data));
      }
    }

    updates.push("updated_at = datetime('now')");
    params.push(campaignId, tokenId);

    this.db.prepare(`
      UPDATE tokens 
      SET ${updates.join(', ')} 
      WHERE campaign_id = ? AND id = ?
    `).run(...params);

    return this.getTokenById(campaignId, tokenId)!;
  }

  deleteToken(campaignId: string, tokenId: string, userId: string, isMaster: boolean): void {
    const existing = this.getTokenById(campaignId, tokenId);
    if (!existing) throw new Error('Token não encontrado.');

    if (!isMaster) {
      if (!existing.character_id || existing.owner_user_id !== userId) {
        throw new Error('Você não tem permissão para remover este token.');
      }
    }

    this.db.prepare(`DELETE FROM tokens WHERE campaign_id = ? AND id = ?`).run(campaignId, tokenId);
  }

  private mapScene(row: any): Scene {
    let fogData = [];
    try {
      fogData = JSON.parse(row.fog_data_json || '[]');
    } catch {
      fogData = [];
    }

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      name: row.name,
      image_url: row.image_url,
      grid_type: row.grid_type,
      grid_size: row.grid_size,
      grid_scale: row.grid_scale,
      grid_scale_unit: row.grid_scale_unit,
      grid_color: row.grid_color,
      grid_opacity: row.grid_opacity,
      width: row.width,
      height: row.height,
      is_active: row.is_active === 1,
      fog_enabled: row.fog_enabled === 1,
      fog_data: fogData,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private mapToken(row: any, isMaster: boolean = true): Token {
    let npcData: Record<string, any> = {};
    try {
      npcData = JSON.parse(row.npc_data_json || '{}');
    } catch {}

    let name = row.name;
    let curHp = row.current_hp !== null ? Number(row.current_hp) : null;
    let maxHp = row.max_hp !== null ? Number(row.max_hp) : null;
    let notes = row.notes || '';
    let hpPercent: number | null = null;
    let hpStatus: 'healthy' | 'injured' | 'bloodied' | 'critical' | 'defeated' | null = null;

    if (maxHp && maxHp > 0 && curHp !== null) {
      hpPercent = Math.max(0, Math.min(100, Math.round((curHp / maxHp) * 100)));
      if (curHp <= 0) hpStatus = 'defeated';
      else if (hpPercent <= 25) hpStatus = 'critical';
      else if (hpPercent <= 50) hpStatus = 'bloodied';
      else if (hpPercent <= 75) hpStatus = 'injured';
      else hpStatus = 'healthy';
    }

    const revealed = npcData.revealed_fields || {};

    if (!isMaster) {
      if (!revealed.name && npcData.display_name_players) {
        name = npcData.display_name_players;
      }
      if (!revealed.exact_hp || npcData.hide_exact_hp === true) {
        curHp = null;
        maxHp = null;
      }
      notes = '';
      npcData = sanitizeNpcDataForPlayer(npcData, revealed);
    }

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      scene_id: row.scene_id,
      character_id: row.character_id,
      source_creature_id: row.source_creature_id || null,
      name,
      avatar_url: row.avatar_url,
      x: Number(row.x),
      y: Number(row.y),
      size: Number(row.size),
      rotation: Number(row.rotation),
      is_visible: row.is_visible === 1,
      is_locked: row.is_locked === 1,
      color: row.color || '#4f46e5',
      current_hp: curHp,
      max_hp: maxHp,
      hp_percent: hpPercent,
      hp_status: hpStatus,
      notes,
      npc_data: npcData,
      created_at: row.created_at,
      updated_at: row.updated_at,
      owner_user_id: row.character_owner_id || null
    };
  }
}
