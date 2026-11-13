import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipMap = new Map<string, RateLimitRecord>();

/**
 * Middleware leve e em memória para mitigação de ataques de força bruta em autenticação.
 * Permite maxRequests por windowMs por IP.
 */
export function createRateLimiter(options: { windowMs: number; maxRequests: number; message?: string }) {
  const { windowMs, maxRequests, message = 'Muitas tentativas. Tente novamente mais tarde.' } = options;

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = ipMap.get(ip);

    if (!record || now > record.resetTime) {
      ipMap.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      res.status(429).json({ error: message });
      return;
    }

    record.count++;
    next();
  };
}
