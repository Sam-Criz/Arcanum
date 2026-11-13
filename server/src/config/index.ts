import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const defaultSecret = 'modular-rpg-super-secret-key-change-in-prod-2026';
const jwtSecret = process.env.JWT_SECRET || defaultSecret;

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === defaultSecret)) {
  throw new Error('FATAL: A variável JWT_SECRET deve ser obrigatoriamente configurada com chave segura em ambiente de produção.');
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret,
  jwtExpiresIn: '7d',
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../../data/rpg.db'),
  isDev: !isProduction
};
