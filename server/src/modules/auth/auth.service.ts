import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../../config';
import { AuthResponse, AuthTokenPayload, LoginDTO, RegisterDTO, User } from './auth.types';

export class AuthService {
  constructor(private db: DatabaseSync) {}

  register(data: RegisterDTO): AuthResponse {
    const emailNormalized = data.email.trim().toLowerCase();
    const usernameNormalized = data.username.trim();

    if (!emailNormalized || !usernameNormalized || !data.password) {
      throw new Error('Email, nome de usuário e senha são obrigatórios.');
    }

    if (data.password.length < 6) {
      throw new Error('A senha deve conter no mínimo 6 caracteres.');
    }

    // Verificar se já existe email ou username
    const existing = this.db.prepare(`
      SELECT id FROM users WHERE email = ? OR username = ?
    `).get(emailNormalized, usernameNormalized);

    if (existing) {
      throw new Error('Já existe uma conta cadastrada com este email ou nome de usuário.');
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(data.password, salt);
    const userId = crypto.randomUUID();
    const avatarUrl = data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${usernameNormalized}`;

    this.db.prepare(`
      INSERT INTO users (id, email, username, password_hash, avatar_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, emailNormalized, usernameNormalized, passwordHash, avatarUrl);

    const token = this.generateToken({
      userId,
      email: emailNormalized,
      username: usernameNormalized
    });

    return {
      user: {
        id: userId,
        email: emailNormalized,
        username: usernameNormalized,
        avatarUrl
      },
      token
    };
  }

  login(data: LoginDTO): AuthResponse {
    const loginNormalized = data.login.trim().toLowerCase();

    const user = this.db.prepare(`
      SELECT id, email, username, password_hash, avatar_url 
      FROM users 
      WHERE LOWER(email) = ? OR LOWER(username) = ?
    `).get(loginNormalized, loginNormalized) as any;

    if (!user) {
      throw new Error('Credenciais inválidas. Verifique seu email/usuário e senha.');
    }

    const passwordValid = bcrypt.compareSync(data.password, user.password_hash);
    if (!passwordValid) {
      throw new Error('Credenciais inválidas. Verifique seu email/usuário e senha.');
    }

    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      username: user.username
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatar_url
      },
      token
    };
  }

  getUserById(id: string): User | null {
    const row = this.db.prepare(`
      SELECT id, email, username, avatar_url, created_at 
      FROM users 
      WHERE id = ?
    `).get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      username: row.username,
      avatar_url: row.avatar_url,
      created_at: row.created_at
    };
  }

  generateToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
    } catch {
      throw new Error('Sessão expirada ou token inválido.');
    }
  }
}
