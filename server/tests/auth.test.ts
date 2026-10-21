import test from 'node:test';
import assert from 'node:assert';
import { getDatabase } from '../src/db/connection';
import { AuthService } from '../src/modules/auth/auth.service';

test('Auth Module - Registro, Login e JWT', () => {
  const db = getDatabase(':memory:');
  const authService = new AuthService(db);

  // 1. Registro com sucesso
  const regResult = authService.register({
    email: 'mestre@rpg.com',
    username: 'MestreMistico',
    password: 'senhaSegura123'
  });

  assert.strictEqual(regResult.user.email, 'mestre@rpg.com');
  assert.strictEqual(regResult.user.username, 'MestreMistico');
  assert.ok(regResult.token);

  // 2. Tentar registrar com email duplicado
  assert.throws(() => {
    authService.register({
      email: 'mestre@rpg.com',
      username: 'OutroNome',
      password: 'senhaSegura123'
    });
  }, /Já existe uma conta/);

  // 3. Login com email válido
  const loginResult = authService.login({
    login: 'mestre@rpg.com',
    password: 'senhaSegura123'
  });
  assert.strictEqual(loginResult.user.id, regResult.user.id);
  assert.ok(loginResult.token);

  // 4. Login com username válido
  const loginUser = authService.login({
    login: 'MestreMistico',
    password: 'senhaSegura123'
  });
  assert.strictEqual(loginUser.user.id, regResult.user.id);

  // 5. Senha incorreta
  assert.throws(() => {
    authService.login({
      login: 'mestre@rpg.com',
      password: 'senhaErrada'
    });
  }, /Credenciais inválidas/);

  // 6. Verificação de Token
  const payload = authService.verifyToken(loginResult.token);
  assert.strictEqual(payload.userId, regResult.user.id);
  assert.strictEqual(payload.email, 'mestre@rpg.com');

  db.close();
});
