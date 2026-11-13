import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';

test('Fase 6 — Auditoria de Vazamento Zero de Dados e Sanitização de Payloads (payload_leakage)', async () => {
  const db = getDatabase(':memory:');
  const server = http.createServer();
  const { app, bestiaryService, masterToolsService } = createApp(db);
  server.on('request', app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

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

    const tokenMaster = await registerUser('master_leak@test.com', 'MasterLeak');
    const tokenPlayer1 = await registerUser('player1_leak@test.com', 'Player1Leak');
    const tokenPlayer2 = await registerUser('player2_leak@test.com', 'Player2Leak');

    const me1 = await (await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${tokenPlayer1}` } })).json();
    const player1Id = me1.user.id;

    // Criar Campanha
    const campRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMaster}` },
      body: JSON.stringify({ name: 'Mesa de Auditoria de Dados' })
    });
    const camp = (await campRes.json()).campaign;

    // Jogadores entram na Campanha
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

    // =========================================================================
    // 1. BESTIÁRIO: Monstro Secreto e Monstro com Revelação Granular
    // =========================================================================
    // 1.1 Monstro Oculto (is_revealed = false, sem revelação prévia)
    const hiddenMonster = bestiaryService.createCreature(camp.id, {
      name: 'Dragão das Sombras Abissais',
      display_name_players: 'Sombra Indistinta',
      category: 'dragao',
      is_revealed: false,
      raw_data: { forca: 24, vida: 350, fraqueza: 'Luz Sagrada' },
      actions: [{ name: 'Sopro Sombrio', attack_formula: '1d20+12', damage_formula: '6d8' }],
      private_notes: 'O ponto fraco é a escama quebrada sob a asa esquerda'
    });

    // Mestre lista o Bestiário: vê o monstro completo com todos os dados
    const masterBestiaryRes = await fetch(`${baseUrl}/campaigns/${camp.id}/bestiary`, {
      headers: { Authorization: `Bearer ${tokenMaster}` }
    });
    const masterBestiary = (await masterBestiaryRes.json()).creatures;
    assert.ok(masterBestiary.some((c: any) => c.name === 'Dragão das Sombras Abissais'));

    // Jogador 1 lista o Bestiário: monstro oculto NUNCA deve listar o nome real nem notas secretas
    const p1BestiaryRes = await fetch(`${baseUrl}/campaigns/${camp.id}/bestiary`, {
      headers: { Authorization: `Bearer ${tokenPlayer1}` }
    });
    const p1Bestiary = (await p1BestiaryRes.json()).creatures;
    assert.ok(!p1Bestiary.some((c: any) => c.name === 'Dragão das Sombras Abissais'), 'Nome secreto do monstro nunca deve vazar');
    assert.ok(!p1Bestiary.some((c: any) => c.private_notes?.includes('escama quebrada')), 'Notas do mestre nunca vazam na listagem');

    // Jogador 1 tenta GET direto no monstro oculto -> deve responder 404
    const directMonsterRes = await fetch(`${baseUrl}/campaigns/${camp.id}/bestiary/${hiddenMonster.id}`, {
      headers: { Authorization: `Bearer ${tokenPlayer1}` }
    });
    assert.strictEqual(directMonsterRes.status, 404, 'Tentativa de ler monstro oculto por ID direto deve retornar 404');

    // 1.2 Mestre concede revelação granular APENAS de 'weakness' para o Player 1
    await masterToolsService.revelations.revealEntity(camp.id, {
      entity_type: 'monster',
      entity_id: hiddenMonster.id,
      revealed_to_user_id: player1Id,
      revealed_fields: ['weakness']
    });

    // Agora Player 1 pode consultar a criatura: recebe apenas a fraqueza, sem atributos nem ações nem notas
    const p1RevealedRes = await fetch(`${baseUrl}/campaigns/${camp.id}/bestiary/${hiddenMonster.id}`, {
      headers: { Authorization: `Bearer ${tokenPlayer1}` }
    });
    assert.strictEqual(p1RevealedRes.status, 200);
    const p1Creature = (await p1RevealedRes.json()).creature;
    assert.strictEqual(p1Creature.weakness, 'Luz Sagrada', 'Fraqueza autorizada deve ser entregue');
    assert.strictEqual(p1Creature.attributes, undefined, 'Atributos não revelados devem ser estritamente omitidos');
    assert.strictEqual(p1Creature.actions, undefined, 'Ações não reveladas devem ser estritamente omitidas');
    assert.ok(!p1Creature.private_notes, 'Notas privadas nunca vazam');

    // Player 2 (sem permissão) continua recebendo 404
    const p2MonsterRes = await fetch(`${baseUrl}/campaigns/${camp.id}/bestiary/${hiddenMonster.id}`, {
      headers: { Authorization: `Bearer ${tokenPlayer2}` }
    });
    assert.strictEqual(p2MonsterRes.status, 404, 'Player 2 não tem revelação e continua recebendo 404');

    // =========================================================================
    // 2. NOTAS SECRETAS DO MESTRE: Zero Leakage
    // =========================================================================
    const secretNoteRes = await fetch(`${baseUrl}/campaigns/${camp.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMaster}` },
      body: JSON.stringify({
        title: 'Traição do Conselheiro Real',
        content: 'O Lorde Varis está envenenando o poço com Beladona.',
        category: 'enredo',
        is_private: true
      })
    });
    const secretNote = (await secretNoteRes.json()).note;

    // Listagem de notas do Player 1: não contém a nota privada
    const p1NotesRes = await fetch(`${baseUrl}/campaigns/${camp.id}/notes`, {
      headers: { Authorization: `Bearer ${tokenPlayer1}` }
    });
    const p1Notes = (await p1NotesRes.json()).notes;
    assert.strictEqual(p1Notes.length, 0, 'Notas privadas nunca aparecem na listagem pública');

    // Tentativa direta do Player 1 de ler a nota privada por ID -> 404
    const directNoteP1 = await fetch(`${baseUrl}/campaigns/${camp.id}/notes/${secretNote.id}`, {
      headers: { Authorization: `Bearer ${tokenPlayer1}` }
    });
    assert.strictEqual(directNoteP1.status, 404, 'Acesso direto por ID à nota privada retorna 404');

    // =========================================================================
    // 3. EVENTOS SECRETOS: Master Only
    // =========================================================================
    const secretEventRes = await fetch(`${baseUrl}/campaigns/${camp.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMaster}` },
      body: JSON.stringify({
        title: 'Emboscada dos Assassinos Noturnos',
        description: '4 Assassinos surgem pelo telhado',
        event_type: 'manual',
        visibility: 'master_only'
      })
    });
    const secretEvent = (await secretEventRes.json()).event;

    // Player 1 lista eventos: não vê o evento master_only
    const p1EventsRes = await fetch(`${baseUrl}/campaigns/${camp.id}/events`, {
      headers: { Authorization: `Bearer ${tokenPlayer1}` }
    });
    const p1Events = (await p1EventsRes.json()).events;
    assert.strictEqual(p1Events.length, 0, 'Eventos master_only nunca constam no payload de jogadores');

    // Player 1 consulta evento secreto por ID -> 404
    const directEventP1 = await fetch(`${baseUrl}/campaigns/${camp.id}/events/${secretEvent.id}`, {
      headers: { Authorization: `Bearer ${tokenPlayer1}` }
    });
    assert.strictEqual(directEventP1.status, 404, 'Consulta direta a evento oculto retorna 404');

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
