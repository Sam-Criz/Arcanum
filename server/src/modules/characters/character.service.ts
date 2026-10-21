import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { Character, CharacterTemplate, CreateCharacterDTO, TemplateSchema } from './character.types';
import { RulesService } from '../rules-engine/rules.service';
import { Evaluator } from '../rules-engine/evaluator';
import { ActiveCondition } from '../rules-engine/rules.types';

export class CharacterService {
  constructor(
    private db: DatabaseSync,
    private rulesService: RulesService
  ) {}

  /**
   * Cria um modelo de ficha (template) para a campanha
   */
  createTemplate(campaignId: string, name: string, description: string, schema: TemplateSchema): CharacterTemplate {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO character_templates (id, campaign_id, name, description, schema_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, campaignId, name.trim(), description.trim(), JSON.stringify(schema), now);

    return {
      id,
      campaign_id: campaignId,
      name: name.trim(),
      description: description.trim(),
      schema,
      created_at: now
    };
  }

  getTemplates(campaignId: string): CharacterTemplate[] {
    const rows = this.db.prepare(`
      SELECT id, campaign_id, name, description, schema_json, created_at
      FROM character_templates
      WHERE campaign_id = ?
      ORDER BY created_at ASC
    `).all(campaignId) as any[];

    return rows.map(r => ({
      id: r.id,
      campaign_id: r.campaign_id,
      name: r.name,
      description: r.description,
      schema: JSON.parse(r.schema_json),
      created_at: r.created_at
    }));
  }

  getTemplateById(campaignId: string, templateId: string): CharacterTemplate | null {
    const row = this.db.prepare(`
      SELECT id, campaign_id, name, description, schema_json, created_at
      FROM character_templates
      WHERE campaign_id = ? AND id = ?
    `).get(campaignId, templateId) as any;

    if (!row) return null;

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      name: row.name,
      description: row.description,
      schema: JSON.parse(row.schema_json),
      created_at: row.created_at
    };
  }

  updateTemplate(
    campaignId: string,
    templateId: string,
    data: { name?: string; description?: string; schema?: TemplateSchema }
  ): CharacterTemplate {
    const existing = this.getTemplateById(campaignId, templateId);
    if (!existing) {
      throw new Error('Modelo de ficha não encontrado nesta campanha.');
    }

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const description = data.description !== undefined ? data.description.trim() : existing.description;
    const schema = data.schema !== undefined ? data.schema : existing.schema;

    this.db.prepare(`
      UPDATE character_templates
      SET name = ?, description = ?, schema_json = ?
      WHERE id = ? AND campaign_id = ?
    `).run(name, description, JSON.stringify(schema), templateId, campaignId);

    return {
      ...existing,
      name,
      description,
      schema
    };
  }

  deleteTemplate(campaignId: string, templateId: string): void {
    const res = this.db.prepare(`
      DELETE FROM character_templates WHERE id = ? AND campaign_id = ?
    `).run(templateId, campaignId);

    if (res.changes === 0) {
      throw new Error('Modelo de ficha não encontrado para remoção.');
    }
  }

  /**
   * Recalcula campos derivados e recursos da ficha usando as regras da campanha e o modelo da ficha
   */
  computeCharacterFields(campaignId: string, rawData: Record<string, any>, templateId?: string | null, characterId?: string): Record<string, any> {
    const computed: Record<string, any> = { ...rawData };
    const ruleset = this.rulesService.getActiveRuleset(campaignId);

    // 0. Injetar carga atual e peso total a partir do inventário real do personagem
    if (characterId) {
      try {
        const invRow = this.db.prepare(`
          SELECT COALESCE(SUM(weight * quantity), 0) as total_weight, COALESCE(SUM(quantity), 0) as total_items
          FROM character_inventory
          WHERE character_id = ?
        `).get(characterId) as any;
        const totalWeight = Math.round((Number(invRow?.total_weight) || 0) * 100) / 100;
        const totalItems = Math.round(Number(invRow?.total_items) || 0);

        computed['carga_atual'] = totalWeight;
        computed['peso_total'] = totalWeight;
        computed['peso_carregado'] = totalWeight;
        computed['total_itens'] = totalItems;
      } catch {
        // Tabela ainda pode não ter dados
      }
    }

    if (!ruleset) return computed;

    // 1. Extrair variáveis numéricas fornecidas pelo usuário
    const numericContext: Record<string, number> = {};
    for (const [k, v] of Object.entries(computed)) {
      if (typeof v === 'number' || (!isNaN(Number(v)) && v !== '')) {
        const num = Number(v);
        numericContext[k] = num;
        numericContext[k.toLowerCase()] = num;
      }
    }
    for (const [k, v] of Object.entries(rawData)) {
      if (typeof v === 'number' || (!isNaN(Number(v)) && v !== '')) {
        const num = Number(v);
        numericContext[k] = num;
        numericContext[k.toLowerCase()] = num;
      }
    }

    // 2. Preencher atributos da campanha e sincronizar identificadores
    for (const attr of ruleset.config.attributes) {
      const lowerId = attr.id.toLowerCase();
      const lowerName = attr.name.toLowerCase();

      if (lowerId in numericContext || lowerName in numericContext) {
        const val = numericContext[lowerId] !== undefined ? numericContext[lowerId] : numericContext[lowerName];
        numericContext[attr.id] = val;
        numericContext[attr.name] = val;
        numericContext[lowerId] = val;
        numericContext[lowerName] = val;
        computed[attr.id] = val;
      } else if (!attr.isDerived) {
        numericContext[attr.id] = attr.defaultValue;
        numericContext[attr.name] = attr.defaultValue;
        numericContext[lowerId] = attr.defaultValue;
        numericContext[lowerName] = attr.defaultValue;
        computed[attr.id] = attr.defaultValue;
      }
    }

    // 3. Calcular atributos derivados da campanha (Ex: Defesa = 10 + Agilidade)
    for (const attr of ruleset.config.attributes) {
      if (attr.isDerived && attr.formula) {
        try {
          const res = Evaluator.evaluateExpression(attr.formula, { variables: numericContext });
          computed[attr.id] = res.total;
          numericContext[attr.id] = res.total;
          numericContext[attr.name] = res.total;
        } catch {
          computed[attr.id] = attr.defaultValue;
        }
      }
    }

    // 4. Calcular máximos dos recursos (Ex: Vida Máxima = Vigor * 5 + 10)
    for (const res of ruleset.config.resources) {
      const maxFieldId = `${res.id}_max`;
      const currentFieldId = `${res.id}_atual`;

      try {
        const result = Evaluator.evaluateExpression(res.maxFormula, { variables: numericContext });
        computed[maxFieldId] = result.total;
        numericContext[maxFieldId] = result.total;

        // Se o valor atual não foi definido, inicializa no máximo
        if (computed[currentFieldId] === undefined || computed[currentFieldId] === null) {
          computed[currentFieldId] = result.total;
        }
      } catch {
        computed[maxFieldId] = 10;
        if (computed[currentFieldId] === undefined) computed[currentFieldId] = 10;
      }
    }

    // 5. Se houver templateId, aplicar campos e fórmulas definidos pelo mestre no modelo de ficha
    if (templateId) {
      const template = this.getTemplateById(campaignId, templateId);
      if (template && template.schema && Array.isArray(template.schema.sections)) {
        for (const section of template.schema.sections) {
          for (const field of section.fields) {
            // Se o campo não foi preenchido manualmente, inicializa com o defaultValue
            if (!(field.id in computed) && field.defaultValue !== undefined) {
              computed[field.id] = field.defaultValue;
              if (typeof field.defaultValue === 'number') {
                numericContext[field.id] = field.defaultValue;
                numericContext[field.name] = field.defaultValue;
              }
            }

            // Se for campo derivado configurado com fórmula matemática
            if (field.isDerived && field.formula) {
              try {
                const res = Evaluator.evaluateExpression(field.formula, { variables: numericContext });
                computed[field.id] = res.total;
                numericContext[field.id] = res.total;
                numericContext[field.name] = res.total;
              } catch {
                if (field.defaultValue !== undefined) {
                  computed[field.id] = field.defaultValue;
                }
              }
            }
          }
        }
      }
    }

    // Aplica modificadores de condições ativas da ficha, se houver
    if (characterId) {
      try {
        const row = this.db.prepare(`SELECT conditions_json FROM characters WHERE campaign_id = ? AND id = ?`).get(campaignId, characterId) as any;
        if (row?.conditions_json) {
          const conds: ActiveCondition[] = JSON.parse(row.conditions_json);
          for (const cond of conds) {
            if (cond.modifiers) {
              for (const mod of cond.modifiers) {
                const targetKey = mod.target.toLowerCase();
                if (computed[targetKey] !== undefined) {
                  if (mod.type === 'percentage') {
                    computed[targetKey] = Math.round(computed[targetKey] * (1 + mod.value / 100));
                  } else {
                    computed[targetKey] += mod.value;
                  }
                } else if (computed[mod.target] !== undefined) {
                  if (mod.type === 'percentage') {
                    computed[mod.target] = Math.round(computed[mod.target] * (1 + mod.value / 100));
                  } else {
                    computed[mod.target] += mod.value;
                  }
                }
              }
            }
          }
        }
      } catch {}
    }

    return computed;
  }

  createCharacter(campaignId: string, userId: string, data: CreateCharacterDTO): Character {
    if (!data.name || !data.name.trim()) {
      throw new Error('O nome do personagem é obrigatório.');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const rawData = data.rawData || (data as any).raw_data || {};
    const computedData = this.computeCharacterFields(campaignId, rawData, data.templateId);

    this.db.prepare(`
      INSERT INTO characters (
        id, campaign_id, user_id, template_id, name, avatar_url, is_npc, 
        raw_data_json, computed_data_json, conditions_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)
    `).run(
      id,
      campaignId,
      userId,
      data.templateId || null,
      data.name.trim(),
      data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.name)}`,
      data.isNpc ? 1 : 0,
      JSON.stringify(rawData),
      JSON.stringify(computedData),
      now,
      now
    );

    return {
      id,
      campaign_id: campaignId,
      user_id: userId,
      template_id: data.templateId || null,
      name: data.name.trim(),
      avatar_url: data.avatarUrl || null,
      is_npc: data.isNpc ? 1 : 0,
      raw_data: rawData,
      computed_data: computedData,
      conditions: [],
      created_at: now,
      updated_at: now
    };
  }

  getCampaignCharacters(campaignId: string, userId: string, isMaster: boolean): Character[] {
    let sql = `
      SELECT c.*, u.username as owner_username
      FROM characters c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.campaign_id = ?
    `;

    // Se não for mestre, filtra NPCs ocultos se houver flag privada
    if (!isMaster) {
      sql += ` AND (c.is_npc = 0 OR c.user_id = '${userId}')`;
    }

    sql += ` ORDER BY c.name ASC`;

    const rows = this.db.prepare(sql).all(campaignId) as any[];

    return rows.map(r => {
      const rawData = JSON.parse(r.raw_data_json || '{}');
      let computedData = JSON.parse(r.computed_data_json || '{}');
      if (computedData.carga_atual === undefined) {
        computedData = this.computeCharacterFields(campaignId, rawData, r.template_id, r.id);
      }
      let conditions: ActiveCondition[] = [];
      try {
        conditions = JSON.parse(r.conditions_json || '[]');
      } catch {
        conditions = [];
      }
      return {
        id: r.id,
        campaign_id: r.campaign_id,
        user_id: r.user_id,
        template_id: r.template_id,
        name: r.name,
        avatar_url: r.avatar_url,
        is_npc: r.is_npc,
        raw_data: rawData,
        computed_data: computedData,
        conditions,
        created_at: r.created_at,
        updated_at: r.updated_at,
        owner_username: r.owner_username
      };
    });
  }

  getCharacterById(campaignId: string, characterId: string): Character | null {
    const row = this.db.prepare(`
      SELECT c.*, u.username as owner_username
      FROM characters c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.campaign_id = ? AND c.id = ?
    `).get(campaignId, characterId) as any;

    if (!row) return null;

    const rawData = JSON.parse(row.raw_data_json || '{}');
    let computedData = JSON.parse(row.computed_data_json || '{}');
    if (computedData.carga_atual === undefined) {
      computedData = this.computeCharacterFields(campaignId, rawData, row.template_id, row.id);
    }
    let conditions: ActiveCondition[] = [];
    try {
      conditions = JSON.parse(row.conditions_json || '[]');
    } catch {
      conditions = [];
    }

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      user_id: row.user_id,
      template_id: row.template_id,
      name: row.name,
      avatar_url: row.avatar_url,
      is_npc: row.is_npc,
      raw_data: rawData,
      computed_data: computedData,
      conditions,
      created_at: row.created_at,
      updated_at: row.updated_at,
      owner_username: row.owner_username
    };
  }

  updateCharacter(
    campaignId: string,
    characterId: string,
    data: { name?: string; avatarUrl?: string; rawData?: Record<string, any> },
    requesterUserId: string,
    isMaster: boolean
  ): Character {
    const existing = this.getCharacterById(campaignId, characterId);
    if (!existing) {
      throw new Error('Personagem não encontrado.');
    }

    // Apenas o dono do personagem ou um mestre da campanha pode editar a ficha
    if (existing.user_id !== requesterUserId && !isMaster) {
      throw new Error('Você não tem permissão para editar a ficha de outro jogador.');
    }

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const avatarUrl = data.avatarUrl !== undefined ? data.avatarUrl : (existing.avatar_url ?? null);
    const rawData = data.rawData !== undefined ? { ...existing.raw_data, ...data.rawData } : existing.raw_data;
    const computedData = this.computeCharacterFields(campaignId, rawData, existing.template_id, characterId);
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE characters
      SET name = ?, avatar_url = ?, raw_data_json = ?, computed_data_json = ?, updated_at = ?
      WHERE id = ? AND campaign_id = ?
    `).run(name, avatarUrl ?? null, JSON.stringify(rawData), JSON.stringify(computedData), now, characterId, campaignId);

    return {
      ...existing,
      name,
      avatar_url: avatarUrl,
      raw_data: rawData,
      computed_data: computedData,
      updated_at: now
    };
  }

  /**
   * Recalcula a ficha e atualiza os atributos no banco (incluindo peso/carga de itens)
   */
  recomputeCharacter(campaignId: string, characterId: string): Character | null {
    const existing = this.getCharacterById(campaignId, characterId);
    if (!existing) return null;

    const computedData = this.computeCharacterFields(campaignId, existing.raw_data, existing.template_id, characterId);
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE characters
      SET computed_data_json = ?, updated_at = ?
      WHERE id = ? AND campaign_id = ?
    `).run(JSON.stringify(computedData), now, characterId, campaignId);

    return {
      ...existing,
      computed_data: computedData,
      updated_at: now
    };
  }

  /**
   * Obtém as condições ativas na ficha de um personagem
   */
  getCharacterConditions(campaignId: string, characterId: string): ActiveCondition[] {
    const char = this.getCharacterById(campaignId, characterId);
    if (!char) throw new Error('Personagem não encontrado.');
    return char.conditions || [];
  }

  /**
   * Aplica uma condição ativa na ficha de um personagem
   */
  applyCondition(
    campaignId: string,
    characterId: string,
    conditionData: Partial<ActiveCondition> & { name?: string; condition_id?: string; condition?: string; id?: string }
  ): ActiveCondition {
    const char = this.getCharacterById(campaignId, characterId);
    if (!char) throw new Error('Personagem não encontrado.');

    // Busca definição no ruleset para preencher padrões se disponíveis
    const rulesetConditions = this.rulesService.getConditions(campaignId);
    const lookupKey = (conditionData.condition_id || (conditionData as any).id || (conditionData as any).condition || conditionData.name || '').toString().trim().toLowerCase();
    const def = rulesetConditions.find(
      c => c.id.toLowerCase() === lookupKey || 
           (c.name && c.name.toLowerCase() === lookupKey) || 
           (conditionData.name && c.name && c.name.toLowerCase() === conditionData.name.toString().toLowerCase().trim())
    );

    const conditionId = conditionData.condition_id || def?.id || (conditionData as any).id || (conditionData as any).condition || crypto.randomUUID();
    const conditionName = conditionData.name || def?.name || (conditionData as any).condition || conditionId;
    const durationType = conditionData.duration_type || def?.default_duration?.type || 'turns';
    const durationRemaining = conditionData.duration_remaining ?? def?.default_duration?.value ?? (durationType === 'permanent' ? 0 : 3);
    const tickTiming = conditionData.tick_timing || def?.tick_timing || (durationType === 'rounds' ? 'round_end' : durationType === 'actions' ? 'action' : 'turn_start');
    const stackRule = (conditionData as any).stack_rule || def?.stack_rule || 'replace';

    let currentConditions: ActiveCondition[] = [...(char.conditions || [])];
    const existingIndex = currentConditions.findIndex(
      c => c.condition_id === conditionId || (conditionName && c.name && c.name.toLowerCase() === conditionName.toLowerCase())
    );

    let activeCondition: ActiveCondition;

    if (existingIndex >= 0) {
      if (stackRule === 'stack_duration') {
        currentConditions[existingIndex].duration_remaining += durationRemaining;
        activeCondition = currentConditions[existingIndex];
      } else if (stackRule === 'stack_intensity') {
        currentConditions[existingIndex].stack_count = (currentConditions[existingIndex].stack_count || 1) + 1;
        currentConditions[existingIndex].duration_remaining = Math.max(currentConditions[existingIndex].duration_remaining, durationRemaining);
        activeCondition = currentConditions[existingIndex];
      } else if (stackRule === 'ignore') {
        activeCondition = currentConditions[existingIndex];
      } else {
        // replace
        activeCondition = {
          id: currentConditions[existingIndex].id,
          condition_id: conditionId,
          name: conditionName,
          description: conditionData.description ?? def?.description,
          icon: conditionData.icon ?? def?.icon,
          color: conditionData.color ?? def?.color,
          duration_type: durationType,
          duration_remaining: durationRemaining,
          tick_timing: tickTiming,
          modifiers: conditionData.modifiers ?? def?.modifiers ?? [],
          effects: conditionData.effects ?? def?.effects ?? {},
          stack_count: 1,
          is_visible_to_players: conditionData.is_visible_to_players ?? def?.is_visible_to_players ?? true
        };
        currentConditions[existingIndex] = activeCondition;
      }
    } else {
      activeCondition = {
        id: crypto.randomUUID(),
        condition_id: conditionId,
        name: conditionName,
        description: conditionData.description ?? def?.description,
        icon: conditionData.icon ?? def?.icon,
        color: conditionData.color ?? def?.color,
        duration_type: durationType,
        duration_remaining: durationRemaining,
        tick_timing: tickTiming,
        modifiers: conditionData.modifiers ?? def?.modifiers ?? [],
        effects: conditionData.effects ?? def?.effects ?? {},
        stack_count: 1,
        is_visible_to_players: conditionData.is_visible_to_players ?? def?.is_visible_to_players ?? true
      };
      currentConditions.push(activeCondition);
    }

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE characters
      SET conditions_json = ?, updated_at = ?
      WHERE campaign_id = ? AND id = ?
    `).run(JSON.stringify(currentConditions), now, campaignId, characterId);

    // Recalcula campos derivados caso afetem atributos
    this.recomputeCharacter(campaignId, characterId);

    return activeCondition;
  }

  /**
   * Remove uma condição da ficha do personagem
   */
  removeCondition(campaignId: string, characterId: string, activeConditionId: string): boolean {
    const char = this.getCharacterById(campaignId, characterId);
    if (!char) throw new Error('Personagem não encontrado.');

    const searchKey = (activeConditionId || '').toString().trim().toLowerCase();
    const currentConditions = [...(char.conditions || [])];
    const filtered = currentConditions.filter(
      c => c.id !== activeConditionId && 
           c.condition_id !== activeConditionId && 
           (c.name ? c.name.toLowerCase() !== searchKey : true)
    );

    if (filtered.length === currentConditions.length) {
      return false;
    }

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE characters
      SET conditions_json = ?, updated_at = ?
      WHERE campaign_id = ? AND id = ?
    `).run(JSON.stringify(filtered), now, campaignId, characterId);

    this.recomputeCharacter(campaignId, characterId);
    return true;
  }
}
