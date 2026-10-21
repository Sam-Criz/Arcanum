export type TokenType =
  | 'NUMBER'
  | 'DICE'
  | 'IDENTIFIER'
  | 'PLUS'
  | 'MINUS'
  | 'MULTIPLY'
  | 'DIVIDE'
  | 'MODULO'
  | 'POWER'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export type ASTNode =
  | { type: 'Number'; value: number }
  | { type: 'Dice'; count: number; sides: number }
  | { type: 'Identifier'; name: string }
  | { type: 'UnaryOp'; op: '+' | '-'; expr: ASTNode }
  | { type: 'BinaryOp'; op: '+' | '-' | '*' | '/' | '%' | '^'; left: ASTNode; right: ASTNode }
  | { type: 'FunctionCall'; name: string; args: ASTNode[] };

const ALLOWED_FUNCTIONS = new Set(['max', 'min', 'floor', 'ceil', 'round', 'abs', 'clamp', 'sqrt']);
const MAX_EXPRESSION_LENGTH = 500;
const MAX_DICE_COUNT = 100;
const MAX_DICE_SIDES = 10000;
const MAX_RECURSION_DEPTH = 30;

export class RuleSyntaxError extends Error {
  constructor(message: string, public position?: number) {
    super(position !== undefined ? `Erro de sintaxe (pos ${position}): ${message}` : message);
    this.name = 'RuleSyntaxError';
  }
}

export class Tokenizer {
  private pos = 0;

  constructor(private input: string) {
    if (input.length > MAX_EXPRESSION_LENGTH) {
      throw new RuleSyntaxError(`A expressão excede o tamanho máximo de ${MAX_EXPRESSION_LENGTH} caracteres.`);
    }
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    const len = this.input.length;

    while (this.pos < len) {
      const char = this.input[this.pos];

      // Ignorar espaços
      if (/\s/.test(char)) {
        this.pos++;
        continue;
      }

      const startPos = this.pos;

      // Operadores simples e parênteses
      if (char === '+') { tokens.push({ type: 'PLUS', value: '+', position: startPos }); this.pos++; continue; }
      if (char === '-') { tokens.push({ type: 'MINUS', value: '-', position: startPos }); this.pos++; continue; }
      if (char === '*') { tokens.push({ type: 'MULTIPLY', value: '*', position: startPos }); this.pos++; continue; }
      if (char === '/') { tokens.push({ type: 'DIVIDE', value: '/', position: startPos }); this.pos++; continue; }
      if (char === '%') { tokens.push({ type: 'MODULO', value: '%', position: startPos }); this.pos++; continue; }
      if (char === '^') { tokens.push({ type: 'POWER', value: '^', position: startPos }); this.pos++; continue; }
      if (char === '(') { tokens.push({ type: 'LPAREN', value: '(', position: startPos }); this.pos++; continue; }
      if (char === ')') { tokens.push({ type: 'RPAREN', value: ')', position: startPos }); this.pos++; continue; }
      if (char === ',') { tokens.push({ type: 'COMMA', value: ',', position: startPos }); this.pos++; continue; }

      // Dados sem contagem explícita no início (Ex: "d20", "D6")
      if ((char === 'd' || char === 'D') && (this.pos + 1 < len && /\d/.test(this.input[this.pos + 1]))) {
        this.pos++; // consome 'd'
        let sidesStr = '';
        while (this.pos < len && /\d/.test(this.input[this.pos])) {
          sidesStr += this.input[this.pos++];
        }
        tokens.push({ type: 'DICE', value: `1d${sidesStr}`, position: startPos });
        continue;
      }

      // Números ou Dados com contagem explícita (Ex: "10", "2d6", "3.5")
      if (/\d/.test(char)) {
        let numStr = '';
        while (this.pos < len && /\d/.test(this.input[this.pos])) {
          numStr += this.input[this.pos++];
        }

        // Verifica se é dado (Ex: 2d6, 1D20)
        if (this.pos < len && (this.input[this.pos] === 'd' || this.input[this.pos] === 'D')) {
          this.pos++; // consome 'd'
          let sidesStr = '';
          while (this.pos < len && /\d/.test(this.input[this.pos])) {
            sidesStr += this.input[this.pos++];
          }
          if (!sidesStr) {
            throw new RuleSyntaxError(`Expressão de dado incompleta: esperado número de faces após 'd'`, startPos);
          }
          tokens.push({ type: 'DICE', value: `${numStr}d${sidesStr}`, position: startPos });
          continue;
        }

        // Ponto decimal
        if (this.pos < len && this.input[this.pos] === '.' && this.pos + 1 < len && /\d/.test(this.input[this.pos + 1])) {
          numStr += this.input[this.pos++]; // '.'
          while (this.pos < len && /\d/.test(this.input[this.pos])) {
            numStr += this.input[this.pos++];
          }
        }

        tokens.push({ type: 'NUMBER', value: numStr, position: startPos });
        continue;
      }

      // Identificadores de variáveis ou funções (Ex: Agilidade, Forca, max, min)
      // Suporta letras latin-1 e acentos comuns em português
      if (/[a-zA-Z_À-ÿ]/.test(char)) {
        let ident = '';
        while (this.pos < len && /[a-zA-Z0-9_À-ÿ]/.test(this.input[this.pos])) {
          ident += this.input[this.pos++];
        }
        tokens.push({ type: 'IDENTIFIER', value: ident, position: startPos });
        continue;
      }

      throw new RuleSyntaxError(`Caractere não reconhecido: '${char}'`, startPos);
    }

    tokens.push({ type: 'EOF', value: '', position: this.pos });
    return tokens;
  }
}

export class Parser {
  private tokens: Token[];
  private current = 0;
  private depth = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  static parse(expression: string): ASTNode {
    const trimmed = expression.trim();
    if (!trimmed) {
      throw new RuleSyntaxError('Expressão de fórmula vazia');
    }
    const tokenizer = new Tokenizer(trimmed);
    const tokens = tokenizer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parseExpression();

    if (!parser.isAtEnd()) {
      const remaining = parser.peek();
      throw new RuleSyntaxError(`Caractere inesperado após expressão: '${remaining.value}'`, remaining.position);
    }

    return ast;
  }

  private parseExpression(): ASTNode {
    return this.parseAdditive();
  }

  // Precedência 1: + e -
  private parseAdditive(): ASTNode {
    let expr = this.parseMultiplicative();

    while (this.match('PLUS', 'MINUS')) {
      const op = this.previous().type === 'PLUS' ? '+' : '-';
      const right = this.parseMultiplicative();
      expr = { type: 'BinaryOp', op, left: expr, right };
    }

    return expr;
  }

  // Precedência 2: *, / e %
  private parseMultiplicative(): ASTNode {
    let expr = this.parseExponent();

    while (this.match('MULTIPLY', 'DIVIDE', 'MODULO')) {
      const prevType = this.previous().type;
      const op = prevType === 'MULTIPLY' ? '*' : prevType === 'DIVIDE' ? '/' : '%';
      const right = this.parseExponent();
      expr = { type: 'BinaryOp', op, left: expr, right };
    }

    return expr;
  }

  // Precedência 3: ^ (exponenciação, associativa à direita)
  private parseExponent(): ASTNode {
    const expr = this.parseUnary();

    if (this.match('POWER')) {
      const right = this.parseExponent();
      return { type: 'BinaryOp', op: '^', left: expr, right };
    }

    return expr;
  }

  // Precedência 4: Unary + e -
  private parseUnary(): ASTNode {
    if (this.match('MINUS')) {
      const expr = this.parseUnary();
      return { type: 'UnaryOp', op: '-', expr };
    }
    if (this.match('PLUS')) {
      const expr = this.parseUnary();
      return { type: 'UnaryOp', op: '+', expr };
    }
    return this.parsePrimary();
  }

  // Precedência 5: Termos básicos, funções, parênteses
  private parsePrimary(): ASTNode {
    this.depth++;
    if (this.depth > MAX_RECURSION_DEPTH) {
      throw new RuleSyntaxError('Limite de aninhamento da expressão excedido');
    }

    try {
      if (this.match('NUMBER')) {
        const val = parseFloat(this.previous().value);
        return { type: 'Number', value: val };
      }

      if (this.match('DICE')) {
        const raw = this.previous().value;
        const [countStr, sidesStr] = raw.toLowerCase().split('d');
        const count = parseInt(countStr, 10);
        const sides = parseInt(sidesStr, 10);

        if (count < 1 || count > MAX_DICE_COUNT) {
          throw new RuleSyntaxError(`A quantidade de dados deve estar entre 1 e ${MAX_DICE_COUNT}`);
        }
        if (sides < 1 || sides > MAX_DICE_SIDES) {
          throw new RuleSyntaxError(`O número de faces do dado deve estar entre 1 e ${MAX_DICE_SIDES}`);
        }

        return { type: 'Dice', count, sides };
      }

      if (this.match('IDENTIFIER')) {
        const token = this.previous();
        const ident = token.value;

        // Se for seguido por parêntese de abertura '(', é uma chamada de função
        if (this.check('LPAREN')) {
          this.advance(); // consome '('
          const fnName = ident.toLowerCase();

          if (!ALLOWED_FUNCTIONS.has(fnName)) {
            throw new RuleSyntaxError(`Função '${ident}' não é permitida. Funções autorizadas: ${Array.from(ALLOWED_FUNCTIONS).join(', ')}`, token.position);
          }

          const args: ASTNode[] = [];
          if (!this.check('RPAREN')) {
            do {
              args.push(this.parseExpression());
            } while (this.match('COMMA'));
          }

          this.consume('RPAREN', `Esperado ')' após argumentos da função '${fnName}'`);
          this.validateFunctionArgs(fnName, args.length, token.position);

          return { type: 'FunctionCall', name: fnName, args };
        }

        // Variável / Atributo
        return { type: 'Identifier', name: ident };
      }

      if (this.match('LPAREN')) {
        const expr = this.parseExpression();
        this.consume('RPAREN', `Esperado ')' para fechar expressão`);
        return expr;
      }

      const token = this.peek();
      throw new RuleSyntaxError(`Esperada expressão válida, mas encontrado '${token.value || 'fim'}'`, token.position);
    } finally {
      this.depth--;
    }
  }

  private validateFunctionArgs(fnName: string, argCount: number, pos: number): void {
    if ((fnName === 'max' || fnName === 'min') && argCount < 2) {
      throw new RuleSyntaxError(`A função ${fnName}() requer pelo menos 2 argumentos`, pos);
    }
    if ((fnName === 'floor' || fnName === 'ceil' || fnName === 'round' || fnName === 'abs' || fnName === 'sqrt') && argCount !== 1) {
      throw new RuleSyntaxError(`A função ${fnName}() requer exatamente 1 argumento`, pos);
    }
    if (fnName === 'clamp' && argCount !== 3) {
      throw new RuleSyntaxError(`A função clamp() requer exatamente 3 argumentos: clamp(valor, min, max)`, pos);
    }
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, errorMessage: string): Token {
    if (this.check(type)) return this.advance();
    const token = this.peek();
    throw new RuleSyntaxError(errorMessage, token.position);
  }
}
