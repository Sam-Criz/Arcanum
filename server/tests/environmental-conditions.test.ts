import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import WebSocket from 'ws';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';
import { RealtimeServer } from '../src/modules/realtime/ws.server';
import { AuthService } from '../src/modules/auth/auth.service';
import { RbacService } from '../src/modules/permissions/rbac.service';

test('Fase 5 — Condições Ambientais (Mecânicas, Narrativas, Permissões, WebSocket e Isolamento)', async () => {
  const db = getDatabase(':memory:');
  const authService = new AuthService(db);
  const rbacService = new RbacService(db);
  const server = http.createServer();
  const realtimeServer = new RealtimeServer(server, authService, rbacService);
  const { app, masterToolsService, setRealtimeServer } = createApp(db, realtimeServer);
  setRealtimeServer(realtimeServer);
  server.on('request', app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;
  const wsUrl = `ws://localhost:${address.port}/ws`;

  const connectWsClient = (token: string, campaignId: string): Promise<{ ws: WebSocket; messages: any[] }> => {
    return new Promise((resolve) => {
      const ws = new WebSocket(wsUrl);
      const messages: any[] = [];

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth',
          token,
          campaignId
        }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          messages.push(msg);
          if (msg.type === 'auth:success') {
            resolve({ ws, messages });
          }
        } catch {}
      });
    });
  };

  let masterWs: any = null;
  let playerWs: any = null;

  try {
    // 1. Cadastrar Mestre e Jogadores
    const mRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mestre_env@test.com', username: 'MestreEnv', password: 'Password123!' })
    });
    const masterToken = (await mRes.json()).token;

    const pRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player_env@test.com', username: 'PlayerEnv', password: 'Password123!' })
    });
    const playerToken = (await pRes.json()).token;

    // Criar Campanha A e B
    const campARes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({ name: 'Campanha A Env' })
    });
    const campA = (await campARes.json()).campaign;

    const campBRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({ name: 'Campanha B Env' })
    });
    const campB = (await campBRes.json()).campaign;

    // Jogador entra na Campanha A
    const invRes = await fetch(`${baseUrl}/campaigns/${campA.id}/invites`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    const invCode = (await invRes.json()).invite.code;

    await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${playerToken}` },
      body: JSON.stringify({ code: invCode })
    });

    // Conectar WebSockets para o Mestre e para o Jogador na Campanha A
    masterWs = await connectWsClient(masterToken, campA.id);
    playerWs = await connectWsClient(playerToken, campA.id);

    // =========================================================================
    // 1. Criação de Condições Ambientais pelo Mestre
    // =========================================================================
    // 1.1 Condição Narrativa: "Chuva Torrencial" (visível e ativa)
    const rainRes = await fetch(`${baseUrl}/campaigns/${campA.id}/environmental-conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({
        name: 'Chuva Torrencial',
        description: 'Visibilidade reduzida e sons abafados',
        icon: 'cloud-rain',
        is_active: true,
        is_visible_to_players: true
      })
    });
    assert.strictEqual(rainRes.status, 201);
    const rainCond = (await rainRes.json()).condition;
    assert.strictEqual(rainCond.name, 'Chuva Torrencial');
    assert.strictEqual(rainCond.is_active, 1);
    assert.strictEqual(rainCond.is_visible_to_players, 1);

    // Aguardar propagação WebSocket
    await new Promise((r) => setTimeout(r, 60));

    // Validação WebSocket: Jogador comum e Mestre DEVEM receber o broadcast da condição visível
    const playerReceivedRain = playerWs.messages.find(m => 
      (m.type === 'scene:condition_updated' || m.type === 'environmental:created') &&
      m.condition?.id === rainCond.id
    );
    assert.ok(playerReceivedRain, 'Jogador comum deve receber evento WebSocket para condição visível ativa');
    assert.strictEqual(playerReceivedRain.condition.name, 'Chuva Torrencial');

    // 1.2 Criar Cena de Teste e Condição Mecânica com Cena: "Gás Venenoso"
    const sceneRes = await fetch(`${baseUrl}/campaigns/${campA.id}/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({ name: 'Masmorra dos Sussurros' })
    });
    const testScene = (await sceneRes.json()).scene;
    const testSceneId = testScene.id;

    const gasRes = await fetch(`${baseUrl}/campaigns/${campA.id}/environmental-conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({
        scene_id: testSceneId,
        name: 'Gás Venenoso',
        description: 'Causa 4 pontos de dano tóxico a cada rodada',
        icon: 'skull',
        is_active: true,
        is_visible_to_players: true,
        duration_rounds: 3,
        effect_payload: { formula: '4', damage_type: 'poison' }
      })
    });
    assert.strictEqual(gasRes.status, 201);
    const gasCond = (await gasRes.json()).condition;
    const gasMod = masterToolsService.environmental.evaluateConditionModifier(gasCond);
    assert.strictEqual(gasMod, 4, 'Condição mecânica com fórmula deve ser avaliada com precisão');

    // 1.3 Condição Oculta: "Névoa Ilusória do Covil" (is_visible_to_players = false)
    const hiddenRes = await fetch(`${baseUrl}/campaigns/${campA.id}/environmental-conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({
        scene_id: testSceneId,
        name: 'Névoa Ilusória do Covil',
        is_active: true,
        is_visible_to_players: false
      })
    });
    assert.strictEqual(hiddenRes.status, 201);
    const hiddenCond = (await hiddenRes.json()).condition;

    await new Promise((r) => setTimeout(r, 60));

    // Validação WebSocket de Segurança: Jogador comum NÃO PODE receber a condição oculta
    const playerReceivedHidden = playerWs.messages.find(m => 
      (m.type === 'scene:condition_updated' || m.type === 'environmental:created') &&
      m.condition?.id === hiddenCond.id
    );
    assert.strictEqual(playerReceivedHidden, undefined, 'Condição com is_visible_to_players = 0 NUNCA deve ser transmitida ao jogador via WebSocket');

    // =========================================================================
    // 2. Consulta de Jogadores (Filtro e Censura de Visibilidade na API)
    // =========================================================================
    // 2.1 GET geral de condições da campanha para o Jogador
    const playerGetRes = await fetch(`${baseUrl}/campaigns/${campA.id}/environmental-conditions`, {
      headers: { Authorization: `Bearer ${playerToken}` }
    });
    assert.strictEqual(playerGetRes.status, 200);
    const playerConds = (await playerGetRes.json()).conditions;
    assert.strictEqual(playerConds.length, 2);
    assert.ok(playerConds.some((c: any) => c.name === 'Chuva Torrencial'));
    assert.ok(playerConds.some((c: any) => c.name === 'Gás Venenoso'));
    assert.ok(!playerConds.some((c: any) => c.name === 'Névoa Ilusória do Covil'), 'Condição oculta estritamente omitida no payload do jogador');

    // 2.2 GET específico por cena: GET /api/campaigns/:campaignId/scenes/:sceneId/conditions
    const sceneCondsRes = await fetch(`${baseUrl}/campaigns/${campA.id}/scenes/${testSceneId}/conditions`, {
      headers: { Authorization: `Bearer ${playerToken}` }
    });
    assert.strictEqual(sceneCondsRes.status, 200);
    const sceneConds = (await sceneCondsRes.json()).conditions;
    // Retorna a condição da cena (Gás) e a condição global (Chuva), mas NÃO a oculta
    assert.strictEqual(sceneConds.length, 2);
    assert.ok(sceneConds.some((c: any) => c.name === 'Gás Venenoso'));
    assert.ok(sceneConds.some((c: any) => c.name === 'Chuva Torrencial'));
    assert.ok(!sceneConds.some((c: any) => c.name === 'Névoa Ilusória do Covil'));

    // 2.3 Mestre consultando a mesma cena vê TODAS as 3 condições (ativas, inativas, visíveis e ocultas)
    const masterSceneRes = await fetch(`${baseUrl}/campaigns/${campA.id}/scenes/${testSceneId}/conditions`, {
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    assert.strictEqual(masterSceneRes.status, 200);
    const masterSceneConds = (await masterSceneRes.json()).conditions;
    assert.strictEqual(masterSceneConds.length, 3);
    assert.ok(masterSceneConds.some((c: any) => c.name === 'Névoa Ilusória do Covil'));

    // 2.4 Tentativa direta do jogador de ler a condição oculta por ID -> 404
    const playerDirectGet = await fetch(`${baseUrl}/campaigns/${campA.id}/environmental-conditions/${hiddenCond.id}`, {
      headers: { Authorization: `Bearer ${playerToken}` }
    });
    assert.strictEqual(playerDirectGet.status, 404);

    // =========================================================================
    // 3. Ativação / Desativação (Toggle) e WebSocket de Remoção
    // =========================================================================
    const playerMsgCountBeforeToggle = playerWs.messages.length;

    // Mestre desativa Chuva Torrencial
    const toggleRes = await fetch(`${baseUrl}/campaigns/${campA.id}/environmental-conditions/${rainCond.id}/toggle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    assert.strictEqual(toggleRes.status, 200);
    const toggled = (await toggleRes.json()).condition;
    assert.strictEqual(toggled.is_active, 0);

    await new Promise((r) => setTimeout(r, 60));

    // Jogador recebe evento WebSocket indicando remoção (removed: true) da tela
    const newPlayerMsgs = playerWs.messages.slice(playerMsgCountBeforeToggle);
    const removeEvent = newPlayerMsgs.find(m => 
      (m.type === 'scene:condition_updated' || m.type === 'environmental:updated') &&
      m.removed === true &&
      (m.conditionId === rainCond.id || m.condition?.id === rainCond.id)
    );
    assert.ok(removeEvent, 'Jogador comum deve receber evento WebSocket de remoção ao desativar condição');

    // Jogador consulta novamente -> chuva inativa sumiu da lista do jogador
    const playerGetAfterToggle = await fetch(`${baseUrl}/campaigns/${campA.id}/environmental-conditions`, {
      headers: { Authorization: `Bearer ${playerToken}` }
    });
    const condsAfterToggle = (await playerGetAfterToggle.json()).conditions;
    assert.strictEqual(condsAfterToggle.length, 1);
    assert.strictEqual(condsAfterToggle[0].name, 'Gás Venenoso');

    // Jogador comum tenta criar ou deletar condição -> 403 Forbidden
    const unauthPost = await fetch(`${baseUrl}/campaigns/${campA.id}/environmental-conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${playerToken}` },
      body: JSON.stringify({ name: 'Hacker Storm' })
    });
    assert.strictEqual(unauthPost.status, 403);

    const unauthDel = await fetch(`${baseUrl}/campaigns/${campA.id}/environmental-conditions/${gasCond.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${playerToken}` }
    });
    assert.strictEqual(unauthDel.status, 403);

    // Mestre deleta a condição
    const delRes = await fetch(`${baseUrl}/campaigns/${campA.id}/environmental-conditions/${gasCond.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    assert.strictEqual(delRes.status, 200);

    // =========================================================================
    // 4. Isolamento entre Campanhas (Multi-Tenant)
    // =========================================================================
    // Condições de Campanha A não aparecem na Campanha B
    const campBCondsRes = await fetch(`${baseUrl}/campaigns/${campB.id}/environmental-conditions`, {
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    const campBConds = (await campBCondsRes.json()).conditions;
    assert.strictEqual(campBConds.length, 0);

  } finally {
    try { masterWs?.ws?.terminate(); } catch {}
    try { playerWs?.ws?.terminate(); } catch {}
    try { await realtimeServer.close(); } catch {}
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
