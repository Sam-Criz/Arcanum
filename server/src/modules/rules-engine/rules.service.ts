import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { 
  CampaignRuleSetConfig, CombatRulesConfig, EvaluationResult, ValidationResult, ConditionDefinition, DamageTypeDefinition, AbilityDefinition 
} from './rules.types';
import { Evaluator } from './evaluator';

export class RulesService {
  constructor(private db: DatabaseSync) {}

  /**
   * Obtém as configurações de regras ativas da campanha
   */
  getActiveRuleset(campaignId: string): { id: string; version: number; title: string; config: CampaignRuleSetConfig } | null {
    const row = this.db.prepare(`
      SELECT id, version_number, title, config_json 
      FROM ruleset_versions 
      WHERE campaign_id = ? AND is_active = 1 
      ORDER BY version_number DESC 
      LIMIT 1
    `).get(campaignId) as any;

    if (!row) return null;

    return {
      id: row.id,
      version: row.version_number,
      title: row.title,
      config: JSON.parse(row.config_json)
    };
  }

  /**
   * Salva uma nova versão de regras para a campanha, desativando a anterior
   */
  saveRulesetVersion(campaignId: string, config: CampaignRuleSetConfig, title = 'Atualização de Regras'): { id: string; version: number } {
    const latest = this.db.prepare(`
      SELECT version_number FROM ruleset_versions 
      WHERE campaign_id = ? 
      ORDER BY version_number DESC 
      LIMIT 1
    `).get(campaignId) as any;

    const nextVersion = (latest?.version_number || 0) + 1;
    const id = crypto.randomUUID();

    // Desativa versões antigas e insere a nova versão atomicamente
    this.db.exec('BEGIN TRANSACTION;');
    try {
      this.db.prepare(`UPDATE ruleset_versions SET is_active = 0 WHERE campaign_id = ?`).run(campaignId);

      this.db.prepare(`
        INSERT INTO ruleset_versions (id, campaign_id, version_number, title, config_json, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(id, campaignId, nextVersion, title, JSON.stringify(config));

      this.db.exec('COMMIT;');
      return { id, version: nextVersion };
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  /**
   * Valida uma fórmula contra os atributos permitidos pela campanha
   */
  validateFormula(campaignId: string, expression: string): ValidationResult {
    const ruleset = this.getActiveRuleset(campaignId);
    if (!ruleset) {
      return { isValid: false, error: 'A campanha não possui regras ativas configuradas', variables: [] };
    }

    const allowedAttributes = ruleset.config.attributes.map(a => a.name);
    return Evaluator.validateExpression(expression, allowedAttributes);
  }

  /**
   * Avalia uma fórmula no contexto da campanha
   */
  evaluateFormula(
    campaignId: string, 
    expressionOrFormulaId: string, 
    variables: Record<string, number> = {},
    customRng?: () => number
  ): EvaluationResult {
    const ruleset = this.getActiveRuleset(campaignId);
    let expressionToRun = expressionOrFormulaId;

    if (ruleset) {
      // Se for um identificador de fórmula configurada na campanha, busca a expressão cadastrada
      const configuredFormula = ruleset.config.formulas.find(f => f.id === expressionOrFormulaId);
      if (configuredFormula) {
        expressionToRun = configuredFormula.expression;
      }
    }

    return Evaluator.evaluateExpression(expressionToRun, {
      variables,
      rng: customRng
    });
  }

  /**
   * Obtém as configurações de combate da campanha (iniciativa, desempate, ações, defesa, esquiva)
   */
  getCombatRulesConfig(campaignId: string): CombatRulesConfig {
    const ruleset = this.getActiveRuleset(campaignId);
    if (ruleset?.config?.combatConfig) {
      return ruleset.config.combatConfig;
    }

    // Inferência baseada nos atributos disponíveis no ruleset
    const attrIds = (ruleset?.config?.attributes || []).map(a => a.id.toLowerCase());
    let tieBreaker = 'agilidade';
    let initFormula = '1d20 + agilidade';
    let dodgeFormula = '1d20 + agilidade';
    let defenseEffect: { type: 'bonus_rd' | 'bonus_defense'; value: number } = { type: 'bonus_rd', value: 2 };

    if (attrIds.includes('destreza')) {
      tieBreaker = 'destreza';
      initFormula = '1d20 + destreza';
      dodgeFormula = '1d20 + destreza';
      defenseEffect = { type: 'bonus_defense', value: 2 };
    } else if (attrIds.includes('reflexo')) {
      tieBreaker = 'reflexo';
      initFormula = '2d6 + reflexo';
      dodgeFormula = '2d6 + reflexo';
      defenseEffect = { type: 'bonus_rd', value: 2 };
    }

    return {
      initiative_formula: initFormula,
      tie_breaker_attr: tieBreaker,
      actions_per_turn: { main: 1, bonus: 1, reaction: 1, free: 99 },
      defense_effect: defenseEffect,
      dodge_effect: { formula: dodgeFormula, type: 'replace_defense_if_higher' },
      skip_incapacitated: true
    };
  }

  /**
   * Obtém as condições cadastradas no ruleset da campanha
   */
  getConditions(campaignId: string): ConditionDefinition[] {
    const ruleset = this.getActiveRuleset(campaignId);
    if (!ruleset) return [];
    if (ruleset.config.conditions && Array.isArray(ruleset.config.conditions) && ruleset.config.conditions.length > 0) {
      return ruleset.config.conditions;
    }
    // Fallback: se o ruleset ainda não tiver condições salvas, utiliza o preset correspondente
    const sys = (ruleset.config.systemName || '').toLowerCase();
    const presetName = sys.includes('cyber') ? 'cyberpunk' : sys.includes('d20') ? 'fantasia_d20' : 'investigacao';
    const preset = getPresetConfig(presetName);
    return preset.conditions || [];
  }

  /**
   * Adiciona uma nova definição de condição ao ruleset da campanha
   */
  addConditionDefinition(campaignId: string, condition: ConditionDefinition): ConditionDefinition {
    const ruleset = this.getActiveRuleset(campaignId);
    if (!ruleset) throw new Error('Ruleset da campanha não encontrado.');
    const config = { ...ruleset.config };
    config.conditions = [...(config.conditions || this.getConditions(campaignId))];

    if (config.conditions.some(c => c.id === condition.id)) {
      throw new Error(`Condição com ID '${condition.id}' já existe.`);
    }

    config.conditions.push(condition);
    this.saveRulesetVersion(campaignId, config, `Adicionada condição ${condition.name}`);
    return condition;
  }

  /**
   * Atualiza uma definição de condição existente
   */
  updateConditionDefinition(campaignId: string, conditionId: string, patch: Partial<ConditionDefinition>): ConditionDefinition {
    const ruleset = this.getActiveRuleset(campaignId);
    if (!ruleset) throw new Error('Ruleset da campanha não encontrado.');
    const config = { ...ruleset.config };
    config.conditions = [...(config.conditions || this.getConditions(campaignId))];

    const idx = config.conditions.findIndex(c => c.id === conditionId);
    if (idx === -1) {
      throw new Error(`Condição '${conditionId}' não encontrada.`);
    }

    const updated = { ...config.conditions[idx], ...patch, id: conditionId };
    config.conditions[idx] = updated;
    this.saveRulesetVersion(campaignId, config, `Atualizada condição ${updated.name}`);
    return updated;
  }

  /**
   * Remove uma definição de condição
   */
  deleteConditionDefinition(campaignId: string, conditionId: string): boolean {
    const ruleset = this.getActiveRuleset(campaignId);
    if (!ruleset) throw new Error('Ruleset da campanha não encontrado.');
    const config = { ...ruleset.config };
    config.conditions = [...(config.conditions || this.getConditions(campaignId))];

    const prevLength = config.conditions.length;
    config.conditions = config.conditions.filter(c => c.id !== conditionId);
    if (config.conditions.length === prevLength) {
      throw new Error(`Condição '${conditionId}' não encontrada.`);
    }

    this.saveRulesetVersion(campaignId, config, `Removida condição ${conditionId}`);
    return true;
  }

  /**
   * Obtém os tipos de dano cadastrados no ruleset da campanha
   */
  getDamageTypes(campaignId: string): DamageTypeDefinition[] {
    const ruleset = this.getActiveRuleset(campaignId);
    if (!ruleset) return [];
    if (ruleset.config.damageTypes && Array.isArray(ruleset.config.damageTypes) && ruleset.config.damageTypes.length > 0) {
      return ruleset.config.damageTypes;
    }
    // Fallback para preset
    const sys = (ruleset.config.systemName || '').toLowerCase();
    const presetName = sys.includes('cyber') ? 'cyberpunk' : sys.includes('d20') ? 'fantasia_d20' : 'investigacao';
    const preset = getPresetConfig(presetName);
    return preset.damageTypes || [
      { id: 'fisico', name: 'Físico', color: '#94a3b8' },
      { id: 'fogo', name: 'Fogo', color: '#f97316' },
      { id: 'gelo', name: 'Gelo', color: '#38bdf8' },
      { id: 'eletrico', name: 'Elétrico', color: '#eab308' },
      { id: 'veneno', name: 'Veneno', color: '#10b981' },
      { id: 'acido', name: 'Ácido', color: '#84cc16' },
      { id: 'energia', name: 'Energia', color: '#06b6d4' },
      { id: 'oculto', name: 'Oculto', color: '#a855f7' }
    ];
  }

  /**
   * Adiciona um novo tipo de dano ao ruleset da campanha
   */
  addDamageType(campaignId: string, damageType: DamageTypeDefinition): DamageTypeDefinition {
    const ruleset = this.getActiveRuleset(campaignId);
    if (!ruleset) throw new Error('Ruleset da campanha não encontrado.');
    const config = { ...ruleset.config };
    config.damageTypes = [...(config.damageTypes || this.getDamageTypes(campaignId))];

    if (config.damageTypes.some(d => d.id === damageType.id)) {
      throw new Error(`Tipo de dano com ID '${damageType.id}' já existe.`);
    }

    config.damageTypes.push(damageType);
    this.saveRulesetVersion(campaignId, config, `Adicionado tipo de dano ${damageType.name}`);
    return damageType;
  }

  /**
   * Atualiza um tipo de dano existente
   */
  updateDamageType(campaignId: string, damageTypeId: string, patch: Partial<DamageTypeDefinition>): DamageTypeDefinition {
    const ruleset = this.getActiveRuleset(campaignId);
    if (!ruleset) throw new Error('Ruleset da campanha não encontrado.');
    const config = { ...ruleset.config };
    config.damageTypes = [...(config.damageTypes || this.getDamageTypes(campaignId))];

    const idx = config.damageTypes.findIndex(d => d.id === damageTypeId);
    if (idx === -1) {
      throw new Error(`Tipo de dano '${damageTypeId}' não encontrado.`);
    }

    const updated = { ...config.damageTypes[idx], ...patch, id: damageTypeId };
    config.damageTypes[idx] = updated;
    this.saveRulesetVersion(campaignId, config, `Atualizado tipo de dano ${updated.name}`);
    return updated;
  }

  /**
   * Remove um tipo de dano
   */
  deleteDamageType(campaignId: string, damageTypeId: string): boolean {
    const ruleset = this.getActiveRuleset(campaignId);
    if (!ruleset) throw new Error('Ruleset da campanha não encontrado.');
    const config = { ...ruleset.config };
    config.damageTypes = [...(config.damageTypes || this.getDamageTypes(campaignId))];

    const prevLength = config.damageTypes.length;
    config.damageTypes = config.damageTypes.filter(d => d.id !== damageTypeId);
    if (config.damageTypes.length === prevLength) {
      throw new Error(`Tipo de dano '${damageTypeId}' não encontrado.`);
    }

    this.saveRulesetVersion(campaignId, config, `Removido tipo de dano ${damageTypeId}`);
    return true;
  }

  /**
   * Obtém as habilidades cadastradas no ruleset da campanha
   */
  getAbilities(campaignId: string): AbilityDefinition[] {
    const ruleset = this.getActiveRuleset(campaignId);
    if (!ruleset) return [];
    if (ruleset.config.abilities && Array.isArray(ruleset.config.abilities) && ruleset.config.abilities.length > 0) {
      return ruleset.config.abilities;
    }
    const sys = (ruleset.config.systemName || '').toLowerCase();
    const presetName = sys.includes('cyber') ? 'cyberpunk' : sys.includes('d20') ? 'fantasia_d20' : 'investigacao';
    const preset = getPresetConfig(presetName);
    return preset.abilities || [];
  }

  /**
   * Adiciona uma nova habilidade ao ruleset da campanha
   */
  addAbilityDefinition(campaignId: string, ability: Partial<AbilityDefinition>): AbilityDefinition {
    const ruleset = this.getActiveRuleset(campaignId);
    if (!ruleset) throw new Error('Ruleset da campanha não encontrado.');
    const config = { ...ruleset.config };
    config.abilities = [...(config.abilities || this.getAbilities(campaignId))];

    const id = ability.id || crypto.randomUUID();
    if (config.abilities.some(a => a.id === id)) {
      throw new Error(`Habilidade com ID '${id}' já existe.`);
    }

    const fullAbility: AbilityDefinition = {
      id,
      name: ability.name || 'Nova Habilidade',
      description: ability.description || '',
      action_type: ability.action_type || ability.action_cost || 'main',
      action_cost: ability.action_cost || ability.action_type || 'main',
      valid_targets: ability.valid_targets || 'enemies',
      range: ability.range || 'corpo a corpo',
      type: ability.type || (ability.healing_formula || (ability as any).heal_formula ? 'heal' : 'attack'),
      resource_cost: ability.resource_cost,
      attack_formula: ability.attack_formula,
      defense_target: ability.defense_target,
      damage_formula: ability.damage_formula,
      damage_type: ability.damage_type,
      damage_components: ability.damage_components,
      healing_formula: ability.healing_formula || (ability as any).heal_formula,
      heal_formula: (ability as any).heal_formula || ability.healing_formula,
      apply_conditions: ability.apply_conditions,
      remove_conditions: ability.remove_conditions,
      requires_weapon: ability.requires_weapon
    };

    config.abilities.push(fullAbility);
    this.saveRulesetVersion(campaignId, config, `Adicionada habilidade ${fullAbility.name}`);
    return fullAbility;
  }

  /**
   * Atualiza uma habilidade existente no ruleset
   */
  updateAbilityDefinition(campaignId: string, abilityId: string, patch: Partial<AbilityDefinition>): AbilityDefinition {
    const ruleset = this.getActiveRuleset(campaignId);
    if (!ruleset) throw new Error('Ruleset da campanha não encontrado.');
    const config = { ...ruleset.config };
    config.abilities = [...(config.abilities || this.getAbilities(campaignId))];

    const idx = config.abilities.findIndex(a => a.id === abilityId);
    if (idx === -1) {
      throw new Error(`Habilidade '${abilityId}' não encontrada.`);
    }

    const updated: AbilityDefinition = {
      ...config.abilities[idx],
      ...patch,
      id: abilityId
    };

    config.abilities[idx] = updated;
    this.saveRulesetVersion(campaignId, config, `Atualizada habilidade ${updated.name}`);
    return updated;
  }

  /**
   * Remove uma habilidade do ruleset
   */
  deleteAbilityDefinition(campaignId: string, abilityId: string): boolean {
    const ruleset = this.getActiveRuleset(campaignId);
    if (!ruleset) throw new Error('Ruleset da campanha não encontrado.');
    const config = { ...ruleset.config };
    config.abilities = [...(config.abilities || this.getAbilities(campaignId))];

    const prevLength = config.abilities.length;
    config.abilities = config.abilities.filter(a => a.id !== abilityId);
    if (config.abilities.length === prevLength) {
      throw new Error(`Habilidade '${abilityId}' não encontrada.`);
    }

    this.saveRulesetVersion(campaignId, config, `Removida habilidade ${abilityId}`);
    return true;
  }

  /**
   * Cria o conjunto de regras inicial para uma nova campanha com base em um preset
   */
  initializeDefaultRules(campaignId: string, presetName: 'investigacao' | 'fantasia_d20' | 'cyberpunk' = 'investigacao'): void {
    const config = getPresetConfig(presetName);
    this.saveRulesetVersion(campaignId, config, `Regras Iniciais (${config.systemName})`);
  }
}

export function getPresetConfig(presetName: 'investigacao' | 'fantasia_d20' | 'cyberpunk'): CampaignRuleSetConfig {
  if (presetName === 'investigacao') {
    return {
      systemName: 'Investigação Paranormal & Ocultismo',
      description: 'Sistema focado em perícias, sanidade, horror e testes com d20.',
      defaultDice: '1d20',
      attributes: [
        { id: 'forca', name: 'Forca', abbr: 'FOR', type: 'number', defaultValue: 1, min: 0, max: 10, description: 'Capacidade física e brutalidade' },
        { id: 'agilidade', name: 'Agilidade', abbr: 'AGI', type: 'number', defaultValue: 1, min: 0, max: 10, description: 'Velocidade, reflexos e pontaria' },
        { id: 'intelecto', name: 'Intelecto', abbr: 'INT', type: 'number', defaultValue: 1, min: 0, max: 10, description: 'Raciocínio lógico, investigação e ocultismo' },
        { id: 'presenca', name: 'Presenca', abbr: 'PRE', type: 'number', defaultValue: 1, min: 0, max: 10, description: 'Força de vontade, lábia e carisma' },
        { id: 'vigor', name: 'Vigor', abbr: 'VIG', type: 'number', defaultValue: 1, min: 0, max: 10, description: 'Resistência corporal e saúde' },
        { id: 'defesa', name: 'Defesa', abbr: 'DEF', type: 'number', defaultValue: 10, isDerived: true, formula: '10 + Agilidade', description: 'Dificuldade para ser atingido' }
      ],
      resources: [
        { id: 'vida', name: 'Pontos de Vida', abbr: 'PV', color: '#ef4444', maxFormula: 'Vigor * 5 + 10' },
        { id: 'sanidade', name: 'Sanidade', abbr: 'SAN', color: '#3b82f6', maxFormula: 'Presenca * 5 + 10' },
        { id: 'esforco', name: 'Pontos de Esforço', abbr: 'PE', color: '#10b981', maxFormula: 'Intelecto * 3 + 5' }
      ],
      formulas: [
        { id: 'teste_pericia', name: 'Teste Geral de Perícia', expression: '1d20 + Agilidade', category: 'test' },
        { id: 'ataque_fisico', name: 'Ataque Físico', expression: '1d20 + Forca', category: 'attack' },
        { id: 'ataque_tiro', name: 'Disparo com Arma de Fogo', expression: '1d20 + Agilidade', category: 'attack' },
        { id: 'dano_laminas', name: 'Dano de Lâminas', expression: '1d6 + Forca', category: 'damage' },
        { id: 'dano_fuzil', name: 'Dano Fuzil de Assalto', expression: '2d8 + Agilidade', category: 'damage' },
        { id: 'reducao_bloqueio', name: 'Redução de Bloqueio', expression: 'max(0, DanoBruto - Vigor)', category: 'defense' }
      ],
      combatConfig: {
        initiative_formula: '1d20 + Agilidade',
        tie_breaker_attr: 'agilidade',
        actions_per_turn: { main: 1, bonus: 1, reaction: 1, free: 99 },
        defense_effect: { type: 'bonus_rd', value: 2, formula: '2' },
        dodge_effect: { formula: '1d20 + Agilidade', type: 'replace_defense_if_higher' },
        skip_incapacitated: true
      },
      conditions: [
        {
          id: 'sangrando',
          name: 'Sangrando',
          description: 'Sofre 2 de dano no final do seu turno.',
          icon: 'droplet',
          color: '#ef4444',
          effects: {
            dot: { formula: '2', damageType: 'sangramento', timing: 'turn_end' }
          },
          default_duration: { type: 'turns', value: 3 },
          tick_timing: 'turn_end',
          stack_rule: 'stack_duration',
          is_visible_to_players: true
        },
        {
          id: 'abalado',
          name: 'Abalado',
          description: '-2 em testes de ataque e perícias por choque psicológico.',
          icon: 'alert-triangle',
          color: '#f59e0b',
          effects: {
            attack_mod: -2
          },
          modifiers: [
            { target: 'ataque', type: 'flat', value: -2 }
          ],
          default_duration: { type: 'rounds', value: 2 },
          tick_timing: 'round_end',
          stack_rule: 'replace',
          is_visible_to_players: true
        },
        {
          id: 'paralisado',
          name: 'Paralisado',
          description: 'Incapacitado de agir ou se mover. Defesa reduzida em 4.',
          icon: 'lock',
          color: '#6366f1',
          effects: {
            incapacitated: true,
            defense_mod: -4
          },
          modifiers: [
            { target: 'defesa', type: 'flat', value: -4 }
          ],
          default_duration: { type: 'rounds', value: 1 },
          tick_timing: 'round_end',
          stack_rule: 'replace',
          is_visible_to_players: true
        },
        {
          id: 'protegido',
          name: 'Protegido',
          description: '+2 na defesa por abrigo ou cobertura tática.',
          icon: 'shield',
          color: '#10b981',
          effects: {
            defense_mod: 2
          },
          modifiers: [
            { target: 'defesa', type: 'flat', value: 2 }
          ],
          default_duration: { type: 'rounds', value: 2 },
          tick_timing: 'round_end',
          stack_rule: 'replace',
          is_visible_to_players: true
        }
      ],
      damageTypes: [
        { id: 'fisico', name: 'Físico', color: '#94a3b8' },
        { id: 'balistico', name: 'Balístico', color: '#64748b' },
        { id: 'perfuracao', name: 'Perfuração', color: '#78716c' },
        { id: 'fogo', name: 'Fogo', color: '#f97316' },
        { id: 'eletrico', name: 'Elétrico', color: '#eab308' },
        { id: 'veneno', name: 'Veneno', color: '#10b981' },
        { id: 'quimico', name: 'Químico', color: '#84cc16' },
        { id: 'sangue', name: 'Sangue', color: '#ef4444' },
        { id: 'morte', name: 'Morte', color: '#18181b' },
        { id: 'energia', name: 'Energia', color: '#06b6d4' },
        { id: 'conhecimento', name: 'Conhecimento', color: '#a855f7' }
      ],
      abilities: [
        {
          id: 'primeiros_socorros',
          name: 'Primeiros Socorros',
          description: 'Aplica ataduras e analgésicos para estabilizar e curar um aliado.',
          action_type: 'main',
          valid_targets: 'allies',
          range: 'toque',
          resource_cost: { name: 'sanidade', amount: 2 },
          healing_formula: '1d8 + Vigor',
          apply_conditions: ['protegido']
        },
        {
          id: 'tiro_preciso',
          name: 'Tiro Preciso',
          description: 'Mire cuidadosamente antes de disparar contra o inimigo.',
          action_type: 'bonus',
          valid_targets: 'enemies',
          range: '18m',
          attack_formula: '1d20 + Agilidade + 2',
          damage_formula: '2d6 + 2',
          damage_type: 'balistico'
        },
        {
          id: 'sangria_oculta',
          name: 'Sangria Oculta',
          description: 'Causa ferimento profundo e sangramento no inimigo.',
          action_type: 'main',
          valid_targets: 'enemies',
          range: 'corpo a corpo',
          resource_cost: { name: 'sanidade', amount: 3 },
          attack_formula: '1d20 + Forca',
          damage_formula: '1d6',
          damage_type: 'corte',
          apply_conditions: ['sangrando']
        }
      ]
    };
  }

  if (presetName === 'cyberpunk') {
    return {
      systemName: 'Cyberpunk Neon & Cromo',
      description: 'Sistema baseado em paradas de d6 e modificadores cibernéticos.',
      defaultDice: '2d6',
      attributes: [
        { id: 'cromo', name: 'Cromo', abbr: 'CRO', type: 'number', defaultValue: 2, min: 1, max: 8 },
        { id: 'reflexo', name: 'Reflexo', abbr: 'REF', type: 'number', defaultValue: 3, min: 1, max: 8 },
        { id: 'inteligencia', name: 'Inteligencia', abbr: 'INT', type: 'number', defaultValue: 2, min: 1, max: 8 },
        { id: 'tecnica', name: 'Tecnica', abbr: 'TEC', type: 'number', defaultValue: 2, min: 1, max: 8 }
      ],
      resources: [
        { id: 'bateria', name: 'Bateria Cibernética', abbr: 'BAT', color: '#06b6d4', maxFormula: 'Cromo * 10' },
        { id: 'estresse', name: 'Estresse Neural', abbr: 'EST', color: '#f59e0b', maxFormula: 'Reflexo * 5' }
      ],
      formulas: [
        { id: 'hackeamento', name: 'Teste de Invasão Neural', expression: '2d6 + Inteligencia', category: 'test' },
        { id: 'tiro_plasma', name: 'Disparo de Pistola de Plasma', expression: '2d6 + Reflexo', category: 'attack' },
        { id: 'dano_plasma', name: 'Dano de Plasma', expression: '3d6 + Cromo', category: 'damage' }
      ],
      combatConfig: {
        initiative_formula: '2d6 + Reflexo',
        tie_breaker_attr: 'reflexo',
        actions_per_turn: { main: 1, bonus: 1, reaction: 1, free: 99 },
        defense_effect: { type: 'bonus_rd', value: 2, formula: '2' },
        dodge_effect: { formula: '2d6 + Reflexo', type: 'replace_defense_if_higher' },
        skip_incapacitated: true
      },
      conditions: [
        {
          id: 'sobrecarga',
          name: 'Sobrecarga Elétrica',
          description: 'Sofre 1d8 de dano elétrico no início do seu turno.',
          icon: 'zap',
          color: '#06b6d4',
          effects: {
            dot: { formula: '1d8', damageType: 'eletrico', timing: 'turn_start' }
          },
          default_duration: { type: 'turns', value: 2 },
          tick_timing: 'turn_start',
          stack_rule: 'stack_duration',
          is_visible_to_players: true
        },
        {
          id: 'eletrocutado',
          name: 'Eletrocutado',
          description: 'Incapacitado temporariamente por choque nos circuitos.',
          icon: 'activity',
          color: '#eab308',
          effects: {
            incapacitated: true
          },
          default_duration: { type: 'rounds', value: 1 },
          tick_timing: 'round_end',
          stack_rule: 'replace',
          is_visible_to_players: true
        },
        {
          id: 'mirando',
          name: 'Mirando',
          description: '+2 no próximo teste de ataque.',
          icon: 'crosshair',
          color: '#10b981',
          effects: {
            attack_mod: 2
          },
          modifiers: [
            { target: 'ataque', type: 'flat', value: 2 }
          ],
          default_duration: { type: 'actions', value: 1 },
          tick_timing: 'action',
          stack_rule: 'replace',
          is_visible_to_players: true
        },
        {
          id: 'camuflado',
          name: 'Camuflado',
          description: '+4 na defesa por camuflagem óptica ativa.',
          icon: 'eye-off',
          color: '#a855f7',
          effects: {
            defense_mod: 4
          },
          modifiers: [
            { target: 'defesa', type: 'flat', value: 4 }
          ],
          default_duration: { type: 'actions', value: 2 },
          tick_timing: 'action',
          stack_rule: 'replace',
          is_visible_to_players: true
        }
      ],
      damageTypes: [
        { id: 'cinetico', name: 'Cinético', color: '#94a3b8' },
        { id: 'balistico', name: 'Balístico', color: '#64748b' },
        { id: 'termico', name: 'Térmico / Fogo', color: '#f97316' },
        { id: 'eletrico', name: 'Elétrico / PEM', color: '#06b6d4' },
        { id: 'quimico', name: 'Químico / Veneno', color: '#10b981' },
        { id: 'laser', name: 'Laser / Energia', color: '#ec4899' },
        { id: 'cibernetico', name: 'Cibernético', color: '#8b5cf6' }
      ],
      abilities: [
        {
          id: 'pulso_pem',
          name: 'Pulso Eletromagnético (PEM)',
          description: 'Descarrega energia que sobrecarrega os circuitos do alvo.',
          action_type: 'main',
          valid_targets: 'enemies',
          range: '9m',
          resource_cost: { name: 'bateria', amount: 4 },
          attack_formula: '2d6 + Cromo',
          damage_formula: '2d6',
          damage_type: 'eletrico',
          apply_conditions: ['sobrecarga_eletrica']
        },
        {
          id: 'injecao_nanites',
          name: 'Injeção de Nanites Médicos',
          description: 'Nanomáquinas reparam tecidos celulares e fecham ferimentos.',
          action_type: 'bonus',
          valid_targets: 'allies',
          range: 'toque',
          resource_cost: { name: 'bateria', amount: 3 },
          healing_formula: '2d8 + Biologia'
        },
        {
          id: 'rajada_cibernetica',
          name: 'Rajada Cibernética',
          description: 'Disparo de alta cadência otimizado pelo software de mira.',
          action_type: 'main',
          valid_targets: 'enemies',
          range: '15m',
          resource_cost: { name: 'bateria', amount: 2 },
          attack_formula: '2d6 + Reflexo + 2',
          damage_formula: '3d6',
          damage_type: 'balistico'
        }
      ]
    };
  }

  // Fantasia d20
  return {
    systemName: 'Fantasia Clássica D20',
    description: 'Sistema com os 6 atributos clássicos e combate d20.',
    defaultDice: '1d20',
    attributes: [
      { id: 'forca', name: 'Forca', abbr: 'FOR', type: 'number', defaultValue: 10, min: 1, max: 30 },
      { id: 'destreza', name: 'Destreza', abbr: 'DES', type: 'number', defaultValue: 10, min: 1, max: 30 },
      { id: 'constituicao', name: 'Constituicao', abbr: 'CON', type: 'number', defaultValue: 10, min: 1, max: 30 },
      { id: 'inteligencia', name: 'Inteligencia', abbr: 'INT', type: 'number', defaultValue: 10, min: 1, max: 30 },
      { id: 'sabedoria', name: 'Sabedoria', abbr: 'SAB', type: 'number', defaultValue: 10, min: 1, max: 30 },
      { id: 'carisma', name: 'Carisma', abbr: 'CAR', type: 'number', defaultValue: 10, min: 1, max: 30 }
    ],
    resources: [
      { id: 'hp', name: 'Hit Points', abbr: 'HP', color: '#ef4444', maxFormula: 'Constituicao * 2 + 10' }
    ],
    formulas: [
      { id: 'ataque_espada', name: 'Ataque com Espada', expression: '1d20 + floor((Forca - 10) / 2)', category: 'attack' },
      { id: 'dano_espada', name: 'Dano com Espada Longa', expression: '1d8 + floor((Forca - 10) / 2)', category: 'damage' }
    ],
    combatConfig: {
      initiative_formula: '1d20 + floor((Destreza - 10) / 2)',
      tie_breaker_attr: 'destreza',
      actions_per_turn: { main: 1, bonus: 1, reaction: 1, free: 99 },
      defense_effect: { type: 'bonus_defense', value: 2, formula: '2' },
      dodge_effect: { formula: '1d20 + floor((Destreza - 10) / 2)', type: 'replace_defense_if_higher' },
      skip_incapacitated: true
    },
    conditions: [
      {
        id: 'envenenado',
        name: 'Envenenado',
        description: 'Sofre 1d4 de dano no início do turno e penalidade de -2 em testes de ataque.',
        icon: 'skull',
        color: '#10b981',
        effects: {
          dot: { formula: '1d4', damageType: 'veneno', timing: 'turn_start' },
          attack_mod: -2
        },
        modifiers: [
          { target: 'ataque', type: 'flat', value: -2 }
        ],
        default_duration: { type: 'turns', value: 3 },
        tick_timing: 'turn_start',
        stack_rule: 'stack_duration',
        is_visible_to_players: true
      },
      {
        id: 'em_chamas',
        name: 'Em Chamas',
        description: 'Sofre 1d6 de dano de fogo no início do turno.',
        icon: 'flame',
        color: '#f97316',
        effects: {
          dot: { formula: '1d6', damageType: 'fogo', timing: 'turn_start' }
        },
        default_duration: { type: 'turns', value: 3 },
        tick_timing: 'turn_start',
        stack_rule: 'stack_duration',
        is_visible_to_players: true
      },
      {
        id: 'atordoado',
        name: 'Atordoado',
        description: 'Incapacitado de agir e perde 5 de defesa.',
        icon: 'zap-off',
        color: '#eab308',
        effects: {
          incapacitated: true,
          defense_mod: -5
        },
        modifiers: [
          { target: 'defesa', type: 'flat', value: -5 }
        ],
        default_duration: { type: 'rounds', value: 1 },
        tick_timing: 'round_end',
        stack_rule: 'replace',
        is_visible_to_players: true
      },
      {
        id: 'cego',
        name: 'Cego',
        description: '-5 em testes de ataque e -5 na defesa.',
        icon: 'eye-off',
        color: '#6b7280',
        effects: {
          attack_mod: -5,
          defense_mod: -5
        },
        modifiers: [
          { target: 'ataque', type: 'flat', value: -5 },
          { target: 'defesa', type: 'flat', value: -5 }
        ],
        default_duration: { type: 'rounds', value: 2 },
        tick_timing: 'round_end',
        stack_rule: 'replace',
        is_visible_to_players: true
      },
      {
        id: 'caido',
        name: 'Caído',
        description: 'Alvo no chão: -2 na defesa corpo a corpo.',
        icon: 'arrow-down',
        color: '#8b5cf6',
        effects: {
          defense_mod: -2
        },
        modifiers: [
          { target: 'defesa', type: 'flat', value: -2 }
        ],
        default_duration: { type: 'permanent', value: 0 },
        tick_timing: 'turn_start',
        stack_rule: 'replace',
        is_visible_to_players: true
      },
      {
        id: 'abencoado',
        name: 'Abençoado',
        description: '+1 em testes de ataque e +1 em rolagens de dano.',
        icon: 'sparkles',
        color: '#3b82f6',
        effects: {
          attack_mod: 1,
          damage_mod: 1
        },
        modifiers: [
          { target: 'ataque', type: 'flat', value: 1 },
          { target: 'dano', type: 'flat', value: 1 }
        ],
        default_duration: { type: 'rounds', value: 3 },
        tick_timing: 'round_end',
        stack_rule: 'replace',
        is_visible_to_players: true
      }
    ],
    damageTypes: [
      { id: 'fisico', name: 'Físico', color: '#94a3b8' },
      { id: 'fogo', name: 'Fogo', color: '#f97316' },
      { id: 'gelo', name: 'Gelo', color: '#38bdf8' },
      { id: 'eletrico', name: 'Elétrico', color: '#eab308' },
      { id: 'acido', name: 'Ácido', color: '#84cc16' },
      { id: 'veneno', name: 'Veneno', color: '#10b981' },
      { id: 'necrotico', name: 'Necrótico', color: '#475569' },
      { id: 'sagrado', name: 'Sagrado', color: '#fbbf24' },
      { id: 'energia', name: 'Energia / Arcano', color: '#a855f7' },
      { id: 'psiquico', name: 'Psíquico', color: '#f43f5e' }
    ],
    abilities: [
      {
        id: 'curar_ferimentos',
        name: 'Curar Ferimentos',
        description: 'Energia divina restaura pontos de vida de um aliado ou do próprio usuário.',
        action_type: 'main',
        valid_targets: 'allies',
        range: 'toque',
        resource_cost: { name: 'mana', amount: 5 },
        healing_formula: '2d8 + Sabedoria'
      },
      {
        id: 'golpe_poderoso',
        name: 'Golpe Poderoso',
        description: 'Golpe devastador desferido com força total contra o inimigo.',
        action_type: 'main',
        valid_targets: 'enemies',
        range: 'corpo a corpo',
        attack_formula: '1d20 + Forca',
        damage_formula: '2d8 + Forca',
        damage_type: 'fisico'
      },
      {
        id: 'toque_toxico',
        name: 'Toque Tóxico',
        description: 'Infunde veneno letal nas veias do alvo.',
        action_type: 'main',
        valid_targets: 'enemies',
        range: 'toque',
        resource_cost: { name: 'mana', amount: 3 },
        attack_formula: '1d20 + Inteligencia',
        damage_formula: '1d6',
        damage_type: 'veneno',
        apply_conditions: ['envenenado']
      },
      {
        id: 'bencao_divina',
        name: 'Bênção Divina',
        description: 'Concede a bênção divina que aprimora ataques e defesas de aliados.',
        action_type: 'bonus',
        valid_targets: 'allies',
        range: '9m',
        resource_cost: { name: 'mana', amount: 4 },
        apply_conditions: ['abencoado']
      }
    ]
  };
}
