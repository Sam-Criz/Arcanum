import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';

test('Fase 5 — Matriz de Acesso e Revelação Granular por Jogador (Entity Revelations)', async () => {
  const db = getDatabase(':memory:');
  const server = http.createServer();
  const { app, bestiaryService } = createApp(db);
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
      body: JSON.stringify({ email: 'mestre_rev@test.com', username: 'MestreRev', password: 'Password123!' })
    });
    const masterToken = (await mRes.json()).token;

    const p1Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player1_rev@test.com', username: 'Player1Rev', password: 'Password123!' })
    });
    const p1Data = await p1Res.json();
    const p1Token = p1Data.token;
    const p1Id = p1Data.user.id;

    const p2Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player2_rev@test.com', username: 'Player2Rev', password: 'Password123!' })
    });
    const p2Data = await p2Res.json();
    const p2Token = p2Data.token;

    // Criar Campanha
    const campRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({ name: 'Campanha Revelações' })
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

    // 2. Mestre cria Monstro no Bestiário (inicialmente is_revealed = 0)
    const monster = bestiaryService.createCreature(campId, {
      name: 'Lorde Vladislaus, o Sanguinário',
      display_name_players: 'Vulto Noturno Encapuzado',
      description: 'Um nobre imortal que se alimenta das almas dos incautos.',
      category: 'monstro',
      race: 'Vampiro Puro',
      is_revealed: true,
      attributes: { forca: 18, destreza: 16, vigor: 14, inteligencia: 16 },
      properties: {
        weaknesses: ['Prata Forjada', 'Luz Solar'],
        immunities: ['Veneno', 'Sangramento']
      }
    });

    // =========================================================================
    // CENÁRIO 1: Sem Revelações -> Jogadores recebem apenas dados genéricos
    // =========================================================================
    const p1GetInitial = await fetch(`${baseUrl}/campaigns/${campId}/bestiary/${monster.id}`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    });
    const p1DataInitial = await p1GetInitial.json();
    assert.strictEqual(p1DataInitial.creature.name, 'Vulto Noturno Encapuzado');
    assert.strictEqual(p1DataInitial.creature.attributes, undefined, 'Stats não devem vazar para o Player 1');
    assert.strictEqual(p1DataInitial.creature.weaknesses, undefined, 'Fraquezas não devem vazar para o Player 1');

    // =========================================================================
    // CENÁRIO 2: Revelação Granular Exclusiva para Player 1 (Nome Verdadeiro + Ficha/Stats)
    // =========================================================================
    const revP1Res = await fetch(`${baseUrl}/campaigns/${campId}/revelations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({
        entity_type: 'monster',
        entity_id: monster.id,
        revealed_to_user_id: p1Id,
        revealed_fields: ['true_name', 'stats']
      })
    });
    assert.strictEqual(revP1Res.status, 201);

    // Player 1 consulta novamente
    const p1GetAfterRev = await fetch(`${baseUrl}/campaigns/${campId}/bestiary/${monster.id}`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    });
    const p1DataAfterRev = await p1GetAfterRev.json();
    assert.strictEqual(p1DataAfterRev.creature.name, 'Lorde Vladislaus, o Sanguinário');
    assert.ok(p1DataAfterRev.creature.attributes, 'Player 1 agora tem acesso aos atributos');
    assert.strictEqual(p1DataAfterRev.creature.attributes.forca, 18);
    assert.strictEqual(p1DataAfterRev.creature.weaknesses, undefined, 'Fraquezas continuam estritamente ocultas');

    // Player 2 consulta no mesmo instante -> Continua anônimo sem ficha!
    const p2GetParallel = await fetch(`${baseUrl}/campaigns/${campId}/bestiary/${monster.id}`, {
      headers: { Authorization: `Bearer ${p2Token}` }
    });
    const p2DataParallel = await p2GetParallel.json();
    assert.strictEqual(p2DataParallel.creature.name, 'Vulto Noturno Encapuzado');
    assert.strictEqual(p2DataParallel.creature.attributes, undefined);
    assert.strictEqual(p2DataParallel.creature.weaknesses, undefined);

    // =========================================================================
    // CENÁRIO 3: Revelação Pública da Fraqueza para Todos os Jogadores
    // =========================================================================
    await fetch(`${baseUrl}/campaigns/${campId}/revelations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({
        entity_type: 'monster',
        entity_id: monster.id,
        revealed_to_user_id: null, // Público para toda a campanha
        revealed_fields: ['weakness']
      })
    });

    // Player 2 agora vê a fraqueza, mas AINDA NÃO vê a ficha nem o nome verdadeiro
    const p2AfterPublicWeakness = await fetch(`${baseUrl}/campaigns/${campId}/bestiary/${monster.id}`, {
      headers: { Authorization: `Bearer ${p2Token}` }
    });
    const p2DataWeakness = await p2AfterPublicWeakness.json();
    assert.strictEqual(p2DataWeakness.creature.name, 'Vulto Noturno Encapuzado');
    assert.strictEqual(p2DataWeakness.creature.attributes, undefined);
    assert.deepStrictEqual(p2DataWeakness.creature.weaknesses, ['Prata Forjada', 'Luz Solar']);

    // Player 1 vê Nome Verdadeiro, Stats E a fraqueza pública
    const p1Final = await fetch(`${baseUrl}/campaigns/${campId}/bestiary/${monster.id}`, {
      headers: { Authorization: `Bearer ${p1Token}` }
    });
    const p1FinalData = await p1Final.json();
    assert.strictEqual(p1FinalData.creature.name, 'Lorde Vladislaus, o Sanguinário');
    assert.strictEqual(p1FinalData.creature.attributes.forca, 18);
    assert.deepStrictEqual(p1FinalData.creature.weaknesses, ['Prata Forjada', 'Luz Solar']);

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
