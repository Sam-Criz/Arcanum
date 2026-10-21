import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { AuthService } from '../auth/auth.service';
import { RbacService, CampaignRole } from '../permissions/rbac.service';
import { VttService } from '../vtt/vtt.service';

interface AuthenticatedClient {
  ws: WebSocket;
  userId: string;
  username: string;
  campaignId: string;
  role: CampaignRole;
}

export class RealtimeServer {
  private wss: WebSocketServer;
  private clients = new Map<WebSocket, AuthenticatedClient>();
  private vttService?: VttService;

  constructor(
    server: HttpServer,
    private authService: AuthService,
    private rbacService: RbacService
  ) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupListeners();
  }

  setVttService(vtt: VttService) {
    this.vttService = vtt;
  }

  private setupListeners(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Mensagem JSON inválida' }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });
  }

  private handleMessage(ws: WebSocket, data: any): void {
    // 1. Handshake de autenticação e ingresso na sala da campanha
    if (data.type === 'auth') {
      const { token, campaignId } = data;
      if (!token || !campaignId) {
        ws.send(JSON.stringify({ type: 'auth:error', message: 'Token e campaignId são obrigatórios.' }));
        return;
      }

      try {
        const payload = this.authService.verifyToken(token);
        const membership = this.rbacService.getMembership(campaignId, payload.userId);

        if (!membership) {
          ws.send(JSON.stringify({ 
            type: 'auth:error', 
            message: 'Acesso negado. Você não é participante desta campanha.' 
          }));
          ws.close();
          return;
        }

        const client: AuthenticatedClient = {
          ws,
          userId: payload.userId,
          username: payload.username,
          campaignId,
          role: membership.role
        };

        this.clients.set(ws, client);

        ws.send(JSON.stringify({
          type: 'auth:success',
          campaignId,
          role: membership.role,
          username: payload.username
        }));

        // Notificar sala sobre novo usuário online
        this.broadcast(campaignId, {
          type: 'user:joined',
          username: payload.username,
          userId: payload.userId
        }, ws);
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'auth:error', message: err.message || 'Token inválido' }));
      }
      return;
    }

    // 2. Para qualquer outro evento, verifica se o cliente está autenticado
    const client = this.clients.get(ws);
    if (!client) {
      ws.send(JSON.stringify({ type: 'error', message: 'Cliente não autenticado na campanha.' }));
      return;
    }

    // Processamento de mensagens em tempo real da mesa
    switch (data.type) {
      case 'chat:send': {
        this.broadcast(client.campaignId, {
          type: 'chat:message',
          sender: client.username,
          userId: client.userId,
          text: String(data.text || '').slice(0, 1000),
          timestamp: new Date().toISOString()
        });
        break;
      }

      case 'token:move': {
        if (!this.vttService) {
          // Fallback para broadcast simples se vttService ainda não injetado
          this.broadcast(client.campaignId, {
            type: 'token:moved',
            tokenId: data.tokenId,
            x: data.x,
            y: data.y,
            movedBy: client.username
          }, ws);
          break;
        }

        try {
          const isMaster = client.role === 'owner' || client.role === 'master' || client.role === 'assistant';
          const updated = this.vttService.updateToken(
            client.campaignId,
            data.tokenId,
            { x: data.x, y: data.y },
            client.userId,
            isMaster
          );

          this.broadcast(client.campaignId, {
            type: 'token:moved',
            tokenId: updated.id,
            x: updated.x,
            y: updated.y,
            token: updated,
            timestamp: Date.now(),
            movedBy: client.username
          }, ws);
        } catch (err: any) {
          ws.send(JSON.stringify({ type: 'error', message: err.message || 'Erro ao mover token.' }));
        }
        break;
      }
    }
  }

  /**
   * Envia evento para os clientes da campanha com suporte a filtragem de segredos
   */
  broadcast(
    campaignId: string, 
    payload: any, 
    excludeWs?: WebSocket,
    options: { masterOnly?: boolean } = {}
  ): void {
    const serialized = JSON.stringify(payload);

    for (const [ws, client] of this.clients.entries()) {
      if (client.campaignId !== campaignId) continue;
      if (excludeWs && ws === excludeWs) continue;

      if (options.masterOnly && client.role !== 'owner' && client.role !== 'master' && client.role !== 'assistant') {
        continue;
      }

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    }
  }

  /**
   * Transmite evento personalizado por cliente/função de permissão
   */
  broadcastFiltered(
    campaignId: string,
    filterFn: (client: AuthenticatedClient) => any | null,
    excludeWs?: WebSocket
  ): void {
    for (const [ws, client] of this.clients.entries()) {
      if (client.campaignId !== campaignId) continue;
      if (excludeWs && ws === excludeWs) continue;

      const payload = filterFn(client);
      if (payload !== null && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    }
  }

  close(): Promise<void> {
    return new Promise<void>((resolve) => {
      for (const [ws] of this.clients.entries()) {
        try { ws.terminate(); } catch {}
      }
      this.clients.clear();
      this.wss.close(() => resolve());
    });
  }
}
