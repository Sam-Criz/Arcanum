import { ActiveCondition } from '../rules-engine/rules.types';

export interface FieldDefinition {
  id: string; // Ex: "forca", "vida_atual", "historia"
  name: string; // Ex: "Força", "Vida Atual"
  type: 'number' | 'text' | 'textarea' | 'select' | 'boolean';
  category?: 'attribute' | 'resource' | 'info' | 'combat';
  defaultValue?: any;
  min?: number;
  max?: number;
  isDerived?: boolean;
  formula?: string; // Ex: "10 + Agilidade", "Vigor * 5 + 10"
  options?: string[]; // Para tipo 'select'
  description?: string;
  required?: boolean;
  width?: 'full' | 'half' | 'third';
}

export interface TemplateSchema {
  sections: Array<{
    id: string;
    title: string;
    fields: FieldDefinition[];
  }>;
}

export interface CharacterTemplate {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  schema: TemplateSchema;
  created_at: string;
}

export interface UpdateTemplateDTO {
  name?: string;
  description?: string;
  schema?: TemplateSchema;
}

export interface Character {
  id: string;
  campaign_id: string;
  user_id: string;
  template_id?: string | null;
  name: string;
  avatar_url?: string | null;
  is_npc: number;
  raw_data: Record<string, any>;
  computed_data: Record<string, any>;
  conditions?: ActiveCondition[];
  created_at: string;
  updated_at: string;
  owner_username?: string;
}

export interface CreateCharacterDTO {
  name: string;
  templateId?: string;
  avatarUrl?: string;
  isNpc?: boolean;
  rawData?: Record<string, any>;
}
