export interface AttributeDefinition {
  id: string;
  name: string;
  abbr: string;
  type: 'number' | 'text' | 'boolean';
  min?: number;
  max?: number;
  defaultValue: number;
  isDerived?: boolean;
  formula?: string; // Ex: "floor(Agilidade / 2) + 10"
  description?: string;
}

export interface ResourceDefinition {
  id: string;
  name: string;
  abbr?: string;
  color?: string; // hex ou nome de cor para a barra na ficha
  maxFormula: string; // Ex: "Vigor * 5 + 10"
  min?: number;
  description?: string;
}

export interface FormulaDefinition {
  id: string;
  name: string;
  expression: string; // Ex: "1d20 + Agilidade", "max(0, Dano - Armadura)"
  description?: string;
  category?: 'test' | 'attack' | 'damage' | 'defense' | 'custom';
}

export interface CombatRulesConfig {
  initiative_formula?: string;
  tie_breaker_attr?: string; // Atributo para critério de desempate da iniciativa (ex: 'agilidade', 'destreza', 'reflexo')
  actions_per_turn?: {
    main?: number; // Padrão: 1
    bonus?: number; // Padrão: 1
    reaction?: number; // Padrão: 1
    free?: number;
  };
  defense_effect?: {
    type: 'bonus_rd' | 'bonus_defense';
    value: number;
    formula?: string;
    duration?: 'until_next_turn' | 'until_attacked';
  };
  dodge_effect?: {
    formula?: string;
    type: 'replace_defense_if_higher' | 'bonus_defense';
    duration?: 'until_next_turn' | 'until_attacked';
  };
  skip_incapacitated?: boolean;
}

export interface ConditionModifier {
  target: 'ataque' | 'defesa' | 'dano' | 'iniciativa' | 'rd' | string;
  type: 'flat' | 'percentage';
  value: number;
}

export interface ConditionDotEffect {
  formula: string; // Ex: "1d4", "2", "1d6"
  damageType?: string; // Ex: "veneno", "fogo", "sangramento", "eletrico"
  damage_type?: string; // Alias para compatibilidade
  timing: 'turn_start' | 'turn_end' | 'round_end' | string;
  trigger?: string; // Alias para compatibilidade
}

export interface ConditionEffects {
  incapacitated?: boolean;
  dot?: ConditionDotEffect;
  defense_mod?: number;
  damage_mod?: number;
  attack_mod?: number;
  damage_reduction_mod?: number;
  incoming_damage_mod?: number; // Multiplicador ou acréscimo de dano sofrido
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
  id: string; // ID único da instância ativa (UUID)
  condition_id: string; // Referência à definição ou custom
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
  id: string; // ex: 'fisico', 'fogo', 'gelo', 'eletrico', 'veneno', 'acido', 'energia', 'oculto'
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
  formula?: string; // ex: '1d4'
  percentage_damage?: number; // ex: 10 (% da vida)
  percentage_damage_target?: 'max_hp' | 'current_hp';
  chance_percent?: number; // ex: 25 (% de chance de ativação: 0-100)
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
  condition?: string;
  conditions?: string[] | any[];
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
  condition?: string;
  apply_conditions?: Array<Partial<ActiveCondition> & { name: string; condition_id?: string } | string>;
  duration_type: 'attacks' | 'hits' | 'turns' | 'rounds' | 'permanent';
  charges_remaining?: number;
  max_charges?: number;
  duration_remaining?: number;
  combine_behavior?: 'replace' | 'stack' | 'reject';
  created_at: string;
}

export type ValidTargetType = 'self' | 'allies' | 'enemies' | 'any' | 'weapon' | 'object';

export interface AbilityResourceCost {
  name: string; // ex: 'mana', 'pontos_alma', 'sanidade', 'vigor', 'bateria'
  amount: number;
}

export interface AbilityDefinition {
  id: string;
  name: string;
  description?: string;
  action_type?: 'main' | 'bonus' | 'reaction' | 'free'; // default: 'main'
  action_cost?: 'main' | 'bonus' | 'reaction' | 'free'; // alias para compatibilidade
  valid_targets?: ValidTargetType | ValidTargetType[]; // default: 'enemies'
  range?: string; // ex: 'corpo a corpo', '9m', 'toque', 'pessoal'
  type?: 'attack' | 'heal' | 'buff' | 'utility';
  resource_cost?: AbilityResourceCost;
  attack_formula?: string; // ex: '1d20 + Inteligencia'
  defense_target?: 'defense' | 'rd' | string;
  damage_formula?: string; // ex: '3d6'
  damage_type?: string; // ex: 'fogo', 'magico', 'eletrico'
  damage_components?: DamageComponent[];
  healing_formula?: string; // ex: '2d8 + Sabedoria'
  heal_formula?: string; // alias para compatibilidade
  apply_conditions?: Array<Partial<ActiveCondition> & { name: string; condition_id?: string } | string>;
  remove_conditions?: string[]; // Nomes ou IDs de condições que remove (ex: remove veneno)
  requires_weapon?: boolean;
}

export interface CampaignRuleSetConfig {
  systemName: string;
  description?: string;
  defaultDice: string; // Ex: "1d20", "3d6", "1d100"
  attributes: AttributeDefinition[];
  resources: ResourceDefinition[];
  formulas: FormulaDefinition[];
  combatConfig?: CombatRulesConfig;
  conditions?: ConditionDefinition[];
  damageTypes?: DamageTypeDefinition[];
  abilities?: AbilityDefinition[];
}

export interface RollBreakdownItem {
  dice: string;
  rolls: number[];
  subtotal: number;
}

export interface EvaluationResult {
  total: number;
  breakdown: {
    expression: string;
    diceRolls: RollBreakdownItem[];
    variablesUsed: Record<string, number>;
  };
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  variables: string[];
}
