import test from 'node:test';
import assert from 'node:assert';
import { Parser, RuleSyntaxError } from '../src/modules/rules-engine/parser';
import { Evaluator, EvaluationError } from '../src/modules/rules-engine/evaluator';

test('Rules Engine - Expressões Aritméticas Básicas e Precedência', () => {
  const result1 = Evaluator.evaluateExpression('10 + 5 * 2');
  assert.strictEqual(result1.total, 20);

  const result2 = Evaluator.evaluateExpression('(10 + 5) * 2');
  assert.strictEqual(result2.total, 30);

  const result3 = Evaluator.evaluateExpression('2 ^ 3 + 4');
  assert.strictEqual(result3.total, 12);

  const result4 = Evaluator.evaluateExpression('10 - -5');
  assert.strictEqual(result4.total, 15);

  const result5 = Evaluator.evaluateExpression('20 / 4 + 2');
  assert.strictEqual(result5.total, 7);
});

test('Rules Engine - Rolagem de Dados com Breakdown Detalhado', () => {
  // Mock RNG que sempre retorna 0.5 (resultando em 11 em 1d20, ou 4 em 1d6)
  const mockRng = () => 0.5;

  const result = Evaluator.evaluateExpression('1d20 + 5', { rng: mockRng });
  assert.strictEqual(result.total, 16); // floor(0.5 * 20) + 1 = 11, 11 + 5 = 16
  assert.strictEqual(result.breakdown.diceRolls.length, 1);
  assert.strictEqual(result.breakdown.diceRolls[0].dice, '1d20');
  assert.deepStrictEqual(result.breakdown.diceRolls[0].rolls, [11]);
});

test('Rules Engine - Funções Matemáticas Autorizadas', () => {
  assert.strictEqual(Evaluator.evaluateExpression('max(10, 25)').total, 25);
  assert.strictEqual(Evaluator.evaluateExpression('min(10, 25)').total, 10);
  assert.strictEqual(Evaluator.evaluateExpression('floor(7.8)').total, 7);
  assert.strictEqual(Evaluator.evaluateExpression('ceil(7.2)').total, 8);
  assert.strictEqual(Evaluator.evaluateExpression('round(7.5)').total, 8);
  assert.strictEqual(Evaluator.evaluateExpression('abs(-15)').total, 15);
  assert.strictEqual(Evaluator.evaluateExpression('clamp(15, 0, 10)').total, 10);
  assert.strictEqual(Evaluator.evaluateExpression('clamp(-5, 0, 10)').total, 0);
  assert.strictEqual(Evaluator.evaluateExpression('clamp(5, 0, 10)').total, 5);
});

test('Rules Engine - Variáveis e Atributos de Personagem', () => {
  const vars = { Agilidade: 4, Forca: 3, Armadura: 2, DanoBruto: 12 };

  const attackRoll = Evaluator.evaluateExpression('Agilidade + 10', { variables: vars });
  assert.strictEqual(attackRoll.total, 14);

  const damageReduction = Evaluator.evaluateExpression('max(0, DanoBruto - Armadura)', { variables: vars });
  assert.strictEqual(damageReduction.total, 10);

  // Insensível a maiúsculas/minúsculas
  const caseInsensitive = Evaluator.evaluateExpression('agilidade * 2', { variables: vars });
  assert.strictEqual(caseInsensitive.total, 8);
});

test('Rules Engine - Segurança e Tratamento de Erros', () => {
  // Divisão por zero
  assert.throws(() => {
    Evaluator.evaluateExpression('10 / 0');
  }, EvaluationError);

  // Função não autorizada (sem eval ou acesso a JS perigoso)
  assert.throws(() => {
    Parser.parse('alert(1)');
  }, RuleSyntaxError);

  assert.throws(() => {
    Parser.parse('require("fs")');
  }, RuleSyntaxError);

  // Variável não fornecida no contexto
  assert.throws(() => {
    Evaluator.evaluateExpression('Forca + 5', { variables: { Destreza: 2 } });
  }, EvaluationError);
});

test('Rules Engine - Validação de Expressões contra Atributos da Campanha', () => {
  const allowed = ['Forca', 'Agilidade', 'Intelecto', 'Vigor'];

  const valid = Evaluator.validateExpression('1d20 + Agilidade', allowed);
  assert.strictEqual(valid.isValid, true);
  assert.deepStrictEqual(valid.variables, ['Agilidade']);

  const invalid = Evaluator.validateExpression('1d20 + Carisma', allowed);
  assert.strictEqual(invalid.isValid, false);
  assert.match(invalid.error || '', /Carisma/);
});
