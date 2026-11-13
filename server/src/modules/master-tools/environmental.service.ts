import { DatabaseSync as Database } from 'node:sqlite';
import { Evaluator } from '../rules-engine/evaluator';
import {
  EnvironmentalCondition,
  CreateEnvironmentalConditionDTO,
  UpdateEnvironmentalConditionDTO
} from './master-tools.types';

export class EnvironmentalService {
  constructor(private db: Database) {}

  private mapRow(row: any): EnvironmentalCondition {
    let effectPayload = null;
    try {
      if (row.effect_payload) {
        effectPayload = JSON.parse(row.effect_payload);
      }
    } catch {
      effectPayload = null;
    }

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      scene_id: row.scene_id || null,
      name: row.name,
      description: row.description || null,
      icon: row.icon || null,
      is_active: Number(row.is_active) || 0,
      is_visible_to_players: Number(row.is_visible_to_players) || 0,
      duration_rounds: row.duration_rounds !== null && row.duration_rounds !== undefined ? Number(row.duration_rounds) : null,
      rule_modifier_id: row.rule_modifier_id || null,
      effect_payload: effectPayload,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  createCondition(campaignId: string, data: CreateEnvironmentalConditionDTO): EnvironmentalCondition {
    if (!data.name || !data.name.trim()) {
      throw new Error('O nome da condição ambiental é obrigatório.');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const isActive = data.is_active === false || data.is_active === 0 ? 0 : 1;
    const isVisible = data.is_visible_to_players === false || data.is_visible_to_players === 0 ? 0 : 1;
    const effectJson = data.effect_payload ? JSON.stringify(data.effect_payload) : null;

    this.db.prepare(`
      INSERT INTO environmental_conditions (
        id, campaign_id, scene_id, name, description, icon,
        is_active, is_visible_to_players, duration_rounds,
        rule_modifier_id, effect_payload, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      campaignId,
      data.scene_id || null,
      data.name.trim(),
      data.description?.trim() || null,
      data.icon?.trim() || null,
      isActive,
      isVisible,
      data.duration_rounds !== undefined && data.duration_rounds !== null ? Number(data.duration_rounds) : null,
      data.rule_modifier_id?.trim() || null,
      effectJson,
      now,
      now
    );

    return this.getConditionById(campaignId, id, true)!;
  }

  getConditions(campaignId: string, sceneId?: string | null, isMaster: boolean = true): EnvironmentalCondition[] {
    let sql = `SELECT * FROM environmental_conditions WHERE campaign_id = ?`;
    const params: any[] = [campaignId];

    if (sceneId !== undefined && sceneId !== '' && sceneId !== 'null' && sceneId !== 'undefined') {
      if (sceneId === null) {
        sql += ` AND scene_id IS NULL`;
      } else {
        sql += ` AND (scene_id = ? OR scene_id IS NULL)`;
        params.push(sceneId);
      }
    } else if (sceneId === null) {
      sql += ` AND scene_id IS NULL`;
    }

    if (!isMaster) {
      sql += ` AND is_visible_to_players = 1 AND is_active = 1`;
    }

    sql += ` ORDER BY created_at ASC`;

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getConditionById(campaignId: string, id: string, isMaster: boolean = true): EnvironmentalCondition | null {
    const row = this.db.prepare(`
      SELECT * FROM environmental_conditions WHERE campaign_id = ? AND id = ?
    `).get(campaignId, id) as any;

    if (!row) return null;
    const cond = this.mapRow(row);

    if (!isMaster && (!cond.is_visible_to_players || !cond.is_active)) {
      return null;
    }

    return cond;
  }

  updateCondition(campaignId: string, id: string, data: UpdateEnvironmentalConditionDTO): EnvironmentalCondition {
    const existing = this.getConditionById(campaignId, id, true);
    if (!existing) {
      throw new Error('Condição ambiental não encontrada.');
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name.trim());
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description ? data.description.trim() : null);
    }
    if (data.icon !== undefined) {
      updates.push('icon = ?');
      params.push(data.icon ? data.icon.trim() : null);
    }
    if (data.scene_id !== undefined) {
      updates.push('scene_id = ?');
      params.push(data.scene_id || null);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(data.is_active === true || data.is_active === 1 ? 1 : 0);
    }
    if (data.is_visible_to_players !== undefined) {
      updates.push('is_visible_to_players = ?');
      params.push(data.is_visible_to_players === true || data.is_visible_to_players === 1 ? 1 : 0);
    }
    if (data.duration_rounds !== undefined) {
      updates.push('duration_rounds = ?');
      params.push(data.duration_rounds !== null ? Number(data.duration_rounds) : null);
    }
    if (data.rule_modifier_id !== undefined) {
      updates.push('rule_modifier_id = ?');
      params.push(data.rule_modifier_id ? data.rule_modifier_id.trim() : null);
    }
    if (data.effect_payload !== undefined) {
      updates.push('effect_payload = ?');
      params.push(data.effect_payload ? JSON.stringify(data.effect_payload) : null);
    }

    const now = new Date().toISOString();
    updates.push('updated_at = ?');
    params.push(now);

    params.push(campaignId, id);

    this.db.prepare(`
      UPDATE environmental_conditions
      SET ${updates.join(', ')}
      WHERE campaign_id = ? AND id = ?
    `).run(...params);

    return this.getConditionById(campaignId, id, true)!;
  }

  toggleCondition(campaignId: string, id: string, isActive?: boolean): EnvironmentalCondition {
    const existing = this.getConditionById(campaignId, id, true);
    if (!existing) {
      throw new Error('Condição ambiental não encontrada.');
    }

    const nextState = isActive !== undefined ? (isActive ? 1 : 0) : (existing.is_active ? 0 : 1);
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE environmental_conditions
      SET is_active = ?, updated_at = ?
      WHERE campaign_id = ? AND id = ?
    `).run(nextState, now, campaignId, id);

    return this.getConditionById(campaignId, id, true)!;
  }

  deleteCondition(campaignId: string, id: string): void {
    const res = this.db.prepare(`
      DELETE FROM environmental_conditions WHERE campaign_id = ? AND id = ?
    `).run(campaignId, id);

    if (res.changes === 0) {
      throw new Error('Condição ambiental não encontrada para exclusão.');
    }
  }

  /**
   * Avalia modificador mecânico determinístico sem eval
   * Retorna null se for puramente narrativa ou sem regra vinculada
   */
  evaluateConditionModifier(condition: EnvironmentalCondition, context: Record<string, number> = {}): number | null {
    if (!condition.is_active) return null;

    const formula = condition.effect_payload?.formula || condition.effect_payload?.modifier_formula;
    if (!formula && !condition.rule_modifier_id) {
      // Condição puramente narrativa (ex: Chuva, Névoa sem regra matemática)
      return null;
    }

    if (formula) {
      try {
        const res = Evaluator.evaluateExpression(formula, { variables: context });
        return res.total;
      } catch {
        return null;
      }
    }

    return null;
  }
}
