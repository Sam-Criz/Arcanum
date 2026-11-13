import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';

test('Funcionalidades Finais: Lore com Privacidade, Sussurros 1-on-1 e Áudio YouTube', async (t) => {
  const db = getDatabase(':memory:');
  const { app } = createApp(db);
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    // 1. Setup: Criar Mestre, Jogador 1 e Jogador 2
    const register = async (email: string, username: string) => {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password: 'password123' })
      });
      return await res.json();
    };

    const masterData = await register('mestre@arcanum.io', 'MestreSupremo');
    const p1Data = await register('jogador1@arcanum.io', 'Guerreiro1');
    const p2Data = await register('jogador2@arcanum.io', 'Ladino2');

    const masterToken = masterData.token;
    const masterUser = masterData.user;
    const p1Token = p1Data.token;
    const p1User = p1Data.user;
    const p2Token = p2Data.token;
    const p2User = p2Data.user;

    // 2. Mestre cria Campanha
    const campRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({ name: 'Crônicas do Arquivo Sombrio', description: 'Campanha de Teste' })
    });
    const campJson = await campRes.json();
    const campaignId = campJson.campaign.id;

    // 3. Adicionar Jogador 1 e Jogador 2 à campanha
    db.prepare(`
      INSERT INTO campaign_memberships (id, campaign_id, user_id, role, joined_at)
      VALUES (?, ?, ?, 'player', datetime('now')), (?, ?, ?, 'player', datetime('now'))
    `).run('cm-1', campaignId, p1User.id, 'cm-2', campaignId, p2User.id);

    // 4. Mestre cria Personagem pertencente ao Jogador 1
    const charRes = await fetch(`${baseUrl}/campaigns/${campaignId}/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
      body: JSON.stringify({
        name: 'Aldric Ventoforte',
        userId: p1User.id,
        user_id: p1User.id,
        rawData: { forca: 16, destreza: 12, constituicao: 14 }
      })
    });
    const charJson = await charRes.json();
    const charId = charJson.character.id;

    // ==========================================
    // TESTE 1: ABA DE LORE COM PRIVACIDADE GRANULAR
    // ==========================================
    await t.test('1.1 Jogador 1 cria entrada de Lore Pública', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${charId}/lore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1Token}` },
        body: JSON.stringify({
          title: 'Origem de Aldric',
          content: 'Nascido nos vales de pedra úmida, foi treinado pela ordem dos guardiões.',
          visibility: 'public'
        })
      });
      const json = await res.json();
      assert.equal(res.status, 201);
      assert.equal(json.entry.title, 'Origem de Aldric');
      assert.equal(json.entry.visibility, 'public');
    });

    let secretLoreId = '';
    await t.test('1.2 Jogador 1 cria entrada de Lore Privada (Apenas Mestre e Jogador)', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${charId}/lore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1Token}` },
        body: JSON.stringify({
          title: 'O Segredo Proibido',
          content: 'Aldric fez um pacto proibido com uma entidade de cinzas para salvar sua irmã.',
          visibility: 'private_gm'
        })
      });
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.entry.title, 'O Segredo Proibido');
      assert.equal(json.entry.visibility, 'private_gm');
      secretLoreId = json.entry.id;
    });

    await t.test('1.3 Mestre e Jogador 1 visualizam ambas as notas (pública e privada)', async () => {
      // Jogador 1 (dono da ficha)
      const p1Res = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${charId}/lore`, {
        headers: { Authorization: `Bearer ${p1Token}` }
      });
      assert.equal(p1Res.status, 200);
      const p1List = await p1Res.json();
      assert.equal(p1List.entries.length, 2);

      // Mestre
      const masterRes = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${charId}/lore`, {
        headers: { Authorization: `Bearer ${masterToken}` }
      });
      assert.equal(masterRes.status, 200);
      const masterList = await masterRes.json();
      assert.equal(masterList.entries.length, 2);
    });

    await t.test('1.4 Jogador 2 (terceiro) vê APENAS a nota pública na listagem', async () => {
      const p2Res = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${charId}/lore`, {
        headers: { Authorization: `Bearer ${p2Token}` }
      });
      assert.equal(p2Res.status, 200);
      const p2List = await p2Res.json();

      assert.equal(p2List.entries.length, 1);
      assert.equal(p2List.entries[0].title, 'Origem de Aldric');
      assert.equal(p2List.entries[0].visibility, 'public');
    });

    await t.test('1.5 Jogador 2 tenta acesso direto por ID à nota privada -> Recebe 404 estrito', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${charId}/lore/${secretLoreId}`, {
        headers: { Authorization: `Bearer ${p2Token}` }
      });
      assert.equal(res.status, 404);
      const json = await res.json();
      assert.ok(json.error);
    });

    await t.test('1.6 Jogador 2 tenta criar lore na ficha de Aldric -> Recebe 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/characters/${charId}/lore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p2Token}` },
        body: JSON.stringify({
          title: 'Intromissão',
          content: 'Tentando adulterar a ficha alheia.',
          visibility: 'public'
        })
      });
      assert.equal(res.status, 403);
    });

    // ==========================================
    // TESTE 2: SUSSURRO PRIVADO 1-ON-1 COM O MESTRE
    // ==========================================
    await t.test('2.1 Jogador 1 envia sussurro privado para o Mestre', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/whispers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1Token}` },
        body: JSON.stringify({
          content: 'Mestre, pretendo usar meu pacto secreto quando entrarmos na cripta.'
        })
      });
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.whisper.sender_id, p1User.id);
      assert.equal(json.whisper.recipient_id, masterUser.id);
      assert.equal(json.whisper.is_read, 0);
    });

    await t.test('2.2 Mestre visualiza o sussurro de Jogador 1 e lista de contatos com badge', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/whispers`, {
        headers: { Authorization: `Bearer ${masterToken}` }
      });
      assert.equal(res.status, 200);
      const json = await res.json();

      assert.equal(json.whispers.length, 1);
      assert.equal(json.whispers[0].sender_id, p1User.id);

      const contactP1 = json.contacts.find((c: any) => c.user_id === p1User.id);
      assert.ok(contactP1);
      assert.equal(contactP1.unread_count, 1);
    });

    await t.test('2.3 Isolamento estrito: Jogador 2 lista sussurros e recebe lista vazia (zero vazamento)', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/whispers`, {
        headers: { Authorization: `Bearer ${p2Token}` }
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.whispers.length, 0);
    });

    await t.test('2.4 Mestre responde ao Jogador 1 e marca como lido', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/whispers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
        body: JSON.stringify({
          recipient_id: p1User.id,
          content: 'Compreendido. Prepare-se para as consequências.'
        })
      });
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.whisper.recipient_id, p1User.id);

      // Mestre marca mensagens de P1 como lidas
      const readRes = await fetch(`${baseUrl}/campaigns/${campaignId}/whispers/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
        body: JSON.stringify({ other_user_id: p1User.id })
      });
      assert.equal(readRes.status, 200);

      // Jogador 1 consulta sua conversa e vê ambas as mensagens
      const p1Res = await fetch(`${baseUrl}/campaigns/${campaignId}/whispers`, {
        headers: { Authorization: `Bearer ${p1Token}` }
      });
      assert.equal(p1Res.status, 200);
      const p1Chat = await p1Res.json();
      assert.equal(p1Chat.whispers.length, 2);

      // Jogador 2 continua com zero vazamentos
      const p2Res = await fetch(`${baseUrl}/campaigns/${campaignId}/whispers`, {
        headers: { Authorization: `Bearer ${p2Token}` }
      });
      assert.equal(p2Res.status, 200);
      const p2Chat = await p2Res.json();
      assert.equal(p2Chat.whispers.length, 0);
    });

    // ==========================================
    // TESTE 3: ÁUDIO E AMBIENTAÇÃO (YOUTUBE)
    // ==========================================
    let trackId = '';
    await t.test('3.1 Jogador 1 sugere trilha sonora do YouTube', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p1Token}` },
        body: JSON.stringify({
          title: 'Taverna do Crepúsculo',
          youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          volume: 75
        })
      });
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.track.title, 'Taverna do Crepúsculo');
      assert.equal(json.track.youtube_video_id, 'dQw4w9WgXcQ');
      assert.equal(json.track.is_playing, 0);
      trackId = json.track.id;
    });

    await t.test('3.2 Jogador comum tenta dar Play na trilha -> 403 Forbidden (Apenas Mestre)', async () => {
      const res = await fetch(`${baseUrl}/campaigns/${campaignId}/audio/${trackId}/play`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p1Token}` }
      });
      assert.equal(res.status, 403);
    });

    await t.test('3.3 Mestre ativa o playback da trilha e depois pausa', async () => {
      // Play
      const playRes = await fetch(`${baseUrl}/campaigns/${campaignId}/audio/${trackId}/play`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}` }
      });
      assert.equal(playRes.status, 200);
      const playJson = await playRes.json();
      assert.equal(playJson.track.is_playing, 1);

      // Conferencia de status na listagem
      const listRes = await fetch(`${baseUrl}/campaigns/${campaignId}/audio`, {
        headers: { Authorization: `Bearer ${p2Token}` }
      });
      assert.equal(listRes.status, 200);
      const listJson = await listRes.json();
      assert.equal(listJson.currentTrack?.id, trackId);

      // Pause
      const pauseRes = await fetch(`${baseUrl}/campaigns/${campaignId}/audio/pause`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${masterToken}` }
      });
      assert.equal(pauseRes.status, 200);

      const pausedListRes = await fetch(`${baseUrl}/campaigns/${campaignId}/audio`, {
        headers: { Authorization: `Bearer ${p1Token}` }
      });
      assert.equal(pausedListRes.status, 200);
      const pausedJson = await pausedListRes.json();
      assert.equal(pausedJson.currentTrack, null);
    });

    await t.test('3.4 Mestre exclui a trilha', async () => {
      const delRes = await fetch(`${baseUrl}/campaigns/${campaignId}/audio/${trackId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${masterToken}` }
      });
      assert.equal(delRes.status, 200);

      const listRes = await fetch(`${baseUrl}/campaigns/${campaignId}/audio`, {
        headers: { Authorization: `Bearer ${masterToken}` }
      });
      assert.equal(listRes.status, 200);
      const listJson = await listRes.json();
      assert.equal(listJson.tracks.length, 0);
    });
  } finally {
    server.close();
  }
});
