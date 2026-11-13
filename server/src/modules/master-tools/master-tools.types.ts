export interface EnvironmentalCondition {
  id: string;
  campaign_id: string;
  scene_id?: string | null;
  name: string;
  description?: string | null;
  icon?: string | null;
  is_active: number; // 0 | 1
  is_visible_to_players: number; // 0 | 1
  duration_rounds?: number | null;
  rule_modifier_id?: string | null;
  effect_payload?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEnvironmentalConditionDTO {
  scene_id?: string | null;
  name: string;
  description?: string;
  icon?: string;
  is_active?: boolean | number;
  is_visible_to_players?: boolean | number;
  duration_rounds?: number | null;
  rule_modifier_id?: string | null;
  effect_payload?: Record<string, any>;
}

export interface UpdateEnvironmentalConditionDTO {
  scene_id?: string | null;
  name?: string;
  description?: string;
  icon?: string;
  is_active?: boolean | number;
  is_visible_to_players?: boolean | number;
  duration_rounds?: number | null;
  rule_modifier_id?: string | null;
  effect_payload?: Record<string, any>;
}

export type EventType = 'manual' | 'scheduled' | 'trigger';
export type EventStatus = 'pending' | 'triggered' | 'completed' | 'cancelled';
export type EventVisibility = 'master_only' | 'public' | 'targeted';

export interface CampaignEvent {
  id: string;
  campaign_id: string;
  scene_id?: string | null;
  title: string;
  description?: string | null;
  event_type: EventType;
  status: EventStatus;
  trigger_conditions?: Record<string, any> | null;
  visibility: EventVisibility;
  target_user_ids: string[];
  action_payload?: Record<string, any> | null;
  scheduled_at?: string | null;
  triggered_at?: string | null;
  created_by: string;
  created_at: string;
}

export interface CreateCampaignEventDTO {
  scene_id?: string | null;
  title: string;
  description?: string;
  event_type?: EventType;
  trigger_conditions?: Record<string, any>;
  visibility?: EventVisibility;
  target_user_ids?: string[];
  action_payload?: Record<string, any>;
  scheduled_at?: string | null;
}

export interface UpdateCampaignEventDTO {
  scene_id?: string | null;
  title?: string;
  description?: string;
  event_type?: EventType;
  status?: EventStatus;
  trigger_conditions?: Record<string, any>;
  visibility?: EventVisibility;
  target_user_ids?: string[];
  action_payload?: Record<string, any>;
  scheduled_at?: string | null;
}

export interface MasterNote {
  id: string;
  campaign_id: string;
  scene_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_private: number; // 0 | 1
  shared_with_user_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMasterNoteDTO {
  scene_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  is_private?: boolean | number;
  shared_with_user_ids?: string[];
}

export interface UpdateMasterNoteDTO {
  scene_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  is_private?: boolean | number;
  shared_with_user_ids?: string[];
}

export type RevelationEntityType = 'npc' | 'monster' | 'clue' | 'note' | 'scene_prop';

export interface EntityRevelation {
  id: string;
  campaign_id: string;
  entity_type: RevelationEntityType;
  entity_id: string;
  revealed_to_user_id?: string | null; // null = all players
  revealed_fields: string[];
  created_at: string;
}

export interface SetRevelationDTO {
  entity_type: RevelationEntityType;
  entity_id: string;
  revealed_to_user_id?: string | null;
  revealed_fields: string[];
}
