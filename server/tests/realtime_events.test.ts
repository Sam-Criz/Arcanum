import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';
import { RealtimeServer } from '../src/modules/realtime/ws.server';
import { AuthService } from '../src/modules/auth/auth.service';
import { RbacService } from '../src/modules/permissions/rbac.service';

test('Fase 6 — Entrega Direcionada de Eventos em Tempo Real e Persistência de Chat (realtime_events)', async () => {
  const tmpDbPath = path.join(__dirname, `test_realtime_${Date.now()}.db`);
  const db = getDatabase(tmpDbPath);
  const authService = new AuthService(db);
  const rbacService = new RbacService(db);
  const server = http.createServer();
  const realtimeServer = new RealtimeServer(server, authService, rbacService);
  const { app, setRealtimeServer } = createApp(db, realtimeServer);
  setRealtimeServer(realtimeServer);
  server.on('request', app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
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
  let p1Ws: any = null;
  let p2Ws: any = null;

  try {
    // 1. Cadastrar Mestre, Player 1 e Player 2
    const registerUser = async (email: string, username: string) => {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password: 'Password123!' })
      });
      return (await res.json()).token;
    };

    const tokenMaster = await registerUser('master_rt@test.com', 'MasterRT');
    const tokenPlayer1 = await registerUser('player1_rt@test.com', 'Player1RT');
    const tokenPlayer2 = await registerUser('player2_rt@test.com', 'Player2RT');

    const me1 = await (await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${tokenPlayer1}` } })).json();
    const player1Id = me1.user.id;

    // Criar Campanha
    const campRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMaster}` },
      body: JSON.stringify({ name: 'Campanha Realtime Events' })
    });
    const camp = (await campRes.json()).campaign;

    // Entrar na campanha
    const invRes = await fetch(`${baseUrl}/campaigns/${camp.id}/invites`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenMaster}` }
    });
    const invCode = (await invRes.json()).invite.code;

    await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPlayer1}` },
      body: JSON.stringify({ code: invCode })
    });
    await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPlayer2}` },
      body: JSON.stringify({ code: invCode })
    });

    // Conectar os 3 sockets via WebSocket
    masterWs = await connectWsClient(tokenMaster, camp.id);
    p1Ws = await connectWsClient(tokenPlayer1, camp.id);
    p2Ws = await connectWsClient(tokenPlayer2, camp.id);

    // =========================================================================
    // 1. ROLAGEM SECRETA: Entrega Exclusiva ao Mestre
    // =========================================================================
    const p2CountBeforeSecret = p2Ws.messages.length;

    // Player 1 realiza rolagem secreta
    const rollRes = await fetch(`${baseUrl}/campaigns/${camp.id}/rules/roll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPlayer1}` },
      body: JSON.stringify({
        expression: '1d20+5',
        isSecret: true
      })
    });
    assert.strictEqual(rollRes.status, 200);
    const rollBody = await rollRes.json();
    assert.strictEqual(rollBody.isSecret, true);
    assert.strictEqual(rollBody.total, undefined, 'Total da rolagem secreta omitido do payload do jogador comum');

    await new Promise((r) => setTimeout(r, 60));

    // Mestre deve ter recebido a rolagem com o total e breakdown
    const masterSecretRoll = masterWs.messages.find((m: any) => m.type === 'dice:rolled' && m.roll?.isSecret);
    assert.ok(masterSecretRoll, 'Mestre deve receber a rolagem secreta via WebSocket');
    assert.ok(typeof masterSecretRoll.roll.total === 'number');

    // Player 2 NUNCA pode ter recebido a rolagem secreta
    const p2SecretRoll = p2Ws.messages.slice(p2CountBeforeSecret).find((m: any) => m.type === 'dice:rolled');
    assert.strictEqual(p2SecretRoll, undefined, 'Outros jogadores nunca devem receber evento de rolagem secreta');

    // =========================================================================
    // 2. EVENTO DIRECIONADO: target_player vs master_only
    // =========================================================================
    const p1CountBefore = p1Ws.messages.length;
    const p2CountBefore = p2Ws.messages.length;

    // 2.1 Evento Master Only
    await fetch(`${baseUrl}/campaigns/${camp.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMaster}` },
      body: JSON.stringify({
        title: 'Segredo dos Sussurros',
        description: 'Vozes na cabeça do mestre',
        event_type: 'manual',
        visibility: 'master_only'
      })
    });

    await new Promise((r) => setTimeout(r, 60));

    // Nem Player 1 nem Player 2 receberam o evento master_only
    assert.ok(!p1Ws.messages.slice(p1CountBefore).some((m: any) => m.type === 'event:created'));
    assert.ok(!p2Ws.messages.slice(p2CountBefore).some((m: any) => m.type === 'event:created'));

    // 2.2 Evento direcionado ao Player 1 (target_player)
    const p1TargetCount = p1Ws.messages.length;
    const p2TargetCount = p2Ws.messages.length;

    await fetch(`${baseUrl}/campaigns/${camp.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMaster}` },
      body: JSON.stringify({
        title: 'Visão Arcana Pessoal',
        description: 'Apenas Player 1 enxerga a runa brilhando no chão',
        event_type: 'manual',
        visibility: 'target_player',
        target_user_id: player1Id
      })
    });

    await new Promise((r) => setTimeout(r, 60));

    // Player 1 recebeu
    assert.ok(p1Ws.messages.slice(p1TargetCount).some((m: any) => m.type === 'event:created' && m.event.title === 'Visão Arcana Pessoal'));

    // Player 2 NÃO recebeu
    assert.ok(!p2Ws.messages.slice(p2TargetCount).some((m: any) => m.type === 'event:created'));

    // =========================================================================
    // 3. PERSISTÊNCIA DE CHAT APÓS REINICIALIZAÇÃO DO BANCO
    // =========================================================================
    // Player 1 envia mensagem de chat
    const chatRes = await fetch(`${baseUrl}/campaigns/${camp.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPlayer1}` },
      body: JSON.stringify({ text: 'Protejam o flanco esquerdo!' })
    });
    assert.strictEqual(chatRes.status, 201);

    // Mestre envia mensagem de chat
    await fetch(`${baseUrl}/campaigns/${camp.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMaster}` },
      body: JSON.stringify({ text: 'Iniciativa rolada, comecem seus turnos!' })
    });

    // Fechar WebSockets e Servidor HTTP
    try { masterWs?.ws?.terminate(); } catch {}
    try { p1Ws?.ws?.terminate(); } catch {}
    try { p2Ws?.ws?.terminate(); } catch {}
    try { await realtimeServer.close(); } catch {}
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // REINICIALIZAÇÃO: Novo servidor abrindo o mesmo arquivo SQLite persistido em disco
    const restartedDb = getDatabase(tmpDbPath);
    const restartedServer = http.createServer();
    const restartedAppObj = createApp(restartedDb);
    restartedServer.on('request', restartedAppObj.app);

    await new Promise<void>((resolve) => restartedServer.listen(0, resolve));
    const newPort = (restartedServer.address() as any).port;
    const newBaseUrl = `http://localhost:${newPort}/api`;

    try {
      // Login do Player 1 no servidor reiniciado
      const loginRes = await fetch(`${newBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: 'player1_rt@test.com', password: 'Password123!' })
      });
      const newP1Token = (await loginRes.json()).token;

      // Consulta de histórico do chat
      const chatHistoryRes = await fetch(`${newBaseUrl}/campaigns/${camp.id}/chat`, {
        headers: { Authorization: `Bearer ${newP1Token}` }
      });
      assert.strictEqual(chatHistoryRes.status, 200);
      const chatHistory = (await chatHistoryRes.json()).messages;

      assert.strictEqual(chatHistory.length, 2, 'Todas as mensagens devem persistir no banco após reinicialização');
      assert.strictEqual(chatHistory[0].content, 'Protejam o flanco esquerdo!');
      assert.strictEqual(chatHistory[1].content, 'Iniciativa rolada, comecem seus turnos!');
    } finally {
      await new Promise<void>((resolve) => restartedServer.close(() => resolve()));
    }

  } finally {
    try { masterWs?.ws?.terminate(); } catch {}
    try { p1Ws?.ws?.terminate(); } catch {}
    try { p2Ws?.ws?.terminate(); } catch {}
    try { await realtimeServer.close(); } catch {}
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try { fs.unlinkSync(tmpDbPath); } catch {}
  }
});
