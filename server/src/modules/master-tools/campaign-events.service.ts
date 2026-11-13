import { DatabaseSync as Database } from 'node:sqlite';
import {
  CampaignEvent,
  CreateCampaignEventDTO,
  UpdateCampaignEventDTO
} from './master-tools.types';

export class CampaignEventsService {
  constructor(private db: Database) {
    // Hidratação e execução imediata de eventos pendentes/agendados ao inicializar o runtime
    this.processScheduledEvents();
  }

  private mapRow(row: any): CampaignEvent {
    let triggerConditions = null;
    let actionPayload = null;
    let targetUserIds: string[] = [];

    try {
      if (row.trigger_conditions) triggerConditions = JSON.parse(row.trigger_conditions);
    } catch {}
    try {
      if (row.action_payload) actionPayload = JSON.parse(row.action_payload);
    } catch {}
    try {
      if (row.target_user_ids) targetUserIds = JSON.parse(row.target_user_ids);
    } catch {}

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      scene_id: row.scene_id || null,
      title: row.title,
      description: row.description || null,
      event_type: row.event_type || 'manual',
      status: row.status || 'pending',
      trigger_conditions: triggerConditions,
      visibility: row.visibility || 'master_only',
      target_user_ids: Array.isArray(targetUserIds) ? targetUserIds : [],
      action_payload: actionPayload,
      scheduled_at: row.scheduled_at || null,
      triggered_at: row.triggered_at || null,
      created_by: row.created_by,
      created_at: row.created_at
    };
  }

  createEvent(campaignId: string, userId: string, data: CreateCampaignEventDTO): CampaignEvent {
    if (!data.title || !data.title.trim()) {
      throw new Error('O título do evento é obrigatório.');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const eventType = data.event_type || 'manual';
    const visibility = data.visibility || 'master_only';
    const targetUsers = Array.isArray(data.target_user_ids)
      ? data.target_user_ids
      : ((data as any).target_user_id ? [(data as any).target_user_id] : []);
    const targetUsersJson = JSON.stringify(targetUsers);
    const triggerCondJson = data.trigger_conditions ? JSON.stringify(data.trigger_conditions) : null;
    const actionJson = data.action_payload ? JSON.stringify(data.action_payload) : null;
    const scheduledAt = data.scheduled_at || null;

    this.db.prepare(`
      INSERT INTO campaign_events (
        id, campaign_id, scene_id, title, description,
        event_type, status, trigger_conditions, visibility,
        target_user_ids, action_payload, scheduled_at, triggered_at,
        created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(
      id,
      campaignId,
      data.scene_id || null,
      data.title.trim(),
      data.description?.trim() || null,
      eventType,
      triggerCondJson,
      visibility,
      targetUsersJson,
      actionJson,
      scheduledAt,
      userId,
      now
    );

    return this.getEventById(campaignId, id, userId, true)!;
  }

  getEvents(campaignId: string, userId: string, isMaster: boolean = true, sceneId?: string | null): CampaignEvent[] {
    let sql = `SELECT * FROM campaign_events WHERE campaign_id = ?`;
    const params: any[] = [campaignId];

    if (sceneId !== undefined) {
      if (sceneId === null) {
        sql += ` AND scene_id IS NULL`;
      } else {
        sql += ` AND (scene_id = ? OR scene_id IS NULL)`;
        params.push(sceneId);
      }
    }

    if (!isMaster) {
      // Jogador comum: só vê eventos já disparados que sejam públicos ou direcionados a ele
      sql += ` AND (status = 'triggered' OR status = 'completed') AND (visibility = 'public' OR (visibility = 'targeted' AND target_user_ids LIKE ?))`;
      params.push(`%"${userId}"%`);
    }

    sql += ` ORDER BY created_at DESC`;

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapRow(r));
  }

  getEventById(campaignId: string, eventId: string, userId: string, isMaster: boolean = true): CampaignEvent | null {
    const row = this.db.prepare(`
      SELECT * FROM campaign_events WHERE campaign_id = ? AND id = ?
    `).get(campaignId, eventId) as any;

    if (!row) return null;
    const event = this.mapRow(row);

    if (!isMaster) {
      if (event.status === 'pending' || event.visibility === 'master_only') {
        return null;
      }
      if (event.visibility === 'targeted' && !event.target_user_ids.includes(userId)) {
        return null;
      }
    }

    return event;
  }

  updateEvent(campaignId: string, eventId: string, data: UpdateCampaignEventDTO): CampaignEvent {
    const existing = this.getEventById(campaignId, eventId, '', true);
    if (!existing) {
      throw new Error('Evento de campanha não encontrado.');
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title.trim());
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description ? data.description.trim() : null);
    }
    if (data.scene_id !== undefined) {
      updates.push('scene_id = ?');
      params.push(data.scene_id || null);
    }
    if (data.event_type !== undefined) {
      updates.push('event_type = ?');
      params.push(data.event_type);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.visibility !== undefined) {
      updates.push('visibility = ?');
      params.push(data.visibility);
    }
    if (data.target_user_ids !== undefined) {
      updates.push('target_user_ids = ?');
      params.push(JSON.stringify(data.target_user_ids));
    }
    if (data.trigger_conditions !== undefined) {
      updates.push('trigger_conditions = ?');
      params.push(data.trigger_conditions ? JSON.stringify(data.trigger_conditions) : null);
    }
    if (data.action_payload !== undefined) {
      updates.push('action_payload = ?');
      params.push(data.action_payload ? JSON.stringify(data.action_payload) : null);
    }
    if (data.scheduled_at !== undefined) {
      updates.push('scheduled_at = ?');
      params.push(data.scheduled_at || null);
    }

    if (updates.length > 0) {
      params.push(campaignId, eventId);
      this.db.prepare(`
        UPDATE campaign_events
        SET ${updates.join(', ')}
        WHERE campaign_id = ? AND id = ?
      `).run(...params);
    }

    return this.getEventById(campaignId, eventId, '', true)!;
  }

  deleteEvent(campaignId: string, eventId: string): void {
    const res = this.db.prepare(`
      DELETE FROM campaign_events WHERE campaign_id = ? AND id = ?
    `).run(campaignId, eventId);

    if (res.changes === 0) {
      throw new Error('Evento de campanha não encontrado para exclusão.');
    }
  }

  triggerEvent(campaignId: string, eventId: string, userId: string, isMaster: boolean = true): { event: CampaignEvent; executionResult: any } {
    if (!isMaster) {
      throw new Error('Apenas o Mestre pode disparar eventos manualmente.');
    }

    const event = this.getEventById(campaignId, eventId, userId, true);
    if (!event) {
      throw new Error('Evento não encontrado.');
    }

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE campaign_events
      SET status = 'triggered', triggered_at = ?
      WHERE campaign_id = ? AND id = ?
    `).run(now, campaignId, eventId);

    // Execução de efeitos atrelados ao evento
    let executionResult: any = { triggered: true, timestamp: now };
    const payload = event.action_payload;

    if (payload) {
      try {
        // 1. Ação: Ativar condição ambiental
        if (payload.action === 'activate_condition' && payload.condition_id) {
          this.db.prepare(`
            UPDATE environmental_conditions
            SET is_active = 1, updated_at = ?
            WHERE campaign_id = ? AND id = ?
          `).run(now, campaignId, payload.condition_id);
          executionResult.activatedConditionId = payload.condition_id;
        }

        // 2. Ação: Registrar mensagem de sistema no chat
        if (payload.action === 'system_chat' || payload.message) {
          const chatMsg = payload.message || event.description || `Evento disparado: ${event.title}`;
          const msgId = crypto.randomUUID();
          this.db.prepare(`
            INSERT INTO campaign_chat_messages (id, campaign_id, sender_id, sender_name, content, type, created_at)
            VALUES (?, ?, ?, 'Sistema', ?, 'event', ?)
          `).run(msgId, campaignId, userId, chatMsg, now);
          executionResult.chatMessageCreated = true;
        }

        // 3. Ação: Revelar entidade
        if (payload.action === 'reveal_entity' && payload.entity_id && payload.entity_type) {
          const revId = crypto.randomUUID();
          const fieldsJson = JSON.stringify(payload.revealed_fields || ['true_name', 'stats']);
          this.db.prepare(`
            INSERT INTO entity_revelations (id, campaign_id, entity_type, entity_id, revealed_to_user_id, revealed_fields, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(revId, campaignId, payload.entity_type, payload.entity_id, payload.target_user_id || null, fieldsJson, now);
          executionResult.entityRevealed = payload.entity_id;
        }
      } catch (err: any) {
        executionResult.actionError = err.message;
      }
    }

    const updated = this.getEventById(campaignId, eventId, userId, true)!;
    return { event: updated, executionResult };
  }

  /**
   * Varre e processa eventos pendentes com data agendada atingida.
   * Sobrevive a reinicializações porque lê do SQLite em disco.
   */
  processScheduledEvents(): number {
    try {
      const now = new Date().toISOString();
      const overdue = this.db.prepare(`
        SELECT id, campaign_id, created_by FROM campaign_events
        WHERE status = 'pending'
          AND event_type = 'scheduled'
          AND scheduled_at IS NOT NULL
          AND scheduled_at <= ?
      `).all(now) as any[];

      for (const row of overdue) {
        try {
          this.triggerEvent(row.campaign_id, row.id, row.created_by, true);
        } catch {}
      }

      return overdue.length;
    } catch {
      return 0;
    }
  }
}
