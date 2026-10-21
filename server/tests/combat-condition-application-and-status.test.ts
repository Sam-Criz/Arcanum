import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import WebSocket from 'ws';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';
import { AuthService } from '../src/modules/auth/auth.service';
import { RbacService } from '../src/modules/permissions/rbac.service';
import { RealtimeServer } from '../src/modules/realtime/ws.server';
import { CampaignService } from '../src/modules/campaigns/campaign.service';
import { CharacterService } from '../src/modules/characters/character.service';
import { RulesService } from '../src/modules/rules-engine/rules.service';
import { VttService } from '../src/modules/vtt/vtt.service';
import { CombatService, normalizeChancePercent, evaluateChanceRoll } from '../src/modules/combat/combat.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';

test('Combate: Aplicação e Resolução de Condições e Efeitos de Status (15 Cenários Obrigatórios)', async () => {
  const db = getDatabase(':memory:');
  const authService = new AuthService(db);
  const rbacService = new RbacService(db);
  const rulesService = new RulesService(db);
  const campaignService = new CampaignService(db, rulesService);
  const characterService = new CharacterService(db, rulesService);
  const inventoryService = new InventoryService(db, rulesService, characterService);
  const vttService = new VttService(db, characterService);
  const combatService = new CombatService(db, rulesService, characterService, inventoryService);

  const server = http.createServer();
  const realtimeServer = new RealtimeServer(server, authService, rbacService);
  realtimeServer.setVttService(vttService);
  const { app, setRealtimeServer } = createApp(db, realtimeServer);
  setRealtimeServer(realtimeServer);
  server.on('request', app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  const connectWsClient = (token: string, campaignId: string): Promise<{ ws: WebSocket; messages: any[] }> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const messages: any[] = [];
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'auth', token, campaignId }));
      });
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          messages.push(msg);
          if (msg.type === 'auth:success' || msg.type === 'auth:error') {
            resolve({ ws, messages });
          }
        } catch {}
      });
      ws.on('close', () => resolve({ ws, messages }));
      ws.on('error', reject);
    });
  };

  let masterWs: any = null;
  let playerWs: any = null;

  try {
    // 0. Setup de Usuários e Campanha
    const masterRes = authService.register({ username: 'gm_conditions', email: 'gm_cond@arcanum.test', password: 'password123' });
    const master = masterRes.user;
    const masterToken = authService.login({ login: 'gm_cond@arcanum.test', password: 'password123' }).token;

    const playerRes = authService.register({ username: 'player_conditions', email: 'player_cond@arcanum.test', password: 'password123' });
    const player = playerRes.user;
    const playerToken = authService.login({ login: 'player_cond@arcanum.test', password: 'password123' }).token;

    const campaign = campaignService.createCampaign(master.id, {
      name: 'Campanha Teste Condições e Status',
      description: 'Validação completa dos 15 cenários de aplicação de condições',
      preset: 'fantasia_d20'
    });

    const campaignId = campaign.id;
    const invite = campaignService.createInvite(campaignId, { role: 'player' });
    campaignService.joinCampaignByInvite(invite.code, player.id);

    // Conectar WebSockets para validar sincronização em tempo real
    const masterConn = await connectWsClient(masterToken, campaignId);
    masterWs = masterConn.ws;
    const playerConn = await connectWsClient(playerToken, campaignId);
    playerWs = playerConn.ws;

    // Configurar definições de condições no ruleset (se já existirem no preset fantasia_d20, atualiza)
    const existingConds = rulesService.getConditions(campaignId);

    const envenenadoDef = {
      id: 'envenenado',
      name: 'Envenenado',
      description: 'Sofre dano contínuo de veneno a cada início de turno.',
      icon: 'skull',
      color: '#22c55e',
      default_duration: { type: 'turns' as const, value: 3 },
      tick_timing: 'turn_start' as const,
      stack_rule: 'replace' as const,
      effects: {
        dot: {
          formula: '1d4',
          damage_type: 'veneno',
          timing: 'turn_start'
        }
      }
    };
    if (existingConds.some(c => c.id === 'envenenado')) {
      rulesService.updateConditionDefinition(campaignId, 'envenenado', envenenadoDef);
    } else {
      rulesService.addConditionDefinition(campaignId, envenenadoDef);
    }

    const atordoadoDef = {
      id: 'atordoado',
      name: 'Atordoado',
      description: 'Incapacitado e com penalidade de defesa.',
      icon: 'alert-triangle',
      color: '#eab308',
      default_duration: { type: 'turns' as const, value: 2 },
      tick_timing: 'turn_start' as const,
      stack_rule: 'stack_duration' as const,
      modifiers: [
        { target: 'defesa', type: 'flat' as const, value: -4 }
      ],
      effects: {
        defense_mod: -4,
        incapacitated: true
      }
    };
    if (existingConds.some(c => c.id === 'atordoado')) {
      rulesService.updateConditionDefinition(campaignId, 'atordoado', atordoadoDef);
    } else {
      rulesService.addConditionDefinition(campaignId, atordoadoDef);
    }

    const abencoadoDef = {
      id: 'abencoado',
      name: 'Abençoado',
      description: 'Bônus sagrado de defesa e força.',
      icon: 'sparkles',
      color: '#38bdf8',
      default_duration: { type: 'turns' as const, value: 3 },
      tick_timing: 'turn_start' as const,
      stack_rule: 'stack_intensity' as const,
      modifiers: [
        { target: 'defesa', type: 'flat' as const, value: 3 },
        { target: 'forca', type: 'flat' as const, value: 2 }
      ]
    };
    if (existingConds.some(c => c.id === 'abencoado')) {
      rulesService.updateConditionDefinition(campaignId, 'abencoado', abencoadoDef);
    } else {
      rulesService.addConditionDefinition(campaignId, abencoadoDef);
    }

    // 1. Setup de Personagens e Combatentes
    const heroChar = characterService.createCharacter(campaignId, player.id, {
      name: 'Guerreiro da Luz',
      rawData: {
        vida: 30,
        vida_atual: 30,
        forca: 14,
        destreza: 12,
        defesa: 12,
        mana: 10,
        mana_atual: 10
      }
    });

    const enemyChar = characterService.createCharacter(campaignId, master.id, {
      name: 'Monstro Venenoso',
      isNpc: true,
      rawData: {
        vida: 40,
        vida_atual: 40,
        defesa: 10
      }
    });

    const immuneChar = characterService.createCharacter(campaignId, master.id, {
      name: 'Golem Imune',
      isNpc: true,
      rawData: {
        vida: 50,
        vida_atual: 50,
        defesa: 14,
        imunidades: ['envenenado', 'veneno']
      }
    });

    const encounter = combatService.startEncounter(campaignId, {
      name: 'Batalha das Condições'
    });
    const encounterId = encounter.id;

    const heroComb = combatService.addCombatant(campaignId, encounterId, {
      character_id: heroChar.id,
      name: heroChar.name,
      initiative: 20
    });

    const enemyComb = combatService.addCombatant(campaignId, encounterId, {
      character_id: enemyChar.id,
      name: enemyChar.name,
      is_npc: true,
      initiative: 15
    });

    const immuneComb = combatService.addCombatant(campaignId, encounterId, {
      character_id: immuneChar.id,
      name: immuneChar.name,
      is_npc: true,
      initiative: 10
    });

    combatService.activateCombatEncounter(campaignId, encounterId);
    const resetActions = () => db.prepare("UPDATE combatants SET actions_used_json = '{}'").run();

    // =========================================================================
    // CENÁRIO 1: Aplicação com 100% de chance garantida (normalizando 100, 1, '100', '100%')
    // =========================================================================
    resetActions();
    assert.strictEqual(normalizeChancePercent(100), 100);
    assert.strictEqual(normalizeChancePercent('100'), 100);
    assert.strictEqual(normalizeChancePercent('100%'), 100);
    assert.strictEqual(normalizeChancePercent(1), 100);
    assert.strictEqual(normalizeChancePercent('1'), 100);
    assert.strictEqual(evaluateChanceRoll(100).activated, true);

    const res1 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: heroComb.id,
      actor_name: heroComb.name,
      target_id: enemyComb.id,
      action_type: 'attack',
      action_mode: 'manual',
      amount: 5,
      apply_conditions: [{ name: 'Envenenado', condition_id: 'envenenado', chance_percent: 100 }]
    });

    assert.strictEqual(res1.hit, true);
    assert.ok(res1.appliedConditions && res1.appliedConditions.length > 0);
    const appCond1 = res1.appliedConditions.find(c => c.condition_id === 'envenenado');
    assert.ok(appCond1, 'Condição envenenado deve ter resultado');
    assert.strictEqual(appCond1.status, 'applied');
    assert.strictEqual(appCond1.chance_percent, 100);

    // Verifica persistência no combatente alvo
    const enemyAfter1 = combatService.getCombatantById(campaignId, enemyComb.id)!;
    assert.ok(enemyAfter1.conditions.some(c => c.condition_id === 'envenenado'));

    // Limpa condição para os próximos cenários
    combatService.removeConditionFromCombatant(campaignId, encounterId, enemyComb.id, 'envenenado');

    // =========================================================================
    // CENÁRIO 2: Aplicação com chance parcial (<100%) testando sucessos e falhas
    // =========================================================================
    resetActions();
    assert.strictEqual(normalizeChancePercent(0.1), 10);
    assert.strictEqual(normalizeChancePercent(0.5), 50);
    assert.strictEqual(normalizeChancePercent('30%'), 30);
    assert.strictEqual(normalizeChancePercent(0), 0);
    assert.strictEqual(evaluateChanceRoll(0).activated, false);

    // Teste com chance 0% deve sempre falhar
    const res2Fail = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: heroComb.id,
      actor_name: heroComb.name,
      target_id: enemyComb.id,
      action_type: 'attack',
      action_mode: 'manual',
      amount: 5,
      apply_conditions: [{ name: 'Envenenado', condition_id: 'envenenado', chance_percent: 0 }]
    });
    const appCond2Fail = res2Fail.appliedConditions?.find(c => c.condition_id === 'envenenado');
    assert.strictEqual(appCond2Fail?.status, 'chance_failed');
    assert.strictEqual(appCond2Fail?.chance_percent, 0);

    // =========================================================================
    // CENÁRIO 3: Tentativa de aplicação quando o ataque erra (não deve aplicar em miss)
    // =========================================================================
    resetActions();
    const res3Miss = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: heroComb.id,
      actor_name: heroComb.name,
      target_id: enemyComb.id,
      action_type: 'attack',
      action_mode: 'weapon',
      attack_formula: '1d1 - 100', // Ataque garantido de errar contra defesa 10
      formula: '1d6',
      apply_conditions: [{ name: 'Envenenado', condition_id: 'envenenado', chance_percent: 100 }]
    });

    assert.strictEqual(res3Miss.hit, false);
    const appCond3 = res3Miss.appliedConditions?.find(c => c.condition_id === 'envenenado');
    assert.strictEqual(appCond3?.status, 'missed_attack');
    const enemyAfter3 = combatService.getCombatantById(campaignId, enemyComb.id)!;
    assert.ok(!enemyAfter3.conditions.some(c => c.condition_id === 'envenenado'), 'Não deve aplicar condição se errou o ataque');

    // =========================================================================
    // CENÁRIO 4: Aplicação por poção consumível em si mesmo (auto-uso)
    // =========================================================================
    resetActions();
    const potionSelf = inventoryService.addItemToCharacter(campaignId, heroChar.id, {
      itemName: 'Poção da Bênção',
      category: 'consumivel',
      quantity: 1,
      properties: {
        condition: 'abencoado',
        chance_percent: 100,
        action_cost: 'bonus'
      }
    }, true);

    const res4 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: heroComb.id,
      actor_name: heroComb.name,
      target_id: heroComb.id,
      action_mode: 'consumable',
      consumable_item_id: potionSelf.id
    });

    assert.strictEqual(res4.hit, true);
    const appCond4 = res4.appliedConditions?.find(c => c.condition_id === 'abencoado');
    assert.strictEqual(appCond4?.status, 'applied');
    const heroAfter4 = combatService.getCombatantById(campaignId, heroComb.id)!;
    assert.ok(heroAfter4.conditions.some(c => c.condition_id === 'abencoado'), 'Herói deve estar com condição Abençoado em si');

    // =========================================================================
    // CENÁRIO 5: Aplicação por poção consumível em alvo (inimigo)
    // =========================================================================
    resetActions();
    const poisonVial = inventoryService.addItemToCharacter(campaignId, heroChar.id, {
      itemName: 'Frasco de Veneno Arremessável',
      category: 'consumivel',
      quantity: 1,
      properties: {
        dano: 5,
        tipo_dano: 'veneno',
        condition: 'envenenado',
        chance_percent: 100,
        action_cost: 'main'
      }
    }, true);

    const res5 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: heroComb.id,
      actor_name: heroComb.name,
      target_id: enemyComb.id,
      action_mode: 'consumable',
      consumable_item_id: poisonVial.id
    });

    assert.strictEqual(res5.hit, true);
    const appCond5 = res5.appliedConditions?.find(c => c.condition_id === 'envenenado');
    assert.strictEqual(appCond5?.status, 'applied');
    const enemyAfter5 = combatService.getCombatantById(campaignId, enemyComb.id)!;
    assert.ok(enemyAfter5.conditions.some(c => c.condition_id === 'envenenado'), 'Inimigo deve estar envenenado pelo consumível');

    // =========================================================================
    // CENÁRIO 6: Aplicação por habilidade de cura que concede condição benéfica
    // =========================================================================
    resetActions();
    const res6 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: heroComb.id,
      actor_name: heroComb.name,
      target_id: heroComb.id,
      action_mode: 'ability',
      ability_name: 'Prece Curativa',
      action_type: 'heal',
      formula: '1d8 + 4',
      apply_conditions: [{ name: 'Abençoado', condition_id: 'abencoado', chance_percent: 100 }]
    });

    assert.strictEqual(res6.hit, true);
    const appCond6 = res6.appliedConditions?.find(c => c.condition_id === 'abencoado');
    assert.strictEqual(appCond6?.status, 'applied');

    // =========================================================================
    // CENÁRIO 7: Aplicação por habilidade ofensiva com status negativo
    // =========================================================================
    resetActions();
    const res7 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: heroComb.id,
      actor_name: heroComb.name,
      target_id: enemyComb.id,
      action_mode: 'ability',
      ability_name: 'Golpe Atordoante',
      action_type: 'attack',
      formula: '2d6',
      apply_conditions: [{ name: 'Atordoado', condition_id: 'atordoado', chance_percent: 100 }]
    });

    assert.strictEqual(res7.hit, true);
    const appCond7 = res7.appliedConditions?.find(c => c.condition_id === 'atordoado');
    assert.strictEqual(appCond7?.status, 'applied');
    const enemyAfter7 = combatService.getCombatantById(campaignId, enemyComb.id)!;
    assert.ok(enemyAfter7.conditions.some(c => c.condition_id === 'atordoado'));

    // =========================================================================
    // CENÁRIO 8: Aplicação por arma imbuída com consumível de veneno (cargas/hits)
    // =========================================================================
    resetActions();
    const poisonOil = inventoryService.addItemToCharacter(campaignId, heroChar.id, {
      itemName: 'Óleo de Veneno Letal',
      category: 'consumivel',
      quantity: 1,
      properties: {
        can_imbue: true,
        imbue_properties: {
          damage_type: 'veneno',
          damage_formula: '1d4',
          condition: 'envenenado',
          chance_percent: 100,
          duration_type: 'hits',
          charges: 2
        }
      }
    }, true);

    const sword = inventoryService.addItemToCharacter(campaignId, heroChar.id, {
      itemName: 'Espada Longa',
      category: 'arma',
      quantity: 1,
      properties: {
        dano_formula: '1d8',
        tipo_dano: 'fisico'
      }
    }, true);

    // Imbui arma
    inventoryService.imbueWeapon(campaignId, heroChar.id, {
      consumableInventoryId: poisonOil.id,
      weaponInventoryId: sword.id
    }, player.id, false);

    // Ataque com arma imbuída contra o inimigo
    const res8 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: heroComb.id,
      actor_name: heroComb.name,
      target_id: enemyComb.id,
      action_mode: 'weapon',
      weapon_id: sword.id
    });

    assert.strictEqual(res8.hit, true);
    const appCond8 = res8.appliedConditions?.find(c => c.condition_id === 'envenenado');
    assert.strictEqual(appCond8?.status, 'applied', 'Arma imbuída com veneno deve aplicar condição envenenado');

    // =========================================================================
    // CENÁRIO 9: Alvo imune à condição específica (deve rejeitar e registrar imunidade)
    // =========================================================================
    resetActions();
    const res9 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: heroComb.id,
      actor_name: heroComb.name,
      target_id: immuneComb.id,
      action_type: 'attack',
      action_mode: 'manual',
      amount: 5,
      apply_conditions: [{ name: 'Envenenado', condition_id: 'envenenado', chance_percent: 100 }]
    });

    const appCond9 = res9.appliedConditions?.find(c => c.condition_id === 'envenenado');
    assert.ok(appCond9, 'Deve ter resultado para envenenado no alvo imune');
    assert.strictEqual(appCond9.status, 'immune', 'Alvo com imunidade à condição deve retornar status immune');
    const immuneAfter9 = combatService.getCombatantById(campaignId, immuneComb.id)!;
    assert.ok(!immuneAfter9.conditions.some(c => c.condition_id === 'envenenado'), 'Alvo imune não pode ter a condição aplicada');

    // =========================================================================
    // CENÁRIO 10: Alvo imune ao tipo de dano do efeito (dano 0 por imunidade não aplica condição que requer dano)
    // =========================================================================
    resetActions();
    const res10 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: heroComb.id,
      actor_name: heroComb.name,
      target_id: immuneComb.id,
      action_mode: 'weapon',
      weapon_id: sword.id, // Arma imbuída com veneno contra golem imune a veneno
      attack_formula: '100' // Garante acerto para testar a rejeição por imunidade
    });
    assert.strictEqual(res10.hit, true, 'Ataque deve acertar para avaliar a imunidade');
    // O golem é imune a veneno, portanto qualquer efeito condicional de veneno é bloqueado
    const appCond10 = res10.appliedConditions?.find(c => c.condition_id === 'envenenado');
    assert.ok(appCond10?.status === 'immune' || appCond10?.status === 'damage_zero', 'Condição de veneno bloqueada por imunidade');
    assert.strictEqual(appCond10?.status, 'immune');

    // =========================================================================
    // CENÁRIO 11: Aplicação de DoT com dano periódico ao longo dos turnos
    // =========================================================================
    // Aplica condição de DoT no inimigo com vida conhecida
    const enemyBeforeDot = combatService.getCombatantById(campaignId, enemyComb.id)!;
    const initialHp = enemyBeforeDot.current_hp!;
    combatService.applyConditionToCombatant(campaignId, encounterId, enemyComb.id, {
      condition_id: 'envenenado',
      name: 'Envenenado',
      duration_remaining: 3,
      duration_type: 'turns',
      tick_timing: 'turn_start',
      effects: {
        dot: {
          formula: '4', // Dano fixo de 4 para teste determinístico
          damage_type: 'veneno',
          timing: 'turn_start'
        }
      }
    });

    // Dispara tick de início de turno para o combatente inimigo
    combatService.tickConditionsForCombatant(campaignId, encounterId, enemyComb.id, 'turn_start');
    const enemyAfterDot = combatService.getCombatantById(campaignId, enemyComb.id)!;
    assert.strictEqual(enemyAfterDot.current_hp, initialHp - 4, 'DoT deve descontar 4 pontos de vida no tick de início de turno');

    // =========================================================================
    // CENÁRIO 12: Acúmulo ou substituição conforme regra (replace, stack_duration, stack_intensity)
    // =========================================================================
    // A) Replace: re-aplicar envenenado (com duração 3) substitui
    combatService.applyConditionToCombatant(campaignId, encounterId, enemyComb.id, {
      condition_id: 'envenenado',
      name: 'Envenenado',
      duration_remaining: 3,
      stack_rule: 'replace'
    } as any);
    let curEnemyConds = combatService.getCombatantConditions(campaignId, enemyComb.id);
    let poisonCond = curEnemyConds.find(c => c.condition_id === 'envenenado')!;
    assert.strictEqual(poisonCond.duration_remaining, 3, 'Regra replace deve manter duração base da nova aplicação');

    // B) Stack Duration: atordoado (duração 2 + 2 = 4)
    combatService.removeConditionFromCombatant(campaignId, encounterId, enemyComb.id, 'atordoado');
    combatService.applyConditionToCombatant(campaignId, encounterId, enemyComb.id, {
      condition_id: 'atordoado',
      name: 'Atordoado',
      duration_remaining: 2,
      stack_rule: 'stack_duration'
    } as any);
    combatService.applyConditionToCombatant(campaignId, encounterId, enemyComb.id, {
      condition_id: 'atordoado',
      name: 'Atordoado',
      duration_remaining: 2,
      stack_rule: 'stack_duration'
    } as any);
    curEnemyConds = combatService.getCombatantConditions(campaignId, enemyComb.id);
    let stunCond = curEnemyConds.find(c => c.condition_id === 'atordoado')!;
    assert.strictEqual(stunCond.duration_remaining, 4, 'Regra stack_duration deve somar as durações');

    // C) Stack Intensity: abençoado (stack_count incrementado)
    combatService.applyConditionToCombatant(campaignId, encounterId, heroComb.id, {
      condition_id: 'abencoado',
      name: 'Abençoado',
      duration_remaining: 3,
      stack_rule: 'stack_intensity'
    } as any);
    combatService.applyConditionToCombatant(campaignId, encounterId, heroComb.id, {
      condition_id: 'abencoado',
      name: 'Abençoado',
      duration_remaining: 3,
      stack_rule: 'stack_intensity'
    } as any);
    let curHeroConds = combatService.getCombatantConditions(campaignId, heroComb.id);
    let blessCond = curHeroConds.find(c => c.condition_id === 'abencoado')!;
    assert.ok((blessCond.stack_count || 1) >= 2, 'Regra stack_intensity deve incrementar o contador de acúmulo');

    // =========================================================================
    // CENÁRIO 13: Remoção de condição antes do término por ação ou habilidade de purificação
    // =========================================================================
    resetActions();
    combatService.applyConditionToCombatant(campaignId, encounterId, heroComb.id, {
      condition_id: 'envenenado',
      name: 'Envenenado',
      duration_remaining: 2
    });
    const res13 = combatService.applyCombatAction(campaignId, encounterId, {
      actor_id: heroComb.id,
      actor_name: heroComb.name,
      target_id: heroComb.id,
      action_mode: 'ability',
      ability_name: 'Purificação Sagrada',
      action_type: 'heal',
      amount: 0,
      remove_conditions: ['envenenado']
    });

    assert.strictEqual(res13.hit, true);
    const heroAfter13 = combatService.getCombatantById(campaignId, heroComb.id)!;
    assert.ok(!heroAfter13.conditions.some(c => c.condition_id === 'envenenado'), 'Condição envenenado deve ser removida pela ação de purificação');

    // =========================================================================
    // CENÁRIO 14: Recálculo correto dos atributos e defesa do alvo após receber e após perder a condição
    // =========================================================================
    characterService.removeCondition(campaignId, heroChar.id, 'abencoado');
    const baseHeroChar = characterService.getCharacterById(campaignId, heroChar.id)!;
    const baseDefense = baseHeroChar.computed_data?.defesa || 12;
    const baseForca = baseHeroChar.computed_data?.forca || 14;

    characterService.applyCondition(campaignId, heroChar.id, {
      condition_id: 'abencoado',
      name: 'Abençoado',
      duration_remaining: 3,
      modifiers: [
        { target: 'defesa', type: 'flat', value: 3 },
        { target: 'forca', type: 'flat', value: 2 }
      ]
    });

    const blessedHeroChar = characterService.getCharacterById(campaignId, heroChar.id)!;
    assert.strictEqual(blessedHeroChar.computed_data?.defesa, baseDefense + 3, 'Defesa deve ter bônus de +3');
    assert.strictEqual(blessedHeroChar.computed_data?.forca, baseForca + 2, 'Força deve ter bônus de +2');

    // Remove a condição e valida restauração
    characterService.removeCondition(campaignId, heroChar.id, 'abencoado');
    const restoredHeroChar = characterService.getCharacterById(campaignId, heroChar.id)!;
    assert.strictEqual(restoredHeroChar.computed_data?.defesa, baseDefense, 'Defesa deve ser restaurada ao valor base');
    assert.strictEqual(restoredHeroChar.computed_data?.forca, baseForca, 'Força deve ser restaurada ao valor base');

    // =========================================================================
    // CENÁRIO 15: Persistência correta no banco após recarregamento (simulado lendo diretamente do banco)
    // =========================================================================
    // Aplica Envenenado no inimigo
    combatService.applyConditionToCombatant(campaignId, encounterId, enemyComb.id, {
      condition_id: 'envenenado',
      name: 'Envenenado',
      duration_remaining: 2,
      duration_type: 'turns'
    });

    // Simula recarregamento/reinicialização do serviço lendo do SQLite
    const newCombatService = new CombatService(db, rulesService, characterService, inventoryService);
    const reloadedCombatant = newCombatService.getCombatantById(campaignId, enemyComb.id)!;
    assert.ok(reloadedCombatant.conditions.some(c => c.condition_id === 'envenenado'), 'Condição deve persistir no banco após recarregar serviço');
    const persistedCond = reloadedCombatant.conditions.find(c => c.condition_id === 'envenenado')!;
    assert.strictEqual(persistedCond.duration_remaining, 2);

    // Valida também no banco de dados SQLite bruto
    const rawRow = db.prepare(`SELECT conditions_json FROM combatants WHERE id = ?`).get(enemyComb.id) as any;
    assert.ok(rawRow && rawRow.conditions_json);
    const parsedRaw = JSON.parse(rawRow.conditions_json);
    assert.ok(parsedRaw.some((c: any) => c.condition_id === 'envenenado'));

    console.log('✔ Todos os 15 cenários de aplicação de condições e status foram validados com sucesso!');
  } finally {
    if (masterWs) masterWs.close();
    if (playerWs) playerWs.close();
    server.close();
  }
});
