const API_URL = '/api';

export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  cover_image?: string;
  owner_id: string;
  role: 'owner' | 'master' | 'assistant' | 'player';
  member_count: number;
  active_ruleset_name?: string;
}

export interface AttributeDef {
  id: string;
  name: string;
  abbr: string;
  type: string;
  defaultValue: number;
  min?: number;
  max?: number;
  isDerived?: boolean;
  formula?: string;
  description?: string;
}

export interface ResourceDef {
  id: string;
  name: string;
  abbr?: string;
  color?: string;
  maxFormula: string;
}

export interface FormulaDef {
  id: string;
  name: string;
  expression: string;
  category?: string;
}

export interface ConditionModifier {
  target: 'ataque' | 'defesa' | 'dano' | 'iniciativa' | 'rd' | string;
  type: 'flat' | 'percentage';
  value: number;
}

export interface ConditionDotEffect {
  formula: string;
  damageType?: string;
  timing: 'turn_start' | 'turn_end' | 'round_end';
}

export interface ConditionEffects {
  incapacitated?: boolean;
  dot?: ConditionDotEffect;
  defense_mod?: number;
  damage_mod?: number;
  attack_mod?: number;
  damage_reduction_mod?: number;
  incoming_damage_mod?: number;
  speed_mod?: number;
  disadvantage_attack?: boolean;
}

export interface ConditionDefaultDuration {
  type: 'turns' | 'rounds' | 'actions' | 'permanent';
  value: number;
}

export interface ConditionDefinition {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  modifiers?: ConditionModifier[];
  effects?: ConditionEffects;
  default_duration: ConditionDefaultDuration;
  tick_timing?: 'turn_start' | 'turn_end' | 'round_end' | 'action';
  stack_rule?: 'replace' | 'stack_duration' | 'stack_intensity' | 'ignore';
  is_visible_to_players?: boolean;
}

export interface ActiveCondition {
  id: string;
  condition_id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  duration_type: 'turns' | 'rounds' | 'actions' | 'permanent';
  duration_remaining: number;
  tick_timing: 'turn_start' | 'turn_end' | 'round_end' | 'action';
  applied_at_round?: number;
  applied_at_turn?: number;
  applied_by?: string;
  modifiers?: ConditionModifier[];
  effects?: ConditionEffects;
  stack_count?: number;
  is_visible_to_players?: boolean;
}

export interface DamageTypeDefinition {
  id: string;
  name: string;
  category?: string;
  description?: string;
  color?: string;
  icon?: string;
  default_resistance?: number;
  default_vulnerability?: number;
}

export interface DamageComponent {
  id?: string;
  name?: string;
  damage_type: string;
  formula?: string;
  percentage_damage?: number;
  percentage_damage_target?: 'max_hp' | 'current_hp';
  chance_percent?: number;
  condition?: string;
  apply_conditions?: Array<Partial<ActiveCondition> & { name: string; condition_id?: string } | string>;
}

export interface ImbueProperties {
  can_imbue: boolean;
  compatible_categories?: string[];
  damage_type: string;
  damage_formula?: string;
  percentage_damage?: number;
  percentage_damage_target?: 'max_hp' | 'current_hp';
  chance_percent?: number;
  apply_conditions?: Array<Partial<ActiveCondition> & { name: string; condition_id?: string } | string>;
  duration_type?: 'attacks' | 'hits' | 'turns' | 'rounds' | 'permanent';
  charges?: number;
  max_charges?: number;
  duration_value?: number;
  combine_behavior?: 'replace' | 'stack' | 'reject';
  description?: string;
}

export interface ActiveImbuedEffect {
  id: string;
  source_item_id?: string;
  source_item_name: string;
  damage_type: string;
  damage_formula?: string;
  percentage_damage?: number;
  percentage_damage_target?: 'max_hp' | 'current_hp';
  chance_percent?: number;
  apply_conditions?: Array<Partial<ActiveCondition> & { name: string; condition_id?: string } | string>;
  duration_type: 'attacks' | 'hits' | 'turns' | 'rounds' | 'permanent';
  charges_remaining?: number;
  max_charges?: number;
  duration_remaining?: number;
  combine_behavior?: 'replace' | 'stack' | 'reject';
  created_at: string;
}

export interface ImbueWeaponDTO {
  consumableInventoryId: string;
  weaponInventoryId: string;
}

export type ValidTargetType = 'self' | 'allies' | 'enemies' | 'any' | 'weapon' | 'object';

export interface AbilityResourceCost {
  name: string; // ex: 'mana', 'sanidade', 'bateria', 'pontos_de_acao'
  amount: number;
}

export interface AbilityDefinition {
  id: string;
  name: string;
  description?: string;
  action_type?: 'main' | 'bonus' | 'reaction' | 'free';
  action_cost?: 'main' | 'bonus' | 'reaction' | 'free';
  valid_targets?: ValidTargetType | ValidTargetType[];
  range?: string;
  type?: 'attack' | 'heal' | 'buff' | 'utility';
  resource_cost?: AbilityResourceCost;
  attack_formula?: string;
  defense_target?: 'defense' | 'rd' | string;
  damage_formula?: string;
  damage_type?: string;
  damage_components?: DamageComponent[];
  healing_formula?: string;
  heal_formula?: string;
  apply_conditions?: Array<Partial<ActiveCondition> & { name: string; condition_id?: string } | string>;
  remove_conditions?: string[];
  requires_weapon?: boolean;
}

export interface Ruleset {
  id: string;
  version: number;
  title: string;
  config: {
    systemName: string;
    description?: string;
    defaultDice: string;
    attributes: AttributeDef[];
    resources: ResourceDef[];
    formulas: FormulaDef[];
    conditions?: ConditionDefinition[];
    damageTypes?: DamageTypeDefinition[];
    abilities?: AbilityDefinition[];
  };
}

export interface Character {
  id: string;
  campaign_id: string;
  user_id: string;
  template_id?: string | null;
  name: string;
  avatar_url?: string;
  is_npc: number;
  raw_data: Record<string, any>;
  computed_data: Record<string, any>;
  conditions?: ActiveCondition[];
  owner_username?: string;
}

export interface CatalogItem {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  category: string;
  weight: number;
  cost: number;
  acquisition_mode: 'free' | 'limited' | 'approval';
  stock_quantity: number | null;
  is_hidden?: boolean;
  is_purchasable?: boolean;
  properties: Record<string, any>;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  character_id: string;
  item_id?: string | null;
  item_name: string;
  category: string;
  quantity: number;
  weight: number;
  cost: number;
  is_equipped: number;
  properties: Record<string, any>;
}

export type CharacterInventoryItem = InventoryItem;

export interface InventorySummary {
  items: InventoryItem[];
  totalWeight: number;
  totalCost: number;
  equippedCount: number;
  itemCount: number;
}

export interface InventoryTransferRecord {
  id: string;
  campaign_id: string;
  from_character_id: string;
  to_character_id: string;
  from_character_name?: string;
  to_character_name?: string;
  item_name: string;
  quantity: number;
  transferred_by_user_id: string;
  transferred_by_username?: string;
  created_at: string;
}

export interface ItemRequest {
  id: string;
  campaign_id: string;
  character_id: string;
  character_name?: string;
  user_id: string;
  username?: string;
  item_id: string;
  item_name?: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  reviewed_by_user_id?: string | null;
  reviewed_by_username?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateField {
  id: string;
  name: string;
  type: 'number' | 'text' | 'textarea' | 'select' | 'boolean';
  category?: 'attribute' | 'resource' | 'info' | 'combat';
  defaultValue?: any;
  min?: number;
  max?: number;
  isDerived?: boolean;
  formula?: string;
  options?: string[];
  description?: string;
  required?: boolean;
  width?: 'full' | 'half' | 'third';
}

export interface TemplateSection {
  id: string;
  title: string;
  fields: TemplateField[];
}

export interface CharacterTemplate {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  schema: {
    sections: TemplateSection[];
  };
  created_at: string;
}

export interface Scene {
  id: string;
  campaign_id: string;
  name: string;
  image_url: string | null;
  grid_type: 'square' | 'none' | 'hex';
  grid_size: number;
  grid_scale: number;
  grid_scale_unit: string;
  grid_color: string;
  grid_opacity: number;
  width: number;
  height: number;
  is_active: boolean;
  fog_enabled: boolean;
  fog_data: any[];
  created_at: string;
  updated_at: string;
}

export interface Token {
  id: string;
  campaign_id: string;
  scene_id: string;
  character_id: string | null;
  name: string;
  avatar_url: string | null;
  x: number;
  y: number;
  size: number;
  rotation: number;
  is_visible: boolean;
  is_locked: boolean;
  color: string;
  current_hp: number | null;
  max_hp: number | null;
  hp_percent?: number | null;
  hp_status?: 'healthy' | 'injured' | 'bloodied' | 'critical' | 'defeated' | null;
  notes: string;
  npc_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
  owner_user_id?: string | null;
}

export interface CombatEncounter {
  id: string;
  campaign_id: string;
  scene_id: string | null;
  name: string;
  status: 'prep' | 'active' | 'paused' | 'ended';
  round: number;
  turn_index: number;
  turn_timer_seconds: number;
  turn_started_at: string | null;
  notes?: string;
  planned_creatures?: any[];
  data: Record<string, any>;
  combatants?: Combatant[];
  created_at: string;
}

export interface DefensiveState {
  defense?: {
    active: boolean;
    type: 'bonus_rd' | 'bonus_defense';
    value: number;
    formula?: string;
    description?: string;
    expires_on_turn_start_id?: string;
    expires_at_round?: number;
  };
  dodge?: {
    active: boolean;
    effective_defense: number;
    roll_total: number;
    bonus_defense: number;
    formula?: string;
    description?: string;
    expires_on_turn_start_id?: string;
    expires_at_round?: number;
  };
}

export interface ActionsUsed {
  main: number;
  bonus: number;
  reaction: number;
  free: number;
  [key: string]: number;
}

export interface Combatant {
  id: string;
  encounter_id: string;
  campaign_id: string;
  character_id: string | null;
  token_id: string | null;
  source_creature_id?: string | null;
  name: string;
  avatar_url: string | null;
  initiative: number;
  initiative_formula: string;
  is_npc: boolean;
  is_hidden: boolean;
  sort_order: number;
  current_hp: number | null;
  max_hp: number | null;
  hp_percent?: number | null;
  hp_status?: 'healthy' | 'injured' | 'bloodied' | 'critical' | 'defeated' | null;
  conditions: ActiveCondition[];
  defense?: number;
  damage_reduction?: number;
  npc_data?: Record<string, any>;
  actions_used?: ActionsUsed;
  defensive_state?: DefensiveState;
  tie_breaker?: number;
  is_incapacitated?: boolean;
  created_at: string;
  owner_user_id?: string | null;
}

export interface CreatureRevealedFields {
  name?: boolean;
  category?: boolean;
  avatar?: boolean;
  description?: boolean;
  attributes?: boolean;
  exact_hp?: boolean;
  defenses?: boolean;
  damage_types?: boolean;
  equipment?: boolean;
  abilities?: boolean;
  formulas?: boolean;
  notes?: boolean;
}

export interface CreatureEquipmentItem {
  id?: string;
  name: string;
  item_type?: 'weapon' | 'armor' | 'shield' | 'accessory' | 'consumable' | 'other';
  damage_formula?: string;
  attack_formula?: string;
  damage_type?: string;
  defense_bonus?: number;
  damage_reduction?: number;
  properties?: Record<string, any>;
  notes?: string;
}

export interface BestiaryCreature {
  id: string;
  campaign_id: string;
  template_id: string | null;
  name: string;
  display_name_players?: string;
  is_revealed: number | boolean;
  revealed_fields?: CreatureRevealedFields;
  equipment?: CreatureEquipmentItem[];
  race?: string;
  public_notes?: string;
  private_notes?: string;
  description: string;
  category: string;
  size: number;
  avatar_url: string | null;
  token_url: string | null;
  raw_data: Record<string, any>;
  computed_data: Record<string, any>;
  actions: any[];
  properties: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CombatLog {
  id: string;
  encounter_id: string;
  campaign_id: string;
  actor_id: string | null;
  actor_name: string;
  target_id: string | null;
  target_name: string | null;
  action_type: 'damage' | 'heal' | 'resource_mod' | 'roll' | 'turn_change' | 'note' | 'attack';
  resource_name: string | null;
  amount: number | null;
  details: Record<string, any>;
  created_at: string;
}

export interface RollResult {
  id: string;
  total: number;
  breakdown: {
    expression: string;
    diceRolls: Array<{ dice: string; rolls: number[]; subtotal: number }>;
    variablesUsed: Record<string, number>;
  };
  isSecret?: boolean;
  characterId?: string | null;
  characterName?: string;
  username?: string;
  expression?: string;
  message?: string;
  createdAt?: string;
  timestamp?: string;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('rpg_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('rpg_token', token);
    } else {
      localStorage.removeItem('rpg_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro na requisição ao servidor');
    }

    return data;
  }

  // Auth
  async register(data: { email: string; username: string; password: string }): Promise<{ user: User; token: string }> {
    const res = await this.request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.setToken(res.token);
    return res;
  }

  async login(data: { login: string; password: string }): Promise<{ user: User; token: string }> {
    const res = await this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.setToken(res.token);
    return res;
  }

  async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Campaigns
  async getCampaigns(): Promise<Campaign[]> {
    const res = await this.request<{ campaigns: Campaign[] }>('/campaigns');
    return res.campaigns;
  }

  async createCampaign(data: { name: string; description?: string; preset?: string }): Promise<Campaign> {
    const res = await this.request<{ campaign: Campaign }>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.campaign;
  }

  async getCampaignDetails(campaignId: string): Promise<{ campaign: Campaign; role: string; ruleset: Ruleset }> {
    return this.request<{ campaign: Campaign; role: string; ruleset: Ruleset }>(`/campaigns/${campaignId}`);
  }

  async createInvite(campaignId: string, role = 'player'): Promise<{ invite: { code: string; role: string } }> {
    return this.request<{ invite: { code: string; role: string } }>(`/campaigns/${campaignId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ role })
    });
  }

  async joinCampaign(code: string): Promise<{ campaign: Campaign; role: string }> {
    return this.request<{ campaign: Campaign; role: string }>('/campaigns/join', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  }

  // Rules Engine
  async getCampaignRules(campaignId: string): Promise<Ruleset> {
    const res = await this.request<{ ruleset: Ruleset }>(`/campaigns/${campaignId}/rules`);
    return res.ruleset;
  }

  async saveCampaignRules(campaignId: string, config: any, title?: string): Promise<any> {
    return this.request(`/campaigns/${campaignId}/rules`, {
      method: 'POST',
      body: JSON.stringify({ config, title })
    });
  }

  async validateFormula(campaignId: string, expression: string): Promise<{ isValid: boolean; error?: string; variables: string[] }> {
    return this.request(`/campaigns/${campaignId}/rules/validate`, {
      method: 'POST',
      body: JSON.stringify({ expression })
    });
  }

  async rollDice(campaignId: string, data: { expression?: string; formulaId?: string; variables?: Record<string, number>; characterId?: string; isSecret?: boolean }): Promise<RollResult> {
    return this.request<RollResult>(`/campaigns/${campaignId}/rules/roll`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Characters
  async getCharacters(campaignId: string): Promise<Character[]> {
    const res = await this.request<{ characters: Character[] }>(`/campaigns/${campaignId}/characters`);
    return res.characters;
  }

  async createCharacter(campaignId: string, data: { name: string; rawData: Record<string, any>; templateId?: string; isNpc?: boolean }): Promise<Character> {
    const res = await this.request<{ character: Character }>(`/campaigns/${campaignId}/characters`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.character;
  }

  async updateCharacter(campaignId: string, characterId: string, data: { name?: string; rawData?: Record<string, any> }): Promise<Character> {
    const res = await this.request<{ character: Character }>(`/campaigns/${campaignId}/characters/${characterId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    return res.character;
  }

  // Catálogo de Itens
  async getCatalogItems(campaignId: string, category?: string, search?: string): Promise<CatalogItem[]> {
    let url = `/campaigns/${campaignId}/items`;
    const params = new URLSearchParams();
    if (category && category !== 'todos') params.append('category', category);
    if (search) params.append('search', search);
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const res = await this.request<{ items: CatalogItem[] }>(url);
    return res.items;
  }

  async createCatalogItem(campaignId: string, data: Partial<CatalogItem>): Promise<CatalogItem> {
    const res = await this.request<{ item: CatalogItem }>(`/campaigns/${campaignId}/items`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.item;
  }

  async updateCatalogItem(campaignId: string, itemId: string, data: Partial<CatalogItem>): Promise<CatalogItem> {
    const res = await this.request<{ item: CatalogItem }>(`/campaigns/${campaignId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    return res.item;
  }

  async deleteCatalogItem(campaignId: string, itemId: string): Promise<void> {
    await this.request(`/campaigns/${campaignId}/items/${itemId}`, {
      method: 'DELETE'
    });
  }

  // Compra e Concessão Segura de Itens
  async purchaseItem(
    campaignId: string,
    characterId: string,
    data: { itemId: string; quantity: number }
  ): Promise<{ success: boolean; item: InventoryItem; inventory: InventorySummary; character: Character; transaction: any }> {
    return this.request(`/campaigns/${campaignId}/characters/${characterId}/inventory/purchase`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async grantItemToCharacter(
    campaignId: string,
    characterId: string,
    data: { itemId?: string; itemName?: string; category?: string; quantity?: number; weight?: number; cost?: number; isEquipped?: boolean; properties?: Record<string, any> }
  ): Promise<{ item: InventoryItem; inventory?: InventorySummary; character?: Character }> {
    return this.request(`/campaigns/${campaignId}/characters/${characterId}/inventory/grant`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Inventário do Personagem
  async getCharacterInventory(campaignId: string, characterId: string): Promise<InventorySummary> {
    const res = await this.request<{ inventory: InventorySummary }>(`/campaigns/${campaignId}/characters/${characterId}/inventory`);
    return res.inventory;
  }

  async addItemToCharacter(
    campaignId: string,
    characterId: string,
    data: { itemId?: string; itemName?: string; category?: string; quantity?: number; weight?: number; cost?: number; isEquipped?: boolean }
  ): Promise<{ item: InventoryItem; inventory?: InventorySummary; character?: Character }> {
    return this.request<{ item: InventoryItem; inventory?: InventorySummary; character?: Character }>(`/campaigns/${campaignId}/characters/${characterId}/inventory`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCharacterInventoryItem(
    campaignId: string,
    characterId: string,
    inventoryItemId: string,
    data: { quantity?: number; isEquipped?: boolean }
  ): Promise<{ item: InventoryItem; inventory?: InventorySummary; character?: Character }> {
    return this.request<{ item: InventoryItem; inventory?: InventorySummary; character?: Character }>(`/campaigns/${campaignId}/characters/${characterId}/inventory/${inventoryItemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async removeCharacterInventoryItem(campaignId: string, characterId: string, inventoryItemId: string): Promise<{ success: boolean; inventory?: InventorySummary; character?: Character }> {
    return this.request(`/campaigns/${campaignId}/characters/${characterId}/inventory/${inventoryItemId}`, {
      method: 'DELETE'
    });
  }

  async transferItem(
    campaignId: string,
    characterId: string,
    data: { inventoryItemId: string; targetCharacterId: string; quantity: number }
  ): Promise<{ success: boolean; transferred: any; inventory?: InventorySummary; character?: Character }> {
    return this.request(`/campaigns/${campaignId}/characters/${characterId}/inventory/transfer`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getInventoryTransfers(campaignId: string): Promise<InventoryTransferRecord[]> {
    const res = await this.request<{ history: InventoryTransferRecord[] }>(`/campaigns/${campaignId}/inventory/transfers`);
    return res.history;
  }

  // Uso mecânico de itens do inventário
  async useInventoryItem(
    campaignId: string,
    characterId: string,
    inventoryItemId: string
  ): Promise<{ success: boolean; item: InventoryItem | null; character?: Character; message: string; rollResult?: any }> {
    return this.request(`/campaigns/${campaignId}/characters/${characterId}/inventory/${inventoryItemId}/use`, {
      method: 'POST'
    });
  }

  // Imbuir arma com consumível
  async imbueWeapon(
    campaignId: string,
    characterId: string,
    data: ImbueWeaponDTO
  ): Promise<{ success: boolean; weapon: InventoryItem; consumedItem: InventoryItem | null; character?: Character; imbuedEffect: ActiveImbuedEffect; message: string; inventory: any }> {
    return this.request(`/campaigns/${campaignId}/characters/${characterId}/inventory/imbue`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Solicitações de Itens
  async getItemRequests(campaignId: string, status?: string): Promise<ItemRequest[]> {
    const query = status ? `?status=${status}` : '';
    const res = await this.request<{ requests: ItemRequest[] }>(`/campaigns/${campaignId}/item-requests${query}`);
    return res.requests;
  }

  async createItemRequest(
    campaignId: string,
    data: { characterId: string; itemId: string; quantity?: number; notes?: string }
  ): Promise<ItemRequest> {
    const res = await this.request<{ request: ItemRequest }>(`/campaigns/${campaignId}/item-requests`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.request;
  }

  async reviewItemRequest(
    campaignId: string,
    requestId: string,
    data: { status: 'approved' | 'rejected'; notes?: string }
  ): Promise<ItemRequest> {
    const res = await this.request<{ request: ItemRequest }>(`/campaigns/${campaignId}/item-requests/${requestId}/review`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.request;
  }

  // Histórico persistente de rolagens de dados
  async getRollHistory(campaignId: string, limit?: number): Promise<any[]> {
    const query = limit ? `?limit=${limit}` : '';
    const res = await this.request<{ rolls: any[] }>(`/campaigns/${campaignId}/rolls${query}`);
    return res.rolls;
  }

  // Modelos de Ficha (Templates)
  async getTemplates(campaignId: string): Promise<CharacterTemplate[]> {
    const res = await this.request<{ templates: CharacterTemplate[] }>(`/campaigns/${campaignId}/templates`);
    return res.templates;
  }

  async createTemplate(
    campaignId: string,
    data: { name: string; description?: string; schema: { sections: TemplateSection[] } }
  ): Promise<CharacterTemplate> {
    const res = await this.request<{ template: CharacterTemplate }>(`/campaigns/${campaignId}/templates`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.template;
  }

  async updateTemplate(
    campaignId: string,
    templateId: string,
    data: { name?: string; description?: string; schema?: { sections: TemplateSection[] } }
  ): Promise<CharacterTemplate> {
    const res = await this.request<{ template: CharacterTemplate }>(`/campaigns/${campaignId}/templates/${templateId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    return res.template;
  }

  async deleteTemplate(campaignId: string, templateId: string): Promise<void> {
    await this.request(`/campaigns/${campaignId}/templates/${templateId}`, {
      method: 'DELETE'
    });
  }

  // ==========================================
  // VTT — Cenas (Scenes)
  // ==========================================
  async getScenes(campaignId: string): Promise<{ scenes: Scene[]; activeScene: Scene | null }> {
    return this.request(`/campaigns/${campaignId}/scenes`);
  }

  async createScene(campaignId: string, data: Partial<Scene>): Promise<Scene> {
    const res = await this.request<{ scene: Scene }>(`/campaigns/${campaignId}/scenes`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.scene;
  }

  async updateScene(campaignId: string, sceneId: string, data: Partial<Scene>): Promise<Scene> {
    const res = await this.request<{ scene: Scene }>(`/campaigns/${campaignId}/scenes/${sceneId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    return res.scene;
  }

  async setActiveScene(campaignId: string, sceneId: string): Promise<Scene> {
    const res = await this.request<{ scene: Scene }>(`/campaigns/${campaignId}/scenes/${sceneId}/activate`, {
      method: 'POST'
    });
    return res.scene;
  }

  async deleteScene(campaignId: string, sceneId: string): Promise<void> {
    await this.request(`/campaigns/${campaignId}/scenes/${sceneId}`, {
      method: 'DELETE'
    });
  }

  async updateSceneFog(campaignId: string, sceneId: string, fogData: any[], fogEnabled: boolean): Promise<Scene> {
    const res = await this.request<{ scene: Scene }>(`/campaigns/${campaignId}/scenes/${sceneId}/fog`, {
      method: 'POST',
      body: JSON.stringify({ fogData, fogEnabled })
    });
    return res.scene;
  }

  // ==========================================
  // VTT — Tokens
  // ==========================================
  async getTokens(campaignId: string, sceneId: string): Promise<Token[]> {
    const res = await this.request<{ tokens: Token[] }>(`/campaigns/${campaignId}/scenes/${sceneId}/tokens`);
    return res.tokens;
  }

  async createToken(campaignId: string, sceneId: string, data: Partial<Token>): Promise<Token> {
    const res = await this.request<{ token: Token }>(`/campaigns/${campaignId}/scenes/${sceneId}/tokens`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.token;
  }

  async updateToken(campaignId: string, tokenId: string, data: Partial<Token>): Promise<Token> {
    const res = await this.request<{ token: Token }>(`/campaigns/${campaignId}/tokens/${tokenId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    return res.token;
  }

  async deleteToken(campaignId: string, tokenId: string): Promise<void> {
    await this.request(`/campaigns/${campaignId}/tokens/${tokenId}`, {
      method: 'DELETE'
    });
  }

  // ==========================================
  // VTT — Combate & Iniciativa
  // ==========================================
  async getActiveCombat(campaignId: string): Promise<CombatEncounter | null> {
    const res = await this.request<{ encounter: CombatEncounter | null }>(`/campaigns/${campaignId}/combat/active`);
    return res.encounter;
  }

  async startCombat(campaignId: string, data: { name?: string; scene_id?: string | null }): Promise<CombatEncounter> {
    const res = await this.request<{ encounter: CombatEncounter }>(`/campaigns/${campaignId}/combat/start`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.encounter;
  }

  async updateCombat(campaignId: string, encounterId: string, data: Partial<CombatEncounter>): Promise<CombatEncounter> {
    const res = await this.request<{ encounter: CombatEncounter }>(`/campaigns/${campaignId}/combat/${encounterId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    return res.encounter;
  }

  async nextCombatTurn(campaignId: string, encounterId: string): Promise<CombatEncounter> {
    const res = await this.request<{ encounter: CombatEncounter }>(`/campaigns/${campaignId}/combat/${encounterId}/next`, {
      method: 'POST'
    });
    return res.encounter;
  }

  async prevCombatTurn(campaignId: string, encounterId: string): Promise<CombatEncounter> {
    const res = await this.request<{ encounter: CombatEncounter }>(`/campaigns/${campaignId}/combat/${encounterId}/prev`, {
      method: 'POST'
    });
    return res.encounter;
  }

  async endCombat(campaignId: string, encounterId: string): Promise<CombatEncounter> {
    const res = await this.request<{ encounter: CombatEncounter }>(`/campaigns/${campaignId}/combat/${encounterId}/end`, {
      method: 'POST'
    });
    return res.encounter;
  }

  async addCombatant(campaignId: string, encounterId: string, data: Partial<Combatant>): Promise<{ combatant: Combatant; encounter: CombatEncounter }> {
    return this.request(`/campaigns/${campaignId}/combat/${encounterId}/combatants`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCombatant(campaignId: string, encounterId: string, combatantId: string, data: Partial<Combatant>): Promise<{ combatant: Combatant; encounter: CombatEncounter }> {
    return this.request(`/campaigns/${campaignId}/combat/${encounterId}/combatants/${combatantId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async removeCombatant(campaignId: string, encounterId: string, combatantId: string): Promise<void> {
    await this.request(`/campaigns/${campaignId}/combat/${encounterId}/combatants/${combatantId}`, {
      method: 'DELETE'
    });
  }

  async rollCombatInitiative(campaignId: string, encounterId: string, combatantId?: string): Promise<CombatEncounter> {
    const res = await this.request<{ encounter: CombatEncounter }>(`/campaigns/${campaignId}/combat/${encounterId}/initiative`, {
      method: 'POST',
      body: JSON.stringify({ combatantId })
    });
    return res.encounter;
  }

  async activateCombat(campaignId: string, encounterId: string): Promise<CombatEncounter> {
    const res = await this.request<{ encounter: CombatEncounter }>(`/campaigns/${campaignId}/combat/${encounterId}/activate`, {
      method: 'POST'
    });
    return res.encounter;
  }

  async endCombatTurn(campaignId: string, encounterId: string): Promise<CombatEncounter> {
    const res = await this.request<{ encounter: CombatEncounter }>(`/campaigns/${campaignId}/combat/${encounterId}/end-turn`, {
      method: 'POST'
    });
    return res.encounter;
  }

  async applyCombatAction(
    campaignId: string,
    encounterId: string,
    data: {
      actor_id?: string | null;
      actor_name?: string;
      target_id?: string | null;
      action_type?: 'damage' | 'heal' | 'resource_mod' | 'attack';
      action_mode?: 'weapon' | 'ability' | 'manual' | 'defend' | 'dodge';
      action_cost?: 'main' | 'bonus' | 'reaction' | 'free';
      weapon_id?: string;
      ability_name?: string;
      resource_name?: string;
      amount?: number;
      formula?: string;
      attack_formula?: string;
      damage_type?: string;
      resource_cost?: { name: string; amount: number };
      apply_conditions?: Array<Partial<ActiveCondition> & { name: string; condition_id?: string } | string>;
      notes?: string;
    }
  ): Promise<{
    actionLog: CombatLog;
    targetCombatant: Combatant;
    actorCombatant?: Combatant;
    updatedCharacter?: Character;
    attackRoll?: any;
    damageRoll?: any;
    hit?: boolean;
    finalDamage?: number;
  }> {
    return this.request(`/campaigns/${campaignId}/combat/${encounterId}/action`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getCombatLogs(campaignId: string, encounterId: string): Promise<CombatLog[]> {
    const res = await this.request<{ logs: CombatLog[] }>(`/campaigns/${campaignId}/combat/${encounterId}/logs`);
    return res.logs;
  }

  // --- CONDIÇÕES E EFEITOS DE STATUS ---

  async getRulesetConditions(campaignId: string): Promise<ConditionDefinition[]> {
    const res = await this.request<{ conditions: ConditionDefinition[] }>(`/campaigns/${campaignId}/ruleset/conditions`);
    return res.conditions;
  }

  async addRulesetCondition(campaignId: string, condition: Partial<ConditionDefinition>): Promise<ConditionDefinition> {
    const res = await this.request<{ condition: ConditionDefinition }>(`/campaigns/${campaignId}/ruleset/conditions`, {
      method: 'POST',
      body: JSON.stringify(condition)
    });
    return res.condition;
  }

  async updateRulesetCondition(campaignId: string, conditionId: string, patch: Partial<ConditionDefinition>): Promise<ConditionDefinition> {
    const res = await this.request<{ condition: ConditionDefinition }>(`/campaigns/${campaignId}/ruleset/conditions/${conditionId}`, {
      method: 'PUT',
      body: JSON.stringify(patch)
    });
    return res.condition;
  }

  async deleteRulesetCondition(campaignId: string, conditionId: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>(`/campaigns/${campaignId}/ruleset/conditions/${conditionId}`, {
      method: 'DELETE'
    });
    return res.success;
  }

  // --- TIPOS DE DANO ---

  async getRulesetDamageTypes(campaignId: string): Promise<DamageTypeDefinition[]> {
    const res = await this.request<{ damageTypes: DamageTypeDefinition[] }>(`/campaigns/${campaignId}/ruleset/damage-types`);
    return res.damageTypes;
  }

  async addRulesetDamageType(campaignId: string, damageType: Partial<DamageTypeDefinition>): Promise<DamageTypeDefinition> {
    const res = await this.request<{ damageType: DamageTypeDefinition }>(`/campaigns/${campaignId}/ruleset/damage-types`, {
      method: 'POST',
      body: JSON.stringify(damageType)
    });
    return res.damageType;
  }

  async updateRulesetDamageType(campaignId: string, damageTypeId: string, patch: Partial<DamageTypeDefinition>): Promise<DamageTypeDefinition> {
    const res = await this.request<{ damageType: DamageTypeDefinition }>(`/campaigns/${campaignId}/ruleset/damage-types/${damageTypeId}`, {
      method: 'PUT',
      body: JSON.stringify(patch)
    });
    return res.damageType;
  }

  async deleteRulesetDamageType(campaignId: string, damageTypeId: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>(`/campaigns/${campaignId}/ruleset/damage-types/${damageTypeId}`, {
      method: 'DELETE'
    });
    return res.success;
  }

  async getRulesetAbilities(campaignId: string): Promise<AbilityDefinition[]> {
    const res = await this.request<{ abilities: AbilityDefinition[] }>(`/campaigns/${campaignId}/ruleset/abilities`);
    return res.abilities;
  }

  async addRulesetAbility(campaignId: string, ability: Partial<AbilityDefinition>): Promise<AbilityDefinition> {
    const res = await this.request<{ ability: AbilityDefinition }>(`/campaigns/${campaignId}/ruleset/abilities`, {
      method: 'POST',
      body: JSON.stringify(ability)
    });
    return res.ability;
  }

  async updateRulesetAbility(campaignId: string, abilityId: string, patch: Partial<AbilityDefinition>): Promise<AbilityDefinition> {
    const res = await this.request<{ ability: AbilityDefinition }>(`/campaigns/${campaignId}/ruleset/abilities/${abilityId}`, {
      method: 'PUT',
      body: JSON.stringify(patch)
    });
    return res.ability;
  }

  async deleteRulesetAbility(campaignId: string, abilityId: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>(`/campaigns/${campaignId}/ruleset/abilities/${abilityId}`, {
      method: 'DELETE'
    });
    return res.success;
  }

  async getCombatantConditions(campaignId: string, encounterId: string, combatantId: string): Promise<ActiveCondition[]> {
    const res = await this.request<{ conditions: ActiveCondition[] }>(`/campaigns/${campaignId}/combat/${encounterId}/combatants/${combatantId}/conditions`);
    return res.conditions;
  }

  async applyCombatantCondition(
    campaignId: string, 
    encounterId: string, 
    combatantId: string, 
    data: Partial<ActiveCondition> & { name: string }
  ): Promise<{ condition: ActiveCondition; combatant: Combatant }> {
    return this.request(`/campaigns/${campaignId}/combat/${encounterId}/combatants/${combatantId}/conditions`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async removeCombatantCondition(
    campaignId: string, 
    encounterId: string, 
    combatantId: string, 
    activeConditionId: string
  ): Promise<{ success: boolean; combatant: Combatant }> {
    return this.request(`/campaigns/${campaignId}/combat/${encounterId}/combatants/${combatantId}/conditions/${activeConditionId}`, {
      method: 'DELETE'
    });
  }

  async getCharacterConditions(campaignId: string, characterId: string): Promise<ActiveCondition[]> {
    const res = await this.request<{ conditions: ActiveCondition[] }>(`/campaigns/${campaignId}/characters/${characterId}/conditions`);
    return res.conditions;
  }

  async applyCharacterCondition(
    campaignId: string, 
    characterId: string, 
    data: Partial<ActiveCondition> & { name: string }
  ): Promise<{ condition: ActiveCondition; character: Character }> {
    return this.request(`/campaigns/${campaignId}/characters/${characterId}/conditions`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async removeCharacterCondition(
    campaignId: string, 
    characterId: string, 
    activeConditionId: string
  ): Promise<{ success: boolean; character: Character }> {
    return this.request(`/campaigns/${campaignId}/characters/${characterId}/conditions/${activeConditionId}`, {
      method: 'DELETE'
    });
  }

  // --- BESTIÁRIO & CRIATURAS ---

  async getBestiary(campaignId: string, filters?: { category?: string; search?: string }): Promise<BestiaryCreature[]> {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters?.search) params.append('search', filters.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{ creatures: BestiaryCreature[] }>(`/campaigns/${campaignId}/bestiary${qs}`);
    return res.creatures;
  }

  async getBestiaryCreature(campaignId: string, creatureId: string): Promise<BestiaryCreature> {
    const res = await this.request<{ creature: BestiaryCreature }>(`/campaigns/${campaignId}/bestiary/${creatureId}`);
    return res.creature;
  }

  async createBestiaryCreature(campaignId: string, creature: Partial<BestiaryCreature>): Promise<BestiaryCreature> {
    const res = await this.request<{ creature: BestiaryCreature }>(`/campaigns/${campaignId}/bestiary`, {
      method: 'POST',
      body: JSON.stringify(creature)
    });
    return res.creature;
  }

  async updateBestiaryCreature(campaignId: string, creatureId: string, patch: Partial<BestiaryCreature>): Promise<BestiaryCreature> {
    const res = await this.request<{ creature: BestiaryCreature }>(`/campaigns/${campaignId}/bestiary/${creatureId}`, {
      method: 'PUT',
      body: JSON.stringify(patch)
    });
    return res.creature;
  }

  async duplicateBestiaryCreature(campaignId: string, creatureId: string, options?: { name?: string; description?: string }): Promise<BestiaryCreature> {
    const res = await this.request<{ creature: BestiaryCreature }>(`/campaigns/${campaignId}/bestiary/${creatureId}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(options || {})
    });
    return res.creature;
  }

  async deleteBestiaryCreature(campaignId: string, creatureId: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>(`/campaigns/${campaignId}/bestiary/${creatureId}`, {
      method: 'DELETE'
    });
    return res.success;
  }

  async revealBestiaryCreature(campaignId: string, creatureId: string): Promise<BestiaryCreature> {
    const res = await this.request<{ creature: BestiaryCreature }>(`/campaigns/${campaignId}/bestiary/${creatureId}/reveal`, {
      method: 'POST'
    });
    return res.creature;
  }

  async hideBestiaryCreature(campaignId: string, creatureId: string): Promise<BestiaryCreature> {
    const res = await this.request<{ creature: BestiaryCreature }>(`/campaigns/${campaignId}/bestiary/${creatureId}/hide`, {
      method: 'POST'
    });
    return res.creature;
  }

  async updateBestiaryRevealedFields(
    campaignId: string, 
    creatureId: string, 
    revealed_fields: Partial<CreatureRevealedFields>
  ): Promise<BestiaryCreature> {
    const res = await this.request<{ creature: BestiaryCreature }>(`/campaigns/${campaignId}/bestiary/${creatureId}/revealed-fields`, {
      method: 'PATCH',
      body: JSON.stringify({ revealed_fields })
    });
    return res.creature;
  }

  // --- GERENCIAMENTO DE ENCONTROS ---

  async getEncounters(campaignId: string): Promise<CombatEncounter[]> {
    const res = await this.request<{ encounters: CombatEncounter[] }>(`/campaigns/${campaignId}/combat/encounters`);
    return res.encounters;
  }

  async createPreparedEncounter(campaignId: string, data: { name?: string; scene_id?: string | null; notes?: string; planned_creatures?: any[] }): Promise<CombatEncounter> {
    const res = await this.request<{ encounter: CombatEncounter }>(`/campaigns/${campaignId}/combat/encounters`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.encounter;
  }

  async duplicateEncounter(campaignId: string, encounterId: string): Promise<CombatEncounter> {
    const res = await this.request<{ encounter: CombatEncounter }>(`/campaigns/${campaignId}/combat/encounters/${encounterId}/duplicate`, {
      method: 'POST'
    });
    return res.encounter;
  }

  async deleteEncounter(campaignId: string, encounterId: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>(`/campaigns/${campaignId}/combat/encounters/${encounterId}`, {
      method: 'DELETE'
    });
    return res.success;
  }

  async spawnCreaturesToEncounter(
    campaignId: string,
    encounterId: string,
    data: {
      creature_id: string;
      count?: number;
      scene_id?: string | null;
      x?: number;
      y?: number;
      name_prefix?: string;
      is_hidden?: boolean;
    }
  ): Promise<{ combatants: Combatant[]; encounter: CombatEncounter }> {
    return this.request(`/campaigns/${campaignId}/combat/${encounterId}/spawn-creatures`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}

export const api = new ApiService();
