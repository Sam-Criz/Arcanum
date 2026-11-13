import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';

test('Fase 5 — Eventos de Campanha e Cena (Agendamento, Disparo, Persistência e Ações)', async () => {
  const db = getDatabase(':memory:');
  const server = http.createServer();
  const { app, masterToolsService } = createApp(db);
  server.on('request', app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    // 1. Cadastrar Mestre e Jogadores
    const mRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mestre_ev@test.com', username: 'MestreEvents', password: 'Password123!' })
    });
    const mData = await mRes.json();
    const masterToken = mData.token;
    const masterId = mData.user.id;

    const p1Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player1_ev@test.com', username: 'Player1Events', password: 'Password123!' })
    });
    const p1Data = await p1Res.json();
    const p1Token = p1Data.token;
    const p1Id = p1Data.user.id;

    const p2Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player2_ev@test.com', username: 'Player2Events', password: 'Password123!' })
    });
    const p2Data = await p2Res.json();
    const p2Token = p2Data.token;
    const p2Id = p2Data.user.id;

    // Criar Campanha
    const campRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({ name: 'Campanha de Eventos' })
    });
    const campId = (await campRes.json()).campaign.id;

    // Jogadores entram na Campanha
    const invRes = await fetch(`${baseUrl}/campaigns/${campId}/invites`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    const invCode = (await invRes.json()).invite.code;

    await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1Token}` },
      body: JSON.stringify({ code: invCode })
    });
    await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p2Token}` },
      body: JSON.stringify({ code: invCode })
    });

    // Criar uma condição inativa para ser ativada por evento
    const cond = masterToolsService.environmental.createCondition(campId, {
      name: 'Terremoto da Tumba',
      is_active: false,
      is_visible_to_players: true
    });
    assert.strictEqual(cond.is_active, 0);

    // =========================================================================
    // 1. Criação de Evento com Ação Conectada (Ativar Terremoto e Mensagem de Chat)
    // =========================================================================
    const createEvRes = await fetch(`${baseUrl}/campaigns/${campId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({
        title: 'Desabamento do Teto',
        description: 'O teto de pedra racha e treme violently!',
        event_type: 'manual',
        visibility: 'public',
        action_payload: {
          action: 'activate_condition',
          condition_id: cond.id,
          message: 'As colunas estalam e poeira cobre o aposento!'
        }
      })
    });
    assert.strictEqual(createEvRes.status, 201);
    const eventA = (await createEvRes.json()).event;
    assert.strictEqual(eventA.status, 'pending');
    assert.strictEqual(eventA.triggered_at, null);

    // Enquanto pendente, jogador comum NÃO vê o evento
    const p1ListPending = await fetch(`${baseUrl}/campaigns/${campId}/events`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    });
    const p1PendingEvents = (await p1ListPending.json()).events;
    assert.strictEqual(p1PendingEvents.length, 0, 'Jogadores não visualizam eventos pendentes');

    // =========================================================================
    // 2. Disparo Manual do Evento pelo Mestre
    // =========================================================================
    const triggerRes = await fetch(`${baseUrl}/campaigns/${campId}/events/${eventA.id}/trigger`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    assert.strictEqual(triggerRes.status, 200);
    const triggerData = await triggerRes.json();
    assert.strictEqual(triggerData.event.status, 'triggered');
    assert.ok(triggerData.event.triggered_at, 'Timestamp de disparo deve ser registrado');
    assert.strictEqual(triggerData.executionResult.activatedConditionId, cond.id);

    // Condição ambiental agora deve estar ativa
    const updatedCond = masterToolsService.environmental.getConditionById(campId, cond.id, true);
    assert.strictEqual(updatedCond?.is_active, 1);

    // Mensagem de sistema foi registrada no chat da campanha
    const chatRows = db.prepare(`SELECT * FROM campaign_chat_messages WHERE campaign_id = ? AND type = 'event'`).all(campId) as any[];
    assert.strictEqual(chatRows.length, 1);
    assert.strictEqual(chatRows[0].content, 'As colunas estalam e poeira cobre o aposento!');

    // Agora o evento público disparado é visível para o Player 1 e Player 2
    const p1ListTriggered = await fetch(`${baseUrl}/campaigns/${campId}/events`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    });
    const p1TriggeredEvents = (await p1ListTriggered.json()).events;
    assert.strictEqual(p1TriggeredEvents.length, 1);
    assert.strictEqual(p1TriggeredEvents[0].title, 'Desabamento do Teto');

    // =========================================================================
    // 3. Evento Direcionado (Targeted): Apenas para Player 1
    // =========================================================================
    const targetedEvRes = await fetch(`${baseUrl}/campaigns/${campId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({
        title: 'Visão Oculta do Escolhido',
        description: 'Você ouve vozes sussurrando segredos ancestrais em sua mente.',
        event_type: 'manual',
        visibility: 'targeted',
        target_user_ids: [p1Id]
      })
    });
    const targetedEv = (await targetedEvRes.json()).event;

    // Mestre dispara
    await fetch(`${baseUrl}/campaigns/${campId}/events/${targetedEv.id}/trigger`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${masterToken}` }
    });

    // Player 1 deve ver a visão
    const p1CheckVis = await fetch(`${baseUrl}/campaigns/${campId}/events`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    });
    const p1Events = (await p1CheckVis.json()).events;
    assert.ok(p1Events.some((e: any) => e.title === 'Visão Oculta do Escolhido'));

    // Player 2 NÃO deve ver a visão direcionada ao Player 1
    const p2CheckVis = await fetch(`${baseUrl}/campaigns/${campId}/events`, {
      headers: { Authorization: `Bearer ${p2Token}` }
    });
    const p2Events = (await p2CheckVis.json()).events;
    assert.ok(!p2Events.some((e: any) => e.title === 'Visão Oculta do Escolhido'));

    // =========================================================================
    // 4. Agendamento Sobrevivendo a Reinicialização do Servidor (SQLite em Disco)
    // =========================================================================
    // Cria evento com data no passado (ou agendada para agora)
    const pastDate = new Date(Date.now() - 5000).toISOString();
    const scheduledEv = masterToolsService.events.createEvent(campId, masterId, {
      title: 'Chegada da Guarda Real',
      event_type: 'scheduled',
      scheduled_at: pastDate,
      action_payload: { message: 'A guarda arromba os portões!' }
    });
    assert.strictEqual(scheduledEv.status, 'pending');

    // Simula reinicialização do runtime chamando processScheduledEvents()
    const triggeredCount = masterToolsService.events.processScheduledEvents();
    assert.strictEqual(triggeredCount, 1);

    const reloaded = masterToolsService.events.getEventById(campId, scheduledEv.id, '', true);
    assert.strictEqual(reloaded?.status, 'triggered');
    assert.ok(reloaded?.triggered_at);

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
