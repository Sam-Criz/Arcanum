import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthTokenPayload } from './auth.types';

// Estendendo o tipo Request do Express para incluir o usuário logado
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function createAuthMiddleware(authService: AuthService) {
  return function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Token de autenticação não fornecido.' });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({ error: 'Formato de token inválido. Esperado Bearer <token>.' });
      return;
    }

    const token = parts[1];
    try {
      const payload = authService.verifyToken(token);
      req.user = payload;
      next();
    } catch (err: any) {
      res.status(401).json({ error: err.message || 'Token de autenticação inválido.' });
    }
  };
}
