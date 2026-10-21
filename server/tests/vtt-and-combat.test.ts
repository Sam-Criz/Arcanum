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

test('Fase 3: Mesa Virtual (VTT), Cenas, Tokens, Visibilidade, Combate e Iniciativa', async () => {
  const db = getDatabase(':memory:');
  const authService = new AuthService(db);
  const rbacService = new RbacService(db);
  const rulesService = new RulesService(db);
  const campaignService = new CampaignService(db, rulesService);
  const characterService = new CharacterService(db, rulesService);
  const vttService = new VttService(db, characterService);
  const combatService = new CombatService(db, rulesService, characterService);

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

  // 1. Criar Mestre e Jogadores
  const masterAuth = authService.register({ email: 'mestre@vtt.com', username: 'MestreVTT', password: 'password123' });
  const player1Auth = authService.register({ email: 'p1@vtt.com', username: 'Player1', password: 'password123' });
  const player2Auth = authService.register({ email: 'p2@vtt.com', username: 'Player2', password: 'password123' });

  // 2. Mestre cria Campanha 1
  const campaign1 = campaignService.createCampaign(masterAuth.user.id, { name: 'Mansão Assombrada' });
  const invite1 = campaignService.createInvite(campaign1.id, { role: 'player' });
  campaignService.joinCampaignByInvite(invite1.code, player1Auth.user.id);
  campaignService.joinCampaignByInvite(invite1.code, player2Auth.user.id);

  // Mestre cria Campanha 2 isolada
  const campaign2 = campaignService.createCampaign(masterAuth.user.id, { name: 'Campanha Paralela 2' });

  // 3. Jogadores criam personagens na Campanha 1
  const char1 = characterService.createCharacter(campaign1.id, player1Auth.user.id, {
    name: 'Guerreiro Arthur',
    rawData: { vida_atual: 30, vida_maxima: 30, forca: 3, agilidade: 2 }
  });
  const char2 = characterService.createCharacter(campaign1.id, player2Auth.user.id, {
    name: 'Mago Merlin',
    rawData: { vida_atual: 20, vida_maxima: 20, forca: 1, agilidade: 3 }
  });

  // Conectar WebSockets autenticados
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

  const masterClient = await connectWsClient(masterAuth.token, campaign1.id);
  const p1Client = await connectWsClient(player1Auth.token, campaign1.id);
  const p2Client = await connectWsClient(player2Auth.token, campaign1.id);

  assert.strictEqual(masterClient.messages.some(m => m.type === 'auth:success'), true);
  assert.strictEqual(p1Client.messages.some(m => m.type === 'auth:success'), true);
  assert.strictEqual(p2Client.messages.some(m => m.type === 'auth:success'), true);

  masterClient.messages.length = 0;
  p1Client.messages.length = 0;
  p2Client.messages.length = 0;

  // ========================================================
  // ETAPA A: CENA — CRIAR, EDITAR, SALVAR E RESTAURAR
  // ========================================================
  // Mestre cria uma cena
  const createSceneRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/scenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      name: 'Hall de Entrada',
      image_url: 'https://images.unsplash.com/photo-hall.jpg',
      grid_type: 'square',
      grid_size: 60,
      grid_scale: 1.5,
      is_active: true
    })
  });
  assert.strictEqual(createSceneRes.status, 201);
  const { scene: scene1 } = await createSceneRes.json();
  assert.strictEqual(scene1.name, 'Hall de Entrada');
  assert.strictEqual(scene1.is_active, true);
  assert.strictEqual(scene1.grid_size, 60);

  // Jogador comum NÃO PODE criar cenas (403 Forbidden)
  const forbiddenSceneRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/scenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player1Auth.token}` },
    body: JSON.stringify({ name: 'Cena Ilícita' })
  });
  assert.strictEqual(forbiddenSceneRes.status, 403);

  // Mestre atualiza tamanho de grade e enquadramento da cena
  const updateSceneRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/scenes/${scene1.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({ grid_size: 70, grid_color: '#00ffcc' })
  });
  assert.strictEqual(updateSceneRes.status, 200);
  const { scene: updatedScene } = await updateSceneRes.json();
  assert.strictEqual(updatedScene.grid_size, 70);
  assert.strictEqual(updatedScene.grid_color, '#00ffcc');

  // Mestre adiciona Fog of War persistente
  const fogRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/scenes/${scene1.id}/fog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      fogEnabled: true,
      fogData: [{ x: 0, y: 0, width: 300, height: 300, hidden: true }]
    })
  });
  assert.strictEqual(fogRes.status, 200);
  const { scene: fogScene } = await fogRes.json();
  assert.strictEqual(fogScene.fog_enabled, true);
  assert.strictEqual(fogScene.fog_data.length, 1);

  // ========================================================
  // ETAPA B: TOKENS — CRIAÇÃO, PERMISSÕES, MOVIMENTO E SYNC
  // ========================================================
  // 1. Jogador 1 cria token para seu próprio personagem
  const createTokenP1Res = await fetch(`${apiUrl}/campaigns/${campaign1.id}/scenes/${scene1.id}/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player1Auth.token}` },
    body: JSON.stringify({
      character_id: char1.id,
      x: 100,
      y: 100,
      size: 1
    })
  });
  assert.strictEqual(createTokenP1Res.status, 201);
  const { token: tokenP1 } = await createTokenP1Res.json();
  assert.strictEqual(tokenP1.name, 'Guerreiro Arthur');
  assert.strictEqual(tokenP1.current_hp, 30);
  assert.strictEqual(tokenP1.x, 100);

  // 2. Jogador 1 TENTA criar token usando personagem do Jogador 2 (Deve ser rejeitado com 403)
  const maliciousTokenRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/scenes/${scene1.id}/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player1Auth.token}` },
    body: JSON.stringify({
      character_id: char2.id,
      x: 200,
      y: 200
    })
  });
  assert.strictEqual(maliciousTokenRes.status, 403);

  // 3. Mestre cria token NPC oculto (monstro no fog)
  const monsterTokenRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/scenes/${scene1.id}/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      name: 'Cultista das Sombras',
      x: 500,
      y: 500,
      size: 1,
      is_visible: false,
      current_hp: 15,
      max_hp: 15
    })
  });
  assert.strictEqual(monsterTokenRes.status, 201);
  const { token: monsterToken } = await monsterTokenRes.json();
  assert.strictEqual(monsterToken.is_visible, false);

  // 4. Verificação de Visibilidade: Jogadores comuns NUNCA recebem tokens com is_visible = 0
  const p1TokensRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/scenes/${scene1.id}/tokens`, {
    headers: { 'Authorization': `Bearer ${player1Auth.token}` }
  });
  const { tokens: p1Tokens } = await p1TokensRes.json();
  assert.strictEqual(p1Tokens.some((t: any) => t.id === monsterToken.id), false, 'Jogador não pode ver token invisível');
  assert.strictEqual(p1Tokens.some((t: any) => t.id === tokenP1.id), true);

  // Mestre lista todos os tokens incluindo o invisível
  const masterTokensRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/scenes/${scene1.id}/tokens`, {
    headers: { 'Authorization': `Bearer ${masterAuth.token}` }
  });
  const { tokens: masterTokens } = await masterTokensRes.json();
  assert.strictEqual(masterTokens.some((t: any) => t.id === monsterToken.id), true, 'Mestre deve ver tokens invisíveis');

  // 5. Movimentação Autorizada: Jogador 1 move seu próprio token
  masterClient.messages.length = 0;
  p2Client.messages.length = 0;

  const moveRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/tokens/${tokenP1.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player1Auth.token}` },
    body: JSON.stringify({ x: 250, y: 300 })
  });
  assert.strictEqual(moveRes.status, 200);
  const { token: movedToken } = await moveRes.json();
  assert.strictEqual(movedToken.x, 250);
  assert.strictEqual(movedToken.y, 300);

  // Aguarda propagação WebSocket
  await new Promise(r => setTimeout(r, 100));

  // Mestre e Jogador 2 recebem a atualização de movimento via WebSocket em tempo real
  const masterMoveMsg = masterClient.messages.find(m => m.type === 'token:updated' && m.token?.id === tokenP1.id);
  assert.ok(masterMoveMsg, 'Mestre deve receber atualização do token via WebSocket');
  assert.strictEqual(masterMoveMsg.token.x, 250);

  const p2MoveMsg = p2Client.messages.find(m => m.type === 'token:updated' && m.token?.id === tokenP1.id);
  assert.ok(p2MoveMsg, 'Jogador 2 deve receber movimentação autorizada de Jogador 1');
  assert.strictEqual(p2MoveMsg.token.x, 250);

  // 6. Tentativa Não Autorizada: Jogador 2 TENTA mover o token de Jogador 1 (Rejeitado com 403)
  const unauthorizedMoveRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/tokens/${tokenP1.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player2Auth.token}` },
    body: JSON.stringify({ x: 999, y: 999 })
  });
  assert.strictEqual(unauthorizedMoveRes.status, 403);

  // Token permaneceu na posição 250, 300
  const checkToken = vttService.getTokenById(campaign1.id, tokenP1.id);
  assert.strictEqual(checkToken?.x, 250);

  // ========================================================
  // ETAPA C: COMBATE, INICIATIVA, TURNOS E DANO/CURA EM FICHA
  // ========================================================
  // 1. Mestre inicia combate
  const startCombatRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({ name: 'Emboscada no Hall', scene_id: scene1.id })
  });
  assert.strictEqual(startCombatRes.status, 201);
  const { encounter } = await startCombatRes.json();
  assert.strictEqual(encounter.name, 'Emboscada no Hall');
  assert.strictEqual(encounter.round, 1);
  assert.strictEqual(encounter.status, 'prep');

  // 2. Mestre adiciona combatentes (Arthur, Merlin e Cultista)
  const addArthurRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/combatants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      character_id: char1.id,
      token_id: tokenP1.id,
      initiative_formula: '1d20 + agilidade'
    })
  });
  assert.strictEqual(addArthurRes.status, 201);
  const { combatant: combatantArthur } = await addArthurRes.json();

  const addMerlinRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/combatants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      character_id: char2.id,
      initiative_formula: '1d20 + agilidade'
    })
  });
  assert.strictEqual(addMerlinRes.status, 201);
  const { combatant: combatantMerlin } = await addMerlinRes.json();

  const addCultistRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/combatants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      name: 'Cultista',
      initiative_formula: '1d20',
      is_npc: true,
      current_hp: 15,
      max_hp: 15
    })
  });
  assert.strictEqual(addCultistRes.status, 201);
  const { combatant: combatantCultist } = await addCultistRes.json();

  // 3. Mestre rola iniciativa para todos
  const initRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/initiative`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({})
  });
  assert.strictEqual(initRes.status, 200);
  const { encounter: encAfterInit } = await initRes.json();
  assert.strictEqual(encAfterInit.combatants.length, 3);
  // Devem estar ordenados por iniciativa decrescente
  for (let i = 0; i < encAfterInit.combatants.length - 1; i++) {
    assert.ok(encAfterInit.combatants[i].initiative >= encAfterInit.combatants[i + 1].initiative);
  }

  // 4. Avanço de Turnos
  const nextTurnRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({})
  });
  assert.strictEqual(nextTurnRes.status, 200);
  const { encounter: encTurn1 } = await nextTurnRes.json();
  assert.strictEqual(encTurn1.status, 'active');
  assert.strictEqual(encTurn1.turn_index, 1);
  assert.strictEqual(encTurn1.round, 1);

  // 5. Ação de Combate: Cultista causa dano em Arthur
  // Arthur tinha 30 de vida_atual. Dano de 8 -> deve ficar com 22 na ficha e no combatente
  const damageActionRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      actor_id: combatantCultist.id,
      actor_name: 'Cultista',
      target_id: combatantArthur.id,
      action_type: 'damage',
      resource_name: 'vida',
      amount: 8
    })
  });
  assert.strictEqual(damageActionRes.status, 200);
  const damageResult = await damageActionRes.json();
  assert.strictEqual(damageResult.targetCombatant.current_hp, 22);
  assert.strictEqual(damageResult.actionLog.amount, 8);
  assert.strictEqual(damageResult.updatedCharacter.raw_data.vida_atual, 22);

  // Verifica persistência real no banco de dados da ficha de Arthur
  const arthurFresh = characterService.getCharacterById(campaign1.id, char1.id);
  assert.strictEqual(arthurFresh?.raw_data.vida_atual, 22);

  // 6. Ação de Combate: Cura de 5 pontos em Arthur
  const healActionRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      actor_id: combatantMerlin.id,
      actor_name: 'Merlin',
      target_id: combatantArthur.id,
      action_type: 'heal',
      resource_name: 'vida',
      amount: 5
    })
  });
  assert.strictEqual(healActionRes.status, 200);
  const healResult = await healActionRes.json();
  assert.strictEqual(healResult.targetCombatant.current_hp, 27);
  assert.strictEqual(healResult.updatedCharacter.raw_data.vida_atual, 27);

  // 7. Consulta de histórico de combate
  const combatLogsRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/logs`, {
    headers: { 'Authorization': `Bearer ${player1Auth.token}` }
  });
  assert.strictEqual(combatLogsRes.status, 200);
  const { logs } = await combatLogsRes.json();
  assert.ok(logs.length >= 3);
  assert.ok(logs.some((l: any) => l.action_type === 'damage' && l.amount === 8));
  assert.ok(logs.some((l: any) => l.action_type === 'heal' && l.amount === 5));

  // 8. Isolamento Multi-Tenant: Usuários de outra campanha não podem acessar encontros nem cenas da Campanha 1
  const outsiderAuth = authService.register({ email: 'outsider@vtt.com', username: 'Outsider', password: 'password123' });
  const isolatedSceneRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/scenes`, {
    headers: { 'Authorization': `Bearer ${outsiderAuth.token}` }
  });
  assert.strictEqual(isolatedSceneRes.status, 403);

  const isolatedCombatRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/active`, {
    headers: { 'Authorization': `Bearer ${outsiderAuth.token}` }
  });
  assert.strictEqual(isolatedCombatRes.status, 403);

  // ========================================================
  // ETAPA D: CONTROLE DE TAMANHO DE TOKENS, MAPAS RETANGULARES E FOG DE REVELAÇÃO
  // ========================================================
  // 1. Mestre redimensiona token com tamanhos fracionários (0.5x, 1.5x, 2.5x)
  const resizeRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/tokens/${tokenP1.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({ size: 1.5 })
  });
  assert.strictEqual(resizeRes.status, 200);
  const { token: resizedToken } = await resizeRes.json();
  assert.strictEqual(resizedToken.size, 1.5, 'Tamanho de token 1.5x deve ser persistido');

  // 2. Mestre cria cena retangular com dimensões exatas de imagem (1920x1080)
  const rectangularSceneRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/scenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      name: 'Masmorra Retangular 16:9',
      image_url: 'https://images.unsplash.com/dungeon-1080p.jpg',
      width: 1920,
      height: 1080,
      grid_size: 60
    })
  });
  assert.strictEqual(rectangularSceneRes.status, 201);
  const { scene: rectScene } = await rectangularSceneRes.json();
  assert.strictEqual(rectScene.width, 1920);
  assert.strictEqual(rectScene.height, 1080);

  // 3. Fog of War com operações encadeadas de ocultação e revelação com corte (punch-out)
  const sequentialFogRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/scenes/${rectScene.id}/fog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      fogEnabled: true,
      fogData: [
        { type: 'hide', hidden: true, x: 0, y: 0, width: 1920, height: 1080 },
        { type: 'reveal', hidden: false, x: 100, y: 100, width: 400, height: 300 }
      ]
    })
  });
  assert.strictEqual(sequentialFogRes.status, 200);
  const { scene: seqFogScene } = await sequentialFogRes.json();
  assert.strictEqual(seqFogScene.fog_enabled, true);
  assert.strictEqual(seqFogScene.fog_data.length, 2);
  assert.strictEqual(seqFogScene.fog_data[0].type, 'hide');
  assert.strictEqual(seqFogScene.fog_data[1].type, 'reveal');
  assert.strictEqual(seqFogScene.fog_data[1].hidden, false);

  // ========================================================
  // ETAPA E: NPCS COM ATRIBUTOS DEFENSIVOS E AÇÕES TÁTICAS DE COMBATE (ARMAS, HABILIDADES E RESISTÊNCIAS)
  // ========================================================
  try {
  // 1. Mestre cria token NPC com atributos defensivos e resistências no mapa
  const createNpcTokenRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/scenes/${scene1.id}/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      name: 'Golem de Ferro',
      avatar_url: 'https://images.unsplash.com/iron-golem.png',
      size: 2,
      x: 350,
      y: 350,
      current_hp: 40,
      max_hp: 40,
      npc_data: {
        defense: 15,
        damage_reduction: 3,
        resistances: ['fogo', 'corte'],
        vulnerabilities: ['frio'],
        immunities: ['veneno'],
        initiative_formula: '1d20+2',
        current_hp: 40,
        max_hp: 40
      }
    })
  });
  assert.strictEqual(createNpcTokenRes.status, 201);
  const { token: golemToken } = await createNpcTokenRes.json();
  assert.strictEqual(golemToken.name, 'Golem de Ferro');
  assert.strictEqual(golemToken.npc_data.defense, 15);
  assert.strictEqual(golemToken.npc_data.damage_reduction, 3);
  assert.ok(golemToken.npc_data.resistances.includes('fogo'));
  assert.ok(golemToken.npc_data.resistances.includes('corte'));
  assert.ok(golemToken.npc_data.vulnerabilities.includes('frio'));
  assert.ok(golemToken.npc_data.immunities.includes('veneno'));

  // 2. Mestre adiciona o NPC ao combate pelo token_id, herdando os atributos defensivos
  const addGolemCombatantRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/combatants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      token_id: golemToken.id
    })
  });
  assert.strictEqual(addGolemCombatantRes.status, 201);
  const { combatant: golemCombatant } = await addGolemCombatantRes.json();
  assert.strictEqual(golemCombatant.name, 'Golem de Ferro');
  assert.strictEqual(golemCombatant.defense, 15);
  assert.strictEqual(golemCombatant.damage_reduction, 3);
  assert.strictEqual(golemCombatant.current_hp, 40);
  assert.ok(golemCombatant.npc_data.resistances.includes('corte'));

  // 3. Segurança RBAC: Jogador comum NÃO pode aplicar dano manual arbitrário (action_mode === 'manual')
  const unauthorizedManualRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player1Auth.token}` },
    body: JSON.stringify({
      action_mode: 'manual',
      target_id: golemCombatant.id,
      amount: 25,
      resource_name: 'vida'
    })
  });
  assert.strictEqual(unauthorizedManualRes.status, 403, 'Apenas o mestre pode aplicar ajustes manuais arbitrários de dano');

  // 4. Jogador NÃO pode atacar com uma arma inexistente no inventário
  const fakeWeaponRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player1Auth.token}` },
    body: JSON.stringify({
      action_mode: 'weapon',
      actor_id: combatantArthur.id,
      target_id: golemCombatant.id,
      weapon_id: 'fake-weapon-uuid'
    })
  });
  assert.strictEqual(fakeWeaponRes.status, 400);

  // 5. Adicionar arma legítima ao inventário do Personagem 1 (Espada Vorpal de Corte)
  const addWeaponRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/characters/${char1.id}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      itemName: 'Espada de Aço',
      category: 'arma',
      quantity: 1,
      weight: 3,
      isEquipped: true
    })
  });
  assert.strictEqual(addWeaponRes.status, 201);
  const { item: swordItem } = await addWeaponRes.json();

  // Atualizar propriedades da arma com dano cortante e attack_formula
  db.prepare(`
    UPDATE character_inventory
    SET properties_json = ?
    WHERE id = ?
  `).run(JSON.stringify({
    damage_formula: '10',
    damage_type: 'corte',
    attack_formula: '1' // Ataque baixo para testar erro (miss)
  }), swordItem.id);

  // 6. Testar Ataque que ERRA a Defesa (Roll: 1 vs Defesa: 15)
  // Garantir que é o turno de Arthur para testes de ação do jogador
  const encCombatants = combatService.getCombatants(campaign1.id, encounter.id, true);
  const arthurTurnIdx = encCombatants.findIndex(c => c.id === combatantArthur.id);
  if (arthurTurnIdx !== -1) {
    db.prepare('UPDATE combat_encounters SET turn_index = ? WHERE id = ?').run(arthurTurnIdx, encounter.id);
  }

  const missAttackRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player1Auth.token}` },
    body: JSON.stringify({
      action_mode: 'weapon',
      actor_id: combatantArthur.id,
      target_id: golemCombatant.id,
      weapon_id: swordItem.id
    })
  });
  assert.strictEqual(missAttackRes.status, 200);
  const missResult = await missAttackRes.json();
  assert.strictEqual(missResult.hit, false, 'Ataque menor que a defesa deve errar');
  assert.strictEqual(missResult.targetCombatant.current_hp, 40, 'PV do alvo não deve mudar em caso de erro');

  // 7. Testar Ataque que ACERTA, com Redução de Dano (RD) e Resistência (50% de dano por 'corte')
  // Dano: 10, RD: 3 => Dano após RD = 7. Resistência a corte (50%) => Math.floor(7 / 2) = 3 de dano.
  // PV do Golem deve ir de 40 para 37.
  db.prepare(`
    UPDATE character_inventory
    SET properties_json = ?
    WHERE id = ?
  `).run(JSON.stringify({
    damage_formula: '10',
    damage_type: 'corte',
    attack_formula: '20' // Acerta contra Defesa 15
  }), swordItem.id);

  db.prepare(`
    UPDATE combatants
    SET actions_used_json = '{}'
    WHERE id = ?
  `).run(combatantArthur.id);

  const hitResistAttackRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player1Auth.token}` },
    body: JSON.stringify({
      action_mode: 'weapon',
      actor_id: combatantArthur.id,
      target_id: golemCombatant.id,
      weapon_id: swordItem.id
    })
  });
  assert.strictEqual(hitResistAttackRes.status, 200);
  const hitResistResult = await hitResistAttackRes.json();
  assert.strictEqual(hitResistResult.hit, true);
  assert.strictEqual(hitResistResult.finalDamage, 3, '10 dano - 3 RD = 7. Resistência 50% = 3 dano final');
  assert.strictEqual(hitResistResult.targetCombatant.current_hp, 37, 'PV do alvo deve reduzir para 37');

  // 8. Testar Ataque com Vulnerabilidade ('frio', 200% de dano)
  // Dano: 8, RD: 3 => Dano após RD = 5. Vulnerabilidade (2x) => 5 * 2 = 10 de dano.
  // PV do Golem deve ir de 37 para 27.
  const frostAbilityRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      action_mode: 'ability',
      ability_name: 'Sopro Gélido',
      actor_id: combatantArthur.id,
      target_id: golemCombatant.id,
      formula: '8',
      damage_type: 'frio',
      attack_formula: '18'
    })
  });
  assert.strictEqual(frostAbilityRes.status, 200);
  const frostResult = await frostAbilityRes.json();
  assert.strictEqual(frostResult.hit, true);
  assert.strictEqual(frostResult.finalDamage, 10, '8 dano - 3 RD = 5. Vulnerabilidade 2x = 10 dano final');
  assert.strictEqual(frostResult.targetCombatant.current_hp, 27);

  // 9. Testar Ataque com Imunidade ('veneno', 0 de dano)
  // Golem é imune a veneno. Dano final deve ser 0 e PV permanecer 27.
  const poisonAbilityRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAuth.token}` },
    body: JSON.stringify({
      action_mode: 'ability',
      ability_name: 'Gás Venenoso',
      actor_id: combatantArthur.id,
      target_id: golemCombatant.id,
      formula: '15',
      damage_type: 'veneno',
      attack_formula: '19'
    })
  });
  assert.strictEqual(poisonAbilityRes.status, 200);
  const poisonResult = await poisonAbilityRes.json();
  assert.strictEqual(poisonResult.hit, true);
  assert.strictEqual(poisonResult.finalDamage, 0, 'Imunidade a veneno deve zerar o dano');
  assert.strictEqual(poisonResult.targetCombatant.current_hp, 27, 'PV não deve mudar em imunidade');

  // 10. Testar Habilidade com Custo de Recurso (Consumo de Mana)
  // Inicializa mana do Personagem 1 com 20
  db.prepare(`
    UPDATE characters
    SET raw_data_json = ?, computed_data_json = ?
    WHERE id = ?
  `).run(
    JSON.stringify({ ...char1.raw_data, mana: 20 }),
    JSON.stringify({
      ...char1.computed_data,
      mana: 20,
      mana_max: 20
    }),
    char1.id
  );

  db.prepare(`
    UPDATE combatants
    SET actions_used_json = '{}'
    WHERE id = ?
  `).run(combatantArthur.id);

  // Executa magia gastando 5 de mana
  const manaSpellRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player1Auth.token}` },
    body: JSON.stringify({
      action_mode: 'ability',
      ability_name: 'Dardo Arcano',
      actor_id: combatantArthur.id,
      target_id: golemCombatant.id,
      resource_cost_name: 'mana',
      resource_cost_amount: 5,
      formula: '10',
      damage_type: 'energia',
      attack_formula: '20'
    })
  });
  assert.strictEqual(manaSpellRes.status, 200);

  // Verificar que a mana do personagem foi deduzida no banco de dados para 15
  const updatedCharRow = db.prepare('SELECT computed_data_json FROM characters WHERE id = ?').get(char1.id) as any;
  const updatedCharData = JSON.parse(updatedCharRow.computed_data_json);
  assert.strictEqual(updatedCharData.mana, 15, 'Mana deve ser deduzida atomicamente');

  // Tentar gastar mais mana do que possui (25 de mana quando tem 15) deve ser rejeitado com 400
  const excessManaRes = await fetch(`${apiUrl}/campaigns/${campaign1.id}/combat/${encounter.id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${player1Auth.token}` },
    body: JSON.stringify({
      action_mode: 'ability',
      ability_name: 'Meteoro Devastador',
      actor_id: combatantArthur.id,
      target_id: golemCombatant.id,
      resource_cost_name: 'mana',
      resource_cost_amount: 25,
      formula: '50'
    })
  });
  assert.strictEqual(excessManaRes.status, 400, 'Gasto de recurso maior que o disponível deve falhar');

  // 11. Verificar que o token do Golem no mapa foi sincronizado com o PV atual (17 PV após dardo arcano)
  // Golem tinha 27 PV. Dardo arcano deu 10 de dano energia - 3 RD = 7 de dano. 27 - 7 = 20 PV.
  const tokenRow = db.prepare('SELECT current_hp, npc_data_json FROM tokens WHERE id = ?').get(golemToken.id) as any;
  assert.strictEqual(Number(tokenRow.current_hp), 20, 'PV do token no banco de dados SQLite deve estar sincronizado');
  } catch (err: any) {
    console.error('*** ETAPA E FAILURE DETAIL ***:', err.message, err.stack);
    throw err;
  } finally {
    // Limpeza garantida
    try { masterClient.ws.terminate(); } catch {}
    try { p1Client.ws.terminate(); } catch {}
    try { p2Client.ws.terminate(); } catch {}
    await realtimeServer.close();
    (server as any).closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});
