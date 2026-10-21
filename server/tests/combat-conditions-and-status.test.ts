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
import { CombatService } from '../src/modules/combat/combat.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';

test('Combate: Sistema de Condições, Efeitos de Status, DoT e Automação de Combate', async () => {
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
  const apiUrl = `http://127.0.0.1:${port}/api`;

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
    // 1. Setup de Usuários e Campanha Fantasia D20
    const masterRes = authService.register({ username: 'gm_status', email: 'gm@arcanum.test', password: 'password123' });
    const master = masterRes.user;
    const masterToken = authService.login({ login: 'gm@arcanum.test', password: 'password123' }).token;

    const player1Res = authService.register({ username: 'hero_player', email: 'hero@arcanum.test', password: 'password123' });
    const player1 = player1Res.user;
    const player1Token = authService.login({ login: 'hero@arcanum.test', password: 'password123' }).token;

    const campaign = campaignService.createCampaign(master.id, {
      name: 'Campanha Fase 4 Status',
      description: 'Teste de Condições',
      preset: 'fantasia_d20'
    });

    const invite = campaignService.createInvite(campaign.id, { role: 'player' });
    campaignService.joinCampaignByInvite(invite.code, player1.id);

    // Conectar WebSockets para testes em tempo real
    masterWs = await connectWsClient(masterToken, campaign.id);
    playerWs = await connectWsClient(player1Token, campaign.id);

    // =========================================================================
    // CENÁRIO 1: Definições de Condições Configuráveis no Ruleset (Presets e CRUD)
    // =========================================================================
    // 1.1 Obter condições padrão do preset Fantasia D20
    const getCondsRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/ruleset/conditions`, {
      headers: { Authorization: `Bearer ${player1Token}` }
    });
    assert.strictEqual(getCondsRes.status, 200);
    const condsData = await getCondsRes.json();
    assert.ok(Array.isArray(condsData.conditions));
    assert.ok(condsData.conditions.some((c: any) => c.id === 'envenenado'));
    assert.ok(condsData.conditions.some((c: any) => c.id === 'atordoado'));

    // 1.2 Criação de nova condição customizada pelo Mestre
    const newCondPayload = {
      id: 'congelado',
      name: 'Congelado',
      description: 'Totalmente congelado por gelo ártico.',
      icon: 'snowflake',
      color: '#38bdf8',
      effects: { incapacitated: true, defense_mod: -3 },
      default_duration: { type: 'rounds', value: 2 },
      tick_timing: 'round_end',
      stack_rule: 'replace'
    };
    const createCondRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/ruleset/conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify(newCondPayload)
    });
    assert.strictEqual(createCondRes.status, 201);
    const createdCond = await createCondRes.json();
    assert.strictEqual(createdCond.condition.id, 'congelado');

    // 1.3 Bloqueio para jogador comum tentando criar condição (403)
    const playerCreateRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/ruleset/conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${player1Token}` },
      body: JSON.stringify({ id: 'hack', name: 'Hack' })
    });
    assert.strictEqual(playerCreateRes.status, 403);

    // 1.4 Atualização da condição pelo Mestre
    const updateCondRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/ruleset/conditions/congelado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({ description: 'Congelado e frágil.' })
    });
    assert.strictEqual(updateCondRes.status, 200);
    const updatedCond = await updateCondRes.json();
    assert.strictEqual(updatedCond.condition.description, 'Congelado e frágil.');

    // 1.5 Exclusão da condição pelo Mestre
    const deleteCondRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/ruleset/conditions/congelado`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    assert.strictEqual(deleteCondRes.status, 200);

    // =========================================================================
    // CENÁRIO 2: Aplicação e Remoção de Condição em Combatente & Permissões
    // =========================================================================
    // Criar Personagens: Herói (Jogador 1) e Monstro NPC
    const heroChar = characterService.createCharacter(campaign.id, player1.id, {
      name: 'Sir Galahad',
      rawData: { forca: 16, destreza: 14, constituicao: 14, hp_atual: 30, hp_max: 30 }
    });

    // Iniciar Encontro de Combate
    const encounter = combatService.startEncounter(campaign.id, { name: 'Arena de Testes' });

    // Adicionar Combatente Herói
    const heroCombatant = combatService.addCombatant(campaign.id, encounter.id, {
      character_id: heroChar.id,
      name: 'Sir Galahad',
      current_hp: 30,
      max_hp: 30,
      defense: 15,
      initiative: 20
    });

    // Adicionar Combatente Goblin
    const goblinCombatant = combatService.addCombatant(campaign.id, encounter.id, {
      name: 'Goblin Xamã',
      is_npc: true,
      current_hp: 20,
      max_hp: 20,
      defense: 12,
      damage_reduction: 1,
      initiative: 10
    });

    // Ativar o combate
    combatService.activateCombatEncounter(campaign.id, encounter.id);

    // 2.1 Mestre aplica condição "Envenenado" no Goblin
    const applyGoblinRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/combatants/${goblinCombatant.id}/conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({
        condition_id: 'envenenado',
        name: 'Envenenado',
        duration_type: 'turns',
        duration_remaining: 3,
        tick_timing: 'turn_start',
        effects: { dot: { formula: '3', damageType: 'veneno', timing: 'turn_start' }, attack_mod: -2 }
      })
    });
    assert.strictEqual(applyGoblinRes.status, 201);
    const appliedData = await applyGoblinRes.json();
    assert.strictEqual(appliedData.condition.name, 'Envenenado');
    assert.strictEqual(appliedData.combatant.conditions.length, 1);

    // 2.2 Jogador 1 tenta aplicar condição no Goblin (NPC alheio) -> Bloqueado com 403
    const playerApplyRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/combatants/${goblinCombatant.id}/conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${player1Token}` },
      body: JSON.stringify({ name: 'Falso Status' })
    });
    assert.strictEqual(playerApplyRes.status, 403);

    // =========================================================================
    // CENÁRIO 3: Regras de Acúmulo (Stack Rules)
    // =========================================================================
    // 3.1 Stack Rule 'stack_duration': soma duração
    combatService.applyConditionToCombatant(campaign.id, encounter.id, goblinCombatant.id, {
      condition_id: 'envenenado',
      name: 'Envenenado',
      duration_remaining: 2,
      stack_rule: 'stack_duration' as any
    });
    let freshGoblin = combatService.getCombatantById(campaign.id, goblinCombatant.id)!;
    const poisonCond = freshGoblin.conditions.find(c => c.condition_id === 'envenenado')!;
    assert.strictEqual(poisonCond.duration_remaining, 5); // 3 + 2 = 5 turnos

    // 3.2 Stack Rule 'replace': substitui duração
    combatService.applyConditionToCombatant(campaign.id, encounter.id, goblinCombatant.id, {
      condition_id: 'envenenado',
      name: 'Envenenado',
      duration_remaining: 2,
      effects: { dot: { formula: '3', damageType: 'veneno', timing: 'turn_start' } },
      stack_rule: 'replace' as any
    });
    freshGoblin = combatService.getCombatantById(campaign.id, goblinCombatant.id)!;
    const poisonReplaced = freshGoblin.conditions.find(c => c.condition_id === 'envenenado')!;
    assert.strictEqual(poisonReplaced.duration_remaining, 2);

    // =========================================================================
    // CENÁRIO 4: Dano Periódico (DoT) em Início de Turno (turn_start)
    // =========================================================================
    // Turno atual é do Herói (iniciativa 20). Próximo é o Goblin (iniciativa 10).
    // Goblin tem Envenenado (DoT: 3 dano em turn_start, 2 turnos restantes, HP 20).
    const encBeforeTurn = combatService.getEncounterById(campaign.id, encounter.id, true)!;
    assert.strictEqual(encBeforeTurn.turn_index, 0); // Sir Galahad

    // Avançar turno para o Goblin Xamã
    combatService.nextTurn(campaign.id, encounter.id);
    const encGoblinTurn = combatService.getEncounterById(campaign.id, encounter.id, true)!;
    assert.strictEqual(encGoblinTurn.turn_index, 1); // Goblin Xamã

    freshGoblin = combatService.getCombatantById(campaign.id, goblinCombatant.id)!;
    // DoT de 3 aplicado no início do turno do Goblin: 20 - 3 = 17 HP
    assert.strictEqual(freshGoblin.current_hp, 17);
    // Duração do veneno decrementada de 2 para 1
    const poisonAfterTick = freshGoblin.conditions.find(c => c.condition_id === 'envenenado')!;
    assert.strictEqual(poisonAfterTick.duration_remaining, 1);

    // Verificar se gerou log de DoT
    const logs = combatService.getCombatLogs(campaign.id, encounter.id);
    const dotLog = logs.find(l => l.action_type === 'dot');
    assert.ok(dotLog, 'Log de DoT deve existir');
    assert.strictEqual(dotLog.amount, 3);
    assert.strictEqual(dotLog.target_name, 'Goblin Xamã');

    // =========================================================================
    // CENÁRIO 5: Dano Periódico (DoT) em Final de Turno (turn_end)
    // =========================================================================
    // Aplicar "Sangrando" no Goblin com tick em turn_end
    combatService.applyConditionToCombatant(campaign.id, encounter.id, goblinCombatant.id, {
      condition_id: 'sangrando',
      name: 'Sangrando',
      duration_type: 'turns',
      duration_remaining: 2,
      tick_timing: 'turn_end',
      effects: { dot: { formula: '2', damageType: 'sangramento', timing: 'turn_end' } }
    });

    // Avançar turno a partir do Goblin -> dispara turn_end do Goblin!
    combatService.nextTurn(campaign.id, encounter.id);
    freshGoblin = combatService.getCombatantById(campaign.id, goblinCombatant.id)!;
    // Sofreu 2 de dano de sangramento no final do seu turno: 17 - 2 = 15 HP
    assert.strictEqual(freshGoblin.current_hp, 15);

    // =========================================================================
    // CENÁRIO 6 & 8: Decremento e DoT em Rodadas (round_end / rounds)
    // =========================================================================
    // Aplicar condição de 1 rodada no Herói
    combatService.applyConditionToCombatant(campaign.id, encounter.id, heroCombatant.id, {
      condition_id: 'efeito_rodada',
      name: 'Aura Solar',
      duration_type: 'rounds',
      duration_remaining: 1,
      tick_timing: 'round_end'
    });

    // Estamos na Rodada 2. Avançar turno até passar por todos e avançar rodada para 3.
    // Turno atual é do Herói. Avançar para Goblin.
    combatService.nextTurn(campaign.id, encounter.id);
    // Avançar do Goblin (último) para Herói -> Avança rodada para 3!
    combatService.nextTurn(campaign.id, encounter.id);
    const encRound3 = combatService.getEncounterById(campaign.id, encounter.id, true)!;
    assert.ok(encRound3.round >= 2);

    const freshHero = combatService.getCombatantById(campaign.id, heroCombatant.id)!;
    const auraCond = freshHero.conditions.find(c => c.condition_id === 'efeito_rodada');
    assert.strictEqual(auraCond, undefined, 'Condição de 1 rodada deve ter expirado e sido removida');

    // =========================================================================
    // CENÁRIO 7: Expiração Automática de Condições de Turno (sem duplicidade)
    // =========================================================================
    // O Goblin ainda tinha 1 turno de veneno. No próximo início de turno do Goblin, ele deve sofrer o último tick e expirar!
    combatService.nextTurn(campaign.id, encounter.id); // Início do turno do Goblin
    const goblinAfterPoisonExpire = combatService.getCombatantById(campaign.id, goblinCombatant.id)!;
    // Sofreu o dano acumulado de veneno e sangramento (HP resultante = 10)
    assert.strictEqual(goblinAfterPoisonExpire.current_hp, 10);
    // A condição de veneno deve ter expirado e sido removida da lista!
    assert.strictEqual(goblinAfterPoisonExpire.conditions.some(c => c.condition_id === 'envenenado'), false);

    const expireLog = combatService.getCombatLogs(campaign.id, encounter.id).find(l => l.action_type === 'condition_expired' && l.details?.condition_name === 'Envenenado');
    assert.ok(expireLog, 'Log de expiração de condição deve existir');

    // =========================================================================
    // CENÁRIO 9: Decremento de Duração em Ações (actions)
    // =========================================================================
    // Aplicar condição "Mirando" no Herói com duração de 1 ação
    combatService.applyConditionToCombatant(campaign.id, encounter.id, heroCombatant.id, {
      condition_id: 'mirando',
      name: 'Mirando',
      duration_type: 'actions',
      duration_remaining: 1,
      tick_timing: 'action',
      effects: { attack_mod: 4 }
    });

    let heroWithAim = combatService.getCombatantById(campaign.id, heroCombatant.id)!;
    assert.strictEqual(heroWithAim.conditions.some(c => c.condition_id === 'mirando'), true);

    // Resetar ações do herói para garantir que pode agir
    combatService.resetCombatantActions(campaign.id, heroCombatant.id, { main: 0, bonus: 0, reaction: 0, free: 0 });

    // Herói executa uma ação de ataque
    const actionResult = combatService.applyCombatAction(campaignIdSafe(campaign.id), encounter.id, {
      actor_id: heroCombatant.id,
      actor_name: 'Sir Galahad',
      target_id: goblinCombatant.id,
      action_type: 'attack',
      action_mode: 'manual',
      attack_formula: '1d20 + 2',
      amount: 4,
      is_master: true
    });

    assert.ok(actionResult.actionLog);
    // Após executar a ação, "Mirando" (1 ação) deve ter sido decrementado e expirado!
    const heroAfterAction = combatService.getCombatantById(campaign.id, heroCombatant.id)!;
    assert.strictEqual(heroAfterAction.conditions.some(c => c.condition_id === 'mirando'), false, 'Condição de ação deve expirar após o ataque');

    // =========================================================================
    // CENÁRIO 10: Condições Permanentes (não decrementam)
    // =========================================================================
    combatService.applyConditionToCombatant(campaign.id, encounter.id, goblinCombatant.id, {
      condition_id: 'caido',
      name: 'Caído',
      duration_type: 'permanent',
      duration_remaining: 0,
      effects: { defense_mod: -2 }
    });

    // Avançar vários turnos
    combatService.nextTurn(campaign.id, encounter.id);
    combatService.nextTurn(campaign.id, encounter.id);
    combatService.nextTurn(campaign.id, encounter.id);

    const goblinStillProne = combatService.getCombatantById(campaign.id, goblinCombatant.id)!;
    assert.ok(goblinStillProne.conditions.some(c => c.condition_id === 'caido'), 'Condição permanente deve resistir a múltiplos turnos');

    // =========================================================================
    // CENÁRIO 11: Bloqueio de Combatente Incapacitado (Erro 400 e Salto de Turno)
    // =========================================================================
    // Aplicar Atordoado no Goblin (incapacitado: true)
    combatService.applyConditionToCombatant(campaign.id, encounter.id, goblinCombatant.id, {
      condition_id: 'atordoado',
      name: 'Atordoado',
      duration_type: 'turns',
      duration_remaining: 3,
      effects: { incapacitated: true, defense_mod: -5 }
    });

    const stunnedGoblin = combatService.getCombatantById(campaign.id, goblinCombatant.id)!;
    assert.strictEqual(stunnedGoblin.is_incapacitated, true);

    // Tentar executar ação de combate com o Goblin incapacitado via API -> Deve retornar erro 400
    const actionBlockedRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/combat/${encounter.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({
        actor_id: goblinCombatant.id,
        target_id: heroCombatant.id,
        action_mode: 'manual',
        amount: 5
      })
    });
    assert.strictEqual(actionBlockedRes.status, 400);
    const blockedJson = await actionBlockedRes.json();
    assert.match(blockedJson.error, /incapacitado/i);

    // =========================================================================
    // CENÁRIO 12: Modificadores Dinâmicos de Combate (Defesa, Ataque, RD, Multiplicador)
    // =========================================================================
    // Goblin tem "Caído" (-2 defesa) e "Atordoado" (-5 defesa). Defesa base é 12.
    // Defesa efetiva deve ser 12 - 2 - 5 = 5.
    // Herói recebe condição com bônus de ataque (+5)
    combatService.applyConditionToCombatant(campaign.id, encounter.id, heroCombatant.id, {
      condition_id: 'precisao',
      name: 'Precisão Mágica',
      duration_type: 'turns',
      duration_remaining: 2,
      effects: { attack_mod: 5 }
    });

    // Adicionar vulnerabilidade (+50% dano / multiplicador 1.5) via condição no Goblin
    combatService.applyConditionToCombatant(campaign.id, encounter.id, goblinCombatant.id, {
      condition_id: 'fragil',
      name: 'Frágil',
      duration_type: 'turns',
      duration_remaining: 2,
      effects: { incoming_damage_mod: 1.5 }
    });

    // Ataque com dano bruto 10 contra Goblin (RD 1). Dano após RD = 9. Dano com multiplicador 1.5 = 13.
    const modCombatResult = combatService.applyCombatAction(campaign.id, encounter.id, {
      actor_id: heroCombatant.id,
      actor_name: 'Sir Galahad',
      target_id: goblinCombatant.id,
      action_type: 'attack',
      action_mode: 'manual',
      attack_formula: '1d20',
      formula: '10',
      amount: 10,
      is_master: true
    });

    assert.ok(modCombatResult.hit);
    // Ataque rolado com bônus de condição
    assert.ok(modCombatResult.attackRoll.total >= 5);
    // Dano final após RD (1) e multiplicador Frágil (1.5)
    assert.strictEqual(modCombatResult.finalDamage, 13); // Math.floor((10 - 1) * 1.5) = 13

    // =========================================================================
    // CENÁRIO 13: Aplicação de Condições ao Acertar Ataque (apply_conditions)
    // =========================================================================
    // Herói ataca o Goblin passando `apply_conditions: ['em_chamas']`
    const attackWithConditionRes = combatService.applyCombatAction(campaign.id, encounter.id, {
      actor_id: heroCombatant.id,
      actor_name: 'Sir Galahad',
      target_id: goblinCombatant.id,
      action_type: 'attack',
      action_mode: 'manual',
      amount: 2,
      apply_conditions: ['em_chamas'],
      is_master: true
    });

    assert.ok(attackWithConditionRes.hit);
    const goblinBurned = combatService.getCombatantById(campaign.id, goblinCombatant.id)!;
    assert.ok(goblinBurned.conditions.some(c => c.condition_id === 'em_chamas' || c.name === 'Em Chamas'));

    // =========================================================================
    // CENÁRIO 14: Persistência no SQLite, Sincronização com Personagens & F5
    // =========================================================================
    // Aplicar condição no personagem Sir Galahad via CharacterService
    characterService.applyCondition(campaign.id, heroChar.id, {
      condition_id: 'abencoado',
      name: 'Abençoado',
      duration_type: 'rounds',
      duration_remaining: 3,
      effects: { attack_mod: 1, damage_mod: 1 }
    });

    // Consultar personagem diretamente do banco de dados (simulando recarregar F5)
    const charRow = db.prepare(`SELECT conditions_json FROM characters WHERE campaign_id = ? AND id = ?`).get(campaign.id, heroChar.id) as any;
    assert.ok(charRow.conditions_json);
    const parsedCharConds = JSON.parse(charRow.conditions_json);
    assert.ok(parsedCharConds.some((c: any) => c.name === 'Abençoado'));

    // Consultar combatente do banco de dados
    const combatantRow = db.prepare(`SELECT conditions_json FROM combatants WHERE campaign_id = ? AND id = ?`).get(campaign.id, goblinCombatant.id) as any;
    assert.ok(combatantRow.conditions_json);
    const parsedCombatantConds = JSON.parse(combatantRow.conditions_json);
    assert.ok(parsedCombatantConds.length > 0);

  } finally {
    if (masterWs?.ws) masterWs.ws.close();
    if (playerWs?.ws) playerWs.ws.close();
    realtimeServer.close();
    server.close();
    db.close();
  }
});

function campaignIdSafe(id: string) {
  return id;
}
