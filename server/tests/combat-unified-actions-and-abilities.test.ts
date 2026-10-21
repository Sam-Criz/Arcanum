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

test('Combate: Ações Unificadas, Habilidades, Consumíveis, Alvos e Condições (15 Cenários Obrigatórios)', async () => {
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

  let gmWs: WebSocket | null = null;
  let playerWs: WebSocket | null = null;

  try {
    // 0. Setup: Criar Mestre e Jogador
    const gmReg = authService.register({ username: 'mestre_combat', email: 'gm@arcanum.vtt', password: 'Senha@123' });
    const gmUser = gmReg.user;
    const gmToken = authService.login({ login: 'mestre_combat', password: 'Senha@123' }).token;

    const playerReg = authService.register({ username: 'jogador_combat', email: 'player@arcanum.vtt', password: 'Senha@123' });
    const playerUser = playerReg.user;
    const playerToken = authService.login({ login: 'jogador_combat', password: 'Senha@123' }).token;

    // Criar Campanha Fantasia D20
    const campaign = campaignService.createCampaign(gmUser.id, {
      name: 'Mesa de Ações Unificadas',
      description: 'Campanha de validação de combate e habilidades',
      ruleset_preset: 'fantasia_d20'
    });
    const campaignId = campaign.id;

    // Adicionar jogador à campanha
    db.prepare(`
      INSERT INTO campaign_memberships (id, campaign_id, user_id, role, joined_at)
      VALUES (?, ?, ?, 'player', datetime('now'))
    `).run(crypto.randomUUID(), campaignId, playerUser.id);

    // Conectar WebSockets para monitoramento de eventos em tempo real
    const gmWsConn = await connectWsClient(gmToken, campaignId);
    gmWs = gmWsConn.ws;
    const gmMessages = gmWsConn.messages;

    const playerWsConn = await connectWsClient(playerToken, campaignId);
    playerWs = playerWsConn.ws;
    const playerMessages = playerWsConn.messages;

    // Criar Personagem do Jogador (Guerreiro)
    const warriorChar = characterService.createCharacter(campaignId, playerUser.id, {
      name: 'Guerreiro Valente',
      rawData: {
        forca: 16,
        destreza: 14,
        constituicao: 14,
        mana: 10,
        mana_atual: 10,
        vida: 30,
        pv_atual: 30,
        defesa: 14,
        rd: 2
      }
    });

    // Criar Personagem Aliado (Clérigo do Jogador ou segundo combatente)
    const clericChar = characterService.createCharacter(campaignId, playerUser.id, {
      name: 'Clériga Elen',
      rawData: {
        sabedoria: 16,
        mana: 10,
        mana_atual: 10,
        vida: 25,
        pv_atual: 15, // Ferida
        defesa: 12,
        rd: 1
      }
    });

    // Criar Encontro de Combate
    const encounter = combatService.startEncounter(campaignId, {
      name: 'Emboscada na Cripta'
    });
    const encounterId = encounter.id;

    // Adicionar Combatente Jogador
    const warriorCombatant = combatService.addCombatant(campaignId, encounterId, {
      character_id: warriorChar.id,
      name: warriorChar.name,
      is_npc: false,
      initiative: 20,
      current_hp: 30,
      max_hp: 30,
      defense: 14,
      damage_reduction: 2
    });

    // Adicionar Combatente Aliado (Jogador)
    const clericCombatant = combatService.addCombatant(campaignId, encounterId, {
      character_id: clericChar.id,
      name: clericChar.name,
      is_npc: false,
      initiative: 15,
      current_hp: 15,
      max_hp: 25,
      defense: 12,
      damage_reduction: 1
    });

    // Adicionar NPC Aliado (Guarda Amigável)
    const allyNpcCombatant = combatService.addCombatant(campaignId, encounterId, {
      name: 'Guarda Real (Aliado)',
      is_npc: true,
      initiative: 12,
      current_hp: 10,
      max_hp: 20,
      defense: 13,
      damage_reduction: 2,
      npc_data: {
        disposition: 'friendly',
        faction: 'ally'
      }
    });

    // Adicionar Monstro Inimigo (Orc Furioso)
    const enemyCombatant = combatService.addCombatant(campaignId, encounterId, {
      name: 'Orc Furioso',
      is_npc: true,
      initiative: 10,
      current_hp: 40,
      max_hp: 40,
      defense: 11,
      damage_reduction: 1,
      npc_data: {
        disposition: 'hostile',
        vulnerabilities: ['fogo']
      }
    });

    // Ativar o combate agora com os combatentes participantes
    combatService.activateCombatEncounter(campaignId, encounterId);

    // =========================================================================
    // CENÁRIO 1: Jogador não consegue aplicar condição livremente por ferramenta administrativa
    // =========================================================================
    const unauthorizedCondRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/combatants/${enemyCombatant.id}/conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${playerToken}` },
      body: JSON.stringify({ name: 'Atordoado', duration_remaining: 2, duration_type: 'turns' })
    });
    assert.strictEqual(unauthorizedCondRes.status, 403, 'Cenário 1: Jogador comum deve receber 403 ao tentar aplicar condição manual');

    // =========================================================================
    // CENÁRIO 2: Mestre autorizado consegue aplicar manualmente uma condição
    // =========================================================================
    const masterCondRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/combatants/${enemyCombatant.id}/conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${gmToken}` },
      body: JSON.stringify({ name: 'Atordoado', duration_remaining: 2, duration_type: 'turns' })
    });
    assert.strictEqual(masterCondRes.status, 201, 'Cenário 2: Mestre deve conseguir aplicar condição administrativa');
    const masterCondJson = await masterCondRes.json();
    assert.strictEqual(masterCondJson.condition.name, 'Atordoado');

    // Verificar se o log de combate contém a auditoria explícita [Intervenção Manual do Mestre]
    const logsAfterMaster = combatService.getCombatLogs(campaignId, encounterId);
    const lastLog = logsAfterMaster[logsAfterMaster.length - 1];
    assert.ok(lastLog.details.message.includes('[Intervenção Manual do Mestre]'), 'Cenário 2: Log de condição manual deve conter auditoria explícita');
    assert.strictEqual(lastLog.details.is_manual_master, true);

    // =========================================================================
    // CENÁRIO 3: Jogador consegue usar uma habilidade válida contra um inimigo
    // =========================================================================
    // Cadastrar habilidade ofensiva na campanha
    const offensiveAbility = rulesService.addAbilityDefinition(campaignId, {
      name: 'Golpe Devastador',
      description: 'Ataque pesado que causa dano de impacto e aplica Atordoado',
      type: 'attack',
      action_cost: 'main',
      valid_targets: ['enemies'],
      attack_formula: '1d20 + 10', // Garantir acerto vs defesa 11
      damage_formula: '2d6 + 4',
      damage_type: 'impacto',
      resource_cost: { name: 'mana', amount: 3 },
      apply_conditions: ['Atordoado']
    });

    const abilityActionRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${playerToken}` },
      body: JSON.stringify({
        actor_id: warriorCombatant.id,
        target_id: enemyCombatant.id,
        action_mode: 'ability',
        ability_id: offensiveAbility.id
      })
    });
    if (abilityActionRes.status !== 200) {
      console.log('ABILITY ACTION FAILED:', await abilityActionRes.text());
    }
    assert.strictEqual(abilityActionRes.status, 200, 'Cenário 3: Jogador deve conseguir usar habilidade contra inimigo');
    const abilityActionJson = await abilityActionRes.json();
    assert.strictEqual(abilityActionJson.hit, true, 'Golpe Devastador deve acertar');
    assert.ok(abilityActionJson.finalDamage > 0, 'Golpe deve causar dano');
    assert.ok(abilityActionJson.targetCombatant.current_hp < 40, 'HP do inimigo deve ter diminuído');

    // Verificar consumo do recurso mana (10 - 3 = 7)
    const warriorUpdated = characterService.getCharacterById(campaignId, warriorChar.id);
    assert.strictEqual(warriorUpdated.raw_data.mana_atual, 7, 'Cenário 3: 3 de mana devem ter sido consumidos');

    // =========================================================================
    // CENÁRIO 4: Jogador consegue curar um aliado quando permitido
    // =========================================================================
    // Cadastrar habilidade de cura
    const healAbility = rulesService.addAbilityDefinition(campaignId, {
      name: 'Luz Restauradora',
      description: 'Restaura vida de aliados',
      type: 'heal',
      action_cost: 'bonus',
      valid_targets: ['self', 'allies'],
      heal_formula: '1d8 + 5',
      resource_cost: { name: 'mana', amount: 2 }
    });

    const healActionRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${playerToken}` },
      body: JSON.stringify({
        actor_id: warriorCombatant.id,
        target_id: clericCombatant.id,
        action_mode: 'ability',
        ability_id: healAbility.id
      })
    });
    if (healActionRes.status !== 200) {
      console.log('HEAL ACTION FAILED:', await healActionRes.text());
    }
    assert.strictEqual(healActionRes.status, 200, 'Cenário 4: Habilidade de cura deve funcionar em aliado');
    const healActionJson = await healActionRes.json();
    assert.strictEqual(healActionJson.actionLog.action_type, 'heal');
    assert.ok(healActionJson.targetCombatant.current_hp > 15, 'HP da clériga deve ter aumentado');

    // =========================================================================
    // CENÁRIO 5: Consumível é removido do inventário após uso válido
    // =========================================================================
    // Adicionar poção ao inventário do guerreiro
    const potionItem = inventoryService.addItemToCharacter(campaignId, warriorChar.id, {
      itemName: 'Poção de Cura Menor',
      category: 'consumivel',
      quantity: 1,
      properties: {
        cura: 10,
        valid_targets: ['self', 'allies'],
        action_cost: 'free'
      }
    }, gmUser.id, true);

    const usePotionRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${playerToken}` },
      body: JSON.stringify({
        actor_id: warriorCombatant.id,
        target_id: warriorCombatant.id,
        action_mode: 'consumable',
        consumable_item_id: potionItem.id
      })
    });
    if (usePotionRes.status !== 200) {
      console.log('USE POTION FAILED:', await usePotionRes.text());
    }
    assert.strictEqual(usePotionRes.status, 200, 'Cenário 5: Uso de consumível deve ter sucesso');
    const usePotionJson = await usePotionRes.json();
    assert.strictEqual(usePotionJson.consumedItem.quantity, 0, 'Consumível deve ter sido consumido');

    // Verificar que o item foi removido da tabela character_inventory
    const invSummary = inventoryService.getCharacterInventory(campaignId, warriorChar.id);
    const potionInInv = invSummary.items.find(i => i.id === potionItem.id);
    assert.strictEqual(potionInInv, undefined, 'Cenário 5: Poção com quantidade 0 deve ter sido removida do inventário');

    // =========================================================================
    // CENÁRIO 6: Imbuição consome o item e aplica o efeito persistente à arma
    // =========================================================================
    // Adicionar espada e óleo de fogo ao inventário do guerreiro
    const swordItem = inventoryService.addItemToCharacter(campaignId, warriorChar.id, {
      itemName: 'Espada Longa',
      category: 'arma',
      quantity: 1,
      properties: { dano: '1d8', tipo_dano: 'cortante' }
    }, gmUser.id, true);

    const fireOilItem = inventoryService.addItemToCharacter(campaignId, warriorChar.id, {
      itemName: 'Óleo Incendiário',
      category: 'consumivel',
      quantity: 1,
      properties: {
        can_imbue: true,
        tipo_dano_imbuicao: 'fogo',
        dano_adicional_imbuicao: '1d6',
        cargas_imbuicao: 3
      }
    }, gmUser.id, true);

    const imbueRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${playerToken}` },
      body: JSON.stringify({
        actor_id: warriorCombatant.id,
        action_mode: 'imbue',
        consumable_item_id: fireOilItem.id,
        target_weapon_id: swordItem.id,
        action_cost: 'free'
      })
    });
    assert.strictEqual(imbueRes.status, 200, 'Cenário 6: Ação de imbuição em combate deve ser bem-sucedida');
    const imbueJson = await imbueRes.json();
    assert.ok(imbueJson.imbuedWeapon.properties.imbued_effects.length > 0, 'Arma deve conter o efeito imbuído persistente');
    assert.strictEqual(imbueJson.imbuedWeapon.properties.imbued_effects[0].damage_type, 'fogo');

    // =========================================================================
    // CENÁRIO 7: Alvo inválido é rejeitado
    // =========================================================================
    // Tentar curar o monstro inimigo com Luz Restauradora (que só permite 'self' e 'allies')
    const invalidTargetRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${playerToken}` },
      body: JSON.stringify({
        actor_id: warriorCombatant.id,
        target_id: enemyCombatant.id,
        action_mode: 'ability',
        ability_id: healAbility.id
      })
    });
    assert.strictEqual(invalidTargetRes.status, 400, 'Cenário 7: Cura em inimigo deve retornar 400 Bad Request');
    const invalidTargetJson = await invalidTargetRes.json();
    console.log('INVALID TARGET JSON:', invalidTargetJson);
    assert.ok(invalidTargetJson.error.includes('Alvo inválido'), 'Erro deve informar explicitamente que o alvo é inválido');

    // Tentar atacar aliado com Golpe Devastador (que só permite 'enemies')
    const invalidAtkRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${playerToken}` },
      body: JSON.stringify({
        actor_id: warriorCombatant.id,
        target_id: clericCombatant.id,
        action_mode: 'ability',
        ability_id: offensiveAbility.id
      })
    });
    assert.strictEqual(invalidAtkRes.status, 400, 'Cenário 7: Ataque contra aliado deve ser rejeitado');

    // =========================================================================
    // CENÁRIO 8: Personagem sem recursos não consegue executar uma habilidade que os exige
    // =========================================================================
    // Esgotar a mana do guerreiro (restavam 5 de mana: 10 - 3 - 2 = 5)
    // Tentar usar habilidade que custa 10 de mana
    const expensiveAbility = rulesService.addAbilityDefinition(campaignId, {
      name: 'Tempestade de Aço',
      description: 'Habilidade ultra potente',
      type: 'attack',
      action_cost: 'free',
      valid_targets: ['enemies'],
      damage_formula: '5d10',
      resource_cost: { name: 'mana', amount: 20 }
    });

    const noResourceRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${playerToken}` },
      body: JSON.stringify({
        actor_id: warriorCombatant.id,
        target_id: enemyCombatant.id,
        action_mode: 'ability',
        ability_id: expensiveAbility.id
      })
    });
    assert.strictEqual(noResourceRes.status, 400, 'Cenário 8: Habilidade sem recurso suficiente deve retornar 400');
    const noResourceJson = await noResourceRes.json();
    assert.ok(noResourceJson.error.includes('Recurso insuficiente'), 'Mensagem deve indicar recurso insuficiente');

    // =========================================================================
    // CENÁRIO 9: Uma ação não pode ser executada duas vezes por requisições duplicadas (Idempotência)
    // =========================================================================
    const idempotencyKey = 'req-unique-' + Date.now();
    const actionData = {
      actor_id: warriorCombatant.id,
      target_id: enemyCombatant.id,
      action_mode: 'weapon',
      weapon_id: swordItem.id,
      action_cost: 'free',
      idempotency_key: idempotencyKey
    };

    const firstCallRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${playerToken}` },
      body: JSON.stringify(actionData)
    });
    assert.strictEqual(firstCallRes.status, 200, 'Cenário 9: Primeira requisição deve ter sucesso');
    const firstCallJson = await firstCallRes.json();

    const secondCallRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${playerToken}` },
      body: JSON.stringify(actionData)
    });
    assert.strictEqual(secondCallRes.status, 200, 'Cenário 9: Segunda requisição idempotente deve retornar 200');
    const secondCallJson = await secondCallRes.json();

    // Os IDs dos logs e os resultados devem ser idênticos (veio do cache de idempotência, não duplicou o dano)
    assert.strictEqual(firstCallJson.actionLog.id, secondCallJson.actionLog.id, 'Cenário 9: Segunda requisição não deve duplicar ação');

    // =========================================================================
    // CENÁRIO 10: Custos de ação e iniciativa continuam funcionando corretamente
    // =========================================================================
    // Avançar turno para o clérigo
    combatService.nextTurn(campaignId, encounterId);
    const encTurn2 = combatService.getEncounterById(campaignId, encounterId, true);
    const activeCombatantTurn2 = encTurn2?.combatants?.[encTurn2.turn_index];
    assert.strictEqual(activeCombatantTurn2?.id, clericCombatant.id, 'Cenário 10: Turno deve ter avançado para a Clériga');

    // Tentar agir com o guerreiro durante o turno da clériga (sem ser mestre)
    const outOfTurnRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${playerToken}` },
      body: JSON.stringify({
        actor_id: warriorCombatant.id,
        target_id: enemyCombatant.id,
        action_mode: 'weapon',
        action_cost: 'main'
      })
    });
    assert.strictEqual(outOfTurnRes.status, 400, 'Cenário 10: Ação fora do turno deve ser rejeitada');

    // =========================================================================
    // CENÁRIO 11: Efeitos de dano contínuo e condições existentes continuam funcionando
    // =========================================================================
    // Aplicar sangramento no inimigo com DoT
    combatService.applyConditionToCombatant(campaignId, encounterId, enemyCombatant.id, {
      name: 'Sangrando',
      duration_remaining: 3,
      duration_type: 'turns',
      effects: {
        dot: { formula: '5', damage_type: 'fisico', trigger: 'turn_start' }
      }
    }, 'Mestre', true);

    const enemyBeforeDot = combatService.getCombatantById(campaignId, enemyCombatant.id)!;
    // Avançar turnos até chegar no inimigo
    combatService.nextTurn(campaignId, encounterId); // guarda
    combatService.nextTurn(campaignId, encounterId); // inimigo (aciona dot no turn_start)
    const enemyAfterDot = combatService.getCombatantById(campaignId, enemyCombatant.id)!;
    assert.ok(enemyAfterDot.current_hp! < enemyBeforeDot.current_hp!, 'Cenário 11: DoT deve ter causado dano ao iniciar o turno do inimigo');

    // =========================================================================
    // CENÁRIO 12: NPCs aliados podem receber efeitos de ações válidas
    // =========================================================================
    // Clériga cura Guarda Real (NPC aliado)
    const healAllyNpcRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${gmToken}` },
      body: JSON.stringify({
        actor_id: clericCombatant.id,
        target_id: allyNpcCombatant.id,
        action_mode: 'ability',
        ability_id: healAbility.id
      })
    });
    if (healAllyNpcRes.status !== 200) {
      console.log('HEAL ALLY NPC FAILED:', await healAllyNpcRes.text());
    }
    assert.strictEqual(healAllyNpcRes.status, 200, 'Cenário 12: NPC aliado deve ser alvo válido de cura');
    const healAllyNpcJson = await healAllyNpcRes.json();
    assert.ok(healAllyNpcJson.targetCombatant.current_hp > 10, 'NPC aliado deve ter recebido a cura');

    // =========================================================================
    // CENÁRIO 13: Alterações aparecem em tempo real para todos os participantes (WebSocket)
    // =========================================================================
    // Verificar que gmMessages e playerMessages receberam eventos de combate
    const actionLogs = playerMessages.filter(m => m.type === 'combat:action_logged');
    assert.ok(actionLogs.length > 0, 'Cenário 13: Jogador deve ter recebido eventos WebSocket de ação de combate');

    const invUpdates = playerMessages.filter(m => m.type === 'inventory:updated');
    assert.ok(invUpdates.length > 0, 'Cenário 13: Jogador deve ter recebido evento WebSocket de atualização de inventário');

    // =========================================================================
    // CENÁRIO 14: Dados permanecem corretos após atualizar a página ou consultar backend
    // =========================================================================
    const freshEncounter = combatService.getEncounterById(campaignId, encounterId, true);
    assert.ok(freshEncounter, 'Cenário 14: Encontro deve persistir');
    const freshWarrior = combatService.getCombatantById(campaignId, warriorCombatant.id);
    assert.strictEqual(freshWarrior?.current_hp, warriorCombatant.max_hp, 'HP deve persistir');
    const freshLogs = combatService.getCombatLogs(campaignId, encounterId);
    assert.ok(freshLogs.length >= 5, 'Histórico completo de logs deve persistir no banco');

    // =========================================================================
    // CENÁRIO 15: As permissões entre campanhas e personagens permanecem isoladas
    // =========================================================================
    // Criar outra campanha para outro mestre
    const otherReg = authService.register({ username: 'outro_mestre', email: 'outro@arcanum.vtt', password: 'Senha@123' });
    const otherUser = otherReg.user;
    const otherCampaign = campaignService.createCampaign(otherUser.id, { name: 'Outra Campanha' });

    // Tentar acessar encontro da primeira campanha com usuário não autorizado da outra campanha
    const otherToken = authService.login({ login: 'outro_mestre', password: 'Senha@123' }).token;
    const leakRes = await fetch(`${apiUrl}/campaigns/${campaignId}/combat/${encounterId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${otherToken}` },
      body: JSON.stringify({
        actor_id: warriorCombatant.id,
        target_id: enemyCombatant.id,
        action_mode: 'weapon'
      })
    });
    assert.strictEqual(leakRes.status, 403, 'Cenário 15: Usuário de outra campanha não pode executar ações');

    console.log('✔ Todos os 15 cenários de Ações Unificadas e Habilidades foram validados com sucesso!');
  } catch (err) {
    console.error('TEST ERROR:', err);
    throw err;
  } finally {
    if (gmWs) try { gmWs.close(); } catch {}
    if (playerWs) try { playerWs.close(); } catch {}
    server.close();
  }
});
