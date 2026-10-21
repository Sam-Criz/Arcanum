import { Request, Response, NextFunction } from 'express';
import { DatabaseSync } from 'node:sqlite';

export type CampaignRole = 'owner' | 'master' | 'assistant' | 'player';

export interface CampaignMembership {
  id: string;
  campaign_id: string;
  user_id: string;
  role: CampaignRole;
  joined_at: string;
}

const ROLE_HIERARCHY: Record<CampaignRole, number> = {
  owner: 4,
  master: 3,
  assistant: 2,
  player: 1
};

declare global {
  namespace Express {
    interface Request {
      membership?: CampaignMembership;
    }
  }
}

export class RbacService {
  constructor(private db: DatabaseSync) {}

  getMembership(campaignId: string, userId: string): CampaignMembership | null {
    const row = this.db.prepare(`
      SELECT id, campaign_id, user_id, role, joined_at
      FROM campaign_memberships
      WHERE campaign_id = ? AND user_id = ?
    `).get(campaignId, userId) as any;

    if (!row) {
      const camp = this.db.prepare('SELECT owner_id FROM campaigns WHERE id = ?').get(campaignId) as any;
      if (camp && camp.owner_id === userId) {
        return {
          id: 'owner-' + userId,
          campaign_id: campaignId,
          user_id: userId,
          role: 'owner',
          joined_at: new Date().toISOString()
        };
      }
      return null;
    }

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      user_id: row.user_id,
      role: row.role as CampaignRole,
      joined_at: row.joined_at
    };
  }

  hasRole(campaignId: string, userId: string, minRole: CampaignRole): boolean {
    const membership = this.getMembership(campaignId, userId);
    if (!membership) return false;

    const userLevel = ROLE_HIERARCHY[membership.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    return userLevel >= requiredLevel;
  }

  requireCampaignRole(minRole: CampaignRole = 'player') {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Usuário não autenticado.' });
        return;
      }

      const campaignId = req.params.campaignId || req.params.id;
      if (!campaignId) {
        res.status(400).json({ error: 'ID da campanha não especificado na requisição.' });
        return;
      }

      const membership = this.getMembership(campaignId, user.userId);
      if (!membership) {
        // Isolamento de dados multi-tenant: usuário de outra campanha não pode nem saber dados privados
        res.status(403).json({ 
          error: 'Acesso negado. Você não é membro desta campanha e não possui permissão para acessar estes dados.' 
        });
        return;
      }

      const userLevel = ROLE_HIERARCHY[membership.role] || 0;
      const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

      if (userLevel < requiredLevel) {
        res.status(403).json({ 
          error: `Permissão insuficiente. Esta ação requer nível mínimo de '${minRole}', mas seu papel é '${membership.role}'.` 
        });
        return;
      }

      req.membership = membership;
      next();
    };
  }
}
