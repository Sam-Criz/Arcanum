import { DatabaseSync as Database } from 'node:sqlite';
import {
  EntityRevelation,
  SetRevelationDTO,
  RevelationEntityType
} from './master-tools.types';

export class RevelationService {
  constructor(private db: Database) {}

  private mapRow(row: any): EntityRevelation {
    let fields: string[] = [];
    try {
      if (row.revealed_fields) fields = JSON.parse(row.revealed_fields);
    } catch {}

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      revealed_to_user_id: row.revealed_to_user_id || null,
      revealed_fields: Array.isArray(fields) ? fields : [],
      created_at: row.created_at
    };
  }

  revealEntity(campaignId: string, dto: SetRevelationDTO): EntityRevelation {
    const targetUser = dto.revealed_to_user_id || null;
    const fieldsJson = JSON.stringify(dto.revealed_fields || []);
    const now = new Date().toISOString();

    // Verifica se já existe registro idêntico para a entidade e usuário (ou público geral)
    let existingSql = `
      SELECT id FROM entity_revelations
      WHERE campaign_id = ? AND entity_type = ? AND entity_id = ?
    `;
    const params: any[] = [campaignId, dto.entity_type, dto.entity_id];

    if (targetUser) {
      existingSql += ` AND revealed_to_user_id = ?`;
      params.push(targetUser);
    } else {
      existingSql += ` AND revealed_to_user_id IS NULL`;
    }

    const existing = this.db.prepare(existingSql).get(...params) as any;

    if (existing) {
      this.db.prepare(`
        UPDATE entity_revelations
        SET revealed_fields = ?
        WHERE id = ?
      `).run(fieldsJson, existing.id);

      return this.mapRow(this.db.prepare(`SELECT * FROM entity_revelations WHERE id = ?`).get(existing.id));
    }

    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO entity_revelations (
        id, campaign_id, entity_type, entity_id, revealed_to_user_id, revealed_fields, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, campaignId, dto.entity_type, dto.entity_id, targetUser, fieldsJson, now);

    return this.mapRow(this.db.prepare(`SELECT * FROM entity_revelations WHERE id = ?`).get(id));
  }

  unrevealEntity(campaignId: string, entityType: RevelationEntityType, entityId: string, revealedToUserId?: string | null): void {
    if (revealedToUserId !== undefined) {
      if (revealedToUserId === null) {
        this.db.prepare(`
          DELETE FROM entity_revelations
          WHERE campaign_id = ? AND entity_type = ? AND entity_id = ? AND revealed_to_user_id IS NULL
        `).run(campaignId, entityType, entityId);
      } else {
        this.db.prepare(`
          DELETE FROM entity_revelations
          WHERE campaign_id = ? AND entity_type = ? AND entity_id = ? AND revealed_to_user_id = ?
        `).run(campaignId, entityType, entityId, revealedToUserId);
      }
    } else {
      // Remove todas as revelações da entidade
      this.db.prepare(`
        DELETE FROM entity_revelations
        WHERE campaign_id = ? AND entity_type = ? AND entity_id = ?
      `).run(campaignId, entityType, entityId);
    }
  }

  getRevelationsForEntity(campaignId: string, entityType: RevelationEntityType, entityId: string): EntityRevelation[] {
    const rows = this.db.prepare(`
      SELECT er.*, u.username as revealed_to_username
      FROM entity_revelations er
      LEFT JOIN users u ON u.id = er.revealed_to_user_id
      WHERE er.campaign_id = ? AND er.entity_type = ? AND er.entity_id = ?
      ORDER BY er.created_at ASC
    `).all(campaignId, entityType, entityId) as any[];

    return rows.map(r => this.mapRow(r));
  }

  getRevelationsForUser(campaignId: string, userId: string): EntityRevelation[] {
    const rows = this.db.prepare(`
      SELECT * FROM entity_revelations
      WHERE campaign_id = ? AND (revealed_to_user_id IS NULL OR revealed_to_user_id = ?)
    `).all(campaignId, userId) as any[];

    return rows.map(r => this.mapRow(r));
  }

  /**
   * Sanitiza a entidade no backend ANTES de enviar pela rede (HTTP ou WS).
   * Se for mestre, retorna intacto.
   * Se for jogador, consulta entity_revelations e filtra os campos autorizados.
   */
  sanitizeEntityPayload(
    campaignId: string,
    entityType: RevelationEntityType,
    entity: any,
    userId: string,
    isMaster: boolean
  ): any {
    if (!entity) return null;
    if (isMaster) return entity;

    // Busca revelações ativas para este jogador ou públicas para a campanha
    const revRows = this.db.prepare(`
      SELECT revealed_fields FROM entity_revelations
      WHERE campaign_id = ? AND entity_type = ? AND entity_id = ?
        AND (revealed_to_user_id IS NULL OR revealed_to_user_id = ?)
    `).all(campaignId, entityType, entity.id, userId) as any[];

    const allowedFields = new Set<string>();
    for (const r of revRows) {
      try {
        const fields = JSON.parse(r.revealed_fields || '[]');
        for (const f of fields) allowedFields.add(f.toLowerCase());
      } catch {}
    }

    // Se não há nenhuma revelação da entidade na tabela para este jogador:
    if (allowedFields.size === 0) {
      if (entityType === 'monster') {
        if (entity.revealed_fields && Object.values(entity.revealed_fields).some(v => v === true)) {
          if (entity.revealed_fields.name) allowedFields.add('true_name');
          if (entity.revealed_fields.description) allowedFields.add('description');
          if (entity.revealed_fields.avatar) allowedFields.add('avatar');
          if (entity.revealed_fields.attributes) allowedFields.add('stats');
          if (entity.revealed_fields.defenses) allowedFields.add('weakness');
          if (entity.revealed_fields.abilities) allowedFields.add('actions');
          if (entity.revealed_fields.category) allowedFields.add('category');
        } else {
          return {
            id: entity.id,
            campaign_id: entity.campaign_id,
            name: entity.display_name_players || 'Criatura Desconhecida',
            display_name_players: entity.display_name_players || 'Criatura Desconhecida',
            category: 'Desconhecido',
            raw_data: {},
            computed_data: {},
            is_revealed: 0,
            is_placeholder: true
          };
        }
      } else if (entityType === 'npc') {
        return {
          id: entity.id,
          campaign_id: entity.campaign_id,
          name: 'Figura Enigmática',
          raw_data: {},
          computed_data: {},
          is_revealed: 0,
          is_placeholder: true
        };
      } else if (entityType === 'clue') {
        return null;
      } else {
        return { id: entity.id, is_revealed: 0 };
      }
    }

    // Se foi revelado totalmente ("*" ou "all")
    if (allowedFields.has('*') || allowedFields.has('all')) {
      return { ...entity, is_revealed: 1 };
    }

    // Sanitização granular estrita por campo
    const sanitized: Record<string, any> = {
      id: entity.id,
      campaign_id: entity.campaign_id,
      raw_data: {},
      computed_data: {},
      is_revealed: 1
    };

    // Nome
    if (allowedFields.has('name') || allowedFields.has('true_name')) {
      sanitized.name = entity.name;
    } else {
      sanitized.name = entity.display_name_players || 'Criatura Desconhecida';
    }

    // Descrição
    if (allowedFields.has('description') || allowedFields.has('desc')) {
      sanitized.description = entity.description;
    }

    // Imagens / Avatar
    if (allowedFields.has('avatar') || allowedFields.has('image') || allowedFields.has('visual')) {
      sanitized.avatar_url = entity.avatar_url;
      sanitized.token_url = entity.token_url;
      sanitized.image_url = entity.image_url;
    }

    // Estatísticas / Ficha / Atributos
    if (allowedFields.has('stats') || allowedFields.has('attributes') || allowedFields.has('ficha')) {
      sanitized.attributes = entity.attributes || entity.raw_data || entity.computed_data;
      sanitized.stats = entity.stats;
      sanitized.raw_data = entity.raw_data;
      sanitized.computed_data = entity.computed_data;
      sanitized.current_hp = entity.current_hp;
      sanitized.max_hp = entity.max_hp;
      sanitized.defense = entity.defense;
    }

    // Fraquezas / Vulnerabilidades
    if (allowedFields.has('weakness') || allowedFields.has('weaknesses') || allowedFields.has('fraquezas')) {
      const wVal = entity.weakness || entity.weaknesses || entity.raw_data?.fraqueza || entity.raw_data?.weakness || entity.properties?.weaknesses || entity.properties?.fraqueza;
      sanitized.weakness = wVal;
      sanitized.weaknesses = Array.isArray(wVal) ? wVal : (wVal ? [wVal] : (entity.weaknesses || []));
      sanitized.immunities = entity.immunities || entity.properties?.immunities || [];
    }

    // Habilidades / Magias
    if (allowedFields.has('actions') || allowedFields.has('abilities') || allowedFields.has('habilidades')) {
      sanitized.actions = entity.actions || entity.raw_data?.abilities || [];
    }

    // Categoria e Raça
    if (allowedFields.has('category') || allowedFields.has('type')) {
      sanitized.category = entity.category;
      sanitized.race = entity.race;
      sanitized.size = entity.size;
    }

    return sanitized;
  }
}
