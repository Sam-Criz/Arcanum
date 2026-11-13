import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';

test('Fase 5 — Segurança de Notas Secretas do Mestre (/security_auditor: Isolamento e Vazamento Zero)', async () => {
  const db = getDatabase(':memory:');
  const server = http.createServer();
  const { app } = createApp(db);
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
      body: JSON.stringify({ email: 'mestre_notes@test.com', username: 'MestreNotes', password: 'Password123!' })
    });
    const masterToken = (await mRes.json()).token;

    const p1Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player1_notes@test.com', username: 'Player1Notes', password: 'Password123!' })
    });
    const p1Data = await p1Res.json();
    const p1Token = p1Data.token;
    const p1Id = p1Data.user.id;

    const p2Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player2_notes@test.com', username: 'Player2Notes', password: 'Password123!' })
    });
    const p2Data = await p2Res.json();
    const p2Token = p2Data.token;

    // Criar Campanha A e B
    const campARes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({ name: 'Campanha A Notas' })
    });
    const campAId = (await campARes.json()).campaign.id;

    const campBRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({ name: 'Campanha B Notas' })
    });
    const campBId = (await campBRes.json()).campaign.id;

    // Jogadores entram na Campanha A
    const invRes = await fetch(`${baseUrl}/campaigns/${campAId}/invites`, {
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

    // =========================================================================
    // 1. Mestre Cria Nota Secreta Privada (is_private = 1)
    // =========================================================================
    const createNoteRes = await fetch(`${baseUrl}/campaigns/${campAId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({
        title: 'Verdade sobre o Chanceler',
        content: 'O chanceler é na realidade um doppelganger contratado pelo culto.',
        category: 'plot',
        tags: ['segredo', 'vilão', 'traição'],
        is_private: true
      })
    });
    assert.strictEqual(createNoteRes.status, 201);
    const secretNote = (await createNoteRes.json()).note;
    assert.strictEqual(secretNote.is_private, 1);

    // =========================================================================
    // 2. Auditoria de Segurança: Tentativas de Acesso por Jogadores Comuns
    // =========================================================================
    // 2.1 Player 1 lista notas da campanha -> lista vazia (zero leakage de payload ou contagem)
    const p1ListRes = await fetch(`${baseUrl}/campaigns/${campAId}/notes`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    });
    assert.strictEqual(p1ListRes.status, 200);
    const p1Notes = (await p1ListRes.json()).notes;
    assert.strictEqual(p1Notes.length, 0);

    // 2.2 Player 1 tenta acessar nota privada por ID direto -> 404 Not Found (não 403, para não confirmar existência)
    const p1DirectRes = await fetch(`${baseUrl}/campaigns/${campAId}/notes/${secretNote.id}`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    });
    assert.strictEqual(p1DirectRes.status, 404);

    // =========================================================================
    // 3. Compartilhamento Granular: Revelar Nota Exclusivamente para Player 1
    // =========================================================================
    const shareRes = await fetch(`${baseUrl}/campaigns/${campAId}/notes/${secretNote.id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({
        sharedWithUserIds: [p1Id],
        isPrivate: true
      })
    });
    assert.strictEqual(shareRes.status, 200);

    // Player 1 agora consulta e tem acesso total
    const p1GetAfterShare = await fetch(`${baseUrl}/campaigns/${campAId}/notes/${secretNote.id}`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    });
    assert.strictEqual(p1GetAfterShare.status, 200);
    const p1Note = (await p1GetAfterShare.json()).note;
    assert.strictEqual(p1Note.title, 'Verdade sobre o Chanceler');
    assert.ok(p1Note.content.includes('doppelganger'));

    // Player 2 continua bloqueado com 404 e lista vazia!
    const p2DirectRes = await fetch(`${baseUrl}/campaigns/${campAId}/notes/${secretNote.id}`, {
      headers: { Authorization: `Bearer ${p2Token}` }
    });
    assert.strictEqual(p2DirectRes.status, 404);

    const p2ListRes = await fetch(`${baseUrl}/campaigns/${campAId}/notes`, {
      headers: { Authorization: `Bearer ${p2Token}` }
    });
    const p2Notes = (await p2ListRes.json()).notes;
    assert.strictEqual(p2Notes.length, 0);

    // =========================================================================
    // 4. Isolamento entre Campanhas
    // =========================================================================
    // Tentativa de consultar a nota da Campanha A pela URL da Campanha B
    const crossCampRes = await fetch(`${baseUrl}/campaigns/${campBId}/notes/${secretNote.id}`, {
      headers: { Authorization: `Bearer ${masterToken}` }
    });
    assert.strictEqual(crossCampRes.status, 404);

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
