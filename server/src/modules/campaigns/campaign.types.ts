import { CampaignRole } from '../permissions/rbac.service';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  cover_image?: string | null;
  owner_id: string;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignWithRole extends Campaign {
  role: CampaignRole;
  member_count: number;
  active_ruleset_name?: string;
}

export interface CreateCampaignDTO {
  name: string;
  description?: string;
  coverImage?: string;
  preset?: 'investigacao' | 'fantasia_d20' | 'cyberpunk';
}

export interface UpdateCampaignDTO {
  name?: string;
  description?: string;
  coverImage?: string;
}

export interface CreateInviteDTO {
  role?: 'player' | 'assistant' | 'master';
  maxUses?: number;
  expiresInHours?: number;
}
