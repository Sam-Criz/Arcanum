import { CampaignRole } from '../permissions/rbac.service';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  cover_image?: string | null;
  owner_id: string;
  is_archived: number;
  require_character_approval?: number;
  max_skills_per_character?: number;
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
  requireCharacterApproval?: boolean;
  maxSkillsPerCharacter?: number;
}

export interface UpdateCampaignDTO {
  name?: string;
  description?: string;
  coverImage?: string;
  requireCharacterApproval?: boolean;
  maxSkillsPerCharacter?: number;
}

export interface CreateInviteDTO {
  role?: 'player' | 'assistant' | 'master';
  maxUses?: number;
  expiresInHours?: number;
}
