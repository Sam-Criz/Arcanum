import http from 'http';
import { getDatabase } from './db/connection';
import { createApp } from './app';
import { RealtimeServer } from './modules/realtime/ws.server';
import { AuthService } from './modules/auth/auth.service';
import { RbacService } from './modules/permissions/rbac.service';
import { config } from './config';

async function bootstrap() {
  const db = getDatabase();
  const server = http.createServer();

  const authService = new AuthService(db);
  const rbacService = new RbacService(db);
  const realtimeServer = new RealtimeServer(server, authService, rbacService);

  const { app, setRealtimeServer } = createApp(db, realtimeServer);
  setRealtimeServer(realtimeServer);
  app.set('realtimeServer', realtimeServer);
  server.on('request', app);

  server.listen(config.port, () => {
    console.log(`[RPG Server] Servidor ativo em http://localhost:${config.port}`);
    console.log(`[RPG Server] WebSockets ativos em ws://localhost:${config.port}/ws`);
    console.log(`[RPG Server] Banco SQLite inicializado em ${config.dbPath}`);
  });
}

bootstrap().catch(err => {
  console.error('[RPG Server] Falha crítica ao iniciar servidor:', err);
  process.exit(1);
});
