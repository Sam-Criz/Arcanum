import path from 'path';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'modular-rpg-super-secret-key-change-in-prod-2026',
  jwtExpiresIn: '7d',
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../../data/rpg.db'),
  isDev: process.env.NODE_ENV !== 'production'
};
