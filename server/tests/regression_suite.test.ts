import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { getDatabase } from '../src/db/connection';
import { createApp } from '../src/app';

test('Fase 6 — Suíte de Regressão Crítica (regression_suite)', async () => {
  const db = getDatabase(':memory:');
  const server = http.createServer();
  const { app, characterService, inventoryService } = createApp(db);
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

    const tokenMaster = await registerUser('master_reg@test.com', 'MasterReg');
    const tokenPlayer1 = await registerUser('player1_reg@test.com', 'Player1Reg');
    const tokenPlayer2 = await registerUser('player2_reg@test.com', 'Player2Reg');

    const p1User = (await (await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${tokenPlayer1}` } })).json()).user;
    const p2User = (await (await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${tokenPlayer2}` } })).json()).user;

    // Criar Campanha
    const campRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMaster}` },
      body: JSON.stringify({ name: 'Mesa de Regressão' })
    });
    const camp = (await campRes.json()).campaign;

    // Convidar jogadores
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
    // 1. REGRESSÃO: Gestão de Membros e Expulsão
    // =========================================================================
    // Jogador comum tenta expulsar outro membro -> 403 Forbidden
    const unauthKick = await fetch(`${baseUrl}/campaigns/${camp.id}/members/${p2User.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenPlayer1}` }
    });
    assert.strictEqual(unauthKick.status, 403, 'Jogador comum não pode expulsar membros');

    // Mestre tenta expulsar ID inexistente -> 400 sem crash do servidor
    const invalidKick = await fetch(`${baseUrl}/campaigns/${camp.id}/members/usuario-inexistente-uuid`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenMaster}` }
    });
    assert.strictEqual(invalidKick.status, 400, 'Expulsão de ID inexistente retorna 400 de forma tratada');

    // Mestre expulsa Player 2 com sucesso
    const validKick = await fetch(`${baseUrl}/campaigns/${camp.id}/members/${p2User.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenMaster}` }
    });
    assert.strictEqual(validKick.status, 200, 'Mestre pode expulsar membros da campanha');

    // Membro expulso tenta acessar a campanha -> 403
    const kickedAccess = await fetch(`${baseUrl}/campaigns/${camp.id}`, {
      headers: { Authorization: `Bearer ${tokenPlayer2}` }
    });
    assert.strictEqual(kickedAccess.status, 403, 'Membro expulso não tem mais acesso aos dados da campanha');

    // =========================================================================
    // 2. REGRESSÃO: Limite/Teto de Habilidades por Personagem
    // =========================================================================
    const char1 = characterService.createCharacter(camp.id, p1User.id, {
      name: 'Mago dos Elementos',
      rawData: { abilities: [] }
    });

    // Adiciona até 6 habilidades (teto padrão)
    for (let i = 1; i <= 6; i++) {
      const addSkillRes = await fetch(`${baseUrl}/campaigns/${camp.id}/characters/${char1.id}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPlayer1}` },
        body: JSON.stringify({
          name: `Habilidade Elemental ${i}`,
          type: 'magia',
          cost: '2 PM'
        })
      });
      assert.strictEqual(addSkillRes.status, 201, `Habilidade ${i} deve ser adicionada com sucesso`);
    }

    // Tentativa de adicionar a 7ª habilidade -> Bloqueado com 400 (Teto excedido)
    const overflowSkillRes = await fetch(`${baseUrl}/campaigns/${camp.id}/characters/${char1.id}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPlayer1}` },
      body: JSON.stringify({
        name: 'Habilidade Sobressalente Proibida',
        type: 'magia'
      })
    });
    assert.strictEqual(overflowSkillRes.status, 400, 'Excesso de habilidades deve ser bloqueado com 400');
    const overflowErr = await overflowSkillRes.json();
    assert.ok(overflowErr.error.includes('Limite de habilidades'), 'Mensagem descritiva de teto atingido');

    // =========================================================================
    // 3. REGRESSÃO: Armas na Mochila vs Equipadas no Dock Tático
    // =========================================================================
    const weapon1 = inventoryService.addItemToCharacter(camp.id, char1.id, {
      itemName: 'Espada Longa de Aço',
      category: 'arma',
      quantity: 1,
      isEquipped: true,
      properties: { damage_formula: '1d8', damage_type: 'cortante' }
    }, true);

    const weapon2 = inventoryService.addItemToCharacter(camp.id, char1.id, {
      itemName: 'Adaga de Arremesso',
      category: 'arma',
      quantity: 1,
      isEquipped: false,
      properties: { damage_formula: '1d4', damage_type: 'perfurante' }
    }, true);

    // Consulta de inventário
    const invInitial = inventoryService.getCharacterInventory(camp.id, char1.id);
    const item1 = invInitial.items.find((i: any) => i.id === weapon1.id);
    const item2 = invInitial.items.find((i: any) => i.id === weapon2.id);
    assert.strictEqual(Boolean(item1?.is_equipped), true, 'Espada deve constar como equipada');
    assert.strictEqual(Boolean(item2?.is_equipped), false, 'Adaga deve constar na mochila (não equipada)');

    // Alternar equipamento da Adaga para equipada via PATCH
    const toggleEquipRes = await fetch(`${baseUrl}/campaigns/${camp.id}/characters/${char1.id}/inventory/${weapon2.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPlayer1}` },
      body: JSON.stringify({ isEquipped: true })
    });
    assert.strictEqual(toggleEquipRes.status, 200);

    const invAfterToggle = inventoryService.getCharacterInventory(camp.id, char1.id);
    const item2After = invAfterToggle.items.find((i: any) => i.id === weapon2.id);
    assert.strictEqual(Boolean(item2After?.is_equipped), true, 'Adaga agora deve estar equipada');

    // =========================================================================
    // 4. REGRESSÃO: Isolamento de Fichas e Recursos
    // =========================================================================
    const char2 = characterService.createCharacter(camp.id, p1User.id, {
      name: 'Ladino das Sombras',
      rawData: { vida_atual: 25, vida_max: 25, mana_atual: 15, mana_max: 15 }
    });

    // Atualiza apenas char2
    await fetch(`${baseUrl}/campaigns/${camp.id}/characters/${char2.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPlayer1}` },
      body: JSON.stringify({ rawData: { vida_atual: 18 } })
    });

    const c1Fresh = characterService.getCharacterById(camp.id, char1.id)!;
    const c2Fresh = characterService.getCharacterById(camp.id, char2.id)!;

    assert.strictEqual(c2Fresh.raw_data.vida_atual, 18, 'Char 2 teve sua vida atualizada');
    assert.strictEqual(c1Fresh.name, 'Mago dos Elementos', 'Char 1 permaneceu totalmente isolado');
    assert.strictEqual(c1Fresh.raw_data.vida_atual, undefined, 'Char 1 não teve sua ficha afetada por Char 2');

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
