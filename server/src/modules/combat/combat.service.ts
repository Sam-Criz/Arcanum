import { sanitizeNpcDataForPlayer } from '../bestiary/bestiary.service';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { RulesService } from '../rules-engine/rules.service';
import { CharacterService } from '../characters/character.service';
import { InventoryService } from '../inventory/inventory.service';
import { stripDiacritics } from '../rules-engine/evaluator';
import { ActiveCondition, ConditionDefinition, DamageComponent, ActiveImbuedEffect } from '../rules-engine/rules.types';

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
  defense: number;
  damage_reduction: number;
  npc_data: Record<string, any>;
  actions_used: ActionsUsed;
  defensive_state: DefensiveState;
  tie_breaker: number;
  is_incapacitated: boolean;
  created_at: string;
  // Metadata útil para o cliente
  owner_user_id?: string | null;
}

export interface CombatLog {
  id: string;
  encounter_id: string;
  campaign_id: string;
  actor_id: string | null;
  actor_name: string;
  target_id: string | null;
  target_name: string | null;
  action_type: 'damage' | 'heal' | 'resource_mod' | 'roll' | 'turn_change' | 'note' | 'attack' | 'dot' | 'condition_applied' | 'condition_removed' | 'condition_expired' | 'resisted';
  resource_name: string | null;
  amount: number | null;
  details: Record<string, any>;
  created_at: string;
}

export interface ConditionApplicationResult {
  condition_name: string;
  condition_id?: string;
  status: 'applied' | 'immune' | 'chance_failed' | 'missed_attack' | 'damage_zero' | 'invalid_target';
  message: string;
  activeCondition?: ActiveCondition;
  chance_percent?: number;
  activation_roll?: number | null;
  reason?: string;
}

export function normalizeChancePercent(val: any): number {
  if (val === undefined || val === null || val === '') return 100;
  let str = String(val).trim();
  const hasPercentSign = str.endsWith('%');
  if (hasPercentSign) {
    str = str.replace('%', '').trim();
    const n = parseFloat(str);
    return isNaN(n) ? 100 : Math.max(0, Math.min(100, n));
  }
  const n = parseFloat(str);
  if (isNaN(n)) return 100;
  if (n >= 100) return 100;
  if (n <= 0) return 0;
  if (n > 0 && n <= 1) {
    return Math.round(n * 100);
  }
  return Math.min(100, Math.max(0, n));
}

export function evaluateChanceRoll(chancePercent: number): { activated: boolean; roll: number | null } {
  if (chancePercent >= 100) {
    return { activated: true, roll: 100 };
  }
  if (chancePercent <= 0) {
    return { activated: false, roll: 0 };
  }
  const roll = Math.floor(Math.random() * 100) + 1;
  return { activated: roll <= chancePercent, roll };
}

export function getCombatantFaction(c: Combatant): 'ally' | 'enemy' {
  if (!c.is_npc) return 'ally';
  const disp = (c.npc_data?.disposition || c.npc_data?.faction || (c.npc_data?.is_ally ? 'friendly' : 'hostile')).toLowerCase();
  if (disp === 'friendly' || disp === 'ally') return 'ally';
  return 'enemy';
}

export function areCombatantsAllies(c1: Combatant, c2: Combatant): boolean {
  return getCombatantFaction(c1) === getCombatantFaction(c2);
}

export function areCombatantsEnemies(c1: Combatant, c2: Combatant): boolean {
  return getCombatantFaction(c1) !== getCombatantFaction(c2);
}

export function getCombatantPublicName(combatant: Combatant): string {
  if (!combatant.is_npc) {
    return combatant.name || 'Personagem';
  }

  const npcData = combatant.npc_data || {};
  const revealed = npcData.revealed_fields || {};

  // Se o nome verdadeiro foi explicitamente revelado pelo mestre aos jogadores
  if (revealed.name === true) {
    return combatant.name || 'Inimigo';
  }

  // Se houver nome alternativo/mascarado configurado para jogadores
  if (npcData.display_name_players && String(npcData.display_name_players).trim()) {
    return String(npcData.display_name_players).trim();
  }

  // Se o nome não foi revelado e não há display_name_players configurado
  if (revealed.name === false) {
    return 'Criatura Desconhecida';
  }

  return combatant.name || 'Inimigo';
}

export function formatTurnErrorMessage(
  actorCombatant: Combatant,
  activeCombatant: Combatant | null | undefined,
  isMaster: boolean
): string {
  // 1. Mestre tem visibilidade irrestrita de todos os nomes reais e combatentes
  if (isMaster) {
    const actorName = actorCombatant.name || 'Combatente';
    const activeName = activeCombatant?.name || 'outro participante';
    return `Não é o turno de ${actorName}. O turno atual pertence a ${activeName}.`;
  }

  // 2. Se a entidade ativa for nula ou estiver OCULTA para os jogadores (is_hidden: 1 / true):
  // NUNCA revelar nome verdadeiro, apelido secreto, espécie ou qualquer detalhe.
  // Utilizar mensagem genérica padronizada:
  if (!activeCombatant || activeCombatant.is_hidden) {
    return 'Não é seu turno de agir.';
  }

  // 3. Se a entidade ativa estiver visível para os jogadores, usa o nome público permitido:
  const actorName = getCombatantPublicName(actorCombatant);
  const activeName = getCombatantPublicName(activeCombatant);

  return `Não é o turno de ${actorName}. O turno atual pertence a ${activeName}.`;
}

export class CombatService {
  private actionCache = new Map<string, { result: any; timestamp: number }>();

  constructor(
    private db: DatabaseSync,
    private rulesService: RulesService,
    private characterService: CharacterService,
    private inventoryService?: InventoryService
  ) {}

  // ==========================================
  // ENCONTROS (COMBAT ENCOUNTERS)
  // ==========================================

  getEncounters(campaignId: string, isMaster: boolean): CombatEncounter[] {
    let sql = `SELECT * FROM combat_encounters WHERE campaign_id = ? ORDER BY created_at DESC`;
    const rows = this.db.prepare(sql).all(campaignId) as any[];
    return rows.map(r => {
      const enc = this.mapEncounter(r, isMaster);
      enc.combatants = this.getCombatants(campaignId, enc.id, isMaster);
      if (!isMaster) {
        this.adjustTurnIndexForPlayer(campaignId, enc, r.turn_index ?? 0);
      }
      return enc;
    });
  }

  getActiveEncounter(campaignId: string, isMaster: boolean): CombatEncounter | null {
    const statuses = isMaster ? "('prep', 'active', 'paused')" : "('active', 'paused')";
    const row = this.db.prepare(`
      SELECT * FROM combat_encounters 
      WHERE campaign_id = ? AND status IN ${statuses}
      ORDER BY 
        CASE status 
          WHEN 'active' THEN 1 
          WHEN 'paused' THEN 2 
          WHEN 'prep' THEN 3 
          ELSE 4 
        END ASC, 
        created_at DESC 
      LIMIT 1
    `).get(campaignId) as any;

    if (!row) return null;
    const encounter = this.mapEncounter(row, isMaster);
    encounter.combatants = this.getCombatants(campaignId, encounter.id, isMaster);
    if (!isMaster) {
      this.adjustTurnIndexForPlayer(campaignId, encounter, row.turn_index ?? 0);
    }
    return encounter;
  }

  getEncounterById(campaignId: string, encounterId: string, isMaster: boolean): CombatEncounter | null {
    const row = this.db.prepare(`
      SELECT * FROM combat_encounters 
      WHERE campaign_id = ? AND id = ?
    `).get(campaignId, encounterId) as any;

    if (!row) return null;
    if (!isMaster && row.status === 'prep') return null;
    const encounter = this.mapEncounter(row, isMaster);
    encounter.combatants = this.getCombatants(campaignId, encounter.id, isMaster);
    if (!isMaster) {
      this.adjustTurnIndexForPlayer(campaignId, encounter, row.turn_index ?? 0);
    }
    return encounter;
  }

  private adjustTurnIndexForPlayer(campaignId: string, encounter: CombatEncounter, dbTurnIndex: number): void {
    const masterCombatants = this.getCombatants(campaignId, encounter.id, true);
    if (!masterCombatants.length) {
      encounter.turn_index = 0;
      return;
    }
    const safeIdx = Math.max(0, Math.min(masterCombatants.length - 1, dbTurnIndex));
    const activeMasterCombatant = masterCombatants[safeIdx];
    if (activeMasterCombatant?.is_hidden) {
      encounter.turn_index = -1;
    } else if (activeMasterCombatant && encounter.combatants) {
      const playerIdx = encounter.combatants.findIndex(c => c.id === activeMasterCombatant.id);
      encounter.turn_index = playerIdx !== -1 ? playerIdx : 0;
    }
  }

  createPreparedEncounter(campaignId: string, data: {
    name?: string;
    scene_id?: string | null;
    notes?: string;
    planned_creatures?: any[];
  }): CombatEncounter {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const name = data.name?.trim() || 'Novo Encontro';
    const sceneId = data.scene_id || null;
    const notes = data.notes || '';
    const planned = Array.isArray(data.planned_creatures) ? data.planned_creatures : [];

    this.db.prepare(`
      INSERT INTO combat_encounters (
        id, campaign_id, scene_id, name, status, round, turn_index,
        turn_timer_seconds, turn_started_at, notes, planned_creatures_json, data_json, created_at
      ) VALUES (?, ?, ?, ?, 'prep', 1, 0, 60, null, ?, ?, '{}', ?)
    `).run(
      id,
      campaignId,
      sceneId,
      name,
      notes,
      JSON.stringify(planned),
      now
    );

    return this.getEncounterById(campaignId, id, true)!;
  }

  duplicateEncounter(campaignId: string, encounterId: string): CombatEncounter {
    const existing = this.getEncounterById(campaignId, encounterId, true);
    if (!existing) throw new Error('Encontro original não encontrado.');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const name = `${existing.name} (Cópia)`;

    this.db.prepare(`
      INSERT INTO combat_encounters (
        id, campaign_id, scene_id, name, status, round, turn_index,
        turn_timer_seconds, turn_started_at, notes, planned_creatures_json, data_json, created_at
      ) VALUES (?, ?, ?, ?, 'prep', 1, 0, 60, null, ?, ?, ?, ?)
    `).run(
      id,
      campaignId,
      existing.scene_id,
      name,
      existing.notes || '',
      JSON.stringify(existing.planned_creatures || []),
      JSON.stringify(existing.data || {}),
      now
    );

    return this.getEncounterById(campaignId, id, true)!;
  }

  deleteEncounter(campaignId: string, encounterId: string): void {
    const existing = this.getEncounterById(campaignId, encounterId, true);
    if (!existing) throw new Error('Encontro não encontrado.');
    this.db.prepare(`DELETE FROM combat_encounters WHERE campaign_id = ? AND id = ?`).run(campaignId, encounterId);
  }

  spawnCreaturesToEncounter(campaignId: string, encounterId: string, creatureId: string, count: number, options?: {
    scene_id?: string | null;
    x?: number;
    y?: number;
    name_prefix?: string;
    is_hidden?: boolean;
  }): Combatant[] {
    const encounter = this.getEncounterById(campaignId, encounterId, true);
    if (!encounter) throw new Error('Encontro não encontrado.');

    const creatureRow = this.db.prepare(`SELECT * FROM bestiary_creatures WHERE campaign_id = ? AND id = ?`).get(campaignId, creatureId) as any;
    if (!creatureRow) throw new Error('Criatura não encontrada no bestiário.');

    let rawData: Record<string, any> = {};
    let computedData: Record<string, any> = {};
    let actions: any[] = [];
    let properties: Record<string, any> = {};

    try { rawData = JSON.parse(creatureRow.raw_data_json || '{}'); } catch {}
    try { computedData = JSON.parse(creatureRow.computed_data_json || '{}'); } catch {}
    try { actions = JSON.parse(creatureRow.actions_json || '[]'); } catch {}
    try { properties = JSON.parse(creatureRow.properties_json || '{}'); } catch {}

    const mergedStats = { ...rawData, ...computedData, ...properties };
    const baseName = options?.name_prefix?.trim() || creatureRow.name;
    const isHidden = options?.is_hidden === true;
    const size = Number(creatureRow.size) || 1;
    const targetSceneId = options?.scene_id || encounter.scene_id || null;

    let revealedFields: Record<string, any> = {};
    try { revealedFields = JSON.parse(creatureRow.revealed_fields_json || '{}'); } catch {}
    let equipment: any[] = [];
    try { equipment = JSON.parse(creatureRow.equipment_json || '[]'); } catch {}

    const maxHp = mergedStats.vida_maxima ?? mergedStats.pv_maximo ?? mergedStats.vida ?? mergedStats.pv ?? mergedStats.hp ?? mergedStats.max_hp ?? 20;
    const currentHp = maxHp;
    const defense = mergedStats.defesa ?? mergedStats.ca ?? mergedStats.armor_class ?? 10;
    const damageReduction = mergedStats.rd ?? mergedStats.armadura ?? mergedStats.damage_reduction ?? 0;
    const initFormula = mergedStats.iniciativa_formula || mergedStats.initiative_formula || '1d20';

    const npcData = {
      ...mergedStats,
      category: creatureRow.category,
      race: creatureRow.race || '',
      display_name_players: creatureRow.display_name_players || properties.display_name_players || null,
      revealed_fields: revealedFields,
      equipment,
      actions,
      defense,
      damage_reduction: damageReduction,
      public_notes: creatureRow.public_notes || '',
      gm_notes: creatureRow.private_notes || properties.gm_notes || ''
    };

    const newCombatants: Combatant[] = [];
    const qty = Math.max(1, count || 1);

    for (let i = 1; i <= qty; i++) {
      const instanceName = qty > 1 ? `${baseName} ${i}` : baseName;
      const combatantId = crypto.randomUUID();
      const now = new Date().toISOString();

      let tokenId: string | null = null;
      if (targetSceneId) {
        tokenId = crypto.randomUUID();
        const tokenX = (options?.x ?? 100) + (qty > 1 ? (i - 1) * 60 : 0);
        const tokenY = options?.y ?? 100;

        this.db.prepare(`
          INSERT INTO tokens (
            id, campaign_id, scene_id, name, avatar_url, x, y, size,
            is_visible, current_hp, max_hp, source_creature_id, npc_data_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          tokenId,
          campaignId,
          targetSceneId,
          instanceName,
          creatureRow.avatar_url || creatureRow.token_url || null,
          tokenX,
          tokenY,
          size,
          isHidden ? 0 : 1,
          currentHp,
          maxHp,
          creatureId,
          JSON.stringify(npcData),
          now,
          now
        );
      }

      const tieBreaker = this.calculateTieBreaker(campaignId, { npc_data: npcData });

      this.db.prepare(`
        INSERT INTO combatants (
          id, encounter_id, campaign_id, token_id, source_creature_id, name,
          avatar_url, initiative, initiative_formula, is_npc, is_hidden,
          sort_order, current_hp, max_hp, conditions_json, defense,
          damage_reduction, npc_data_json, actions_used_json, defensive_state_json,
          tie_breaker, is_incapacitated, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?, 0, ?, ?, '[]', ?, ?, ?, '{}', '{}', ?, 0, ?)
      `).run(
        combatantId,
        encounterId,
        campaignId,
        tokenId,
        creatureId,
        instanceName,
        creatureRow.avatar_url || creatureRow.token_url || null,
        initFormula,
        isHidden ? 1 : 0,
        currentHp,
        maxHp,
        defense,
        damageReduction,
        JSON.stringify(npcData),
        tieBreaker,
        now
      );

      if (encounter.status === 'active') {
        this.rollCombatantInitiative(campaignId, combatantId);
      }

      const createdCombatant = this.getCombatantById(campaignId, combatantId, true)!;
      newCombatants.push(createdCombatant);
    }

    return newCombatants;
  }

  startEncounter(campaignId: string, data: { name?: string; scene_id?: string | null; notes?: string }): CombatEncounter {
    // Encerrar quaisquer encontros ativos anteriores para manter unicidade de combate ativo
    this.db.prepare(`
      UPDATE combat_encounters 
      SET status = 'ended' 
      WHERE campaign_id = ? AND status IN ('prep', 'active', 'paused')
    `).run(campaignId);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const name = data.name?.trim() || 'Combate';
    const notes = data.notes || '';

    this.db.prepare(`
      INSERT INTO combat_encounters (
        id, campaign_id, scene_id, name, status, round, turn_index, 
        turn_timer_seconds, turn_started_at, notes, planned_creatures_json, data_json, created_at
      ) VALUES (?, ?, ?, ?, 'prep', 1, 0, 60, ?, ?, '[]', '{}', ?)
    `).run(
      id,
      campaignId,
      data.scene_id || null,
      name,
      now,
      notes,
      now
    );

    this.logCombatAction(campaignId, id, {
      actor_name: 'Mestre',
      action_type: 'turn_change',
      details: { message: `Encontro "${name}" iniciado na fase de preparação.` }
    });

    return this.getEncounterById(campaignId, id, true)!;
  }

  activateCombatEncounter(campaignId: string, encounterId: string): CombatEncounter {
    const encounter = this.getEncounterById(campaignId, encounterId, true);
    if (!encounter) throw new Error('Encontro não encontrado.');

    // Se já estiver ativo, não duplica combatentes nem reinicia estado
    if (encounter.status === 'active') {
      return encounter;
    }

    let combatants = encounter.combatants || [];

    // Se não há combatentes na iniciativa mas há criaturas planejadas, instancia-as agora
    if (combatants.length === 0 && encounter.planned_creatures && encounter.planned_creatures.length > 0) {
      for (const plan of encounter.planned_creatures) {
        if (plan.creature_id) {
          this.spawnCreaturesToEncounter(
            campaignId,
            encounterId,
            plan.creature_id,
            plan.count || 1,
            {
              scene_id: plan.scene_id || encounter.scene_id,
              x: plan.x,
              y: plan.y,
              name_prefix: plan.name,
              is_hidden: plan.is_hidden
            }
          );
        }
      }
      combatants = this.getCombatants(campaignId, encounterId, true);
    }

    if (combatants.length === 0) {
      throw new Error('Não é possível iniciar o combate sem combatentes participantes.');
    }

    // 1. Garantir iniciativa válida e desempate para todos os combatentes
    for (const c of combatants) {
      if (!c.initiative || c.initiative <= 0) {
        this.rollCombatantInitiative(campaignId, c.id);
      } else {
        const tieBreaker = this.calculateTieBreaker(campaignId, c);
        this.db.prepare(`UPDATE combatants SET tie_breaker = ? WHERE campaign_id = ? AND id = ?`)
          .run(tieBreaker, campaignId, c.id);
      }
    }

    // 2. Resetar ações e limpar estados defensivos para a nova batalha
    this.db.prepare(`
      UPDATE combatants 
      SET actions_used_json = '{"main":0,"bonus":0,"reaction":0,"free":0}',
          defensive_state_json = '{}'
      WHERE campaign_id = ? AND encounter_id = ?
    `).run(campaignId, encounterId);

    // 3. Ativar o encontro na rodada 1, turno 0
    this.db.prepare(`
      UPDATE combat_encounters 
      SET status = 'active', round = 1, turn_index = 0, turn_started_at = datetime('now')
      WHERE campaign_id = ? AND id = ?
    `).run(campaignId, encounterId);

    const ordered = this.getCombatants(campaignId, encounterId, true);
    const activeCombatant = ordered[0];

    this.logCombatAction(campaignId, encounterId, {
      actor_name: 'Mestre',
      action_type: 'turn_change',
      details: {
        message: `Combate iniciado! Turno de ${activeCombatant?.name || 'primeiro combatente'}.`,
        round: 1,
        turn_index: 0,
        active_combatant_id: activeCombatant?.id
      }
    });

    return this.getEncounterById(campaignId, encounterId, true)!;
  }

  updateEncounter(campaignId: string, encounterId: string, data: {
    status?: 'prep' | 'active' | 'paused' | 'ended';
    round?: number;
    turn_index?: number;
    name?: string;
    scene_id?: string | null;
    notes?: string;
    planned_creatures?: any[];
  }): CombatEncounter {
    const existing = this.getEncounterById(campaignId, encounterId, true);
    if (!existing) throw new Error('Encontro de combate não encontrado.');

    if (data.status === 'active' && existing.status !== 'active') {
      return this.activateCombatEncounter(campaignId, encounterId);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.round !== undefined) {
      updates.push('round = ?');
      params.push(Math.max(1, data.round));
    }
    if (data.turn_index !== undefined) {
      updates.push('turn_index = ?');
      params.push(Math.max(0, data.turn_index));
    }
    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name.trim() || 'Combate');
    }
    if (data.scene_id !== undefined) {
      updates.push('scene_id = ?');
      params.push(data.scene_id || null);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      params.push(data.notes);
    }
    if (data.planned_creatures !== undefined) {
      updates.push('planned_creatures_json = ?');
      params.push(JSON.stringify(Array.isArray(data.planned_creatures) ? data.planned_creatures : []));
    }

    if (updates.length > 0) {
      params.push(campaignId, encounterId);
      this.db.prepare(`
        UPDATE combat_encounters 
        SET ${updates.join(', ')} 
        WHERE campaign_id = ? AND id = ?
      `).run(...params);
    }

    return this.getEncounterById(campaignId, encounterId, true)!;
  }

  nextTurn(campaignId: string, encounterId: string): CombatEncounter {
    const encounter = this.getEncounterById(campaignId, encounterId, true);
    if (!encounter) throw new Error('Encontro não encontrado.');
    const combatants = encounter.combatants || [];
    if (combatants.length === 0) {
      throw new Error('Nenhum combatente presente no encontro.');
    }

    const combatConfig = this.rulesService.getCombatRulesConfig(campaignId);
    const skipIncapacitated = combatConfig.skip_incapacitated !== false;

    let currentTurn = encounter.turn_index;
    let newTurn = (currentTurn + 1) % combatants.length;
    let newRound = encounter.round;

    // Se avançar passa do final da lista, nova rodada
    if (currentTurn + 1 >= combatants.length) {
      newRound += 1;
    }

    // Pular combatentes incapacitados se configurado
    if (skipIncapacitated) {
      let found = false;
      for (let step = 1; step <= combatants.length; step++) {
        const candidateIndex = (currentTurn + step) % combatants.length;
        const candidate = combatants[candidateIndex];
        const isIncapacitated = candidate.is_incapacitated || (candidate.current_hp !== null && candidate.current_hp <= 0);

        if (!isIncapacitated) {
          newTurn = candidateIndex;
          if (currentTurn + step >= combatants.length) {
            newRound = encounter.round + 1;
          }
          found = true;
          break;
        }
      }
      // Se todos estiverem incapacitados, mantém o primeiro
      if (!found) {
        newTurn = (currentTurn + 1) % combatants.length;
        if (currentTurn + 1 >= combatants.length) newRound = encounter.round + 1;
      }
    }

    const activeCombatant = combatants[newTurn];

    // Processa condições que disparam no final do turno do combatente anterior
    const previousCombatant = combatants[currentTurn];
    if (previousCombatant) {
      this.tickConditionsForCombatant(campaignId, encounterId, previousCombatant.id, 'turn_end');
      this.tickImbuedEffectsForCombatant(campaignId, encounterId, previousCombatant.id, 'turn');
    }

    // Se avançou a rodada, processa condições com tick_timing === 'round_end' ou duration_type === 'rounds'
    if (newRound > encounter.round) {
      for (const c of combatants) {
        this.tickConditionsForCombatant(campaignId, encounterId, c.id, 'round_end');
        this.tickImbuedEffectsForCombatant(campaignId, encounterId, c.id, 'round');
      }
    }

    // Processa condições que disparam no início do turno do novo combatente ativo (DoT, turn_start)
    this.tickConditionsForCombatant(campaignId, encounterId, activeCombatant.id, 'turn_start');

    // Reiniciar ações do novo combatente ativo
    this.db.prepare(`
      UPDATE combatants 
      SET actions_used_json = '{"main":0,"bonus":0,"reaction":0,"free":0}'
      WHERE campaign_id = ? AND id = ?
    `).run(campaignId, activeCombatant.id);

    // Expirar estados defensivos (defender/esquivar que expiram no início do turno deste combatente ou por rodada)
    for (const c of combatants) {
      let defState = { ...c.defensive_state };
      let changed = false;

      if (defState.defense && defState.defense.expires_on_turn_start_id === activeCombatant.id) {
        delete defState.defense;
        changed = true;
      }
      if (defState.dodge && defState.dodge.expires_on_turn_start_id === activeCombatant.id) {
        delete defState.dodge;
        changed = true;
      }
      if (defState.defense && defState.defense.expires_at_round && defState.defense.expires_at_round < newRound) {
        delete defState.defense;
        changed = true;
      }
      if (defState.dodge && defState.dodge.expires_at_round && defState.dodge.expires_at_round < newRound) {
        delete defState.dodge;
        changed = true;
      }

      if (changed) {
        this.db.prepare(`
          UPDATE combatants SET defensive_state_json = ? WHERE campaign_id = ? AND id = ?
        `).run(JSON.stringify(defState), campaignId, c.id);
      }
    }

    this.db.prepare(`
      UPDATE combat_encounters 
      SET status = 'active', turn_index = ?, round = ?, turn_started_at = datetime('now')
      WHERE campaign_id = ? AND id = ?
    `).run(newTurn, newRound, campaignId, encounterId);

    this.logCombatAction(campaignId, encounterId, {
      actor_name: activeCombatant?.name || 'Sistema',
      action_type: 'turn_change',
      details: {
        round: newRound,
        turn_index: newTurn,
        active_combatant_id: activeCombatant?.id,
        active_combatant_name: activeCombatant?.name,
        message: `Início do turno de ${activeCombatant?.name} (Rodada ${newRound}).`
      }
    });

    return this.getEncounterById(campaignId, encounterId, true)!;
  }

  endTurn(campaignId: string, encounterId: string, userId: string, isMaster: boolean): CombatEncounter {
    const encounter = this.getEncounterById(campaignId, encounterId, true);
    if (!encounter) throw new Error('Encontro não encontrado.');
    if (encounter.status !== 'active') throw new Error('O combate não está ativo.');

    const combatants = encounter.combatants || [];
    const activeCombatant = combatants[encounter.turn_index];
    if (!activeCombatant) throw new Error('Nenhum combatente ativo no momento.');

    if (!isMaster) {
      if (activeCombatant.owner_user_id !== userId) {
        throw new Error('Você só pode encerrar o turno do seu próprio personagem.');
      }
    }

    return this.nextTurn(campaignId, encounterId);
  }

  prevTurn(campaignId: string, encounterId: string): CombatEncounter {
    const encounter = this.getEncounterById(campaignId, encounterId, true);
    if (!encounter) throw new Error('Encontro não encontrado.');
    const combatants = encounter.combatants || [];
    if (combatants.length === 0) return encounter;

    let newTurn = encounter.turn_index - 1;
    let newRound = encounter.round;

    if (newTurn < 0) {
      if (newRound > 1) {
        newRound -= 1;
        newTurn = combatants.length - 1;
      } else {
        newTurn = 0;
      }
    }

    this.db.prepare(`
      UPDATE combat_encounters 
      SET turn_index = ?, round = ?, turn_started_at = datetime('now')
      WHERE campaign_id = ? AND id = ?
    `).run(newTurn, newRound, campaignId, encounterId);

    return this.getEncounterById(campaignId, encounterId, true)!;
  }

  endEncounter(campaignId: string, encounterId: string): CombatEncounter {
    this.db.prepare(`
      UPDATE combat_encounters 
      SET status = 'ended' 
      WHERE campaign_id = ? AND id = ?
    `).run(campaignId, encounterId);

    this.logCombatAction(campaignId, encounterId, {
      actor_name: 'Mestre',
      action_type: 'turn_change',
      details: { message: 'Encontro de combate encerrado.' }
    });

    return this.getEncounterById(campaignId, encounterId, true)!;
  }

  // ==========================================
  // COMBATENTES (COMBATANTS & INITIATIVE)
  // ==========================================

  getCombatants(campaignId: string, encounterId: string, isMaster: boolean): Combatant[] {
    let sql = `
      SELECT cb.*, c.user_id as character_owner_id
      FROM combatants cb
      LEFT JOIN characters c ON c.id = cb.character_id
      WHERE cb.campaign_id = ? AND cb.encounter_id = ?
    `;
    const params: any[] = [campaignId, encounterId];

    if (!isMaster) {
      // Jogadores não visualizam combatentes ocultos pelo mestre
      sql += ` AND cb.is_hidden = 0`;
    }

    sql += ` ORDER BY cb.initiative DESC, cb.tie_breaker DESC, cb.sort_order ASC, cb.created_at ASC`;

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.mapCombatant(r, isMaster));
  }

  addCombatant(campaignId: string, encounterId: string, data: {
    character_id?: string | null;
    token_id?: string | null;
    source_creature_id?: string | null;
    name?: string;
    avatar_url?: string | null;
    initiative?: number;
    initiative_formula?: string;
    is_npc?: boolean;
    is_hidden?: boolean;
    current_hp?: number | null;
    max_hp?: number | null;
    defense?: number;
    damage_reduction?: number;
    npc_data?: Record<string, any>;
  }): Combatant {
    const encounter = this.getEncounterById(campaignId, encounterId, true);
    if (!encounter) throw new Error('Encontro não encontrado.');

    let name = data.name?.trim();
    let avatarUrl: string | null = data.avatar_url || null;
    let isNpc = data.is_npc ?? false;
    let currentHp = data.current_hp ?? null;
    let maxHp = data.max_hp ?? null;
    let initFormula = data.initiative_formula || '1d20';
    let defense = data.defense ?? 10;
    let damageReduction = data.damage_reduction ?? 0;
    let npcData = data.npc_data || {};

    // 1. Se forneceu token_id, herda atributos cadastrados no token (inclusive monstros)
    if (data.token_id) {
      const tokenRow = this.db.prepare(`
        SELECT * FROM tokens WHERE campaign_id = ? AND id = ?
      `).get(campaignId, data.token_id) as any;
      if (tokenRow) {
        if (!name) name = tokenRow.name;
        if (!avatarUrl) avatarUrl = tokenRow.avatar_url;
        if (currentHp === null && tokenRow.current_hp !== null) currentHp = Number(tokenRow.current_hp);
        if (maxHp === null && tokenRow.max_hp !== null) maxHp = Number(tokenRow.max_hp);
        if (!data.character_id && tokenRow.character_id) {
          data.character_id = tokenRow.character_id;
        }
        let tNpcData: Record<string, any> = {};
        try {
          tNpcData = JSON.parse(tokenRow.npc_data_json || '{}');
        } catch {}
        npcData = { ...tNpcData, ...npcData };
        if (tNpcData.defense !== undefined && data.defense === undefined) {
          defense = Number(tNpcData.defense);
        }
        if (tNpcData.damage_reduction !== undefined && data.damage_reduction === undefined) {
          damageReduction = Number(tNpcData.damage_reduction);
        }
        if (tNpcData.initiative_formula && !data.initiative_formula) {
          initFormula = tNpcData.initiative_formula;
        }
        if (data.is_npc === undefined) {
          isNpc = !tokenRow.character_id;
        }
      }
    }

    // 2. Se associado a personagem, herda atributos da ficha
    let initialConditions: ActiveCondition[] = [];
    if (data.character_id) {
      const char = this.characterService.getCharacterById(campaignId, data.character_id);
      if (char) {
        if (!name) name = char.name;
        if (!avatarUrl) avatarUrl = char.avatar_url || null;
        if (data.is_npc === undefined) isNpc = char.is_npc === 1;
        if (char.conditions && char.conditions.length > 0) {
          initialConditions = [...char.conditions];
        }
        const cd = char.computed_data || {};
        if (currentHp === null) {
          currentHp = cd.vida_atual ?? cd.pv_atual ?? cd.vida ?? cd.pv ?? cd.hp ?? null;
        }
        if (maxHp === null) {
          maxHp = cd.vida_maxima ?? cd.pv_maximo ?? cd.vida_max ?? cd.pv_max ?? cd.max_hp ?? null;
        }
        // Se houver atributo ou fórmula de iniciativa na ficha
        if (cd.iniciativa !== undefined && !data.initiative_formula) {
          initFormula = `1d20 + ${cd.iniciativa}`;
        } else if (cd.agilidade !== undefined && !data.initiative_formula) {
          initFormula = `1d20 + ${cd.agilidade}`;
        }
        if (data.defense === undefined) {
          defense = cd.defesa ?? cd.ca ?? cd.armor_class ?? defense;
        }
        if (data.damage_reduction === undefined) {
          damageReduction = cd.rd ?? cd.armadura ?? cd.damage_reduction ?? damageReduction;
        }
      }
    }

    if (!name) name = isNpc ? 'Inimigo' : 'Personagem';

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const tieBreaker = this.calculateTieBreaker(campaignId, { character_id: data.character_id, npc_data: npcData });
    const isIncapacitated = initialConditions.some(c => c.effects?.incapacitated) || (currentHp !== null && currentHp <= 0);

    this.db.prepare(`
      INSERT INTO combatants (
        id, encounter_id, campaign_id, character_id, token_id, source_creature_id, name,
        avatar_url, initiative, initiative_formula, is_npc, is_hidden,
        sort_order, current_hp, max_hp, conditions_json, defense,
        damage_reduction, npc_data_json, actions_used_json, defensive_state_json, tie_breaker, is_incapacitated, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, '{}', '{}', ?, ?, ?)
    `).run(
      id,
      encounterId,
      campaignId,
      data.character_id || null,
      data.token_id || null,
      data.source_creature_id || null,
      name,
      avatarUrl,
      data.initiative ?? 0,
      initFormula,
      isNpc ? 1 : 0,
      data.is_hidden ? 1 : 0,
      currentHp,
      maxHp,
      JSON.stringify(initialConditions),
      defense,
      damageReduction,
      JSON.stringify(npcData),
      tieBreaker,
      isIncapacitated ? 1 : 0,
      now
    );

    // Se o combate já estiver ativo, novos combatentes devem receber iniciativa válida imediatamente
    if (encounter.status === 'active' && (!data.initiative || data.initiative <= 0)) {
      this.rollCombatantInitiative(campaignId, id);
    }

    return this.getCombatantById(campaignId, id, true)!;
  }

  getCombatantById(campaignId: string, combatantId: string, isMaster: boolean = true): Combatant | null {
    const row = this.db.prepare(`
      SELECT cb.*, c.user_id as character_owner_id
      FROM combatants cb
      LEFT JOIN characters c ON c.id = cb.character_id
      WHERE cb.campaign_id = ? AND cb.id = ?
    `).get(campaignId, combatantId) as any;

    if (!row) return null;
    if (!isMaster && row.is_hidden === 1) return null;
    return this.mapCombatant(row, isMaster);
  }

  updateCombatant(campaignId: string, combatantId: string, data: {
    name?: string;
    initiative?: number;
    initiative_formula?: string;
    is_hidden?: boolean;
    current_hp?: number | null;
    max_hp?: number | null;
    conditions?: string[];
    defense?: number;
    damage_reduction?: number;
    npc_data?: Record<string, any>;
  }): Combatant {
    const existing = this.getCombatantById(campaignId, combatantId);
    if (!existing) throw new Error('Combatente não encontrado.');

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name.trim() || 'Combatente');
    }
    if (data.initiative !== undefined) {
      updates.push('initiative = ?');
      params.push(data.initiative);
    }
    if (data.initiative_formula !== undefined) {
      updates.push('initiative_formula = ?');
      params.push(data.initiative_formula);
    }
    if (data.is_hidden !== undefined) {
      updates.push('is_hidden = ?');
      params.push(data.is_hidden ? 1 : 0);
    }
    if (data.current_hp !== undefined) {
      updates.push('current_hp = ?');
      params.push(data.current_hp);
    }
    if (data.max_hp !== undefined) {
      updates.push('max_hp = ?');
      params.push(data.max_hp);
    }
    if (data.conditions !== undefined) {
      updates.push('conditions_json = ?');
      params.push(JSON.stringify(data.conditions));
    }
    if (data.defense !== undefined) {
      updates.push('defense = ?');
      params.push(data.defense);
    }
    if (data.damage_reduction !== undefined) {
      updates.push('damage_reduction = ?');
      params.push(data.damage_reduction);
    }
    if (data.npc_data !== undefined) {
      updates.push('npc_data_json = ?');
      params.push(JSON.stringify(data.npc_data));
    }

    if (updates.length > 0) {
      params.push(campaignId, combatantId);
      this.db.prepare(`
        UPDATE combatants 
        SET ${updates.join(', ')} 
        WHERE campaign_id = ? AND id = ?
      `).run(...params);
    }

    if (data.is_hidden !== undefined && existing.token_id) {
      this.db.prepare(`
        UPDATE tokens 
        SET is_visible = ? 
        WHERE campaign_id = ? AND id = ?
      `).run(data.is_hidden ? 0 : 1, campaignId, existing.token_id);
    }

    return this.getCombatantById(campaignId, combatantId)!;
  }

  removeCombatant(campaignId: string, combatantId: string): void {
    this.db.prepare(`DELETE FROM combatants WHERE campaign_id = ? AND id = ?`).run(campaignId, combatantId);
  }

  calculateTieBreaker(campaignId: string, combatant: { character_id?: string | null; npc_data?: Record<string, any> }): number {
    const config = this.rulesService.getCombatRulesConfig(campaignId);
    const attr = stripDiacritics(config.tie_breaker_attr || 'agilidade').toLowerCase();

    if (combatant.character_id) {
      const char = this.characterService.getCharacterById(campaignId, combatant.character_id);
      if (char) {
        const allData = { ...char.raw_data, ...char.computed_data };
        for (const [k, v] of Object.entries(allData)) {
          if (stripDiacritics(k).toLowerCase() === attr && typeof v === 'number') {
            return v;
          }
        }
      }
    }

    if (combatant.npc_data) {
      const npcData = combatant.npc_data;
      for (const [k, v] of Object.entries(npcData)) {
        if (stripDiacritics(k).toLowerCase() === attr && typeof v === 'number') {
          return v;
        }
      }
      if (npcData.attributes && typeof npcData.attributes === 'object') {
        for (const [k, v] of Object.entries(npcData.attributes)) {
          if (stripDiacritics(k).toLowerCase() === attr && typeof v === 'number') {
            return v;
          }
        }
      }
    }

    return 0;
  }

  rollCombatantInitiative(campaignId: string, combatantId: string): { combatant: Combatant; rollResult: any } {
    const combatant = this.getCombatantById(campaignId, combatantId);
    if (!combatant) throw new Error('Combatente não encontrado.');

    let variables: Record<string, number> = {};
    if (combatant.character_id) {
      const char = this.characterService.getCharacterById(campaignId, combatant.character_id);
      if (char) {
        for (const [k, v] of Object.entries(char.computed_data)) {
          if (typeof v === 'number') variables[k] = v;
        }
      }
    } else if (combatant.npc_data) {
      for (const [k, v] of Object.entries(combatant.npc_data)) {
        if (typeof v === 'number') variables[k] = v;
      }
      if (combatant.npc_data.attributes && typeof combatant.npc_data.attributes === 'object') {
        for (const [k, v] of Object.entries(combatant.npc_data.attributes)) {
          if (typeof v === 'number') variables[k] = v;
        }
      }
    }

    const formula = combatant.initiative_formula || '1d20';
    const rollResult = this.rulesService.evaluateFormula(campaignId, formula, variables);
    const tieBreaker = this.calculateTieBreaker(campaignId, combatant);

    this.db.prepare(`
      UPDATE combatants 
      SET initiative = ?, tie_breaker = ? 
      WHERE campaign_id = ? AND id = ?
    `).run(rollResult.total, tieBreaker, campaignId, combatantId);

    this.logCombatAction(campaignId, combatant.encounter_id, {
      actor_id: combatant.id,
      actor_name: combatant.name,
      action_type: 'roll',
      amount: rollResult.total,
      details: {
        formula,
        breakdown: rollResult.breakdown,
        tie_breaker: tieBreaker,
        message: `${combatant.name} rolou iniciativa: ${formula} = ${rollResult.total} (Desempate: ${tieBreaker})`
      }
    });

    return {
      combatant: this.getCombatantById(campaignId, combatantId)!,
      rollResult
    };
  }

  resetCombatantActions(campaignId: string, combatantId: string, actions?: { main?: number; bonus?: number; reaction?: number; free?: number }): Combatant {
    const defaultActions = actions || { main: 0, bonus: 0, reaction: 0, free: 0 };
    this.db.prepare(`
      UPDATE combatants SET actions_used_json = ? WHERE campaign_id = ? AND id = ?
    `).run(JSON.stringify(defaultActions), campaignId, combatantId);
    return this.getCombatantById(campaignId, combatantId)!;
  }

  rollAllInitiatives(campaignId: string, encounterId: string): Combatant[] {
    const combatants = this.getCombatants(campaignId, encounterId, true);
    for (const c of combatants) {
      this.rollCombatantInitiative(campaignId, c.id);
    }
    return this.getCombatants(campaignId, encounterId, true);
  }

  // ==========================================
  // CONDIÇÕES, STATUS E DANO PERIÓDICO (DoT)
  // ==========================================

  private applyDotDamage(
    campaignId: string, 
    encounterId: string, 
    combatant: Combatant, 
    condition: ActiveCondition, 
    timing: string
  ): number {
    if (!condition.effects?.dot?.formula) return 0;
    const formula = condition.effects.dot.formula;
    const damageType = condition.effects.dot.damage_type || condition.effects.dot.damageType || 'dano';

    // 1. Checa imunidade ao tipo de dano ou à condição
    const immuneCheck = this.checkCombatantImmunity(campaignId, combatant, {
      name: condition.name,
      condition_id: condition.condition_id,
      damage_type: damageType
    });
    if (immuneCheck.isImmune) {
      this.logCombatAction(campaignId, encounterId, {
        actor_name: condition.name,
        target_id: combatant.id,
        target_name: combatant.name,
        action_type: 'dot',
        amount: 0,
        details: {
          message: `${combatant.name} é imune ao efeito/dano de "${condition.name}" (${damageType}) e não sofreu dano.`,
          condition_id: condition.condition_id,
          condition_name: condition.name,
          damage: 0,
          damage_type: damageType,
          resisted: true
        }
      });
      return 0;
    }

    let damage = 0;
    try {
      const res = this.rulesService.evaluateFormula(campaignId, formula);
      damage = Math.max(0, res.total);
    } catch {
      damage = 1;
    }

    if (condition.stack_count && condition.stack_count > 1) {
      damage *= condition.stack_count;
    }

    // 2. Checa resistência do combatente ao tipo de dano
    const targetCharObj = combatant.character_id ? this.characterService.getCharacterById(campaignId, combatant.character_id) : null;
    const resistances = [
      ...(combatant.npc_data?.resistances || []),
      ...(combatant.npc_data?.resistencias || []),
      ...(targetCharObj?.raw_data?.resistencias || targetCharObj?.raw_data?.resistances || []),
      ...(targetCharObj?.computed_data?.resistencias || targetCharObj?.computed_data?.resistances || [])
    ].map((s: any) => String(s).toLowerCase().trim());
    for (const c of (combatant.conditions || [])) {
      if (Array.isArray((c.effects as any)?.resistances)) {
        resistances.push(...(c.effects as any).resistances.map((s: any) => String(s).toLowerCase().trim()));
      }
    }
    let resNote = '';
    if (damageType && resistances.includes(damageType.toLowerCase().trim())) {
      damage = Math.floor(damage / 2);
      resNote = ' [Resistência: -50%]';
    }

    const curHp = combatant.current_hp !== null ? combatant.current_hp : 0;
    const newHp = Math.max(0, curHp - damage);

    this.db.prepare(`
      UPDATE combatants 
      SET current_hp = ?, is_incapacitated = ? 
      WHERE campaign_id = ? AND id = ?
    `).run(newHp, newHp <= 0 ? 1 : (combatant.is_incapacitated ? 1 : 0), campaignId, combatant.id);

    if (combatant.token_id) {
      this.db.prepare(`UPDATE tokens SET current_hp = ? WHERE campaign_id = ? AND id = ?`)
        .run(newHp, campaignId, combatant.token_id);
    }

    if (combatant.character_id) {
      const char = this.characterService.getCharacterById(campaignId, combatant.character_id);
      if (char) {
        const raw = { ...char.raw_data };
        const resKey = raw.vida_atual !== undefined ? 'vida_atual' : raw.pv_atual !== undefined ? 'pv_atual' : raw.vida !== undefined ? 'vida' : 'pv';
        raw[resKey] = newHp;
        this.db.prepare(`UPDATE characters SET raw_data_json = ?, updated_at = datetime('now') WHERE campaign_id = ? AND id = ?`)
          .run(JSON.stringify(raw), campaignId, combatant.character_id);
        this.characterService.recomputeCharacter(campaignId, combatant.character_id);
      }
    }

    this.logCombatAction(campaignId, encounterId, {
      actor_name: condition.name,
      target_id: combatant.id,
      target_name: combatant.name,
      action_type: 'dot',
      amount: damage,
      details: {
        message: `${combatant.name} sofreu ${damage} de dano de ${condition.name} (${timing === 'turn_start' ? 'início de turno' : timing === 'turn_end' ? 'final de turno' : 'final de rodada'})${resNote}.`,
        condition_id: condition.condition_id,
        condition_name: condition.name,
        damage,
        damage_type: damageType,
        resulting_hp: newHp
      }
    });

    return damage;
  }

  tickConditionsForCombatant(
    campaignId: string,
    encounterId: string,
    combatantId: string,
    timing: 'turn_start' | 'turn_end' | 'round_end'
  ): void {
    const combatant = this.getCombatantById(campaignId, combatantId);
    if (!combatant) return;

    let conditions = [...(combatant.conditions || [])];
    let changed = false;
    const remainingConditions: ActiveCondition[] = [];

    for (const cond of conditions) {
      const shouldTickTiming = cond.tick_timing === timing || (timing === 'round_end' && cond.duration_type === 'rounds');
      const hasDot = cond.effects?.dot && (cond.effects.dot.timing === timing || cond.effects.dot.trigger === timing);

      if (hasDot) {
        this.applyDotDamage(campaignId, encounterId, combatant, cond, timing);
        changed = true;
      }

      if (shouldTickTiming) {
        if (cond.duration_type !== 'permanent') {
          const nextDuration = cond.duration_remaining - 1;
          changed = true;
          if (nextDuration > 0) {
            remainingConditions.push({ ...cond, duration_remaining: nextDuration });
          } else {
            this.logCombatAction(campaignId, encounterId, {
              actor_name: combatant.name,
              target_id: combatant.id,
              target_name: combatant.name,
              action_type: 'condition_expired',
              details: {
                message: `A condição "${cond.name}" de ${combatant.name} expirou (${timing}).`,
                condition_id: cond.condition_id,
                condition_name: cond.name
              }
            });
            if (combatant.character_id) {
              try {
                this.characterService.removeCondition(campaignId, combatant.character_id, cond.id);
              } catch {}
            }
          }
        } else {
          remainingConditions.push(cond);
        }
      } else {
        remainingConditions.push(cond);
      }
    }

    if (changed) {
      const freshCombatant = this.getCombatantById(campaignId, combatantId);
      const curHp = freshCombatant?.current_hp ?? combatant.current_hp;
      const isIncapacitated = remainingConditions.some(c => c.effects?.incapacitated) || (curHp !== null && curHp <= 0);

      this.db.prepare(`
        UPDATE combatants 
        SET conditions_json = ?, is_incapacitated = ? 
        WHERE campaign_id = ? AND id = ?
      `).run(JSON.stringify(remainingConditions), isIncapacitated ? 1 : 0, campaignId, combatantId);

      if (combatant.character_id) {
        this.db.prepare(`
          UPDATE characters 
          SET conditions_json = ?, updated_at = datetime('now') 
          WHERE campaign_id = ? AND id = ?
        `).run(JSON.stringify(remainingConditions), campaignId, combatant.character_id);
      }
    }
  }

  tickImbuedEffectsForCombatant(
    campaignId: string,
    encounterId: string,
    combatantId: string,
    timing: 'turn' | 'round'
  ): void {
    const combatant = this.getCombatantById(campaignId, combatantId);
    if (!combatant || !combatant.character_id) return;

    const weaponRows = this.db.prepare(`
      SELECT * FROM character_inventory 
      WHERE character_id = ? AND category = 'arma'
    `).all(combatant.character_id) as any[];

    for (const w of weaponRows) {
      let props: any = {};
      try { props = JSON.parse(w.properties_json || '{}'); } catch {}
      if (!Array.isArray(props.imbued_effects) || props.imbued_effects.length === 0) continue;

      let changed = false;
      const remaining: ActiveImbuedEffect[] = [];

      for (const eff of props.imbued_effects) {
        if ((timing === 'turn' && eff.duration_type === 'turns') || (timing === 'round' && eff.duration_type === 'rounds')) {
          const nextDur = (eff.duration_remaining ?? 1) - 1;
          changed = true;
          if (nextDur > 0) {
            remaining.push({ ...eff, duration_remaining: nextDur });
          } else {
            this.logCombatAction(campaignId, encounterId, {
              actor_name: combatant.name,
              target_id: combatant.id,
              target_name: combatant.name,
              action_type: 'condition_expired',
              details: {
                message: `O encantamento de ${eff.source_item_name} na arma "${w.item_name}" expirou por tempo (${timing}).`,
                source_item_name: eff.source_item_name,
                weapon_name: w.item_name
              }
            });
          }
        } else {
          remaining.push(eff);
        }
      }

      if (changed) {
        props.imbued_effects = remaining;
        this.db.prepare(`
          UPDATE character_inventory SET properties_json = ? WHERE id = ?
        `).run(JSON.stringify(props), w.id);
      }
    }
  }

  getCombatantConditions(campaignId: string, combatantId: string): ActiveCondition[] {
    const combatant = this.getCombatantById(campaignId, combatantId);
    if (!combatant) throw new Error('Combatente não encontrado.');
    return combatant.conditions || [];
  }

  checkCombatantImmunity(
    campaignId: string,
    combatant: Combatant,
    conditionInfo: { name?: string; condition_id?: string; damage_type?: string }
  ): { isImmune: boolean; reason?: string } {
    const targetCharObj = combatant.character_id ? this.characterService.getCharacterById(campaignId, combatant.character_id) : null;
    const rawImmunities: any[] = [
      ...(combatant.npc_data?.immunities || []),
      ...(combatant.npc_data?.condition_immunities || []),
      ...(combatant.npc_data?.imunidades || []),
      ...(targetCharObj?.raw_data?.imunidades || targetCharObj?.raw_data?.immunities || []),
      ...(targetCharObj?.raw_data?.condition_immunities || []),
      ...(targetCharObj?.computed_data?.imunidades || targetCharObj?.computed_data?.immunities || [])
    ];
    for (const c of (combatant.conditions || [])) {
      if (Array.isArray((c.effects as any)?.immunities)) {
        rawImmunities.push(...(c.effects as any).immunities);
      }
      if (Array.isArray((c.effects as any)?.condition_immunities)) {
        rawImmunities.push(...(c.effects as any).condition_immunities);
      }
      if (Array.isArray((c.effects as any)?.imunidades)) {
        rawImmunities.push(...(c.effects as any).imunidades);
      }
    }
    const immunities = rawImmunities.map(s => String(s).toLowerCase().trim());

    const cName = (conditionInfo.name || '').toLowerCase().trim();
    const cId = (conditionInfo.condition_id || '').toLowerCase().trim();
    const dType = (conditionInfo.damage_type || '').toLowerCase().trim();

    if (cName && immunities.includes(cName)) {
      return { isImmune: true, reason: `Alvo possui imunidade à condição "${conditionInfo.name}".` };
    }
    if (cId && immunities.includes(cId)) {
      return { isImmune: true, reason: `Alvo possui imunidade à condição "${conditionInfo.name || cId}".` };
    }
    if (dType && immunities.includes(dType)) {
      return { isImmune: true, reason: `Alvo possui imunidade ao tipo de dano "${dType}".` };
    }

    return { isImmune: false };
  }

  applyConditionToCombatant(
    campaignId: string,
    encounterId: string,
    combatantId: string,
    conditionData: Partial<ActiveCondition> & { name?: string; condition_id?: string; condition?: string; id?: string },
    appliedBy?: string,
    isManualMaster: boolean = false
  ): ActiveCondition {
    const combatant = this.getCombatantById(campaignId, combatantId);
    if (!combatant) throw new Error('Combatente não encontrado.');

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

    let currentConditions: ActiveCondition[] = [...(combatant.conditions || [])];
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
          is_visible_to_players: conditionData.is_visible_to_players ?? def?.is_visible_to_players ?? true,
          applied_by: appliedBy
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
        is_visible_to_players: conditionData.is_visible_to_players ?? def?.is_visible_to_players ?? true,
        applied_by: appliedBy
      };
      currentConditions.push(activeCondition);
    }

    const isIncapacitated = currentConditions.some(c => c.effects?.incapacitated) || (combatant.current_hp !== null && combatant.current_hp <= 0);

    this.db.prepare(`
      UPDATE combatants
      SET conditions_json = ?, is_incapacitated = ?
      WHERE campaign_id = ? AND id = ?
    `).run(JSON.stringify(currentConditions), isIncapacitated ? 1 : 0, campaignId, combatantId);

    if (combatant.character_id) {
      try {
        this.characterService.applyCondition(campaignId, combatant.character_id, activeCondition);
      } catch {}
    }

    const masterPrefix = isManualMaster ? '[Intervenção Manual do Mestre] ' : '';
    this.logCombatAction(campaignId, encounterId, {
      actor_name: appliedBy || (isManualMaster ? 'Mestre' : 'Sistema'),
      target_id: combatant.id,
      target_name: combatant.name,
      action_type: 'condition_applied',
      details: {
        message: `${masterPrefix}${combatant.name} recebeu a condição "${activeCondition.name}" (${activeCondition.duration_remaining} ${activeCondition.duration_type}).`,
        condition: activeCondition,
        is_manual_master: isManualMaster
      }
    });

    return activeCondition;
  }

  applyConditionWithRequirements(
    campaignId: string,
    encounterId: string,
    targetCombatant: Combatant,
    condSource: any,
    context: {
      isAttack: boolean;
      hit: boolean;
      finalDamage: number;
      actorName: string;
    }
  ): ConditionApplicationResult {
    // 1. Extrai identificador da condição
    let condObj: any = condSource;
    if (typeof condSource === 'string') {
      condObj = { name: condSource, condition_id: condSource };
    }
    const rulesetConditions = this.rulesService.getConditions(campaignId);
    const lookupKey = (condObj.condition_id || condObj.id || condObj.condition || condObj.name || '').toString().trim().toLowerCase();
    const def = rulesetConditions.find(
      c => c.id.toLowerCase() === lookupKey || 
           (c.name && c.name.toLowerCase() === lookupKey) || 
           (condObj.name && c.name && c.name.toLowerCase() === condObj.name.toString().toLowerCase().trim())
    );

    const conditionName = condObj.name || def?.name || condObj.condition || condObj.condition_id || 'Condição';
    const conditionId = condObj.condition_id || def?.id || condObj.id || condObj.condition || conditionName;
    const damageType = condObj.damage_type || def?.effects?.dot?.damage_type;

    // 2. Se for ataque e o ataque errou (e a condição requer acerto)
    const requiresHit = condObj.requires_hit !== false;
    if (context.isAttack && requiresHit && !context.hit) {
      return {
        condition_name: conditionName,
        condition_id: conditionId,
        status: 'missed_attack',
        message: `A condição "${conditionName}" não foi aplicada pois o ataque errou o alvo.`
      };
    }

    // 3. Se requer causar dano e causou 0 de dano
    const requiresDamage = condObj.requires_damage === true || condObj.requiresDamage === true;
    if (requiresDamage && context.finalDamage <= 0) {
      return {
        condition_name: conditionName,
        condition_id: conditionId,
        status: 'damage_zero',
        message: `A condição "${conditionName}" não foi aplicada pois nenhum dano foi causado ao alvo.`
      };
    }

    // 4. Teste de probabilidade (chance percentual)
    const rawChance = condObj.chance_percent !== undefined ? condObj.chance_percent : (condObj.chance !== undefined ? condObj.chance : 100);
    const chancePercent = normalizeChancePercent(rawChance);
    const chanceRoll = evaluateChanceRoll(chancePercent);

    if (!chanceRoll.activated) {
      return {
        condition_name: conditionName,
        condition_id: conditionId,
        status: 'chance_failed',
        chance_percent: chancePercent,
        activation_roll: chanceRoll.roll,
        message: `A condição "${conditionName}" não ativou (rolou ${chanceRoll.roll} contra chance de ${chancePercent}%).`
      };
    }

    // 5. Teste de imunidade
    const immuneCheck = this.checkCombatantImmunity(campaignId, targetCombatant, {
      name: conditionName,
      condition_id: conditionId,
      damage_type: damageType
    });
    if (immuneCheck.isImmune) {
      this.logCombatAction(campaignId, encounterId, {
        actor_name: context.actorName,
        target_id: targetCombatant.id,
        target_name: targetCombatant.name,
        action_type: 'resisted',
        details: {
          message: `${targetCombatant.name} resistiu à condição "${conditionName}" por imunidade.`,
          condition_name: conditionName,
          condition_id: conditionId,
          reason: immuneCheck.reason
        }
      });

      return {
        condition_name: conditionName,
        condition_id: conditionId,
        status: 'immune',
        reason: immuneCheck.reason,
        message: `${targetCombatant.name} resistiu à condição "${conditionName}" por imunidade.`
      };
    }

    // 6. Aplicação da condição no alvo
    const activeCondition = this.applyConditionToCombatant(
      campaignId,
      encounterId,
      targetCombatant.id,
      {
        ...def,
        ...condObj,
        condition_id: conditionId,
        name: conditionName
      },
      context.actorName,
      false
    );

    return {
      condition_name: conditionName,
      condition_id: conditionId,
      status: 'applied',
      chance_percent: chancePercent,
      activation_roll: chanceRoll.roll,
      activeCondition,
      message: `${targetCombatant.name} recebeu a condição "${conditionName}" (${activeCondition.duration_remaining} ${activeCondition.duration_type}).`
    };
  }

  removeConditionFromCombatant(
    campaignId: string,
    encounterId: string,
    combatantId: string,
    activeConditionId: string,
    removedBy?: string,
    isManualMaster: boolean = false
  ): boolean {
    const combatant = this.getCombatantById(campaignId, combatantId);
    if (!combatant) throw new Error('Combatente não encontrado.');

    const searchKey = (activeConditionId || '').toString().trim().toLowerCase();
    const currentConditions = [...(combatant.conditions || [])];
    const toRemove = currentConditions.find(
      c => c.id === activeConditionId || 
           c.condition_id === activeConditionId || 
           (c.name && c.name.toLowerCase() === searchKey)
    );

    if (!toRemove) return false;

    const filtered = currentConditions.filter(c => c.id !== toRemove.id);
    const isIncapacitated = filtered.some(c => c.effects?.incapacitated) || (combatant.current_hp !== null && combatant.current_hp <= 0);

    this.db.prepare(`
      UPDATE combatants
      SET conditions_json = ?, is_incapacitated = ?
      WHERE campaign_id = ? AND id = ?
    `).run(JSON.stringify(filtered), isIncapacitated ? 1 : 0, campaignId, combatantId);

    if (combatant.character_id) {
      try {
        this.characterService.removeCondition(campaignId, combatant.character_id, toRemove.id);
      } catch {}
    }

    const masterPrefix = isManualMaster ? '[Intervenção Manual do Mestre] ' : '';
    this.logCombatAction(campaignId, encounterId, {
      actor_name: removedBy || (isManualMaster ? 'Mestre' : 'Sistema'),
      target_id: combatant.id,
      target_name: combatant.name,
      action_type: 'condition_removed',
      details: {
        message: `${masterPrefix}A condição "${toRemove.name}" foi removida de ${combatant.name}.`,
        condition_id: toRemove.condition_id,
        condition_name: toRemove.name,
        is_manual_master: isManualMaster
      }
    });

    return true;
  }

  // ==========================================
  // DANO, CURA E AÇÕES DE COMBATE
  // ==========================================

  applyCombatAction(campaignId: string, encounterId: string, data: {
    actor_id?: string | null;
    actor_name: string;
    target_id?: string | null; // Combatant ID (opcional em ações defensivas ou imbue)
    action_type?: 'damage' | 'heal' | 'resource_mod' | 'attack';
    action_mode?: 'weapon' | 'ability' | 'manual' | 'defend' | 'dodge' | 'consumable' | 'imbue';
    action_cost?: 'main' | 'bonus' | 'reaction' | 'free';
    weapon_id?: string;
    target_weapon_id?: string;
    ability_id?: string;
    ability_name?: string;
    consumable_item_id?: string;
    resource_name?: string; // ex: 'vida', 'sanidade', 'mana'
    amount?: number;
    formula?: string;
    attack_formula?: string;
    damage_type?: string;
    resource_cost?: { name: string; amount: number };
    valid_targets?: ('self' | 'allies' | 'enemies' | 'any' | 'weapon' | 'object')[];
    apply_conditions?: Array<Partial<ActiveCondition> & { name?: string; condition_id?: string } | string>;
    condition?: any;
    conditions?: any;
    condicao?: any;
    remove_conditions?: string[];
    remove_condition?: string;
    notes?: string;
    is_master?: boolean;
    user_id?: string;
    idempotency_key?: string;
  }): {
    actionLog: CombatLog;
    targetCombatant: Combatant;
    actorCombatant?: Combatant;
    updatedCharacter?: any;
    updatedTargetCharacter?: any;
    attackRoll?: any;
    damageRoll?: any;
    hit?: boolean;
    finalDamage?: number;
    consumedItem?: any;
    imbuedWeapon?: any;
    appliedConditions?: ConditionApplicationResult[];
  } {
    // 0. Idempotência (proteção contra requisições duplicadas)
    if (data.idempotency_key) {
      const cached = this.actionCache.get(data.idempotency_key);
      if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) {
        return cached.result;
      }
    }

    const encounter = this.getEncounterById(campaignId, encounterId, true);
    if (!encounter) throw new Error('Encontro de combate não encontrado.');
    const combatants = encounter.combatants || [];

    let actorCombatant: Combatant | null = null;
    if (data.actor_id) {
      actorCombatant = this.getCombatantById(campaignId, data.actor_id);
    }
    if (!actorCombatant && combatants.length > 0) {
      actorCombatant = combatants[encounter.turn_index] || combatants[0];
    }
    if (!actorCombatant) {
      throw new Error('Combatente de origem não encontrado.');
    }

    // Validação de Incapacitação (combatentes incapacitados não podem realizar ações)
    const isActorIncapacitated = actorCombatant.is_incapacitated
      || (actorCombatant.current_hp !== null && actorCombatant.current_hp <= 0)
      || (actorCombatant.conditions || []).some(c => c.effects?.incapacitated);

    if (isActorIncapacitated) {
      throw new Error('Combatente está incapacitado e não pode realizar ações.');
    }

    const targetId = data.target_id || actorCombatant.id;
    let targetCombatant = this.getCombatantById(campaignId, targetId);
    if (!targetCombatant && data.action_mode !== 'defend' && data.action_mode !== 'dodge' && data.action_mode !== 'imbue') {
      throw new Error('Combatente alvo não encontrado.');
    }
    if (!targetCombatant && data.action_mode === 'imbue') {
      targetCombatant = actorCombatant;
    }

    let actionCostType: 'main' | 'bonus' | 'reaction' | 'free' = data.action_cost || 'main';
    const combatConfig = this.rulesService.getCombatRulesConfig(campaignId);

    // 1. Obter variáveis do atacante (atributos da ficha ou dados de NPC)
    const activeRuleset = this.rulesService.getActiveRuleset(campaignId);
    let vars: Record<string, number> = {};
    let actorChar: any = null;

    if (actorCombatant.character_id) {
      actorChar = this.characterService.recomputeCharacter(campaignId, actorCombatant.character_id)
        || this.characterService.getCharacterById(campaignId, actorCombatant.character_id);

      if (actorChar) {
        for (const [k, v] of Object.entries(actorChar.computed_data || {})) {
          if (typeof v === 'number') {
            vars[k] = v;
            vars[k.toLowerCase()] = v;
            vars[stripDiacritics(k.toLowerCase())] = v;
          }
        }
        for (const [k, v] of Object.entries(actorChar.raw_data || {})) {
          if (typeof v === 'number' && vars[k] === undefined) {
            vars[k] = v;
            vars[k.toLowerCase()] = v;
            vars[stripDiacritics(k.toLowerCase())] = v;
          }
        }
      }
    } else if (actorCombatant?.npc_data) {
      const npcData = actorCombatant.npc_data;
      for (const [k, v] of Object.entries(npcData)) {
        if (typeof v === 'number') {
          vars[k] = v;
          vars[k.toLowerCase()] = v;
          vars[stripDiacritics(k.toLowerCase())] = v;
        }
      }
      if (npcData.attributes && typeof npcData.attributes === 'object') {
        for (const [k, v] of Object.entries(npcData.attributes)) {
          if (typeof v === 'number') {
            vars[k] = v;
            vars[k.toLowerCase()] = v;
            vars[stripDiacritics(k.toLowerCase())] = v;
          }
        }
      }
    }

    if (actorCombatant) {
      vars['defesa'] = vars['defesa'] ?? actorCombatant.defense;
      vars['defense'] = vars['defense'] ?? actorCombatant.defense;
      vars['rd'] = vars['rd'] ?? actorCombatant.damage_reduction;
      vars['damage_reduction'] = vars['damage_reduction'] ?? actorCombatant.damage_reduction;
      vars['pv'] = vars['pv'] ?? actorCombatant.current_hp ?? 0;
      vars['vida'] = vars['vida'] ?? actorCombatant.current_hp ?? 0;
      vars['hp'] = vars['hp'] ?? actorCombatant.current_hp ?? 0;
    }

    // Sincronizar identificadores de atributos da campanha (id, name, abbr e sem acento)
    if (activeRuleset?.config?.attributes) {
      for (const attr of activeRuleset.config.attributes) {
        const idLower = attr.id.toLowerCase();
        const nameLower = attr.name.toLowerCase();
        const idCanonical = stripDiacritics(idLower);
        const nameCanonical = stripDiacritics(nameLower);

        const val = vars[attr.id] ?? vars[attr.name] ?? vars[idLower] ?? vars[nameLower] ?? vars[idCanonical] ?? vars[nameCanonical];
        if (val !== undefined) {
          vars[attr.id] = val;
          vars[attr.name] = val;
          vars[idLower] = val;
          vars[nameLower] = val;
          vars[idCanonical] = val;
          vars[nameCanonical] = val;
          if (attr.abbr) {
            vars[attr.abbr] = val;
            vars[attr.abbr.toLowerCase()] = val;
            vars[stripDiacritics(attr.abbr.toLowerCase())] = val;
          }
        }
      }
    }

    // 2. Resolução de Imbuição de Arma durante Combate
    if (data.action_mode === 'imbue') {
      if (!this.inventoryService) {
        throw new Error('Serviço de inventário não disponível.');
      }
      if (!actorChar) {
        throw new Error('Combatente precisa ter ficha de personagem vinculada para imbuir armas.');
      }
      if (!data.consumable_item_id || !data.target_weapon_id) {
        throw new Error('Identificadores do consumível e da arma alvo são obrigatórios para imbuição.');
      }

      const imbueCostType: 'main' | 'bonus' | 'reaction' | 'free' = data.action_cost || 'bonus';

      if (encounter.status === 'active' && !data.is_master) {
        const activeCombatant = combatants[encounter.turn_index];
        if (activeCombatant && activeCombatant.id !== actorCombatant.id) {
          throw new Error(formatTurnErrorMessage(actorCombatant, activeCombatant, false));
        }

        if (imbueCostType === 'main') {
          const maxMain = combatConfig.actions_per_turn?.main ?? 1;
          const usedMain = actorCombatant.actions_used?.main ?? 0;
          if (usedMain >= maxMain) {
            const actorDisplayName = data.is_master ? actorCombatant.name : getCombatantPublicName(actorCombatant);
            throw new Error(`Limite de ações atingido: ${actorDisplayName} já utilizou sua ação principal (${usedMain}/${maxMain}) neste turno.`);
          }
        } else if (imbueCostType === 'bonus') {
          const maxBonus = combatConfig.actions_per_turn?.bonus ?? 1;
          const usedBonus = actorCombatant.actions_used?.bonus ?? 0;
          if (usedBonus >= maxBonus) {
            const actorDisplayName = data.is_master ? actorCombatant.name : getCombatantPublicName(actorCombatant);
            throw new Error(`Limite de ações bônus atingido: ${actorDisplayName} já utilizou sua ação bônus (${usedBonus}/${maxBonus}) neste turno.`);
          }
        }
      }

      const imbueRes = this.inventoryService.imbueWeapon(
        campaignId,
        actorChar.id,
        {
          consumableInventoryId: data.consumable_item_id,
          weaponInventoryId: data.target_weapon_id
        },
        data.user_id || '',
        data.is_master || false
      );

      let updatedActor = actorCombatant;
      if (encounter.status === 'active') {
        const newActionsUsed = {
          ...actorCombatant.actions_used,
          [imbueCostType]: (actorCombatant.actions_used[imbueCostType] || 0) + 1
        };
        this.db.prepare(`
          UPDATE combatants SET actions_used_json = ? WHERE campaign_id = ? AND id = ?
        `).run(JSON.stringify(newActionsUsed), campaignId, actorCombatant.id);
        updatedActor = this.getCombatantById(campaignId, actorCombatant.id)!;
      }

      const log = this.logCombatAction(campaignId, encounterId, {
        actor_id: actorCombatant.id,
        actor_name: actorCombatant.name,
        target_id: actorCombatant.id,
        target_name: actorCombatant.name,
        action_type: 'resource_mod',
        details: {
          message: `${actorCombatant.name} imbuyu "${imbueRes.weapon.item_name}" com "${imbueRes.consumedItem?.item_name || 'consumível'}" (${imbueRes.imbuedEffect.damage_type || 'mágico'}). Custo de ação: ${imbueCostType}.`,
          mode: 'imbue',
          weapon: imbueRes.weapon,
          consumed_item: imbueRes.consumedItem,
          imbued_effect: imbueRes.imbuedEffect
        }
      });

      const ret = {
        actionLog: log,
        targetCombatant: updatedActor,
        actorCombatant: updatedActor,
        updatedCharacter: imbueRes.character,
        hit: true,
        finalDamage: 0,
        consumedItem: imbueRes.consumedItem,
        imbuedWeapon: imbueRes.weapon
      };

      if (data.idempotency_key) {
        this.actionCache.set(data.idempotency_key, { result: ret, timestamp: Date.now() });
      }

      return ret;
    }

    // Resolver tipo de custo de ação e validação de alvos antes da validação de limite de ações
    let abilityDefPre: any = null;
    let itemPre: any = null;
    let itemPropsPre: any = null;

    if (data.action_mode === 'ability') {
      const campaignAbilities = this.rulesService.getAbilities(campaignId);
      abilityDefPre = campaignAbilities.find(
        a => a.id === data.ability_id || (data.ability_name && a.name.toLowerCase() === data.ability_name.toLowerCase())
      );
      if (abilityDefPre) {
        if (!data.action_cost) {
          const cost = abilityDefPre.action_cost || abilityDefPre.action_type;
          if (cost) actionCostType = cost;
        }
      }
    } else if (data.action_mode === 'consumable') {
      if (!data.action_cost) actionCostType = 'bonus';
      if (data.consumable_item_id && actorChar) {
        itemPre = this.db.prepare(`
          SELECT item_name, properties_json FROM character_inventory WHERE character_id = ? AND (id = ? OR item_id = ?)
        `).get(actorChar.id, data.consumable_item_id, data.consumable_item_id) as any;
        if (itemPre?.properties_json) {
          try {
            itemPropsPre = JSON.parse(itemPre.properties_json);
            if (!data.action_cost && itemPropsPre.action_cost) actionCostType = itemPropsPre.action_cost;
          } catch {}
        }
      }
    }

    // Validação de Alvos prévia (Target Validation)
    const earlyValidTargets = data.valid_targets || abilityDefPre?.valid_targets || itemPropsPre?.valid_targets || (
      data.action_mode === 'weapon' ? ['enemies', 'any'] :
      data.action_type === 'heal' || abilityDefPre?.type === 'heal' || itemPropsPre?.cura !== undefined ? ['self', 'allies'] :
      ['enemies', 'any']
    );

    if (targetCombatant && earlyValidTargets && earlyValidTargets.length > 0 && !earlyValidTargets.includes('any')) {
      const isSelf = targetCombatant.id === actorCombatant.id;
      const isAlly = areCombatantsAllies(actorCombatant, targetCombatant);
      const isEnemy = areCombatantsEnemies(actorCombatant, targetCombatant);

      let allowed = false;
      for (const vt of earlyValidTargets) {
        if (vt === 'self' && isSelf) allowed = true;
        if (vt === 'allies' && isAlly) allowed = true;
        if (vt === 'enemies' && isEnemy) allowed = true;
      }

      if (!allowed) {
        const actionLabelName = data.ability_name || abilityDefPre?.name || itemPre?.item_name || 'Ação';
        const targetDisplayName = data.is_master ? targetCombatant.name : getCombatantPublicName(targetCombatant);
        throw new Error(`Alvo inválido: A ação "${actionLabelName}" não permite o alvo selecionado (${targetDisplayName}). Alvos válidos: ${earlyValidTargets.join(', ')}.`);
      }
    }

    // 3. Validação de Turno e Economia de Ações (para outras ações)
    if (encounter.status === 'active') {
      if (!data.is_master) {
        const activeCombatant = combatants[encounter.turn_index];
        if (activeCombatant && activeCombatant.id !== actorCombatant.id) {
          throw new Error(formatTurnErrorMessage(actorCombatant, activeCombatant, false));
        }
      }

      if (!data.is_master) {
        if (actionCostType === 'main') {
          const maxMain = combatConfig.actions_per_turn?.main ?? 1;
          const usedMain = actorCombatant.actions_used?.main ?? 0;
          if (usedMain >= maxMain) {
            const actorDisplayName = data.is_master ? actorCombatant.name : getCombatantPublicName(actorCombatant);
            throw new Error(`Limite de ações atingido: ${actorDisplayName} já utilizou sua ação principal (${usedMain}/${maxMain}) neste turno.`);
          }
        } else if (actionCostType === 'bonus') {
          const maxBonus = combatConfig.actions_per_turn?.bonus ?? 1;
          const usedBonus = actorCombatant.actions_used?.bonus ?? 0;
          if (usedBonus >= maxBonus) {
            const actorDisplayName = data.is_master ? actorCombatant.name : getCombatantPublicName(actorCombatant);
            throw new Error(`Limite de ações bônus atingido: ${actorDisplayName} já utilizou sua ação bônus (${usedBonus}/${maxBonus}) neste turno.`);
          }
        }
      }
    }

    // Variáveis defensivas do alvo acessíveis no contexto
    if (targetCombatant) {
      vars['alvo_defesa'] = targetCombatant.defense;
      vars['alvo_rd'] = targetCombatant.damage_reduction;
      vars['alvo_pv'] = targetCombatant.current_hp ?? 0;
      vars['alvo_hp'] = targetCombatant.current_hp ?? 0;
      vars['target_defesa'] = targetCombatant.defense;
      vars['target_defense'] = targetCombatant.defense;
      vars['target_rd'] = targetCombatant.damage_reduction;
      vars['target_hp'] = targetCombatant.current_hp ?? 0;

      if (targetCombatant.character_id) {
        const targetChar = this.characterService.getCharacterById(campaignId, targetCombatant.character_id);
        if (targetChar) {
          for (const [k, v] of Object.entries(targetChar.computed_data || {})) {
            if (typeof v === 'number') {
              vars[`alvo_${k.toLowerCase()}`] = v;
              vars[`target_${k.toLowerCase()}`] = v;
              vars[`alvo_${stripDiacritics(k.toLowerCase())}`] = v;
              vars[`target_${stripDiacritics(k.toLowerCase())}`] = v;
            }
          }
        }
      }
    }

    // Modificadores de atributos originados de condições ativas do atacante
    for (const cond of (actorCombatant.conditions || [])) {
      if (cond.modifiers) {
        for (const mod of cond.modifiers) {
          const t = mod.target.toLowerCase();
          if (vars[t] !== undefined) {
            if (mod.type === 'percentage') {
              vars[t] = Math.round(vars[t] * (1 + mod.value / 100));
            } else {
              vars[t] += mod.value;
            }
            vars[stripDiacritics(t)] = vars[t];
          }
        }
      }
    }

    let weaponName = '';
    let attackFormula = data.attack_formula || '';
    let damageFormula = data.formula || '';
    let damageType = data.damage_type || 'fisico';
    let rawDamage = data.amount ?? 0;

    // 3.1 Tratamento de Postura Defensiva (Defender)
    if (data.action_mode === 'defend') {
      const defenseEffect = combatConfig.defense_effect || { type: 'bonus_rd', value: 2, formula: '2' };
      let bonusVal = defenseEffect.value ?? 2;
      if (defenseEffect.formula && defenseEffect.formula !== '2') {
        try {
          const evalRes = this.rulesService.evaluateFormula(campaignId, defenseEffect.formula, vars);
          bonusVal = Math.max(1, evalRes.total);
        } catch {}
      }

      const desc = defenseEffect.type === 'bonus_rd' 
        ? `+${bonusVal} RD (Redução de Dano)`
        : `+${bonusVal} na Defesa`;

      const defState: DefensiveState = {
        ...actorCombatant.defensive_state,
        defense: {
          active: true,
          type: defenseEffect.type,
          value: bonusVal,
          formula: defenseEffect.formula || `${bonusVal}`,
          description: desc,
          expires_on_turn_start_id: actorCombatant.id,
          expires_at_round: encounter.round + 1
        }
      };

      const newActionsUsed = {
        ...actorCombatant.actions_used,
        [actionCostType]: (actorCombatant.actions_used[actionCostType] || 0) + 1
      };

      this.db.exec('BEGIN TRANSACTION;');
      try {
        this.db.prepare(`
          UPDATE combatants 
          SET defensive_state_json = ?, actions_used_json = ?
          WHERE campaign_id = ? AND id = ?
        `).run(JSON.stringify(defState), JSON.stringify(newActionsUsed), campaignId, actorCombatant.id);

        const log = this.logCombatAction(campaignId, encounterId, {
          actor_id: actorCombatant.id,
          actor_name: actorCombatant.name,
          target_id: actorCombatant.id,
          target_name: actorCombatant.name,
          action_type: 'turn_change',
          details: {
            message: `${actorCombatant.name} assumiu postura defensiva (${desc}) até o início do seu próximo turno.`,
            mode: 'defend',
            defense_effect: defState.defense
          }
        });

        this.db.exec('COMMIT;');
        const updatedActor = this.getCombatantById(campaignId, actorCombatant.id)!;
        return {
          actionLog: log,
          targetCombatant: updatedActor,
          actorCombatant: updatedActor,
          hit: true,
          finalDamage: 0
        };
      } catch (err) {
        this.db.exec('ROLLBACK;');
        throw err;
      }
    }

    // 3.2 Tratamento de Esquiva
    if (data.action_mode === 'dodge') {
      const dodgeConfig = combatConfig.dodge_effect || { formula: '1d20 + agilidade', type: 'replace_defense_if_higher' };
      const dodgeFormula = data.formula || dodgeConfig.formula || '1d20';

      let dodgeRoll: any = null;
      try {
        dodgeRoll = this.rulesService.evaluateFormula(campaignId, dodgeFormula, vars);
      } catch (err: any) {
        throw new Error(`Erro na fórmula de esquiva '${dodgeFormula}': ${err.message}`);
      }

      const rollTotal = dodgeRoll.total;
      const effectiveDefense = Math.max(actorCombatant.defense, rollTotal);
      const bonusDefense = Math.max(0, effectiveDefense - actorCombatant.defense);

      const defState: DefensiveState = {
        ...actorCombatant.defensive_state,
        dodge: {
          active: true,
          effective_defense: effectiveDefense,
          roll_total: rollTotal,
          bonus_defense: bonusDefense,
          formula: dodgeFormula,
          description: `Esquiva ativa: Defesa ${effectiveDefense} (Rolou ${rollTotal})`,
          expires_on_turn_start_id: actorCombatant.id,
          expires_at_round: encounter.round + 1
        }
      };

      const newActionsUsed = {
        ...actorCombatant.actions_used,
        [actionCostType]: (actorCombatant.actions_used[actionCostType] || 0) + 1
      };

      this.db.exec('BEGIN TRANSACTION;');
      try {
        this.db.prepare(`
          UPDATE combatants 
          SET defensive_state_json = ?, actions_used_json = ?
          WHERE campaign_id = ? AND id = ?
        `).run(JSON.stringify(defState), JSON.stringify(newActionsUsed), campaignId, actorCombatant.id);

        const log = this.logCombatAction(campaignId, encounterId, {
          actor_id: actorCombatant.id,
          actor_name: actorCombatant.name,
          target_id: actorCombatant.id,
          target_name: actorCombatant.name,
          action_type: 'roll',
          amount: rollTotal,
          details: {
            message: `${actorCombatant.name} executou esquiva: rolou ${rollTotal} (${dodgeFormula}) — Defesa aumentada para ${effectiveDefense} até seu próximo turno.`,
            mode: 'dodge',
            dodge_roll: dodgeRoll,
            dodge_state: defState.dodge
          }
        });

        this.db.exec('COMMIT;');
        const updatedActor = this.getCombatantById(campaignId, actorCombatant.id)!;
        return {
          actionLog: log,
          targetCombatant: updatedActor,
          actorCombatant: updatedActor,
          hit: true,
          finalDamage: 0
        };
      } catch (err) {
        this.db.exec('ROLLBACK;');
        throw err;
      }
    }

    if (!targetCombatant) {
      throw new Error('Combatente alvo não encontrado.');
    }

    const conditionCandidates: any[] = [];
    if (data.apply_conditions) {
      if (Array.isArray(data.apply_conditions)) conditionCandidates.push(...data.apply_conditions);
      else conditionCandidates.push(data.apply_conditions);
    }
    if (data.condition) conditionCandidates.push(data.condition);
    if (data.conditions) {
      if (Array.isArray(data.conditions)) conditionCandidates.push(...data.conditions);
      else conditionCandidates.push(data.conditions);
    }
    if (data.condicao) conditionCandidates.push(data.condicao);

    const conditionsToRemoveFromTarget: string[] = [];
    if (data.remove_conditions) {
      if (Array.isArray(data.remove_conditions)) conditionsToRemoveFromTarget.push(...data.remove_conditions);
      else conditionsToRemoveFromTarget.push(data.remove_conditions);
    }
    if (data.remove_condition) conditionsToRemoveFromTarget.push(data.remove_condition);
    const failedChanceConditions: Array<{ condition_name: string; chance_percent: number; activation_roll: number | null }> = [];

    let weaponRow: any = null;
    let weaponProps: Record<string, any> = {};
    let consumableRow: any = null;
    let consumableProps: any = {};
    let abilityDef: any = null;

    // 4. Resolução da Ação Conforme o Modo (Arma, Desarmado, Habilidade, Consumível)
    if (data.action_mode === 'ability') {
      const campaignAbilities = this.rulesService.getAbilities(campaignId);
      abilityDef = campaignAbilities.find(
        a => a.id === data.ability_id || (data.ability_name && a.name.toLowerCase() === data.ability_name.toLowerCase())
      );
      if (!abilityDef && actorChar?.computed_data?.abilities) {
        abilityDef = actorChar.computed_data.abilities.find(
          (a: any) => a.id === data.ability_id || (data.ability_name && a.name.toLowerCase() === data.ability_name.toLowerCase())
        );
      }
      if (abilityDef) {
        data.ability_name = abilityDef.name;
        if (!data.action_cost && abilityDef.action_cost) {
          actionCostType = abilityDef.action_cost;
        }
        if (!data.damage_type && abilityDef.damage_type) {
          damageType = abilityDef.damage_type;
        }
        if (!attackFormula && abilityDef.attack_formula) {
          attackFormula = abilityDef.attack_formula;
        }
        if (!damageFormula && abilityDef.damage_formula) {
          damageFormula = abilityDef.damage_formula;
        }
        if (!damageFormula && abilityDef.heal_formula) {
          damageFormula = abilityDef.heal_formula;
          data.action_type = 'heal';
        }
        if (abilityDef.type === 'heal' && !data.action_type) {
          data.action_type = 'heal';
        }
        if (abilityDef.apply_conditions) {
          if (Array.isArray(abilityDef.apply_conditions)) conditionCandidates.push(...abilityDef.apply_conditions);
          else conditionCandidates.push(abilityDef.apply_conditions);
        }
        if (abilityDef.condition) conditionCandidates.push(abilityDef.condition);
        if (abilityDef.conditions) {
          if (Array.isArray(abilityDef.conditions)) conditionCandidates.push(...abilityDef.conditions);
          else conditionCandidates.push(abilityDef.conditions);
        }
        if (abilityDef.condicao) conditionCandidates.push(abilityDef.condicao);
        if (Array.isArray(abilityDef.damage_components)) {
          for (const comp of abilityDef.damage_components) {
            if (comp.condition) conditionCandidates.push({ condition: comp.condition, chance_percent: comp.chance_percent, damage_type: comp.damage_type, requires_damage: true });
            if (comp.apply_conditions) {
              const list = Array.isArray(comp.apply_conditions) ? comp.apply_conditions : [comp.apply_conditions];
              conditionCandidates.push(...list);
            }
          }
        }
        if (abilityDef.remove_conditions) {
          if (Array.isArray(abilityDef.remove_conditions)) conditionsToRemoveFromTarget.push(...abilityDef.remove_conditions);
          else conditionsToRemoveFromTarget.push(abilityDef.remove_conditions);
        }
        if (abilityDef.remove_condition) {
          conditionsToRemoveFromTarget.push(abilityDef.remove_condition);
        }
        if (abilityDef.resource_cost && !data.resource_cost) {
          data.resource_cost = abilityDef.resource_cost;
        }
      }
    } else if (data.action_mode === 'consumable') {
      if (!actorChar) {
        throw new Error('Combatente precisa ter ficha de personagem vinculada para usar consumíveis.');
      }
      if (!data.consumable_item_id) {
        throw new Error('Identificador do item consumível é obrigatório.');
      }

      consumableRow = this.db.prepare(`
        SELECT * FROM character_inventory 
        WHERE character_id = ? AND (id = ? OR item_id = ?)
      `).get(actorChar.id, data.consumable_item_id, data.consumable_item_id) as any;

      if (!consumableRow) {
        throw new Error('O item consumível não foi encontrado no inventário do combatente.');
      }
      if (consumableRow.quantity <= 0) {
        throw new Error(`Item esgotado: ${consumableRow.item_name} não possui mais unidades disponíveis.`);
      }

      try {
        consumableProps = JSON.parse(consumableRow.properties_json || '{}');
      } catch {}

      // Mescla propriedades da definição do item do catálogo se properties_json do inventário estiver vazio ou incompleto
      if (consumableRow.item_id) {
        try {
          const catItem = this.db.prepare(`SELECT properties_json FROM items WHERE id = ?`).get(consumableRow.item_id) as any;
          if (catItem?.properties_json) {
            const catProps = JSON.parse(catItem.properties_json);
            consumableProps = { ...catProps, ...consumableProps };
          }
        } catch {}
      }

      if (consumableProps.cargas_atual !== undefined && consumableProps.cargas_atual <= 0) {
        throw new Error(`Item sem cargas: ${consumableRow.item_name} esgotou suas cargas.`);
      }

      if (consumableProps.cura !== undefined && !data.amount && !data.formula) {
        data.action_type = 'heal';
        data.amount = Number(consumableProps.cura);
        rawDamage = data.amount;
      } else if (consumableProps.heal_formula && !damageFormula) {
        data.action_type = 'heal';
        damageFormula = consumableProps.heal_formula;
      } else if (consumableProps.dano !== undefined && !data.amount && !data.formula) {
        data.action_type = 'damage';
        data.amount = Number(consumableProps.dano);
        rawDamage = data.amount;
      } else if (consumableProps.damage_formula && !damageFormula) {
        damageFormula = consumableProps.damage_formula;
      }

      if (consumableProps.tipo_dano && !data.damage_type) {
        damageType = consumableProps.tipo_dano;
      }

      if (consumableProps.apply_conditions) {
        if (Array.isArray(consumableProps.apply_conditions)) conditionCandidates.push(...consumableProps.apply_conditions);
        else conditionCandidates.push(consumableProps.apply_conditions);
      }
      if (consumableProps.condition) {
        conditionCandidates.push({ condition: consumableProps.condition, chance_percent: consumableProps.chance_percent });
      }
      if (consumableProps.conditions) {
        if (Array.isArray(consumableProps.conditions)) conditionCandidates.push(...consumableProps.conditions);
        else conditionCandidates.push(consumableProps.conditions);
      }
      if (consumableProps.condicao_aplicada) {
        conditionCandidates.push({ condition: consumableProps.condicao_aplicada, chance_percent: consumableProps.chance_percent });
      }
      if (consumableProps.condicao) {
        conditionCandidates.push({ condition: consumableProps.condicao, chance_percent: consumableProps.chance_percent });
      }
      if (consumableProps.imbue_properties?.condition) {
        conditionCandidates.push({
          condition: consumableProps.imbue_properties.condition,
          chance_percent: consumableProps.imbue_properties.chance_percent
        });
      }
      if (consumableProps.remove_conditions) {
        if (Array.isArray(consumableProps.remove_conditions)) conditionsToRemoveFromTarget.push(...consumableProps.remove_conditions);
        else conditionsToRemoveFromTarget.push(consumableProps.remove_conditions);
      }
      if (consumableProps.purifica) {
        conditionsToRemoveFromTarget.push(consumableProps.purifica);
      }
      if (consumableProps.remove_condition) {
        conditionsToRemoveFromTarget.push(consumableProps.remove_condition);
      }
      if (consumableProps.action_cost && !data.action_cost) {
        actionCostType = consumableProps.action_cost;
      }
    } else if (data.action_mode === 'weapon') {
      if (data.weapon_id && actorChar) {
        // Arma selecionada no inventário
        weaponRow = this.db.prepare(`
          SELECT * FROM character_inventory 
          WHERE character_id = ? AND (id = ? OR item_id = ?)
        `).get(actorChar.id, data.weapon_id, data.weapon_id) as any;

        if (!weaponRow) {
          throw new Error('A arma selecionada não foi encontrada no inventário do personagem.');
        }

        weaponName = weaponRow.item_name;
        try {
          weaponProps = JSON.parse(weaponRow.properties_json || '{}');
        } catch {}

        if (!damageFormula) {
          damageFormula = weaponProps.dano || weaponProps.damage_formula || '1d6';
        }
        if (!attackFormula) {
          attackFormula = weaponProps.ataque || weaponProps.attack_formula || '';
          if (!attackFormula) {
            // Se arma não tem fórmula própria, busca fórmula geral de ataque da campanha ou atributos
            const defaultDice = activeRuleset?.config?.defaultDice || '1d20';
            const generalAtk = activeRuleset?.config?.formulas?.find(
              f => f.id === 'ataque_fisico' || f.id === 'ataque_corpo_a_corpo' || f.category === 'attack'
            );
            if (generalAtk) {
              attackFormula = generalAtk.expression;
            } else if (vars.luta !== undefined) {
              attackFormula = `${defaultDice} + luta`;
            } else if (vars.forca !== undefined) {
              attackFormula = `${defaultDice} + forca`;
            } else if (vars.destreza !== undefined) {
              attackFormula = `${defaultDice} + destreza`;
            } else if (vars.agilidade !== undefined) {
              attackFormula = `${defaultDice} + agilidade`;
            } else if (vars.reflexo !== undefined) {
              attackFormula = `${defaultDice} + reflexo`;
            } else {
              attackFormula = defaultDice;
            }
          }
        }
        if (!data.damage_type && (weaponProps.tipo_dano || weaponProps.damage_type)) {
          damageType = weaponProps.tipo_dano || weaponProps.damage_type;
        }
      } else if (data.weapon_id && (actorCombatant?.npc_data?.actions || actorCombatant?.npc_data?.equipment)) {
        const actions = Array.isArray(actorCombatant.npc_data.actions) ? actorCombatant.npc_data.actions : [];
        const equipment = Array.isArray(actorCombatant.npc_data.equipment) ? actorCombatant.npc_data.equipment : [];
        const matched = actions.find((a: any, idx: number) => a.id === data.weapon_id || `npc_act_${idx}` === data.weapon_id || a.name === data.weapon_id)
          || equipment.find((eq: any, idx: number) => eq.id === data.weapon_id || `npc_eq_${idx}` === data.weapon_id || eq.name === data.weapon_id);
        
        if (matched) {
          weaponName = matched.name;
          if (!damageFormula) damageFormula = matched.damage_formula || matched.damage || matched.dano || '1d6';
          if (!attackFormula) attackFormula = matched.attack_formula || matched.ataque || (matched.attack_bonus ? `1d20 + ${matched.attack_bonus}` : '1d20');
          if (!data.damage_type && (matched.damage_type || matched.tipo_dano)) damageType = matched.damage_type || matched.tipo_dano;
          if (Array.isArray(matched.damage_components)) {
            for (const comp of matched.damage_components) {
              if (comp.condition) conditionCandidates.push({ condition: comp.condition, chance_percent: comp.chance_percent, damage_type: comp.damage_type, requires_damage: true });
              if (comp.apply_conditions) {
                const list = Array.isArray(comp.apply_conditions) ? comp.apply_conditions : [comp.apply_conditions];
                conditionCandidates.push(...list);
              }
            }
          }
          if (matched.conditions) {
            const list = Array.isArray(matched.conditions) ? matched.conditions : [matched.conditions];
            conditionCandidates.push(...list);
          }
        }
      } else {
        // Ataque Desarmado (sem arma no inventário ou ação desarmada)
        if ((activeRuleset?.config as any)?.allow_unarmed === false) {
          throw new Error('Ataque desarmado não é permitido pelas regras desta campanha.');
        }

        weaponName = 'Ataque Desarmado';
        damageType = data.damage_type || 'impacto';
        const defaultDice = activeRuleset?.config?.defaultDice || '1d20';

        if (!attackFormula) {
          // Busca fórmula configurada na campanha para ataque desarmado ou ataque físico
          const unarmedAtk = activeRuleset?.config?.formulas?.find(
            f => f.id === 'ataque_desarmado' || (f.category === 'attack' && f.name.toLowerCase().includes('desarmado'))
          );
          const generalAtk = activeRuleset?.config?.formulas?.find(
            f => f.id === 'ataque_fisico' || f.id === 'ataque_corpo_a_corpo'
          );

          if (unarmedAtk) {
            attackFormula = unarmedAtk.expression;
          } else if (generalAtk) {
            attackFormula = generalAtk.expression;
          } else if (vars.luta !== undefined) {
            attackFormula = `${defaultDice} + luta`;
          } else if (vars.forca !== undefined) {
            attackFormula = `${defaultDice} + forca`;
          } else if (vars.destreza !== undefined) {
            attackFormula = `${defaultDice} + destreza`;
          } else if (vars.agilidade !== undefined) {
            attackFormula = `${defaultDice} + agilidade`;
          } else if (vars.reflexo !== undefined) {
            attackFormula = `${defaultDice} + reflexo`;
          } else if (vars.combate !== undefined) {
            attackFormula = `${defaultDice} + combate`;
          } else {
            attackFormula = defaultDice;
          }
        }

        if (!damageFormula) {
          const unarmedDmg = activeRuleset?.config?.formulas?.find(
            f => f.id === 'dano_desarmado' || (f.category === 'damage' && f.name.toLowerCase().includes('desarmado'))
          );
          if (unarmedDmg) {
            damageFormula = unarmedDmg.expression;
          } else if (vars.forca !== undefined) {
            damageFormula = '1d4 + forca';
          } else if (vars.cromo !== undefined) {
            damageFormula = '1d4 + cromo';
          } else if (vars.destreza !== undefined) {
            damageFormula = '1d4 + destreza';
          } else {
            damageFormula = '1d4';
          }
        }
      }
    }

    // 4.1 Validação de Alvos (Target Validation)
    const validTargets = data.valid_targets || abilityDef?.valid_targets || consumableProps?.valid_targets || (
      data.action_mode === 'weapon' ? ['enemies', 'any'] :
      data.action_type === 'heal' ? ['self', 'allies'] :
      data.action_mode === 'consumable' && (consumableProps.cura !== undefined || consumableProps.heal_formula) ? ['self', 'allies'] :
      ['enemies', 'any']
    );

    if (targetCombatant && validTargets && validTargets.length > 0 && !validTargets.includes('any')) {
      const isSelf = targetCombatant.id === actorCombatant.id;
      const isAlly = areCombatantsAllies(actorCombatant, targetCombatant);
      const isEnemy = areCombatantsEnemies(actorCombatant, targetCombatant);

      let allowed = false;
      for (const vt of validTargets) {
        if (vt === 'self' && isSelf) allowed = true;
        if (vt === 'allies' && isAlly) allowed = true;
        if (vt === 'enemies' && isEnemy) allowed = true;
      }

      if (!allowed) {
        const actionLabelName = data.ability_name || consumableRow?.item_name || weaponName || 'Ação';
        throw new Error(`Alvo inválido: A ação "${actionLabelName}" não permite o alvo selecionado (${targetCombatant.name}). Alvos válidos: ${validTargets.join(', ')}.`);
      }
    }

    // 3. Validação prévia de custo de recursos (sem alterar banco ainda)
    const resourceCost = data.resource_cost || (
      (data as any).resource_cost_name && (data as any).resource_cost_amount !== undefined
        ? { name: (data as any).resource_cost_name, amount: Number((data as any).resource_cost_amount) }
        : null
    );

    let resourceUpdate: { raw: any; key: string } | null = null;
    if (data.action_mode === 'ability' && resourceCost && actorChar) {
      const rName = resourceCost.name.toLowerCase();
      const cost = Math.max(0, resourceCost.amount);
      const raw = { ...actorChar.raw_data };
      const currentRes = raw[`${rName}_atual`] ?? raw[rName] ?? actorChar.computed_data?.[`${rName}_atual`] ?? actorChar.computed_data?.[rName] ?? 0;

      if (currentRes < cost) {
        throw new Error(`Recurso insuficiente: ${actorChar.name} possui apenas ${currentRes} de ${rName}, mas o custo é ${cost}.`);
      }

      const resKey = raw[`${rName}_atual`] !== undefined ? `${rName}_atual` : rName;
      raw[resKey] = Math.max(0, currentRes - cost);
      resourceUpdate = { raw, key: resKey };
    }

    // 4. Resolução de Teste de Ataque contra a Defesa do Alvo
    let attackRoll: any = null;
    let targetDefense = targetCombatant.defense ?? targetCombatant.npc_data?.defense ?? 10;
    let defenseBonusNote = '';

    const targetDefState = targetCombatant.defensive_state || {};
    if (targetDefState.dodge?.active) {
      const dodgeDef = targetDefState.dodge.effective_defense;
      if (dodgeDef > targetDefense) {
        defenseBonusNote += ` [Alvo em Esquiva: Defesa ${targetDefense} -> ${dodgeDef}]`;
        targetDefense = dodgeDef;
      }
    }
    if (targetDefState.defense?.active) {
      if (targetDefState.defense.type === 'bonus_defense') {
        const bonusDef = targetDefState.defense.value;
        targetDefense += bonusDef;
        defenseBonusNote += ` [Alvo em Defesa: +${bonusDef} Defesa]`;
      }
    }

    // Modificadores de defesa do alvo provenientes de condições ativas
    let targetDefMod = 0;
    for (const c of (targetCombatant.conditions || [])) {
      if (c.effects?.defense_mod) targetDefMod += c.effects.defense_mod;
      if (c.modifiers) {
        for (const m of c.modifiers) {
          if (['defesa', 'defense'].includes(m.target.toLowerCase())) {
            targetDefMod += m.value;
          }
        }
      }
    }
    if (targetDefMod !== 0) {
      targetDefense += targetDefMod;
      defenseBonusNote += ` [Condições do alvo: ${targetDefMod >= 0 ? '+' : ''}${targetDefMod} Defesa]`;
    }

    // Modificador de teste de ataque do atacante por condições ativas
    let actorAttackMod = 0;
    for (const c of (actorCombatant.conditions || [])) {
      if (c.effects?.attack_mod) actorAttackMod += c.effects.attack_mod;
      if (c.modifiers) {
        for (const m of c.modifiers) {
          if (['ataque', 'attack', 'teste'].includes(m.target.toLowerCase())) {
            actorAttackMod += m.value;
          }
        }
      }
    }

    let hit = true;

    if (attackFormula && attackFormula.trim()) {
      let finalAttackFormula = attackFormula;
      if (actorAttackMod !== 0) {
        finalAttackFormula = `(${attackFormula}) + (${actorAttackMod})`;
      }
      try {
        attackRoll = this.rulesService.evaluateFormula(campaignId, finalAttackFormula, vars);
      } catch (err: any) {
        const actorName = data.actor_name || actorCombatant?.name || actorChar?.name || 'Combatente';
        throw new Error(`Erro na fórmula de teste de ataque '${finalAttackFormula}' de ${actorName}: ${err.message}`);
      }
      hit = attackRoll.total >= targetDefense;
    }

    // 5. Cálculo do Dano Bruto (apenas se acertou o teste de ataque ou não houve teste)
    if (data.amount !== undefined) rawDamage = data.amount;
    let damageRoll: any = null;

    let actorDamageMod = 0;
    for (const c of (actorCombatant.conditions || [])) {
      if (c.effects?.damage_mod) actorDamageMod += c.effects.damage_mod;
      if (c.modifiers) {
        for (const m of c.modifiers) {
          if (['dano', 'damage'].includes(m.target.toLowerCase())) {
            actorDamageMod += m.value;
          }
        }
      }
    }

    if (hit && damageFormula && damageFormula.trim()) {
      let finalDamageFormula = damageFormula;
      if (actorDamageMod !== 0) {
        finalDamageFormula = `(${damageFormula}) + (${actorDamageMod})`;
      }
      try {
        damageRoll = this.rulesService.evaluateFormula(campaignId, finalDamageFormula, vars);
        rawDamage = Math.max(0, damageRoll.total);
      } catch (err: any) {
        const actorName = data.actor_name || actorCombatant?.name || actorChar?.name || 'Combatente';
        throw new Error(`Erro na fórmula de dano '${finalDamageFormula}' de ${actorName}: ${err.message}`);
      }
    }

    if (rawDamage < 0) rawDamage = 0;

    // 6. Aplicação de Regras Defensivas do Alvo (Armadura / RD, Resistências, Vulnerabilidades, Imunidades)
    let finalDamage = 0;
    let dr = 0;
    let defenseNote = '';
    const dtype = damageType.toLowerCase().trim();

    interface DamageComponentBreakdown {
      source: string;
      damage_type: string;
      raw_damage: number;
      final_damage: number;
      activated: boolean;
      activation_roll?: number | null;
      chance_percent?: number | null;
      formula?: string | null;
      notes?: string;
    }

    const damageComponentsBreakdown: DamageComponentBreakdown[] = [];
    let consumedItemRecord: any = null;

    let weaponNeedsDbUpdate = false;
    const expiredImbueNotes: string[] = [];

    if (!hit) {
      finalDamage = 0;

      // Se errou, efeitos imbuídos com duração por ataques ('attacks') ainda consomem carga!
      if (weaponRow && Array.isArray(weaponProps.imbued_effects)) {
        const remainingEffects: ActiveImbuedEffect[] = [];
        for (const eff of weaponProps.imbued_effects) {
          if (eff.duration_type === 'attacks') {
            const nextCharges = (eff.charges_remaining ?? 1) - 1;
            weaponNeedsDbUpdate = true;
            if (nextCharges > 0) {
              remainingEffects.push({ ...eff, charges_remaining: nextCharges });
            } else {
              expiredImbueNotes.push(`Encantamento de ${eff.source_item_name} na arma "${weaponRow.item_name}" expirou (cargas esgotadas).`);
            }
          } else {
            remainingEffects.push(eff);
          }
        }
        weaponProps.imbued_effects = remainingEffects;
      }
    } else if (data.action_type === 'heal') {
      finalDamage = rawDamage;
      damageComponentsBreakdown.push({
        source: 'Cura',
        damage_type: 'cura',
        raw_damage: rawDamage,
        final_damage: rawDamage,
        activated: true
      });
    } else if (data.action_type === 'resource_mod') {
      finalDamage = data.amount ?? rawDamage;
      damageComponentsBreakdown.push({
        source: 'Modificador de Recurso',
        damage_type: 'recurso',
        raw_damage: finalDamage,
        final_damage: finalDamage,
        activated: true
      });
    } else {
      // Dano de Ataque (com múltiplos componentes e elementos)
      dr = targetCombatant.damage_reduction ?? targetCombatant.npc_data?.damage_reduction ?? 0;
      if (targetDefState.defense?.active && targetDefState.defense.type === 'bonus_rd') {
        const bonusRd = targetDefState.defense.value;
        dr += bonusRd;
        defenseNote += ` [Alvo em Defesa: +${bonusRd} RD]`;
      }
      let targetDrMod = 0;
      for (const c of (targetCombatant.conditions || [])) {
        if (c.effects?.damage_reduction_mod) targetDrMod += c.effects.damage_reduction_mod;
        if (c.modifiers) {
          for (const m of c.modifiers) {
            if (['rd', 'damage_reduction', 'armadura'].includes(m.target.toLowerCase())) {
              targetDrMod += m.value;
            }
          }
        }
      }
      dr += targetDrMod;
      if (targetDrMod !== 0) {
        defenseNote += ` [Condições do alvo: ${targetDrMod >= 0 ? '+' : ''}${targetDrMod} RD]`;
      }

      let targetCharObj: any = null;
      if (targetCombatant.character_id) {
        targetCharObj = this.characterService.getCharacterById(campaignId, targetCombatant.character_id);
      }

      const immunities = [
        ...(targetCombatant.npc_data?.immunities || []),
        ...(targetCharObj?.raw_data?.imunidades || targetCharObj?.raw_data?.immunities || []),
        ...(targetCharObj?.computed_data?.imunidades || targetCharObj?.computed_data?.immunities || [])
      ].map((s: any) => String(s).toLowerCase().trim());

      const resistances = [
        ...(targetCombatant.npc_data?.resistances || []),
        ...(targetCharObj?.raw_data?.resistencias || targetCharObj?.raw_data?.resistances || []),
        ...(targetCharObj?.computed_data?.resistencias || targetCharObj?.computed_data?.resistances || [])
      ].map((s: any) => String(s).toLowerCase().trim());

      const vulnerabilities = [
        ...(targetCombatant.npc_data?.vulnerabilities || []),
        ...(targetCharObj?.raw_data?.vulnerabilidades || targetCharObj?.raw_data?.vulnerabilities || []),
        ...(targetCharObj?.computed_data?.vulnerabilidades || targetCharObj?.computed_data?.vulnerabilities || [])
      ].map((s: any) => String(s).toLowerCase().trim());

      for (const c of (targetCombatant.conditions || [])) {
        if (Array.isArray((c.effects as any)?.resistances)) {
          resistances.push(...(c.effects as any).resistances.map((s: any) => String(s).toLowerCase().trim()));
        }
        if (Array.isArray((c.effects as any)?.immunities)) {
          immunities.push(...(c.effects as any).immunities.map((s: any) => String(s).toLowerCase().trim()));
        }
        if (Array.isArray((c.effects as any)?.vulnerabilities)) {
          vulnerabilities.push(...(c.effects as any).vulnerabilities.map((s: any) => String(s).toLowerCase().trim()));
        }
      }

      let incomingMultiplier = 1;
      for (const c of (targetCombatant.conditions || [])) {
        if (c.effects?.incoming_damage_mod) {
          incomingMultiplier *= c.effects.incoming_damage_mod;
        }
      }

      const resolveElementalDamage = (dmgVal: number, element: string, applyDr: boolean = false) => {
        const el = element.toLowerCase().trim();
        let current = dmgVal;
        let note = '';

        if (applyDr) {
          current = Math.max(0, current - dr);
        }

        if (immunities.includes(el)) {
          current = 0;
          note = ` [Imunidade: 0 dano]`;
        } else if (resistances.includes(el)) {
          current = Math.floor(current / 2);
          note = ` [Resistência: -50%]`;
        } else if (vulnerabilities.includes(el)) {
          current = Math.floor(current * 2);
          note = ` [Vulnerabilidade: +100%]`;
        }

        if (incomingMultiplier !== 1) {
          current = Math.floor(current * incomingMultiplier);
          note += ` [Modificador de dano sofrido: x${incomingMultiplier}]`;
        }

        return { finalVal: current, note };
      };

      // A. Componente de Dano Principal
      const mainRes = resolveElementalDamage(rawDamage, dtype, true);
      finalDamage = mainRes.finalVal;
      defenseNote += mainRes.note;

      damageComponentsBreakdown.push({
        source: weaponName || data.ability_name || 'Dano Principal',
        damage_type: dtype,
        raw_damage: rawDamage,
        final_damage: mainRes.finalVal,
        activated: true,
        formula: damageFormula || null,
        notes: mainRes.note
      });

      // Se a arma base possui condições configuradas
      if (weaponProps.apply_conditions) {
        const arr = Array.isArray(weaponProps.apply_conditions) ? weaponProps.apply_conditions : [weaponProps.apply_conditions];
        for (const c of arr) {
          const obj = typeof c === 'string' ? { condition: c } : { ...c };
          if (obj.chance_percent === undefined && weaponProps.chance_percent !== undefined) {
            obj.chance_percent = weaponProps.chance_percent;
          }
          conditionCandidates.push({ ...obj, requires_hit: true });
        }
      }
      if (weaponProps.condition) {
        conditionCandidates.push({
          condition: weaponProps.condition,
          chance_percent: weaponProps.chance_percent,
          requires_hit: true
        });
      }
      if (weaponProps.conditions) {
        const arr = Array.isArray(weaponProps.conditions) ? weaponProps.conditions : [weaponProps.conditions];
        for (const c of arr) {
          conditionCandidates.push({ ...(typeof c === 'string' ? { condition: c } : c), requires_hit: true });
        }
      }

      // B. Componentes Adicionais de Dano da Arma
      if (weaponRow && Array.isArray(weaponProps.damage_components)) {
        for (const comp of (weaponProps.damage_components as DamageComponent[])) {
          let compActivated = true;
          let actRoll: number | null = null;
          const compChance = normalizeChancePercent(comp.chance_percent);
          if (compChance < 100) {
            const rollRes = evaluateChanceRoll(compChance);
            compActivated = rollRes.activated;
            actRoll = rollRes.roll;
          }

          if (compActivated) {
            let compRaw = 0;
            if (comp.formula && comp.formula.trim()) {
              try {
                const compRoll = this.rulesService.evaluateFormula(campaignId, comp.formula, vars);
                compRaw = Math.max(0, compRoll.total);
              } catch (err: any) {
                console.warn(`Erro na fórmula de dano adicional '${comp.formula}':`, err);
              }
            } else if (comp.percentage_damage !== undefined) {
              const targetHpBase = comp.percentage_damage_target === 'current_hp'
                ? (targetCombatant.current_hp || 0)
                : (targetCombatant.max_hp || targetCombatant.npc_data?.max_hp || 100);
              compRaw = Math.max(0, Math.floor(targetHpBase * (comp.percentage_damage / 100)));
            }

            const cType = (comp.damage_type || 'fisico').toLowerCase().trim();
            const compRes = resolveElementalDamage(compRaw, cType, false);
            finalDamage += compRes.finalVal;

            damageComponentsBreakdown.push({
              source: comp.name || `Dano Adicional (${cType})`,
              damage_type: cType,
              raw_damage: compRaw,
              final_damage: compRes.finalVal,
              activated: true,
              activation_roll: actRoll,
              chance_percent: compChance,
              formula: comp.formula || (comp.percentage_damage !== undefined ? `${comp.percentage_damage}% vida` : null),
              notes: compRes.note
            });

            if (comp.condition) {
              conditionCandidates.push({
                condition: comp.condition,
                chance_percent: 100,
                damage_type: cType,
                requires_hit: true,
                requires_damage: true
              });
            }
            if (comp.apply_conditions) {
              const cList = Array.isArray(comp.apply_conditions) ? comp.apply_conditions : [comp.apply_conditions];
              for (const c of cList) {
                conditionCandidates.push({
                  ...(typeof c === 'string' ? { condition: c } : c),
                  chance_percent: 100,
                  damage_type: cType,
                  requires_hit: true,
                  requires_damage: true
                });
              }
            }
          } else {
            damageComponentsBreakdown.push({
              source: comp.name || `Dano Adicional (${comp.damage_type})`,
              damage_type: comp.damage_type,
              raw_damage: 0,
              final_damage: 0,
              activated: false,
              activation_roll: actRoll,
              chance_percent: compChance,
              notes: ' [Não ativou (chance percentual)]'
            });

            if (comp.condition) {
              failedChanceConditions.push({
                condition_name: comp.condition,
                chance_percent: compChance,
                activation_roll: actRoll
              });
            }
          }
        }
      }

      // C. Efeitos Imbuídos Ativos na Arma
      if (weaponRow && Array.isArray(weaponProps.imbued_effects) && weaponProps.imbued_effects.length > 0) {
        const remainingEffects: ActiveImbuedEffect[] = [];

        for (const eff of (weaponProps.imbued_effects as ActiveImbuedEffect[])) {
          let effActivated = true;
          let actRoll: number | null = null;
          const effChance = normalizeChancePercent(eff.chance_percent);
          if (effChance < 100) {
            const rollRes = evaluateChanceRoll(effChance);
            effActivated = rollRes.activated;
            actRoll = rollRes.roll;
          }

          if (effActivated) {
            let effRaw = 0;
            if (eff.damage_formula && eff.damage_formula.trim()) {
              try {
                const effRoll = this.rulesService.evaluateFormula(campaignId, eff.damage_formula, vars);
                effRaw = Math.max(0, effRoll.total);
              } catch (err: any) {
                console.warn(`Erro na fórmula de dano imbuído '${eff.damage_formula}':`, err);
              }
            } else if (eff.percentage_damage !== undefined) {
              const targetHpBase = eff.percentage_damage_target === 'current_hp'
                ? (targetCombatant.current_hp || 0)
                : (targetCombatant.max_hp || targetCombatant.npc_data?.max_hp || 100);
              effRaw = Math.max(0, Math.floor(targetHpBase * (eff.percentage_damage / 100)));
            }

            const eType = (eff.damage_type || 'magico').toLowerCase().trim();
            const effRes = resolveElementalDamage(effRaw, eType, false);
            finalDamage += effRes.finalVal;

            damageComponentsBreakdown.push({
              source: `Imbuído: ${eff.source_item_name}`,
              damage_type: eType,
              raw_damage: effRaw,
              final_damage: effRes.finalVal,
              activated: true,
              activation_roll: actRoll,
              chance_percent: effChance,
              formula: eff.damage_formula || (eff.percentage_damage !== undefined ? `${eff.percentage_damage}% vida` : null),
              notes: effRes.note
            });

            if ((eff as any).condition) {
              conditionCandidates.push({
                condition: (eff as any).condition,
                chance_percent: 100,
                damage_type: eType,
                requires_hit: true
              });
            }
            if (eff.apply_conditions) {
              const cList = Array.isArray(eff.apply_conditions) ? eff.apply_conditions : [eff.apply_conditions];
              for (const c of cList) {
                conditionCandidates.push({
                  ...(typeof c === 'string' ? { condition: c } : c),
                  chance_percent: 100,
                  damage_type: eType,
                  requires_hit: true
                });
              }
            }
          } else {
            damageComponentsBreakdown.push({
              source: `Imbuído: ${eff.source_item_name}`,
              damage_type: eff.damage_type,
              raw_damage: 0,
              final_damage: 0,
              activated: false,
              activation_roll: actRoll,
              chance_percent: effChance,
              notes: ' [Não ativou (chance percentual)]'
            });

            if ((eff as any).condition) {
              failedChanceConditions.push({
                condition_name: (eff as any).condition,
                chance_percent: effChance,
                activation_roll: actRoll
              });
            }
          }

          // Consumo de cargas em acertos ('hits') ou ataques ('attacks')
          if (eff.duration_type === 'hits' || eff.duration_type === 'attacks') {
            const nextCharges = (eff.charges_remaining ?? 1) - 1;
            weaponNeedsDbUpdate = true;
            if (nextCharges > 0) {
              remainingEffects.push({ ...eff, charges_remaining: nextCharges });
            } else {
              expiredImbueNotes.push(`Encantamento de ${eff.source_item_name} na arma "${weaponRow.item_name}" expirou (cargas esgotadas).`);
            }
          } else {
            remainingEffects.push(eff);
          }
        }

        weaponProps.imbued_effects = remainingEffects;
      }
    }

    let delta = 0;
    if (!hit) {
      delta = 0;
    } else if (data.action_type === 'heal') {
      delta = rawDamage;
    } else if (data.action_type === 'resource_mod') {
      delta = data.amount ?? rawDamage;
    } else {
      delta = -finalDamage; // Ataque ou dano
    }

    // Calcular novo HP resultante do alvo
    let newCurrentHp = targetCombatant.current_hp;
    if (newCurrentHp !== null && delta !== 0) {
      newCurrentHp += delta;
      if (data.action_type === 'heal' && targetCombatant.max_hp !== null) {
        newCurrentHp = Math.min(newCurrentHp, targetCombatant.max_hp);
      }
      if (newCurrentHp < 0) newCurrentHp = 0;
    }

    // 7. Persistência Transacional e Atômica no Banco de Dados
    const actionLabel = weaponName || data.ability_name || (data.action_type === 'heal' ? 'Cura' : 'Ação');
    let detailMsg = '';
    if (!hit) {
      detailMsg = `${data.actor_name} usou ${actionLabel} contra ${targetCombatant.name}: Rolou ${attackRoll?.total} contra Defesa ${targetDefense} (ERROU!)${defenseBonusNote}`;
    } else if (data.action_type === 'heal') {
      detailMsg = `${data.actor_name} curou ${rawDamage} PV de ${targetCombatant.name}`;
    } else if (data.action_type === 'resource_mod') {
      detailMsg = `${data.actor_name} modificou recurso de ${targetCombatant.name}`;
    } else {
      detailMsg = `${data.actor_name} acertou e causou ${finalDamage} de dano em ${targetCombatant.name}`;
      if (attackRoll) {
        detailMsg += ` [Atq: ${attackRoll.total} vs Def: ${targetDefense}${defenseBonusNote}]`;
      }
      if (damageComponentsBreakdown.length > 1) {
        const partsSummary = damageComponentsBreakdown.map(b => {
          if (!b.activated) return `${b.source}: não ativou (${b.chance_percent}% chance)`;
          return `${b.source}: ${b.final_damage} (${b.damage_type}${b.notes || ''})`;
        }).join(' + ');
        detailMsg += ` [${partsSummary}]`;
      } else {
        detailMsg += ` [Dano: ${rawDamage} (${dtype}) - RD: ${dr} = ${finalDamage}${defenseNote}]`;
      }
    }

    this.db.exec('BEGIN TRANSACTION;');
    try {
      // A. Consumo de recursos do atacante (se for habilidade)
      if (resourceUpdate) {
        this.db.prepare(`
          UPDATE characters 
          SET raw_data_json = ?, updated_at = datetime('now')
          WHERE campaign_id = ? AND id = ?
        `).run(JSON.stringify(resourceUpdate.raw), campaignId, actorChar.id);
        this.characterService.recomputeCharacter(campaignId, actorChar.id);
      }

      // A.1 Consumo do item consumível do inventário (se for modo consumível)
      if (data.action_mode === 'consumable' && consumableRow) {
        if (consumableProps.cargas_max !== undefined && Number(consumableProps.cargas_atual ?? consumableProps.cargas_max) > 1) {
          consumableProps.cargas_atual = Number(consumableProps.cargas_atual ?? consumableProps.cargas_max) - 1;
          this.db.prepare(`UPDATE character_inventory SET properties_json = ? WHERE id = ?`)
            .run(JSON.stringify(consumableProps), consumableRow.id);
          consumedItemRecord = { ...consumableRow, properties: consumableProps };
        } else {
          const remainingQty = consumableRow.quantity - 1;
          if (remainingQty <= 0) {
            this.db.prepare(`DELETE FROM character_inventory WHERE id = ?`).run(consumableRow.id);
            consumedItemRecord = { ...consumableRow, quantity: 0 };
          } else {
            this.db.prepare(`UPDATE character_inventory SET quantity = ? WHERE id = ?`).run(remainingQty, consumableRow.id);
            consumedItemRecord = { ...consumableRow, quantity: remainingQty };
          }
        }
      }

      // B. Atualização de HP no Combatente Alvo (se houve acerto e delta de vida)
      if (hit && newCurrentHp !== null && delta !== 0) {
        this.db.prepare(`
          UPDATE combatants SET current_hp = ? WHERE campaign_id = ? AND id = ?
        `).run(newCurrentHp, campaignId, targetCombatant.id);

        // C. Sincronização com Token no Mapa
        if (targetCombatant.token_id) {
          this.db.prepare(`
            UPDATE tokens SET current_hp = ? WHERE campaign_id = ? AND id = ?
          `).run(newCurrentHp, campaignId, targetCombatant.token_id);
        }
      }

      // D. Sincronização com Ficha do Personagem Alvo
      let updatedCharacter: any = null;
      if (hit && targetCombatant.character_id && delta !== 0) {
        const char = this.characterService.getCharacterById(campaignId, targetCombatant.character_id);
        if (char) {
          const resKey = data.resource_name?.toLowerCase() || 'vida';
          const raw = { ...char.raw_data };

          let actualKey = '';
          if (raw[`${resKey}_atual`] !== undefined) {
            actualKey = `${resKey}_atual`;
          } else if (raw[resKey] !== undefined) {
            actualKey = resKey;
          } else if (resKey === 'vida' && raw.pv_atual !== undefined) {
            actualKey = 'pv_atual';
          } else if (resKey === 'vida' && raw.pv !== undefined) {
            actualKey = 'pv';
          } else {
            actualKey = resKey;
          }

          const currentVal = typeof raw[actualKey] === 'number' ? raw[actualKey] : (newCurrentHp || 0);
          let updatedVal = currentVal + delta;
          if (updatedVal < 0) updatedVal = 0;

          raw[actualKey] = updatedVal;
          this.db.prepare(`
            UPDATE characters 
            SET raw_data_json = ?, updated_at = datetime('now')
            WHERE campaign_id = ? AND id = ?
          `).run(JSON.stringify(raw), campaignId, targetCombatant.character_id);
          updatedCharacter = this.characterService.recomputeCharacter(campaignId, targetCombatant.character_id);
        }
      }

      // H. Aplicação de condições no alvo (reutilizando serviço compartilhado e testando todos os requisitos)
      const conditionResults: ConditionApplicationResult[] = [];
      const isAttack = data.action_type === 'attack' || !!attackFormula || data.action_mode === 'weapon';

      // Adiciona condições que falharam diretamente no teste probabilístico do componente de arma
      for (const fc of failedChanceConditions) {
        conditionResults.push({
          condition_name: fc.condition_name,
          status: 'chance_failed',
          chance_percent: fc.chance_percent,
          activation_roll: fc.activation_roll,
          message: `A condição "${fc.condition_name}" não ativou (rolou ${fc.activation_roll} contra chance de ${fc.chance_percent}%).`
        });
      }

      for (const cand of conditionCandidates) {
        const res = this.applyConditionWithRequirements(
          campaignId,
          encounterId,
          targetCombatant,
          cand,
          {
            isAttack,
            hit,
            finalDamage,
            actorName: actorCombatant.name
          }
        );
        conditionResults.push(res);
      }

      // I. Remoção de condições no alvo (se especificado na ação/habilidade/item)
      if (hit && conditionsToRemoveFromTarget.length > 0) {
        for (const condItem of conditionsToRemoveFromTarget) {
          const removed = this.removeConditionFromCombatant(campaignId, encounterId, targetCombatant.id, condItem, actorCombatant.name, false);
          if (removed) {
            conditionResults.push({
              condition_name: condItem,
              status: 'applied',
              message: `A condição "${condItem}" foi removida de ${targetCombatant.name}.`
            });
          }
        }
      }

      // Anexa notas de condições no detalhe do log
      for (const cr of conditionResults) {
        if (cr.status === 'applied') {
          detailMsg += ` [Condição aplicada: ${cr.condition_name}]`;
        } else if (cr.status === 'immune') {
          detailMsg += ` [${targetCombatant.name} resistiu a "${cr.condition_name}" por imunidade]`;
        } else if (cr.status === 'chance_failed') {
          detailMsg += ` [Condição "${cr.condition_name}" não ativou (${cr.activation_roll} vs ${cr.chance_percent}%)]`;
        } else if (cr.status === 'missed_attack') {
          detailMsg += ` [Condição "${cr.condition_name}" não aplicada (ataque errou)]`;
        } else if (cr.status === 'damage_zero') {
          detailMsg += ` [Condição "${cr.condition_name}" não aplicada (0 dano)]`;
        }
      }

      // E. Registro do Log de Combate
      const log = this.logCombatAction(campaignId, encounterId, {
        actor_id: data.actor_id || null,
        actor_name: data.actor_name,
        target_id: targetCombatant.id,
        target_name: targetCombatant.name,
        action_type: data.action_type || 'attack',
        resource_name: data.resource_name || 'vida',
        amount: data.action_type === 'heal' ? rawDamage : finalDamage,
        details: {
          action_label: actionLabel,
          weapon_name: weaponName || null,
          ability_name: data.ability_name || null,
          formula: damageFormula || null,
          breakdown: damageRoll?.breakdown || null,
          attack_roll: attackRoll ? {
            total: attackRoll.total,
            breakdown: attackRoll.breakdown,
            expression: attackFormula
          } : null,
          target_defense: targetDefense,
          hit,
          raw_damage: rawDamage,
          damage_reduction: dr,
          damage_type: dtype,
          final_damage: finalDamage,
          damage_components_breakdown: damageComponentsBreakdown,
          delta,
          resulting_hp: newCurrentHp,
          notes: data.notes || '',
          condition_results: conditionResults,
          message: detailMsg
        }
      });

      // E.1 Atualização de Encantamentos e Cargas da Arma no Inventário
      if (weaponNeedsDbUpdate && weaponRow) {
        this.db.prepare(`
          UPDATE character_inventory SET properties_json = ? WHERE id = ?
        `).run(JSON.stringify(weaponProps), weaponRow.id);
      }

      // E.2 Registro de Expiração de Encantamentos Imbuídos
      for (const expNote of expiredImbueNotes) {
        this.logCombatAction(campaignId, encounterId, {
          actor_name: actorCombatant.name,
          target_id: targetCombatant.id,
          target_name: targetCombatant.name,
          action_type: 'condition_expired',
          details: { message: expNote }
        });
      }

      // F. Incrementar ações utilizadas pelo atacante (apenas se combate estiver ativo)
      if (actorCombatant && encounter.status === 'active') {
        const newActionsUsed = {
          ...actorCombatant.actions_used,
          [actionCostType]: (actorCombatant.actions_used[actionCostType] || 0) + 1
        };
        this.db.prepare(`
          UPDATE combatants SET actions_used_json = ? WHERE campaign_id = ? AND id = ?
        `).run(JSON.stringify(newActionsUsed), campaignId, actorCombatant.id);
      }

      // G. Decrementar condições com duração baseada em ações do atacante
      if (actorCombatant) {
        let conditionsUpdated = false;
        const newActorConditions: ActiveCondition[] = [];
        for (const cond of (actorCombatant.conditions || [])) {
          if (cond.duration_type === 'actions') {
            const nextDur = cond.duration_remaining - 1;
            conditionsUpdated = true;
            if (nextDur > 0) {
              newActorConditions.push({ ...cond, duration_remaining: nextDur });
            } else {
              this.logCombatAction(campaignId, encounterId, {
                actor_name: actorCombatant.name,
                target_id: actorCombatant.id,
                target_name: actorCombatant.name,
                action_type: 'condition_expired',
                details: {
                  message: `A condição "${cond.name}" de ${actorCombatant.name} expirou após realizar a ação.`,
                  condition_id: cond.condition_id,
                  condition_name: cond.name
                }
              });
              if (actorCombatant.character_id) {
                try {
                  this.characterService.removeCondition(campaignId, actorCombatant.character_id, cond.id);
                } catch {}
              }
            }
          } else {
            newActorConditions.push(cond);
          }
        }

        if (conditionsUpdated) {
          const isActorStillIncapacitated = newActorConditions.some(c => c.effects?.incapacitated) || (actorCombatant.current_hp !== null && actorCombatant.current_hp <= 0);
          this.db.prepare(`UPDATE combatants SET conditions_json = ?, is_incapacitated = ? WHERE campaign_id = ? AND id = ?`)
            .run(JSON.stringify(newActorConditions), isActorStillIncapacitated ? 1 : 0, campaignId, actorCombatant.id);

          if (actorCombatant.character_id) {
            this.db.prepare(`UPDATE characters SET conditions_json = ?, updated_at = datetime('now') WHERE campaign_id = ? AND id = ?`)
              .run(JSON.stringify(newActorConditions), campaignId, actorCombatant.character_id);
          }
        }
      }

      this.db.exec('COMMIT;');

      const result = {
        actionLog: log,
        targetCombatant: this.getCombatantById(campaignId, targetCombatant.id)!,
        actorCombatant: this.getCombatantById(campaignId, actorCombatant.id)!,
        updatedCharacter,
        updatedTargetCharacter: targetCombatant.character_id ? this.characterService.getCharacterById(campaignId, targetCombatant.character_id) : undefined,
        attackRoll,
        damageRoll,
        hit,
        finalDamage,
        consumedItem: consumedItemRecord,
        appliedConditions: conditionResults
      };

      if (data.idempotency_key) {
        this.actionCache.set(data.idempotency_key, { result, timestamp: Date.now() });
      }

      return result;
    } catch (dbErr) {
      this.db.exec('ROLLBACK;');
      throw dbErr;
    }
  }

  getCombatLogs(campaignId: string, encounterId: string, isMaster: boolean = true): CombatLog[] {
    const rows = this.db.prepare(`
      SELECT * FROM combat_logs 
      WHERE campaign_id = ? AND encounter_id = ? 
      ORDER BY created_at ASC
    `).all(campaignId, encounterId) as any[];

    return rows.map(r => this.mapLog(r, isMaster));
  }

  private logCombatAction(campaignId: string, encounterId: string, data: {
    actor_id?: string | null;
    actor_name: string;
    target_id?: string | null;
    target_name?: string | null;
    action_type: CombatLog['action_type'];
    resource_name?: string | null;
    amount?: number | null;
    details?: Record<string, any>;
  }): CombatLog {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO combat_logs (
        id, encounter_id, campaign_id, actor_id, actor_name,
        target_id, target_name, action_type, resource_name, amount,
        details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      encounterId,
      campaignId,
      data.actor_id || null,
      data.actor_name,
      data.target_id || null,
      data.target_name || null,
      data.action_type,
      data.resource_name || null,
      data.amount ?? null,
      JSON.stringify(data.details || {}),
      now
    );

    return {
      id,
      encounter_id: encounterId,
      campaign_id: campaignId,
      actor_id: data.actor_id || null,
      actor_name: data.actor_name,
      target_id: data.target_id || null,
      target_name: data.target_name || null,
      action_type: data.action_type,
      resource_name: data.resource_name || null,
      amount: data.amount ?? null,
      details: data.details || {},
      created_at: now
    };
  }

  private mapEncounter(row: any, isMaster: boolean = true): CombatEncounter {
    let data = {};
    try {
      data = JSON.parse(row.data_json || '{}');
    } catch {
      data = {};
    }

    let plannedCreatures: any[] = [];
    try {
      plannedCreatures = JSON.parse(row.planned_creatures_json || '[]');
    } catch {}

    const notes = isMaster ? (row.notes || '') : '';

    return {
      id: row.id,
      campaign_id: row.campaign_id,
      scene_id: row.scene_id,
      name: row.name || 'Combate',
      status: row.status,
      round: row.round,
      turn_index: row.turn_index,
      turn_timer_seconds: row.turn_timer_seconds,
      turn_started_at: row.turn_started_at,
      notes,
      planned_creatures: isMaster ? plannedCreatures : [],
      data,
      created_at: row.created_at
    };
  }

  private mapCombatant(row: any, isMaster: boolean = true): Combatant {
    let rawConditions: any[] = [];
    try {
      rawConditions = JSON.parse(row.conditions_json || '[]');
    } catch {
      rawConditions = [];
    }

    let conditions: ActiveCondition[] = rawConditions.map((item: any) => {
      if (typeof item === 'string') {
        return {
          id: item,
          condition_id: item,
          name: item,
          duration_type: 'permanent',
          duration_remaining: 1,
          tick_timing: 'turn_start'
        };
      }
      return item;
    });

    // Se jogador comum, esconde condições secretas (is_visible_to_players === false)
    if (!isMaster) {
      conditions = conditions.filter(c => c.is_visible_to_players !== false && (c as any).visibility !== 'secret');
    }

    let npcData: Record<string, any> = {};
    try {
      npcData = JSON.parse(row.npc_data_json || '{}');
    } catch {
      npcData = {};
    }

    let actionsUsed: ActionsUsed = { main: 0, bonus: 0, reaction: 0, free: 0 };
    try {
      if (row.actions_used_json) {
        actionsUsed = { ...actionsUsed, ...JSON.parse(row.actions_used_json) };
      }
    } catch {}

    let defensiveState: DefensiveState = {};
    try {
      if (row.defensive_state_json) {
        defensiveState = JSON.parse(row.defensive_state_json);
      }
    } catch {}

    const curHp = row.current_hp !== null ? Number(row.current_hp) : null;
    const maxHp = row.max_hp !== null ? Number(row.max_hp) : null;
    const hasIncapacitatingCond = conditions.some(c => c.effects?.incapacitated);
    const isIncapacitated = row.is_incapacitated === 1 || (curHp !== null && curHp <= 0) || hasIncapacitatingCond;

    let finalName = row.name;
    let finalCurHp = curHp;
    let finalMaxHp = maxHp;
    let hpPercent: number | null = null;
    let hpStatus: 'healthy' | 'injured' | 'bloodied' | 'critical' | 'defeated' | null = null;

    if (maxHp && maxHp > 0 && curHp !== null) {
      hpPercent = Math.max(0, Math.min(100, Math.round((curHp / maxHp) * 100)));
      if (curHp <= 0) hpStatus = 'defeated';
      else if (hpPercent <= 25) hpStatus = 'critical';
      else if (hpPercent <= 50) hpStatus = 'bloodied';
      else if (hpPercent <= 75) hpStatus = 'injured';
      else hpStatus = 'healthy';
    }

    // Se for jogador comum (não mestre) inspecionando NPC:
    if (!isMaster && row.is_npc === 1) {
      const revealed = npcData.revealed_fields || {};

      // 1. Identidade desconhecida / nome mascarado
      if (!revealed.name && npcData.display_name_players) {
        finalName = npcData.display_name_players;
      }
      // 2. Ocultação de vida exata
      if (!revealed.exact_hp || npcData.hide_exact_hp === true) {
        finalCurHp = null;
        finalMaxHp = null;
      }
      // 3. Sanitização de defesas
      let sanitizedDefense = (row.defense !== undefined && row.defense !== null) ? Number(row.defense) : (npcData.defense ?? 10);
      let sanitizedDr = (row.damage_reduction !== undefined && row.damage_reduction !== null) ? Number(row.damage_reduction) : (npcData.damage_reduction ?? 0);
      if (!revealed.defenses || npcData.hide_stats === true) {
        sanitizedDefense = 0;
        sanitizedDr = 0;
      }
      // 4. Ocultação de fórmulas
      let sanitizedInitFormula = row.initiative_formula || '1d20';
      if (!revealed.formulas) {
        sanitizedInitFormula = '---';
      }

      // 5. Sanitização centralizada de atributos secretos, notas privadas e detalhes não revelados
      const sanitizedNpcData = sanitizeNpcDataForPlayer(npcData, revealed);

      return {
        id: row.id,
        encounter_id: row.encounter_id,
        campaign_id: row.campaign_id,
        character_id: row.character_id,
        token_id: row.token_id,
        source_creature_id: row.source_creature_id || null,
        name: finalName,
        avatar_url: row.avatar_url,
        initiative: Number(row.initiative),
        initiative_formula: sanitizedInitFormula,
        is_npc: true,
        is_hidden: row.is_hidden === 1,
        sort_order: Number(row.sort_order),
        current_hp: finalCurHp,
        max_hp: finalMaxHp,
        hp_percent: hpPercent,
        hp_status: hpStatus,
        conditions,
        defense: sanitizedDefense,
        damage_reduction: sanitizedDr,
        npc_data: sanitizedNpcData,
        actions_used: actionsUsed,
        defensive_state: defensiveState,
        tie_breaker: Number(row.tie_breaker || 0),
        is_incapacitated: isIncapacitated,
        created_at: row.created_at,
        owner_user_id: row.character_owner_id || null
      };
    }

    return {
      id: row.id,
      encounter_id: row.encounter_id,
      campaign_id: row.campaign_id,
      character_id: row.character_id,
      token_id: row.token_id,
      source_creature_id: row.source_creature_id || null,
      name: finalName,
      avatar_url: row.avatar_url,
      initiative: Number(row.initiative),
      initiative_formula: row.initiative_formula || '1d20',
      is_npc: row.is_npc === 1,
      is_hidden: row.is_hidden === 1,
      sort_order: Number(row.sort_order),
      current_hp: finalCurHp,
      max_hp: finalMaxHp,
      hp_percent: hpPercent,
      hp_status: hpStatus,
      conditions,
      defense: row.defense !== undefined && row.defense !== null ? Number(row.defense) : (npcData.defense ?? 10),
      damage_reduction: row.damage_reduction !== undefined && row.damage_reduction !== null ? Number(row.damage_reduction) : (npcData.damage_reduction ?? 0),
      npc_data: npcData,
      actions_used: actionsUsed,
      defensive_state: defensiveState,
      tie_breaker: Number(row.tie_breaker || 0),
      is_incapacitated: isIncapacitated,
      created_at: row.created_at,
      owner_user_id: row.character_owner_id || null
    };
  }

  mapLog(row: any, isMaster: boolean = true): CombatLog {
    let details: any = {};
    try {
      details = JSON.parse(row.details_json || '{}');
    } catch {
      details = {};
    }

    let actorName = row.actor_name;
    let targetName = row.target_name;

    if (!isMaster) {
      // Sanitização de fórmulas de ataque e dados secretos para jogadores
      if (details.attack_roll) {
        const sanitizedAttack = { ...details.attack_roll };
        delete sanitizedAttack.expression;
        delete sanitizedAttack.rolls;
        details.attack_roll = sanitizedAttack;
      }
      if (details.damage_roll) {
        const sanitizedDmg = { ...details.damage_roll };
        delete sanitizedDmg.expression;
        delete sanitizedDmg.rolls;
        details.damage_roll = sanitizedDmg;
      }
      if (details.formula) {
        delete details.formula;
      }
      if (details.attack_formula) {
        delete details.attack_formula;
      }
      if (details.dodge_roll) {
        const sanitizedDodge = { ...details.dodge_roll };
        delete sanitizedDodge.expression;
        delete sanitizedDodge.rolls;
        details.dodge_roll = sanitizedDodge;
      }

      // Se houver combate associado, checa se ator ou alvo é NPC com display_name_players
      if (row.actor_id) {
        try {
          const actCombatant = this.db.prepare(`SELECT is_npc, npc_data_json FROM combatants WHERE id = ?`).get(row.actor_id) as any;
          if (actCombatant && actCombatant.is_npc === 1 && actCombatant.npc_data_json) {
            const nd = JSON.parse(actCombatant.npc_data_json);
            if (!nd.revealed_fields?.name && nd.display_name_players) {
              const realName = actorName;
              actorName = nd.display_name_players;
              if (details.message && typeof details.message === 'string') {
                details.message = details.message.split(realName).join(actorName);
              }
            }
            if (!nd.revealed_fields?.formulas) {
              if (details.attack_roll) {
                delete details.attack_roll.expression;
                delete details.attack_roll.rolls;
              }
              if (details.damage_roll) {
                delete details.damage_roll.expression;
                delete details.damage_roll.rolls;
              }
              delete details.formula;
              delete details.attack_formula;
              if (Array.isArray(details.componentsBreakdown)) {
                details.componentsBreakdown = details.componentsBreakdown.map((cb: any) => ({
                  damage_type: cb.damage_type,
                  amount: cb.amount
                }));
              }
            }
          }
        } catch {}
      }

      if (row.target_id) {
        try {
          const tgtCombatant = this.db.prepare(`SELECT is_npc, npc_data_json FROM combatants WHERE id = ?`).get(row.target_id) as any;
          if (tgtCombatant && tgtCombatant.is_npc === 1 && tgtCombatant.npc_data_json) {
            const nd = JSON.parse(tgtCombatant.npc_data_json);
            if (!nd.revealed_fields?.name && nd.display_name_players) {
              const realName = targetName;
              targetName = nd.display_name_players;
              if (details.message && typeof details.message === 'string') {
                details.message = details.message.split(realName).join(targetName);
              }
            }
            if (!nd.revealed_fields?.defenses) {
              delete details.target_defense;
              delete details.damage_reduction;
              delete details.target_rd;
            }
          }
        } catch {}
      }
    }

    return {
      id: row.id,
      encounter_id: row.encounter_id,
      campaign_id: row.campaign_id,
      actor_id: row.actor_id,
      actor_name: actorName,
      target_id: row.target_id,
      target_name: targetName,
      action_type: row.action_type,
      resource_name: row.resource_name,
      amount: row.amount !== null ? Number(row.amount) : null,
      details,
      created_at: row.created_at
    };
  }
}
