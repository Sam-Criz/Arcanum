import test from 'node:test';
import assert from 'node:assert';
import { getDatabase } from '../src/db/connection';
import { AuthService } from '../src/modules/auth/auth.service';
import { CampaignService } from '../src/modules/campaigns/campaign.service';
import { RulesService } from '../src/modules/rules-engine/rules.service';
import { CharacterService } from '../src/modules/characters/character.service';
import { RbacService } from '../src/modules/permissions/rbac.service';

test('Multi-Tenant & Regras Independentes entre Campanhas', () => {
  const db = getDatabase(':memory:');
  const authService = new AuthService(db);
  const rulesService = new RulesService(db);
  const campaignService = new CampaignService(db, rulesService);
  const characterService = new CharacterService(db, rulesService);
  const rbacService = new RbacService(db);

  // 1. Criar dois usuários independentes
  const userA = authService.register({
    email: 'mestreA@rpg.com',
    username: 'MestreParanormal',
    password: 'senhaSegura123'
  }).user;

  const userB = authService.register({
    email: 'mestreB@rpg.com',
    username: 'MestreCyberpunk',
    password: 'senhaSegura123'
  }).user;

  // 2. Mestre A cria Campanha A (Investigação Sobrenatural)
  const campaignA = campaignService.createCampaign(userA.id, {
    name: 'Operação Névoa Oculta',
    description: 'Campanha de horror e investigação sobrenatural',
    preset: 'investigacao'
  });

  // 3. Mestre B cria Campanha B (Cyberpunk)
  const campaignB = campaignService.createCampaign(userB.id, {
    name: 'Distrito Neon 2099',
    description: 'Campanha de alta tecnologia e baixa vida',
    preset: 'cyberpunk'
  });

  // 4. Testar Isolamento de Membresia e RBAC
  assert.strictEqual(rbacService.hasRole(campaignA.id, userA.id, 'owner'), true);
  assert.strictEqual(rbacService.hasRole(campaignA.id, userB.id, 'player'), false); // User B NÃO tem acesso à Campanha A

  assert.strictEqual(rbacService.hasRole(campaignB.id, userB.id, 'owner'), true);
  assert.strictEqual(rbacService.hasRole(campaignB.id, userA.id, 'player'), false); // User A NÃO tem acesso à Campanha B

  // 5. Testar Independência das Regras
  const rulesA = rulesService.getActiveRuleset(campaignA.id)!;
  const rulesB = rulesService.getActiveRuleset(campaignB.id)!;

  assert.strictEqual(rulesA.config.systemName, 'Investigação Paranormal & Ocultismo');
  assert.strictEqual(rulesB.config.systemName, 'Cyberpunk Neon & Cromo');

  // Campanha A possui Agilidade e Força
  const hasAgilidadeA = rulesA.config.attributes.some(a => a.name === 'Agilidade');
  assert.strictEqual(hasAgilidadeA, true);

  // Campanha B NÃO possui Agilidade, possui Reflexo e Cromo
  const hasAgilidadeB = rulesB.config.attributes.some(a => a.name === 'Agilidade');
  const hasReflexoB = rulesB.config.attributes.some(a => a.name === 'Reflexo');
  assert.strictEqual(hasAgilidadeB, false);
  assert.strictEqual(hasReflexoB, true);

  // 6. Validação e Execução de Fórmulas no Contexto de cada Campanha
  // Na Campanha A, '1d20 + Agilidade' é válida:
  const validationA = rulesService.validateFormula(campaignA.id, '1d20 + Agilidade');
  assert.strictEqual(validationA.isValid, true);

  // Na Campanha A, '2d6 + Reflexo' NÃO é válida (pois Reflexo é da Campanha B):
  const validationInvalidInA = rulesService.validateFormula(campaignA.id, '2d6 + Reflexo');
  assert.strictEqual(validationInvalidInA.isValid, false);
  assert.match(validationInvalidInA.error || '', /Reflexo/);

  // Na Campanha B, '2d6 + Reflexo' é perfeitamente válida:
  const validationB = rulesService.validateFormula(campaignB.id, '2d6 + Reflexo');
  assert.strictEqual(validationB.isValid, true);

  // Execução de rolagens com fórmulas configuradas
  const rollA = rulesService.evaluateFormula(campaignA.id, 'ataque_tiro', { Agilidade: 3 }, () => 0.5);
  assert.strictEqual(rollA.total, 14); // 11 (dado) + 3 (Agilidade) = 14

  const rollB = rulesService.evaluateFormula(campaignB.id, 'tiro_plasma', { Reflexo: 4 }, () => 0.5);
  assert.strictEqual(rollB.total, 12); // 8 (2d6 com metade) + 4 (Reflexo) = 12

  // 7. Criação e Cálculo Reativo de Fichas Dinâmicas em cada Campanha
  // Ficha no Sistema Paranormal (Campanha A)
  const charA = characterService.createCharacter(campaignA.id, userA.id, {
    name: 'Agente Arthur Cervero',
    rawData: {
      Forca: 2,
      Agilidade: 3,
      Intelecto: 2,
      Presenca: 1,
      Vigor: 2
    }
  });

  // Defesa derivada calculada automaticamente: 10 + Agilidade = 13
  assert.strictEqual(charA.computed_data.defesa, 13);
  // Vida máxima calculada: Vigor * 5 + 10 = 20
  assert.strictEqual(charA.computed_data.vida_max, 20);
  assert.strictEqual(charA.computed_data.vida_atual, 20);

  // Ficha no Sistema Cyberpunk (Campanha B)
  const charB = characterService.createCharacter(campaignB.id, userB.id, {
    name: 'Netrunner V',
    rawData: {
      Cromo: 4,
      Reflexo: 5,
      Inteligencia: 4,
      Tecnica: 3
    }
  });

  // Bateria máxima calculada: Cromo * 10 = 40
  assert.strictEqual(charB.computed_data.bateria_max, 40);

  // 8. Teste de Convite e RBAC Múltiplo
  // Mestre A gera convite de 'player' para a Campanha A
  const invite = campaignService.createInvite(campaignA.id, { role: 'player' });

  // Usuário B entra na Campanha A com o convite
  const joinResult = campaignService.joinCampaignByInvite(invite.code, userB.id);
  assert.strictEqual(joinResult.role, 'player');

  // Agora Usuário B é 'player' na Campanha A e continua 'owner' na Campanha B
  assert.strictEqual(rbacService.hasRole(campaignA.id, userB.id, 'player'), true);
  assert.strictEqual(rbacService.hasRole(campaignA.id, userB.id, 'master'), false); // Não é mestre na A
  assert.strictEqual(rbacService.hasRole(campaignB.id, userB.id, 'owner'), true);  // Mas é owner na B

  db.close();
});
