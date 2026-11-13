import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';

test('Segurança de Rolagens e Trava de Criação de Personagens', async (t) => {
  const db = getDatabase(':memory:');
  const server = http.createServer();
  const { app, characterService } = createApp(db);
  server.on('request', app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    // 1. Criar Mestre e Jogadores
    const masterRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mestre_sec@test.com', username: 'MestreSec', password: 'Password123!' })
    });
    const masterData = await masterRes.json();
    const masterToken = masterData.token;

    const player1Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player1_sec@test.com', username: 'Player1Sec', password: 'Password123!' })
    });
    const player1Data = await player1Res.json();
    const player1Token = player1Data.token;
    const player1Id = player1Data.user.id;

    const player2Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'player2_sec@test.com', username: 'Player2Sec', password: 'Password123!' })
    });
    const player2Data = await player2Res.json();
    const player2Token = player2Data.token;
    const player2Id = player2Data.user.id;

    // 2. Mestre cria campanha
    const campRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({ name: 'Campanha de Segurança', preset: 'investigacao' })
    });
    const campData = await campRes.json();
    const campaignId = campData.campaign.id;

    // Gerar convite e fazer ambos os jogadores entrarem
    const inviteRes = await fetch(`${baseUrl}/campaigns/${campaignId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({ role: 'player' })
    });
    const inviteData = await inviteRes.json();
    const inviteCode = inviteData.invite.code;

    await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${player1Token}` },
      body: JSON.stringify({ code: inviteCode })
    });

    await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${player2Token}` },
      body: JSON.stringify({ code: inviteCode })
    });

    // Setup de personagens para teste de rolagem via characterService
    const char1 = characterService.createCharacter(campaignId, player1Id, {
      name: 'Detetive John',
      rawData: { forca: 14, agilidade: 16 }
    });
    const char1Id = char1.id;

    const char2 = characterService.createCharacter(campaignId, player2Id, {
      name: 'Mago Valerius',
      rawData: { forca: 8, intelecto: 18 }
    });
    const char2Id = char2.id;

    await t.test('1. Player 1 rola dados com seu próprio personagem -> Sucesso 200', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/rules/roll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${player1Token}` },
        body: JSON.stringify({ expression: '1d20 + 2', characterId: char1Id })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.characterId, char1Id);
      assert.strictEqual(data.characterName, 'Detetive John');
    });

    await t.test('2. Player 2 tenta rolar dados se passando pelo personagem do Player 1 -> 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/rules/roll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${player2Token}` },
        body: JSON.stringify({ expression: '1d20 + 2', characterId: char1Id })
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.ok(data.error.includes('Você não tem permissão'));
    });

    await t.test('3. Mestre pode rolar dados em nome de qualquer personagem -> Sucesso 200', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/rules/roll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
        body: JSON.stringify({ expression: '1d20 + 4', characterId: char1Id })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.characterId, char1Id);
      assert.strictEqual(data.characterName, 'Detetive John');
    });

    let requestId: string;

    await t.test('4. Trava de Segurança: Jogador comum tentando criar personagem recebe 403 Forbidden e emite pendência', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${player1Token}` },
        body: JSON.stringify({ name: 'Segundo Personagem', rawData: { vigor: 12 } })
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.status, 'pending_approval');
      assert.ok(data.request.id);
      assert.strictEqual(data.request.name, 'Segundo Personagem');
      assert.strictEqual(data.request.status, 'pending');

      requestId = data.request.id;

      // Verificar que o personagem ainda NÃO está na lista de personagens
      const listRes = await fetch(`${baseUrl}/campaigns/${campaignId}/characters`, {
        headers: { Authorization: `Bearer ${player1Token}` }
      });
      const listData = await listRes.json();
      const found = listData.characters.some((c: any) => c.name === 'Segundo Personagem');
      assert.strictEqual(found, false);
    });

    await t.test('5. Jogador pode listar suas requisições pendentes', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/character-requests`, {
        headers: { Authorization: `Bearer ${player1Token}` }
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.requests));
      assert.strictEqual(data.requests.length, 1);
      assert.strictEqual(data.requests[0].id, requestId);
    });

    await t.test('6. Jogador comum NÃO pode aprovar requisições -> 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/character-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${player2Token}` }
      });

      assert.strictEqual(res.status, 403);
    });

    await t.test('7. Mestre aprova a solicitação -> Personagem é instanciado com sucesso', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/character-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` }
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.request.status, 'approved');
      assert.ok(data.character);
      assert.strictEqual(data.character.name, 'Segundo Personagem');
      assert.strictEqual(data.character.user_id, player1Id);

      // Agora o personagem consta na lista da campanha
      const listRes = await fetch(`${baseUrl}/campaigns/${campaignId}/characters`, {
        headers: { Authorization: `Bearer ${player1Token}` }
      });
      const listData = await listRes.json();
      const found = listData.characters.some((c: any) => c.name === 'Segundo Personagem');
      assert.strictEqual(found, true);
    });

    await t.test('8. Mestre rejeita solicitação inadequada com justificativa', async () => {
      // Player 2 envia solicitação (bloqueado com 403 e pendência registrada)
      const subRes = await fetch(`${baseUrl}/campaigns/${campaignId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${player2Token}` },
        body: JSON.stringify({ name: 'Robô do Futuro Apocalíptico', rawData: { lasers: 100 } })
      });
      assert.strictEqual(subRes.status, 403);
      const subData = await subRes.json();
      const rejReqId = subData.request.id;

      // Mestre rejeita
      const rejRes = await fetch(`${baseUrl}/campaigns/${campaignId}/character-requests/${rejReqId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
        body: JSON.stringify({ reason: 'Não se encaixa na ambientação vitoriana de investigação.' })
      });

      assert.strictEqual(rejRes.status, 200);
      const rejData = await rejRes.json();
      assert.strictEqual(rejData.request.status, 'rejected');
      assert.strictEqual(rejData.request.rejection_reason, 'Não se encaixa na ambientação vitoriana de investigação.');

      // Verificar que o personagem NÃO foi criado
      const listRes = await fetch(`${baseUrl}/campaigns/${campaignId}/characters`, {
        headers: { Authorization: `Bearer ${masterToken}` }
      });
      const listData = await listRes.json();
      const found = listData.characters.some((c: any) => c.name === 'Robô do Futuro Apocalíptico');
      assert.strictEqual(found, false);
    });

    await t.test('9. Mestre pode criar personagem diretamente com 201 Created', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
        body: JSON.stringify({ name: 'Inspetor Chefe NPC', isNpc: true })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.character.name, 'Inspetor Chefe NPC');
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
