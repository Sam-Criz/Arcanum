import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { Campaign, CampaignWithRole, CreateCampaignDTO, CreateInviteDTO, UpdateCampaignDTO } from './campaign.types';
import { RulesService } from '../rules-engine/rules.service';
import { CampaignRole } from '../permissions/rbac.service';

export class CampaignService {
  constructor(
    private db: DatabaseSync,
    private rulesService: RulesService
  ) {}

  createCampaign(ownerId: string, data: CreateCampaignDTO): CampaignWithRole {
    if (!data.name || !data.name.trim()) {
      throw new Error('O nome da campanha é obrigatório.');
    }

    const campaignId = crypto.randomUUID();
    const membershipId = crypto.randomUUID();
    const now = new Date().toISOString();
    const preset = data.preset || 'investigacao';

    this.db.exec('BEGIN TRANSACTION;');
    try {
      this.db.prepare(`
        INSERT INTO campaigns (id, name, description, cover_image, owner_id, is_archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        campaignId,
        data.name.trim(),
        data.description?.trim() || '',
        data.coverImage || null,
        ownerId,
        now,
        now
      );

      this.db.prepare(`
        INSERT INTO campaign_memberships (id, campaign_id, user_id, role, joined_at)
        VALUES (?, ?, ?, 'owner', ?)
      `).run(membershipId, campaignId, ownerId, now);

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    // Inicializa regras específicas e independentes para esta campanha
    this.rulesService.initializeDefaultRules(campaignId, preset);

    const ruleset = this.rulesService.getActiveRuleset(campaignId);

    return {
      id: campaignId,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      cover_image: data.coverImage || null,
      owner_id: ownerId,
      is_archived: 0,
      created_at: now,
      updated_at: now,
      role: 'owner',
      member_count: 1,
      active_ruleset_name: ruleset?.config.systemName
    };
  }

  getUserCampaigns(userId: string): CampaignWithRole[] {
    const rows = this.db.prepare(`
      SELECT 
        c.id, c.name, c.description, c.cover_image, c.owner_id, c.is_archived, c.created_at, c.updated_at,
        m.role,
        (SELECT COUNT(*) FROM campaign_memberships WHERE campaign_id = c.id) as member_count,
        (SELECT title FROM ruleset_versions WHERE campaign_id = c.id AND is_active = 1 LIMIT 1) as active_ruleset_name
      FROM campaigns c
      INNER JOIN campaign_memberships m ON m.campaign_id = c.id
      WHERE m.user_id = ? AND c.is_archived = 0
      ORDER BY c.updated_at DESC
    `).all(userId) as any[];

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      cover_image: r.cover_image,
      owner_id: r.owner_id,
      is_archived: r.is_archived,
      created_at: r.created_at,
      updated_at: r.updated_at,
      role: r.role as CampaignRole,
      member_count: r.member_count,
      active_ruleset_name: r.active_ruleset_name
    }));
  }

  getCampaignById(campaignId: string): Campaign | null {
    const row = this.db.prepare(`
      SELECT id, name, description, cover_image, owner_id, is_archived, created_at, updated_at
      FROM campaigns
      WHERE id = ?
    `).get(campaignId) as any;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      cover_image: row.cover_image,
      owner_id: row.owner_id,
      is_archived: row.is_archived,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  updateCampaign(campaignId: string, data: UpdateCampaignDTO): Campaign {
    const existing = this.getCampaignById(campaignId);
    if (!existing) {
      throw new Error('Campanha não encontrada.');
    }

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const description = data.description !== undefined ? data.description.trim() : existing.description;
    const coverImage = data.coverImage !== undefined ? data.coverImage : (existing.cover_image ?? null);
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE campaigns
      SET name = ?, description = ?, cover_image = ?, updated_at = ?
      WHERE id = ?
    `).run(name, description, coverImage ?? null, now, campaignId);

    return {
      ...existing,
      name,
      description,
      cover_image: coverImage,
      updated_at: now
    };
  }

  archiveCampaign(campaignId: string): void {
    this.db.prepare(`
      UPDATE campaigns SET is_archived = 1, updated_at = datetime('now') WHERE id = ?
    `).run(campaignId);
  }

  createInvite(campaignId: string, data: CreateInviteDTO = {}): { code: string; expiresAt?: string; role: string } {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // Ex: 'A4F19B82'
    const id = crypto.randomUUID();
    const role = data.role || 'player';
    let expiresAt: string | null = null;

    if (data.expiresInHours) {
      const expDate = new Date();
      expDate.setHours(expDate.getHours() + data.expiresInHours);
      expiresAt = expDate.toISOString();
    }

    this.db.prepare(`
      INSERT INTO campaign_invites (id, campaign_id, code, role, expires_at, max_uses, used_count)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(id, campaignId, code, role, expiresAt, data.maxUses || null);

    return { code, expiresAt: expiresAt || undefined, role };
  }

  joinCampaignByInvite(code: string, userId: string): { campaign: Campaign; role: CampaignRole } {
    const invite = this.db.prepare(`
      SELECT id, campaign_id, role, expires_at, max_uses, used_count
      FROM campaign_invites
      WHERE code = ?
    `).get(code.trim().toUpperCase()) as any;

    if (!invite) {
      throw new Error('Código de convite inválido ou não encontrado.');
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      throw new Error('Este convite expirou.');
    }

    if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
      throw new Error('Este convite atingiu o limite máximo de utilizações.');
    }

    // Verificar se usuário já é membro da campanha
    const existingMembership = this.db.prepare(`
      SELECT id, role FROM campaign_memberships WHERE campaign_id = ? AND user_id = ?
    `).get(invite.campaign_id, userId) as any;

    if (existingMembership) {
      const campaign = this.getCampaignById(invite.campaign_id)!;
      return { campaign, role: existingMembership.role };
    }

    const membershipId = crypto.randomUUID();

    this.db.exec('BEGIN TRANSACTION;');
    try {
      this.db.prepare(`
        INSERT INTO campaign_memberships (id, campaign_id, user_id, role)
        VALUES (?, ?, ?, ?)
      `).run(membershipId, invite.campaign_id, userId, invite.role);

      this.db.prepare(`
        UPDATE campaign_invites SET used_count = used_count + 1 WHERE id = ?
      `).run(invite.id);

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    const campaign = this.getCampaignById(invite.campaign_id)!;
    return { campaign, role: invite.role };
  }

  getMembers(campaignId: string): Array<{ userId: string; username: string; email: string; avatarUrl: string | null; role: CampaignRole; joinedAt: string }> {
    const rows = this.db.prepare(`
      SELECT 
        u.id as user_id, u.username, u.email, u.avatar_url,
        m.role, m.joined_at
      FROM campaign_memberships m
      INNER JOIN users u ON u.id = m.user_id
      WHERE m.campaign_id = ?
      ORDER BY 
        CASE m.role 
          WHEN 'owner' THEN 1 
          WHEN 'master' THEN 2 
          WHEN 'assistant' THEN 3 
          ELSE 4 
        END, 
        u.username ASC
    `).all(campaignId) as any[];

    return rows.map(r => ({
      userId: r.user_id,
      username: r.username,
      email: r.email,
      avatarUrl: r.avatar_url,
      role: r.role as CampaignRole,
      joinedAt: r.joined_at
    }));
  }

  updateMemberRole(campaignId: string, targetUserId: string, newRole: CampaignRole, requesterUserId: string): void {
    const requester = this.db.prepare(`
      SELECT role FROM campaign_memberships WHERE campaign_id = ? AND user_id = ?
    `).get(campaignId, requesterUserId) as any;

    if (!requester || requester.role !== 'owner') {
      throw new Error('Apenas o proprietário da campanha pode alterar papéis de membros.');
    }

    if (targetUserId === requesterUserId) {
      throw new Error('O proprietário não pode alterar seu próprio papel diretamente.');
    }

    this.db.prepare(`
      UPDATE campaign_memberships SET role = ? WHERE campaign_id = ? AND user_id = ?
    `).run(newRole, campaignId, targetUserId);
  }
}
