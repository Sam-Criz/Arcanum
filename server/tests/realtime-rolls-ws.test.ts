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

test('Sincronização em tempo real de rolagens públicas e secretas via WebSocket', async (t) => {
  const db = getDatabase(':memory:');
  const authService = new AuthService(db);
  const rbacService = new RbacService(db);
  const rulesService = new RulesService(db);
  const campaignService = new CampaignService(db, rulesService);
  const characterService = new CharacterService(db, rulesService);

  const server = http.createServer();
  const realtimeServer = new RealtimeServer(server, authService, rbacService);
  const { app, setRealtimeServer } = createApp(db, realtimeServer);
  setRealtimeServer(realtimeServer);
  server.on('request', app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;
  const apiUrl = `http://127.0.0.1:${port}/api`;

  // 1. Criar usuários
  const masterAuth = authService.register({ email: 'mestre@rolls.com', username: 'MestreMesa', password: 'password123' });
  const player1Auth = authService.register({ email: 'player1@rolls.com', username: 'Jogador1', password: 'password123' });
  const player2Auth = authService.register({ email: 'player2@rolls.com', username: 'Jogador2', password: 'password123' });
  const outsiderAuth = authService.register({ email: 'outsider@rolls.com', username: 'Invasor', password: 'password123' });

  // 2. Mestre cria campanha
  const campaign = campaignService.createCampaign(masterAuth.user.id, { name: 'Mesa Realtime Test' });

  // 3. Jogadores entram na campanha
  const invite = campaignService.createInvite(campaign.id, { role: 'player' });
  campaignService.joinCampaignByInvite(invite.code, player1Auth.user.id);
  campaignService.joinCampaignByInvite(invite.code, player2Auth.user.id);

  // 4. Jogador 1 cria um personagem
  const char1 = characterService.createCharacter(campaign.id, player1Auth.user.id, {
    name: 'Arthur Pendelton',
    rawData: { forca: 3, agilidade: 2, intelecto: 1 }
  });

  // Helper para conectar cliente WebSocket autenticado
  const connectWsClient = (token: string, campaignId: string): Promise<{ ws: WebSocket; messages: any[] }> => {
    return new Promise((resolve, reject) => {
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
          if (msg.type === 'auth:success' || msg.type === 'auth:error') {
            resolve({ ws, messages });
          }
        } catch (e) {
          // ignore
        }
      });

      ws.on('close', () => {
        resolve({ ws, messages });
      });

      ws.on('error', reject);
    });
  };

  // Conectar Mestre, Player 1 e Player 2
  const masterClient = await connectWsClient(masterAuth.token, campaign.id);
  const player1Client = await connectWsClient(player1Auth.token, campaign.id);
  const player2Client = await connectWsClient(player2Auth.token, campaign.id);

  assert.strictEqual(masterClient.messages.some(m => m.type === 'auth:success'), true);
  assert.strictEqual(player1Client.messages.some(m => m.type === 'auth:success'), true);
  assert.strictEqual(player2Client.messages.some(m => m.type === 'auth:success'), true);

  // Testar conexão de usuário não pertencente à campanha (Outsider)
  const outsiderClient = await connectWsClient(outsiderAuth.token, campaign.id);
  assert.strictEqual(outsiderClient.messages.some(m => m.type === 'auth:error'), true);
  outsiderClient.ws.close();

  // Limpar mensagens acumuladas do handshake
  masterClient.messages.length = 0;
  player1Client.messages.length = 0;
  player2Client.messages.length = 0;

  // --- CENÁRIO 1: ROLAGEM PÚBLICA DO JOGADOR 1 COM PERSONAGEM ---
  const publicRollRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/rules/roll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${player1Auth.token}`
    },
    body: JSON.stringify({
      expression: '1d20 + 2',
      characterId: char1.id,
      isSecret: false
    })
  });
  assert.strictEqual(publicRollRes.status, 200);
  const publicRollData = await publicRollRes.json();
  assert.strictEqual(publicRollData.characterName, 'Arthur Pendelton');
  assert.strictEqual(publicRollData.username, 'Jogador1');
  assert.strictEqual(publicRollData.isSecret, false);
  assert.strictEqual(typeof publicRollData.total, 'number');

  // Aguardar propagação WebSocket
  await new Promise(r => setTimeout(r, 100));

  // Mestre deve receber o evento 'dice:rolled'
  const masterPublicRollMsg = masterClient.messages.find(m => m.type === 'dice:rolled' && m.roll?.id === publicRollData.id);
  assert.ok(masterPublicRollMsg, 'Mestre deve receber evento dice:rolled');
  assert.strictEqual(masterPublicRollMsg.roll.characterName, 'Arthur Pendelton');
  assert.strictEqual(masterPublicRollMsg.roll.username, 'Jogador1');
  assert.strictEqual(masterPublicRollMsg.roll.total, publicRollData.total);
  assert.strictEqual(masterPublicRollMsg.roll.isSecret, false);

  // Player 2 também deve receber o evento da rolagem pública
  const p2PublicRollMsg = player2Client.messages.find(m => m.type === 'dice:rolled' && m.roll?.id === publicRollData.id);
  assert.ok(p2PublicRollMsg, 'Jogador 2 deve receber rolagem pública de outro jogador');
  assert.strictEqual(p2PublicRollMsg.roll.characterName, 'Arthur Pendelton');
  assert.strictEqual(p2PublicRollMsg.roll.total, publicRollData.total);

  // Limpar mensagens
  masterClient.messages.length = 0;
  player1Client.messages.length = 0;
  player2Client.messages.length = 0;

  // --- CENÁRIO 2: ROLAGEM SECRETA DO JOGADOR 1 (SIGILO E ENTREGA AO MESTRE) ---
  const secretRollRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/rules/roll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${player1Auth.token}`
    },
    body: JSON.stringify({
      expression: '1d100',
      characterId: char1.id,
      isSecret: true
    })
  });
  assert.strictEqual(secretRollRes.status, 200);
  const secretRollData = await secretRollRes.json();
  // Para o jogador comum, a resposta HTTP NUNCA deve conter o resultado da rolagem secreta
  assert.strictEqual(secretRollData.isSecret, true);
  assert.strictEqual(secretRollData.total, undefined);
  assert.strictEqual(secretRollData.breakdown, undefined);
  assert.ok(secretRollData.id, 'ID da rolagem deve ser retornado para referência do autor');

  // Aguardar propagação WebSocket
  await new Promise(r => setTimeout(r, 150));

  // MESTRE: Deve receber o evento 'dice:rolled' em tempo real contendo todos os dados para o Toast
  const masterSecretRollMsg = masterClient.messages.find(m => m.type === 'dice:rolled' && m.roll?.id === secretRollData.id);
  assert.ok(masterSecretRollMsg, 'Mestre deve receber a rolagem secreta via WebSocket');
  assert.strictEqual(masterSecretRollMsg.roll.isSecret, true);
  assert.strictEqual(masterSecretRollMsg.roll.username, 'Jogador1');
  assert.strictEqual(masterSecretRollMsg.roll.characterName, 'Arthur Pendelton');
  assert.strictEqual(masterSecretRollMsg.roll.expression, '1d100');
  assert.strictEqual(typeof masterSecretRollMsg.roll.total, 'number');
  assert.ok(masterSecretRollMsg.roll.total >= 1 && masterSecretRollMsg.roll.total <= 100);

  // JOGADOR 2: NUNCA deve receber o evento da rolagem secreta
  const p2SecretRollMsg = player2Client.messages.find(m => m.type === 'dice:rolled' && m.roll?.id === secretRollData.id);
  assert.strictEqual(p2SecretRollMsg, undefined, 'Outros jogadores NÃO podem receber a rolagem secreta via WebSocket');

  // Limpar mensagens
  masterClient.messages.length = 0;
  player1Client.messages.length = 0;
  player2Client.messages.length = 0;

  // --- CENÁRIO 3: ROLAGEM SECRETA DO PRÓPRIO MESTRE ---
  const masterSecretRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/rules/roll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${masterAuth.token}`
    },
    body: JSON.stringify({
      expression: '2d6 + 5',
      isSecret: true
    })
  });
  assert.strictEqual(masterSecretRes.status, 200);
  const masterSecretData = await masterSecretRes.json();
  // Para o mestre, o total é revelado
  assert.strictEqual(typeof masterSecretData.total, 'number');

  await new Promise(r => setTimeout(r, 100));

  // Jogadores comuns não devem receber
  assert.strictEqual(player1Client.messages.some(m => m.roll?.id === masterSecretData.id), false);
  assert.strictEqual(player2Client.messages.some(m => m.roll?.id === masterSecretData.id), false);

  // --- CENÁRIO 4: CONSULTA DE HISTÓRICO COM ISOLAMENTO DE ROLAGENS SECRETAS ---
  // Mestre consulta histórico -> deve ver públicas e secretas
  const masterHistoryRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/rolls`, {
    headers: { 'Authorization': `Bearer ${masterAuth.token}` }
  });
  const masterHistoryData = await masterHistoryRes.json();
  const masterRollIds = masterHistoryData.rolls.map((r: any) => r.id);
  assert.ok(masterRollIds.includes(publicRollData.id));
  assert.ok(masterRollIds.includes(secretRollData.id));
  assert.ok(masterRollIds.includes(masterSecretData.id));

  // Jogador consulta histórico -> só vê públicas
  const playerHistoryRes = await fetch(`${apiUrl}/campaigns/${campaign.id}/rolls`, {
    headers: { 'Authorization': `Bearer ${player2Auth.token}` }
  });
  const playerHistoryData = await playerHistoryRes.json();
  const playerRollIds = playerHistoryData.rolls.map((r: any) => r.id);
  assert.ok(playerRollIds.includes(publicRollData.id));
  assert.strictEqual(playerRollIds.includes(secretRollData.id), false, 'Jogador não deve ver rolagem secreta no histórico');
  assert.strictEqual(playerRollIds.includes(masterSecretData.id), false, 'Jogador não deve ver rolagem secreta do mestre no histórico');

  // Limpeza
  masterClient.ws.close();
  player1Client.ws.close();
  player2Client.ws.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
