import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';

test('Fase 6 — Auditoria de RBAC e Isolamento Multi-Tenant Horizontal (rbac_isolation)', async () => {
  const db = getDatabase(':memory:');
  const server = http.createServer();
  const { app, characterService } = createApp(db);
  server.on('request', app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    // 1. Cadastrar Usuários: Mestre A, Player A, Mestre B, Player B
    const registerUser = async (email: string, username: string) => {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password: 'Password123!' })
      });
      return (await res.json()).token;
    };

    const tokenMasterA = await registerUser('master_a@test.com', 'MasterA');
    const tokenPlayerA = await registerUser('player_a@test.com', 'PlayerA');
    const tokenMasterB = await registerUser('master_b@test.com', 'MasterB');
    const tokenPlayerB = await registerUser('player_b@test.com', 'PlayerB');

    // 2. Mestre A cria Campanha A; Mestre B cria Campanha B
    const createCampaign = async (token: string, name: string) => {
      const res = await fetch(`${baseUrl}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      return (await res.json()).campaign;
    };

    const campA = await createCampaign(tokenMasterA, 'Campanha Alpha');
    const campB = await createCampaign(tokenMasterB, 'Campanha Beta');

    // Player A entra na Campanha A
    const invARes = await fetch(`${baseUrl}/campaigns/${campA.id}/invites`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenMasterA}` }
    });
    const invACode = (await invARes.json()).invite.code;
    await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPlayerA}` },
      body: JSON.stringify({ code: invACode })
    });

    // Player B entra na Campanha B
    const invBRes = await fetch(`${baseUrl}/campaigns/${campB.id}/invites`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenMasterB}` }
    });
    const invBCode = (await invBRes.json()).invite.code;
    await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPlayerB}` },
      body: JSON.stringify({ code: invBCode })
    });

    // Obter usuário do Player A
    const meARes = await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${tokenPlayerA}` } });
    const userPlayerA = (await meARes.json()).user;

    // Criar Personagem para Player A na Campanha A
    const charA = characterService.createCharacter(campA.id, userPlayerA.id, {
      name: 'Guerreiro Alpha',
      rawData: { forca: 16, destreza: 12 }
    });

    // =========================================================================
    // CENÁRIO 1: Player B tenta consultar recursos da Campanha A -> 403
    // =========================================================================
    const unauthChars = await fetch(`${baseUrl}/campaigns/${campA.id}/characters`, {
      headers: { Authorization: `Bearer ${tokenPlayerB}` }
    });
    assert.strictEqual(unauthChars.status, 403, 'Jogador da Campanha B não pode listar personagens da Campanha A');

    const unauthMembers = await fetch(`${baseUrl}/campaigns/${campA.id}/members`, {
      headers: { Authorization: `Bearer ${tokenPlayerB}` }
    });
    assert.strictEqual(unauthMembers.status, 403, 'Jogador da Campanha B não pode listar membros da Campanha A');

    const unauthRules = await fetch(`${baseUrl}/campaigns/${campA.id}/ruleset/conditions`, {
      headers: { Authorization: `Bearer ${tokenPlayerB}` }
    });
    assert.strictEqual(unauthRules.status, 403, 'Jogador da Campanha B não pode acessar regras da Campanha A');

    // =========================================================================
    // CENÁRIO 2: Player B tenta modificar personagem da Campanha A -> 403
    // =========================================================================
    const unauthPatch = await fetch(`${baseUrl}/campaigns/${campA.id}/characters/${charA.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPlayerB}` },
      body: JSON.stringify({ name: 'Hacked Alpha' })
    });
    assert.strictEqual(unauthPatch.status, 403, 'Jogador de outra campanha não pode modificar personagem alheio');

    // =========================================================================
    // CENÁRIO 3: Player B tenta rolar dados com personagem da Campanha A -> 403
    // =========================================================================
    const unauthRoll = await fetch(`${baseUrl}/campaigns/${campA.id}/rules/roll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPlayerB}` },
      body: JSON.stringify({ expression: '1d20+2', characterId: charA.id })
    });
    assert.strictEqual(unauthRoll.status, 403, 'Jogador de outra campanha não pode rolar com personagem alheio');

    // =========================================================================
    // CENÁRIO 4: Player B tenta acessar endpoint de notas privadas diretamente por ID -> 403
    // =========================================================================
    // Mestre A cria uma nota na Campanha A
    const noteRes = await fetch(`${baseUrl}/campaigns/${campA.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMasterA}` },
      body: JSON.stringify({ title: 'Segredo Alpha', content: 'Tesouro oculto sob a torre', is_private: true })
    });
    const note = (await noteRes.json()).note;

    // Player B tenta acessar /api/notes/:id da nota da Campanha A -> 403
    const directNoteBypass = await fetch(`${baseUrl}/notes/${note.id}`, {
      headers: { Authorization: `Bearer ${tokenPlayerB}` }
    });
    assert.strictEqual(directNoteBypass.status, 403, 'Acesso direto por ID à nota de outra campanha deve ser bloqueado com 403');

    // Player A (que é membro de Campanha A mas jogador comum) tenta ler nota privada sem ser autorizado -> 404
    const directNotePlayerA = await fetch(`${baseUrl}/notes/${note.id}`, {
      headers: { Authorization: `Bearer ${tokenPlayerA}` }
    });
    assert.strictEqual(directNotePlayerA.status, 404, 'Jogador comum da mesma campanha sem compartilhamento recebe 404');

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
