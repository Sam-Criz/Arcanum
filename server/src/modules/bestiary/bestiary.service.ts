import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { RulesService } from '../rules-engine/rules.service';
import { CharacterService } from '../characters/character.service';

export interface CreatureRevealedFields {
  name?: boolean;           // Revelar nome verdadeiro (se falso, jogadores veem display_name_players)
  category?: boolean;       // Revelar categoria e raça/espécie
  avatar?: boolean;         // Revelar avatar e imagem do token
  description?: boolean;    // Revelar descrição e histórico
  attributes?: boolean;     // Revelar atributos numéricos
  exact_hp?: boolean;       // Revelar valor exato de PV (se falso, apenas barra de status/percentual)
  defenses?: boolean;       // Revelar Defesa, RD, resistências, vulnerabilidades e imunidades
  damage_types?: boolean;   // Revelar tipos de dano causados pelos ataques
  equipment?: boolean;      // Revelar armas e armaduras equipadas
  abilities?: boolean;      // Revelar habilidades especiais e ações
  formulas?: boolean;       // Revelar fórmulas internas de dano e ataque
  notes?: boolean;          // Revelar anotações públicas para jogadores
}

export const DEFAULT_REVEALED_FIELDS: CreatureRevealedFields = {
  name: false,
  category: false,
  avatar: false,
  description: false,
  attributes: false,
  exact_hp: false,
  defenses: false,
  damage_types: false,
  equipment: false,
  abilities: false,
  formulas: false,
  notes: false
};

export interface CreatureEquipmentItem {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'shield' | 'accessory' | 'item';
  category?: string;
  equipped: boolean;
  attack_formula?: string;
  damage_formula?: string;
  damage_type?: string;
  damage_components?: Array<{ formula: string; damage_type: string; condition?: string; chance_percent?: number }>;
  defense_bonus?: number;
  damage_reduction?: number;
  properties?: Record<string, any>;
  description?: string;
}

export interface BestiaryCreature {
  id: string;
  campaign_id: string;
  template_id: string | null;
  name: string;
  display_name_players: string | null;
  description: string;
  category: string;
  race: string;
  size: number;
  avatar_url: string | null;
  token_url: string | null;
  is_revealed: boolean;
  revealed_fields: CreatureRevealedFields;
  equipment: CreatureEquipmentItem[];
  raw_data: Record<string, any>;
  computed_data: Record<string, any>;
  actions: any[];
  properties: Record<string, any>;
  public_notes: string;
  private_notes: string;
  created_at: string;
  updated_at: string;
}

export function sanitizeNpcDataForPlayer(npcData: Record<string, any>, revealed: CreatureRevealedFields = {}): Record<string, any> {
  const result: Record<string, any> = { ...npcData };

  // Sempre remove notas secretas do mestre
  delete result.gm_notes;
  delete result.private_notes;

  // 1. HP / Vida
  const hpKeys = ['hp', 'vida', 'pv', 'current_hp', 'max_hp', 'pv_maximo', 'vida_maxima', 'vida_max', 'pv_max', 'vida_atual', 'pv_atual', 'hp_max', 'cur_hp'];
  if (!revealed.exact_hp || result.hide_exact_hp === true) {
    for (const k of hpKeys) {
      delete result[k];
    }
  }

  // 2. Defesas & RD
  const defKeys = ['defense', 'defesa', 'ca', 'armor_class', 'damage_reduction', 'rd', 'armadura'];
  if (!revealed.defenses || result.hide_stats === true) {
    for (const k of defKeys) {
      delete result[k];
    }
    delete result.resistances;
    delete result.vulnerabilities;
    delete result.immunities;
  }

  // 3. Fórmulas de iniciativa e dados
  const formulaKeys = ['iniciativa_formula', 'initiative_formula', 'iniciativa', 'initiative', 'attack_formula', 'damage_formula', 'damage_components', 'formula'];
  if (!revealed.formulas) {
    for (const k of formulaKeys) {
      delete result[k];
    }
    if (Array.isArray(result.actions)) {
      result.actions = result.actions.map((act: any) => ({
        name: act.name,
        description: act.description || '',
        type: act.type || 'attack'
      }));
    }
  }

  // 4. Tipos de dano
  if (!revealed.damage_types) {
    delete result.damage_components;
    delete result.resistances;
    delete result.vulnerabilities;
    delete result.immunities;
  }

  // 5. Atributos mecânicos
  if (!revealed.attributes || result.hide_stats === true) {
    delete result.attributes;
    const knownAttrs = [
      'forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma',
      'agilidade', 'vigor', 'intelecto', 'presenca', 'for', 'des', 'con', 'int', 'sab', 'car',
      'str', 'dex', 'con', 'int', 'wis', 'cha', 'agi', 'vig', 'pre', 'sanidade', 'mana'
    ];
    for (const k of Object.keys(result)) {
      if (knownAttrs.includes(k.toLowerCase()) || (typeof result[k] === 'number' && k !== 'size')) {
        delete result[k];
      }
    }
  }

  // 6. Equipamentos
  if (!revealed.equipment) {
    delete result.equipment;
  }

  // 7. Notas públicas
  if (!revealed.notes) {
    delete result.public_notes;
  }

  // 8. Descrição
  if (!revealed.description) {
    delete result.description;
  }

  return result;
}

export class BestiaryService {
  constructor(
    private db: DatabaseSync,
    private rulesService: RulesService,
    private characterService?: CharacterService
  ) {}

  getCreatures(campaignId: string, filters?: { category?: string; search?: string }, isMaster: boolean = true): BestiaryCreature[] {
    let sql = `SELECT * FROM bestiary_creatures WHERE campaign_id = ?`;
    const params: any[] = [campaignId];

    if (!isMaster) {
      // Jogadores só visualizam criaturas explicitamente reveladas no bestiário
      sql += ` AND is_revealed = 1`;
    }

    if (filters?.category && filters.category !== 'all') {
      sql += ` AND category = ?`;
      params.push(filters.category);
    }
    if (filters?.search && filters.search.trim()) {
      sql += ` AND (name LIKE ? OR description LIKE ? OR category LIKE ? OR display_name_players LIKE ? OR race LIKE ?)`;
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    sql += ` ORDER BY name ASC, created_at DESC`;

    const rows = this.db.prepare(sql).all(...params) as any[];
    const creatures = rows.map(r => this.mapCreature(r));

    if (!isMaster) {
      return creatures.map(c => this.sanitizeCreatureForPlayer(c));
    }
    return creatures;
  }

  getCreatureById(campaignId: string, creatureId: string, isMaster: boolean = true): BestiaryCreature | null {
    const row = this.db.prepare(`
      SELECT * FROM bestiary_creatures WHERE campaign_id = ? AND id = ?
    `).get(campaignId, creatureId) as any;

    if (!row) return null;
    const creature = this.mapCreature(row);

    if (!isMaster) {
      // Bloqueio rigoroso de consulta direta a ficha de criatura oculta por jogadores
      if (!creature.is_revealed) return null;
      return this.sanitizeCreatureForPlayer(creature);
    }

    return creature;
  }

  createCreature(campaignId: string, data: Partial<BestiaryCreature>): BestiaryCreature {
    const id = crypto.randomUUID();
    const name = data.name?.trim() || 'Nova Criatura';
    const displayNamePlayers = data.display_name_players?.trim() || data.properties?.display_name_players?.trim() || null;
    const description = data.description?.trim() || '';
    const category = data.category?.trim() || 'monstro';
    const race = data.race?.trim() || '';
    const size = typeof data.size === 'number' ? Math.max(0.25, Math.min(10, data.size)) : 1;
    const avatarUrl = data.avatar_url || null;
    const tokenUrl = data.token_url || avatarUrl || null;
    const templateId = data.template_id || null;

    // Criatura nova SEMPRE começa oculta para jogadores por padrão (is_revealed = 0)
    const isRevealed = data.is_revealed === true ? 1 : 0;
    const revealedFields = data.revealed_fields ? { ...DEFAULT_REVEALED_FIELDS, ...data.revealed_fields } : { ...DEFAULT_REVEALED_FIELDS };
    const equipment = Array.isArray(data.equipment) ? data.equipment : [];
    const publicNotes = data.public_notes?.trim() || '';
    const privateNotes = data.private_notes?.trim() || (data.properties?.gm_notes || '');

    const rawData = data.raw_data || {};
    let computedData = data.computed_data || {};

    if (templateId && this.characterService) {
      try {
        computedData = this.characterService.computeCharacterFields(campaignId, rawData, templateId);
      } catch {
        computedData = { ...rawData, ...computedData };
      }
    } else {
      computedData = { ...rawData, ...computedData };
    }

    const actions = Array.isArray(data.actions) ? data.actions : [];
    const properties = {
      ...(data.properties || {}),
      display_name_players: displayNamePlayers
    };

    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO bestiary_creatures (
        id, campaign_id, template_id, name, display_name_players, description, category, race, size,
        avatar_url, token_url, is_revealed, revealed_fields_json, equipment_json,
        raw_data_json, computed_data_json, actions_json, properties_json,
        public_notes, private_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      campaignId,
      templateId,
      name,
      displayNamePlayers,
      description,
      category,
      race,
      size,
      avatarUrl,
      tokenUrl,
      isRevealed,
      JSON.stringify(revealedFields),
      JSON.stringify(equipment),
      JSON.stringify(rawData),
      JSON.stringify(computedData),
      JSON.stringify(actions),
      JSON.stringify(properties),
      publicNotes,
      privateNotes,
      now,
      now
    );

    return this.getCreatureById(campaignId, id, true)!;
  }

  updateCreature(campaignId: string, creatureId: string, data: Partial<BestiaryCreature>): BestiaryCreature {
    const existing = this.getCreatureById(campaignId, creatureId, true);
    if (!existing) throw new Error('Criatura não encontrada no bestiário.');

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name.trim() || 'Criatura');
    }
    if (data.display_name_players !== undefined || data.properties?.display_name_players !== undefined) {
      const dnp = data.display_name_players !== undefined ? data.display_name_players?.trim() : data.properties?.display_name_players?.trim();
      updates.push('display_name_players = ?');
      params.push(dnp || null);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description.trim());
    }
    if (data.category !== undefined) {
      updates.push('category = ?');
      params.push(data.category.trim() || 'monstro');
    }
    if (data.race !== undefined) {
      updates.push('race = ?');
      params.push(data.race.trim());
    }
    if (data.size !== undefined) {
      updates.push('size = ?');
      params.push(Math.max(0.25, Math.min(10, data.size)));
    }
    if (data.avatar_url !== undefined) {
      updates.push('avatar_url = ?');
      params.push(data.avatar_url || null);
    }
    if (data.token_url !== undefined) {
      updates.push('token_url = ?');
      params.push(data.token_url || null);
    }
    if (data.template_id !== undefined) {
      updates.push('template_id = ?');
      params.push(data.template_id || null);
    }
    if (data.is_revealed !== undefined) {
      updates.push('is_revealed = ?');
      params.push(data.is_revealed ? 1 : 0);
    }
    if (data.revealed_fields !== undefined) {
      const mergedFields = { ...existing.revealed_fields, ...data.revealed_fields };
      updates.push('revealed_fields_json = ?');
      params.push(JSON.stringify(mergedFields));
    }
    if (data.equipment !== undefined) {
      updates.push('equipment_json = ?');
      params.push(JSON.stringify(Array.isArray(data.equipment) ? data.equipment : []));
    }
    if (data.public_notes !== undefined) {
      updates.push('public_notes = ?');
      params.push(data.public_notes.trim());
    }
    if (data.private_notes !== undefined) {
      updates.push('private_notes = ?');
      params.push(data.private_notes.trim());
    }

    let rawData = existing.raw_data;
    if (data.raw_data !== undefined) {
      rawData = data.raw_data;
      updates.push('raw_data_json = ?');
      params.push(JSON.stringify(rawData));
    }

    let computedData = data.computed_data ?? existing.computed_data;
    const templateId = data.template_id !== undefined ? data.template_id : existing.template_id;
    if (data.raw_data !== undefined && templateId && this.characterService) {
      try {
        computedData = this.characterService.computeCharacterFields(campaignId, rawData, templateId);
      } catch {}
    }
    if (data.computed_data !== undefined || (data.raw_data !== undefined && templateId)) {
      updates.push('computed_data_json = ?');
      params.push(JSON.stringify(computedData));
    }

    if (data.actions !== undefined) {
      updates.push('actions_json = ?');
      params.push(JSON.stringify(Array.isArray(data.actions) ? data.actions : []));
    }
    if (data.properties !== undefined) {
      const props = {
        ...existing.properties,
        ...data.properties,
        ...(data.display_name_players !== undefined ? { display_name_players: data.display_name_players } : {})
      };
      updates.push('properties_json = ?');
      params.push(JSON.stringify(props));
    }

    updates.push("updated_at = datetime('now')");
    params.push(campaignId, creatureId);

    this.db.prepare(`
      UPDATE bestiary_creatures 
      SET ${updates.join(', ')} 
      WHERE campaign_id = ? AND id = ?
    `).run(...params);

    return this.getCreatureById(campaignId, creatureId, true)!;
  }

  revealCreature(campaignId: string, creatureId: string, fields?: Partial<CreatureRevealedFields> | 'all'): BestiaryCreature {
    const existing = this.getCreatureById(campaignId, creatureId, true);
    if (!existing) throw new Error('Criatura não encontrada no bestiário.');

    let newFields = { ...existing.revealed_fields };
    if (fields === 'all') {
      newFields = {
        name: true,
        category: true,
        avatar: true,
        description: true,
        attributes: true,
        exact_hp: true,
        defenses: true,
        damage_types: true,
        equipment: true,
        abilities: true,
        formulas: true,
        notes: true
      };
    } else if (fields && typeof fields === 'object') {
      newFields = { ...newFields, ...fields };
    }

    this.db.prepare(`
      UPDATE bestiary_creatures 
      SET is_revealed = 1, revealed_fields_json = ?, updated_at = datetime('now')
      WHERE campaign_id = ? AND id = ?
    `).run(JSON.stringify(newFields), campaignId, creatureId);

    return this.getCreatureById(campaignId, creatureId, true)!;
  }

  hideCreature(campaignId: string, creatureId: string): BestiaryCreature {
    const existing = this.getCreatureById(campaignId, creatureId, true);
    if (!existing) throw new Error('Criatura não encontrada no bestiário.');

    this.db.prepare(`
      UPDATE bestiary_creatures 
      SET is_revealed = 0, updated_at = datetime('now')
      WHERE campaign_id = ? AND id = ?
    `).run(campaignId, creatureId);

    return this.getCreatureById(campaignId, creatureId, true)!;
  }

  updateRevealedFields(campaignId: string, creatureId: string, fields: Partial<CreatureRevealedFields>): BestiaryCreature {
    const existing = this.getCreatureById(campaignId, creatureId, true);
    if (!existing) throw new Error('Criatura não encontrada no bestiário.');

    const newFields = { ...existing.revealed_fields, ...fields };

    this.db.prepare(`
      UPDATE bestiary_creatures 
      SET revealed_fields_json = ?, updated_at = datetime('now')
      WHERE campaign_id = ? AND id = ?
    `).run(JSON.stringify(newFields), campaignId, creatureId);

    return this.getCreatureById(campaignId, creatureId, true)!;
  }

  duplicateCreature(campaignId: string, creatureId: string, options?: { name?: string; description?: string }): BestiaryCreature {
    const original = this.getCreatureById(campaignId, creatureId, true);
    if (!original) throw new Error('Criatura original não encontrada.');

    const newName = options?.name?.trim() || `${original.name} (Variante)`;
    const newDesc = options?.description !== undefined ? options.description.trim() : original.description;

    return this.createCreature(campaignId, {
      name: newName,
      display_name_players: original.display_name_players,
      description: newDesc,
      category: original.category,
      race: original.race,
      size: original.size,
      avatar_url: original.avatar_url,
      token_url: original.token_url,
      template_id: original.template_id,
      is_revealed: false, // Variantes duplicadas começam ocultas por padrão
      revealed_fields: { ...original.revealed_fields },
      equipment: JSON.parse(JSON.stringify(original.equipment || [])),
      raw_data: JSON.parse(JSON.stringify(original.raw_data)),
      computed_data: JSON.parse(JSON.stringify(original.computed_data)),
      actions: JSON.parse(JSON.stringify(original.actions)),
      properties: JSON.parse(JSON.stringify(original.properties)),
      public_notes: original.public_notes,
      private_notes: original.private_notes
    });
  }

  deleteCreature(campaignId: string, creatureId: string): void {
    const existing = this.getCreatureById(campaignId, creatureId, true);
    if (!existing) throw new Error('Criatura não encontrada no bestiário.');

    // Exclusão do modelo não apaga combatentes já instanciados em combates ou tokens em mapas
    this.db.prepare(`DELETE FROM bestiary_creatures WHERE campaign_id = ? AND id = ?`).run(campaignId, creatureId);
  }

  sanitizeCreatureForPlayer(creature: BestiaryCreature): BestiaryCreature {
    const revealed = creature.revealed_fields || {};

    const name = revealed.name ? creature.name : (creature.display_name_players || 'Criatura Desconhecida');
    const category = revealed.category ? creature.category : 'Desconhecido';
    const race = revealed.category ? (creature.race || '') : '';
    const avatarUrl = revealed.avatar ? creature.avatar_url : null;
    const tokenUrl = revealed.avatar ? creature.token_url : null;
    const description = revealed.description ? creature.description : '';

    let sanitizedRaw: Record<string, any> = {};
    let sanitizedComputed: Record<string, any> = {};

    if (revealed.attributes) {
      sanitizedRaw = sanitizeNpcDataForPlayer(creature.raw_data || {}, revealed);
      sanitizedComputed = sanitizeNpcDataForPlayer(creature.computed_data || {}, revealed);
    } else {
      sanitizedRaw = {};
      sanitizedComputed = {};
    }

    if (revealed.exact_hp) {
      const cd = creature.computed_data || {};
      const rd = creature.raw_data || {};
      const hp = cd.hp ?? cd.vida ?? cd.pv ?? rd.vida ?? rd.pv ?? rd.hp;
      const maxHp = cd.max_hp ?? cd.vida_maxima ?? cd.pv_maximo ?? rd.vida_maxima ?? rd.pv_maximo;
      if (hp !== undefined) sanitizedComputed.vida = hp;
      if (maxHp !== undefined) sanitizedComputed.vida_maxima = maxHp;
    } else {
      sanitizedComputed.hp_status = 'healthy';
      sanitizedComputed.hp_percent = 100;
      const hpKeys = ['hp', 'vida', 'pv', 'current_hp', 'max_hp', 'pv_maximo', 'vida_maxima', 'vida_max', 'pv_max', 'vida_atual', 'pv_atual', 'hp_max', 'cur_hp'];
      for (const k of hpKeys) {
        delete sanitizedRaw[k];
        delete sanitizedComputed[k];
      }
    }

    if (revealed.defenses) {
      const cd = creature.computed_data || {};
      const rd = creature.raw_data || {};
      const def = cd.defense ?? cd.defesa ?? rd.defesa ?? rd.defense;
      const dr = cd.damage_reduction ?? cd.rd ?? rd.rd ?? rd.damage_reduction;
      if (def !== undefined) sanitizedComputed.defesa = def;
      if (dr !== undefined) sanitizedComputed.rd = dr;
      if (creature.properties?.resistances) sanitizedComputed.resistances = creature.properties.resistances;
      if (creature.properties?.vulnerabilities) sanitizedComputed.vulnerabilities = creature.properties.vulnerabilities;
      if (creature.properties?.immunities) sanitizedComputed.immunities = creature.properties.immunities;
    } else {
      const defKeys = ['defense', 'defesa', 'ca', 'armor_class', 'damage_reduction', 'rd', 'armadura'];
      for (const k of defKeys) {
        delete sanitizedRaw[k];
        delete sanitizedComputed[k];
      }
      delete sanitizedComputed.resistances;
      delete sanitizedComputed.vulnerabilities;
      delete sanitizedComputed.immunities;
    }

    if (revealed.formulas) {
      const cd = creature.computed_data || {};
      const rd = creature.raw_data || {};
      const init = cd.iniciativa_formula || cd.initiative_formula || rd.iniciativa_formula || rd.initiative_formula || creature.properties?.iniciativa_formula;
      if (init) sanitizedComputed.iniciativa_formula = init;
    } else {
      const formKeys = ['iniciativa_formula', 'initiative_formula', 'iniciativa', 'initiative'];
      for (const k of formKeys) {
        delete sanitizedRaw[k];
        delete sanitizedComputed[k];
      }
    }

    let sanitizedActions: any[] = [];
    if (revealed.abilities) {
      sanitizedActions = (creature.actions || []).map((act: any) => {
        const item: any = {
          name: act.name,
          description: act.description || '',
          type: act.type || 'attack'
        };
        if (revealed.damage_types && act.damage_type) {
          item.damage_type = act.damage_type;
        }
        if (revealed.formulas) {
          if (act.attack_formula) item.attack_formula = act.attack_formula;
          if (act.attack_bonus) item.attack_bonus = act.attack_bonus;
          if (act.formula) item.formula = act.formula;
          if (act.damage_formula) item.damage_formula = act.damage_formula;
          if (act.damage_components) item.damage_components = act.damage_components;
        }
        return item;
      });
    }

    const sanitizedEquipment = revealed.equipment ? (creature.equipment || []) : [];
    const publicNotes = revealed.notes ? (creature.public_notes || '') : '';

    return {
      id: creature.id,
      campaign_id: creature.campaign_id,
      template_id: creature.template_id,
      name,
      display_name_players: creature.display_name_players,
      description,
      category,
      race,
      size: creature.size,
      avatar_url: avatarUrl,
      token_url: tokenUrl,
      is_revealed: true,
      revealed_fields: revealed,
      equipment: sanitizedEquipment,
      raw_data: sanitizedRaw,
      computed_data: sanitizedComputed,
      actions: sanitizedActions,
      properties: {
        is_revealed: true,
        display_name_players: creature.display_name_players
      },
      public_notes: publicNotes,
      private_notes: '',
      created_at: creature.created_at,
      updated_at: creature.updated_at
    };
  }

  private mapCreature(row: any): BestiaryCreature {
    let rawData: Record<string, any> = {};
    let computedData: Record<string, any> = {};
    let actions: any[] = [];
    let properties: Record<string, any> = {};
    let revealedFields: CreatureRevealedFields = { ...DEFAULT_REVEALED_FIELDS };
    let equipment: CreatureEquipmentItem[] = [];

    try { rawData = JSON.parse(row.raw_data_json || '{}'); } catch {}
    try { computedData = JSON.parse(row.computed_data_json || '{}'); } catch {}
    try { actions = JSON.parse(row.actions_json || '[]'); } catch {}
    try { properties = JSON.parse(row.properties_json || '{}'); } catch {}
    try {
      if (row.revealed_fields_json) {
        revealedFields = { ...revealedFields, ...JSON.parse(row.revealed_fields_json) };
      }
    } catch {}
    try {
      if (row.equipment_json) {
        equipment = JSON.parse(row.equipment_json);
      }
    } catch {}

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      template_id: row.template_id || null,
      name: row.name,
      display_name_players: row.display_name_players || properties.display_name_players || null,
      description: row.description || '',
      category: row.category || 'monstro',
      race: row.race || '',
      size: Number(row.size) || 1,
      avatar_url: row.avatar_url || null,
      token_url: row.token_url || null,
      is_revealed: row.is_revealed === 1,
      revealed_fields: revealedFields,
      equipment,
      raw_data: rawData,
      computed_data: computedData,
      actions,
      properties,
      public_notes: row.public_notes || '',
      private_notes: row.private_notes || properties.gm_notes || '',
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
