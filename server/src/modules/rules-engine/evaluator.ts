import { ASTNode, Parser } from './parser';
import { EvaluationResult, RollBreakdownItem, ValidationResult } from './rules.types';

export interface EvaluationOptions {
  variables?: Record<string, number>;
  rng?: () => number;
}

export class EvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationError';
  }
}

export function stripDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export class Evaluator {
  private diceRolls: RollBreakdownItem[] = [];
  private variablesUsed: Record<string, number> = {};
  private normalizedVariables: Record<string, number> = {};
  private originalVariableKeys: string[] = [];
  private rng: () => number;

  constructor(options: EvaluationOptions = {}) {
    this.rng = options.rng || Math.random;

    // Normalizar nomes de variáveis para busca insensível a maiúsculas/minúsculas e acentuação
    if (options.variables) {
      this.originalVariableKeys = Object.keys(options.variables);
      for (const [key, value] of Object.entries(options.variables)) {
        const num = Number(value);
        const lower = key.toLowerCase();
        const stripped = stripDiacritics(lower);
        this.normalizedVariables[lower] = num;
        this.normalizedVariables[stripped] = num;
      }
    }
  }

  evaluate(ast: ASTNode, originalExpression: string): EvaluationResult {
    this.diceRolls = [];
    this.variablesUsed = {};

    const total = this.evaluateNode(ast);

    return {
      total,
      breakdown: {
        expression: originalExpression,
        diceRolls: this.diceRolls,
        variablesUsed: this.variablesUsed
      }
    };
  }

  static evaluateExpression(expression: string, options: EvaluationOptions = {}): EvaluationResult {
    const ast = Parser.parse(expression);
    const evaluator = new Evaluator(options);
    return evaluator.evaluate(ast, expression);
  }

  static validateExpression(expression: string, allowedVariables: string[]): ValidationResult {
    try {
      const ast = Parser.parse(expression);
      const usedVars: string[] = [];
      const allowedSet = new Set<string>();
      for (const v of allowedVariables) {
        allowedSet.add(v.toLowerCase());
        allowedSet.add(stripDiacritics(v.toLowerCase()));
      }

      const collect = (node: ASTNode) => {
        if (node.type === 'Identifier') {
          usedVars.push(node.name);
          const lower = node.name.toLowerCase();
          const stripped = stripDiacritics(lower);
          if (allowedSet.size > 0 && !allowedSet.has(lower) && !allowedSet.has(stripped)) {
            throw new EvaluationError(
              `Atributo/variável '${node.name}' não existe nesta campanha. Variáveis permitidas: ${allowedVariables.join(', ')}`
            );
          }
        } else if (node.type === 'BinaryOp') {
          collect(node.left);
          collect(node.right);
        } else if (node.type === 'UnaryOp') {
          collect(node.expr);
        } else if (node.type === 'FunctionCall') {
          for (const arg of node.args) {
            collect(arg);
          }
        }
      };

      collect(ast);

      return {
        isValid: true,
        variables: Array.from(new Set(usedVars))
      };
    } catch (err: any) {
      return {
        isValid: false,
        error: err.message,
        variables: []
      };
    }
  }

  private evaluateNode(node: ASTNode): number {
    switch (node.type) {
      case 'Number':
        return node.value;

      case 'Dice': {
        const rolls: number[] = [];
        let subtotal = 0;

        for (let i = 0; i < node.count; i++) {
          // Rolagem segura de dado no intervalo [1, sides]
          const roll = Math.floor(this.rng() * node.sides) + 1;
          rolls.push(roll);
          subtotal += roll;
        }

        const diceNotation = `${node.count}d${node.sides}`;
        this.diceRolls.push({
          dice: diceNotation,
          rolls,
          subtotal
        });

        return subtotal;
      }

      case 'Identifier': {
        const lowerName = node.name.toLowerCase();
        const stripped = stripDiacritics(lowerName);

        let val: number | undefined;
        if (lowerName in this.normalizedVariables) {
          val = this.normalizedVariables[lowerName];
        } else if (stripped in this.normalizedVariables) {
          val = this.normalizedVariables[stripped];
        }

        if (val === undefined) {
          const avail = this.originalVariableKeys.length > 0
            ? this.originalVariableKeys.join(', ')
            : 'nenhuma';
          throw new EvaluationError(
            `Variável '${node.name}' não foi fornecida no contexto. Atributos/variáveis disponíveis: [${avail}].`
          );
        }
        this.variablesUsed[node.name] = val;
        return val;
      }

      case 'UnaryOp': {
        const val = this.evaluateNode(node.expr);
        return node.op === '-' ? -val : val;
      }

      case 'BinaryOp': {
        const left = this.evaluateNode(node.left);
        const right = this.evaluateNode(node.right);

        switch (node.op) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/':
            if (right === 0) {
              throw new EvaluationError('Divisão por zero não permitida na fórmula');
            }
            return left / right;
          case '%':
            if (right === 0) {
              throw new EvaluationError('Módulo por zero não permitido');
            }
            return left % right;
          case '^':
            return Math.pow(left, right);
        }
        break;
      }

      case 'FunctionCall': {
        const args = node.args.map(arg => this.evaluateNode(arg));

        switch (node.name) {
          case 'max': return Math.max(...args);
          case 'min': return Math.min(...args);
          case 'floor': return Math.floor(args[0]);
          case 'ceil': return Math.ceil(args[0]);
          case 'round': return Math.round(args[0]);
          case 'abs': return Math.abs(args[0]);
          case 'sqrt':
            if (args[0] < 0) throw new EvaluationError('Raiz quadrada de número negativo não permitida');
            return Math.sqrt(args[0]);
          case 'clamp': {
            const [val, minVal, maxVal] = args;
            return Math.min(Math.max(val, minVal), maxVal);
          }
          default:
            throw new EvaluationError(`Função não suportada: ${node.name}`);
        }
      }
    }
  }
}
