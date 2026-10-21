import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';

test('E2E API - Fluxo Completo de Autenticação, Campanhas, Isolamento e Fichas', async () => {
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
    // 1. Cadastrar Usuário A (Mestre Paranormal)
    const regResA = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'investigador@rpg.com',
        username: 'MestreParanormal',
        password: 'senhaSegura123'
      })
    });
    assert.strictEqual(regResA.status, 201);
    const dataA = await regResA.json();
    const tokenA = dataA.token;
    assert.ok(tokenA);

    // 2. Cadastrar Usuário B (Mestre Cyberpunk)
    const regResB = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'netrunner@rpg.com',
        username: 'MestreCyber',
        password: 'senhaSegura123'
      })
    });
    assert.strictEqual(regResB.status, 201);
    const dataB = await regResB.json();
    const tokenB = dataB.token;
    assert.ok(tokenB);

    // 3. Usuário A cria Campanha A (preset 'investigacao')
    const createCampResA = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        name: 'Operação Névoa Oculta',
        description: 'Investigação e horror paranormal',
        preset: 'investigacao'
      })
    });
    assert.strictEqual(createCampResA.status, 201);
    const campA = (await createCampResA.json()).campaign;
    assert.strictEqual(campA.role, 'owner');

    // 4. Usuário B cria Campanha B (preset 'cyberpunk')
    const createCampResB = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenB}`
      },
      body: JSON.stringify({
        name: 'Distrito Neon 2099',
        description: 'Cyberware e invasão neural',
        preset: 'cyberpunk'
      })
    });
    assert.strictEqual(createCampResB.status, 201);
    const campB = (await createCampResB.json()).campaign;

    // 5. TESTE DE ISOLAMENTO: Usuário B tenta acessar Campanha A sem pertencer a ela -> DEVE RETORNAR 403
    const unauthorizedRes = await fetch(`${baseUrl}/campaigns/${campA.id}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    assert.strictEqual(unauthorizedRes.status, 403);
    const unauthorizedData = await unauthorizedRes.json();
    assert.match(unauthorizedData.error, /Acesso negado/);

    // 6. Usuário A gera convite de 'player' para sua campanha
    const inviteRes = await fetch(`${baseUrl}/campaigns/${campA.id}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ role: 'player' })
    });
    assert.strictEqual(inviteRes.status, 201);
    const inviteCode = (await inviteRes.json()).invite.code;

    // 7. Usuário B entra na Campanha A com o convite
    const joinRes = await fetch(`${baseUrl}/campaigns/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenB}`
      },
      body: JSON.stringify({ code: inviteCode })
    });
    assert.strictEqual(joinRes.status, 200);
    const joinData = await joinRes.json();
    assert.strictEqual(joinData.role, 'player');

    // 8. Usuário B tenta alterar as regras da Campanha A como jogador -> DEVE RETORNAR 403
    const modifyRulesRes = await fetch(`${baseUrl}/campaigns/${campA.id}/rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenB}`
      },
      body: JSON.stringify({
        config: { systemName: 'Regras Hackeadas' }
      })
    });
    assert.strictEqual(modifyRulesRes.status, 403);
    assert.match((await modifyRulesRes.json()).error, /Permissão insuficiente/);

    // 9. Usuário A cria um personagem e valida campos derivados
    const charRes = await fetch(`${baseUrl}/campaigns/${campA.id}/characters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        name: 'Arthur Cervero',
        rawData: {
          Forca: 2,
          Agilidade: 3,
          Intelecto: 2,
          Presenca: 1,
          Vigor: 2
        }
      })
    });
    assert.strictEqual(charRes.status, 201);
    const char = (await charRes.json()).character;
    assert.strictEqual(char.name, 'Arthur Cervero');
    // Defesa derivada calculada pelas regras da campanha: 10 + Agilidade = 13
    assert.strictEqual(char.computed_data.defesa, 13);
    // Vida máxima calculada: Vigor * 5 + 10 = 20
    assert.strictEqual(char.computed_data.vida_max, 20);

    // 10. Rolagem de dados segura através do motor de regras da campanha
    const rollRes = await fetch(`${baseUrl}/campaigns/${campA.id}/rules/roll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        expression: '1d20 + Agilidade',
        variables: { Agilidade: 3 }
      })
    });
    assert.strictEqual(rollRes.status, 200);
    const rollData = await rollRes.json();
    assert.ok(rollData.total >= 4 && rollData.total <= 23);
    assert.strictEqual(rollData.breakdown.expression, '1d20 + Agilidade');
    assert.strictEqual(rollData.breakdown.diceRolls.length, 1);
  } finally {
    server.close();
    db.close();
  }
});
