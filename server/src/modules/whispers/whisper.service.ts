import { DatabaseSync as Database } from 'node:sqlite';
import crypto from 'crypto';

export interface CampaignWhisper {
  id: string;
  campaign_id: string;
  sender_id: string;
  sender_username: string;
  recipient_id: string;
  recipient_username: string;
  content: string;
  is_read: number;
  created_at: string;
}

export class WhisperService {
  constructor(private db: Database) {}

  private getMasterUserId(campaignId: string): string {
    const owner = this.db.prepare(`
      SELECT owner_id FROM campaigns WHERE id = ?
    `).get(campaignId) as any;

    if (!owner) {
      throw new Error('Campanha não encontrada.');
    }
    return owner.owner_id;
  }

  listWhispers(
    campaignId: string,
    userId: string,
    isMaster: boolean,
    withUser?: string
  ): { whispers: CampaignWhisper[]; contacts: any[] } {
    const masterId = this.getMasterUserId(campaignId);

    // 1. Obter membros para listar contatos no painel do mestre
    let contacts: any[] = [];
    if (isMaster) {
      const members = this.db.prepare(`
        SELECT u.id as user_id, u.username, cm.role
        FROM campaign_memberships cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.campaign_id = ? AND cm.user_id != ?
      `).all(campaignId, userId) as any[];

      contacts = members.map(m => {
        // Contar não lidas deste usuário para o mestre
        const unread = this.db.prepare(`
          SELECT COUNT(*) as count
          FROM campaign_whispers
          WHERE campaign_id = ? AND sender_id = ? AND recipient_id = ? AND is_read = 0
        `).get(campaignId, m.user_id, userId) as any;

        // Última mensagem
        const last = this.db.prepare(`
          SELECT content, created_at
          FROM campaign_whispers
          WHERE campaign_id = ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
          ORDER BY created_at DESC LIMIT 1
        `).get(campaignId, m.user_id, userId, userId, m.user_id) as any;

        return {
          user_id: m.user_id,
          username: m.username,
          role: m.role,
          unread_count: Number(unread?.count) || 0,
          last_message: last ? last.content : null,
          last_activity: last ? last.created_at : null
        };
      });
    }

    // 2. Filtrar mensagens
    let query = `
      SELECT w.*, 
             su.username as sender_username,
             ru.username as recipient_username
      FROM campaign_whispers w
      LEFT JOIN users su ON w.sender_id = su.id
      LEFT JOIN users ru ON w.recipient_id = ru.id
      WHERE w.campaign_id = ?
    `;
    const params: any[] = [campaignId];

    if (!isMaster) {
      // Jogador comum: vê estritamente suas próprias conversas com o Mestre
      query += ` AND (w.sender_id = ? OR w.recipient_id = ?)`;
      params.push(userId, userId);
    } else if (withUser) {
      // Mestre filtrando por jogador específico
      query += ` AND ((w.sender_id = ? AND w.recipient_id = ?) OR (w.sender_id = ? AND w.recipient_id = ?))`;
      params.push(userId, withUser, withUser, userId);
    } else {
      // Mestre sem filtro específico: mensagens onde o mestre é participante
      query += ` AND (w.sender_id = ? OR w.recipient_id = ?)`;
      params.push(userId, userId);
    }

    query += ` ORDER BY w.created_at ASC`;

    const rows = this.db.prepare(query).all(...params) as any[];

    const whispers: CampaignWhisper[] = rows.map(r => ({
      id: r.id,
      campaign_id: r.campaign_id,
      sender_id: r.sender_id,
      sender_username: r.sender_username || 'Remetente',
      recipient_id: r.recipient_id,
      recipient_username: r.recipient_username || 'Destinatário',
      content: r.content,
      is_read: Number(r.is_read) || 0,
      created_at: r.created_at
    }));

    return { whispers, contacts };
  }

  sendWhisper(
    campaignId: string,
    senderId: string,
    isMaster: boolean,
    targetRecipientId: string | undefined,
    content: string
  ): CampaignWhisper {
    if (!content || !content.trim()) {
      throw new Error('A mensagem de sussurro não pode ser vazia.');
    }

    const masterId = this.getMasterUserId(campaignId);
    let recipientId = targetRecipientId;

    if (!isMaster) {
      // Se for jogador comum, o destinatário É OBRIGATORIAMENTE o mestre
      recipientId = masterId;
    } else {
      // Se for o mestre, deve fornecer o jogador destinatário
      if (!recipientId) {
        throw new Error('Mestre deve especificar o jogador destinatário do sussurro.');
      }
    }

    // Verificar se destinatário é membro da campanha
    const isMember = this.db.prepare(`
      SELECT user_id FROM campaign_memberships WHERE campaign_id = ? AND user_id = ?
    `).get(campaignId, recipientId);

    if (!isMember) {
      throw new Error('Destinatário não faz parte desta campanha.');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO campaign_whispers (
        id, campaign_id, sender_id, recipient_id, content, is_read, created_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(id, campaignId, senderId, recipientId, content.trim(), now);

    const sender = this.db.prepare(`SELECT username FROM users WHERE id = ?`).get(senderId) as any;
    const recipient = this.db.prepare(`SELECT username FROM users WHERE id = ?`).get(recipientId) as any;

    return {
      id,
      campaign_id: campaignId,
      sender_id: senderId,
      sender_username: sender?.username || 'Remetente',
      recipient_id: recipientId,
      recipient_username: recipient?.username || 'Destinatário',
      content: content.trim(),
      is_read: 0,
      created_at: now
    };
  }

  markAsRead(campaignId: string, userId: string, otherUserId: string): void {
    this.db.prepare(`
      UPDATE campaign_whispers
      SET is_read = 1
      WHERE campaign_id = ? AND sender_id = ? AND recipient_id = ? AND is_read = 0
    `).run(campaignId, otherUserId, userId);
  }
}
