import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt.strategy';
import { StartGameDto } from './dto/start-game.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { UsePowerupDto } from './dto/use-powerup.dto';
import { GameService } from './game.service';

/**
 * Camada de tempo real do jogo. Espelha as acoes REST em eventos de socket,
 * delegando toda a regra de negocio ao GameService (fonte unica da verdade).
 *
 * Autenticacao: o handshake exige um JWT valido (via `auth.token` do socket.io
 * ou header Authorization: Bearer ...). Sem token valido, a conexao e fechada.
 *
 * Cada partida usa uma "room" nomeada pelo gameId, o que permite, futuramente,
 * espectadores e modos multiplayer sem alterar o motor de jogo.
 *
 * Eventos aceitos (cliente -> servidor):
 *   game:start   { difficultyId, educationLevelId? }
 *   game:next    { gameId }
 *   game:answer  { gameId, optionId, responseTimeMs? }
 *   game:powerup { gameId, powerup }
 *   game:finish  { gameId }
 *
 * Eventos emitidos (servidor -> cliente): os mesmos nomes com sufixo do resultado,
 * ex.: game:started, game:question, game:answer:result, game:powerup:result, game:finished.
 */
@WebSocketGateway({
  namespace: '/game',
  cors: { origin: true, credentials: true },
})
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly gameService: GameService,
    private readonly jwt: JwtService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      client.data.userId = payload.sub;
      this.logger.log(`Cliente conectado: ${client.id} (user ${payload.sub})`);
    } catch {
      this.logger.warn(`Handshake rejeitado: ${client.id}`);
      client.emit('game:error', 'Autenticacao obrigatoria.');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('game:start')
  async onStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: StartGameDto,
  ): Promise<void> {
    const userId = client.data.userId as number;
    const state = await this.run(() =>
      this.gameService.startGame(dto.difficultyId, userId, dto.educationLevelId),
    );
    await client.join(this.room(state.gameId));
    this.server.to(this.room(state.gameId)).emit('game:started', state);
  }

  @SubscribeMessage('game:next')
  async onNext(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { gameId: string },
  ): Promise<void> {
    await client.join(this.room(body.gameId));
    const result = await this.run(() => this.gameService.getNextQuestion(body.gameId));
    this.server.to(this.room(body.gameId)).emit('game:question', result);
  }

  @SubscribeMessage('game:answer')
  async onAnswer(@MessageBody() dto: SubmitAnswerDto & { gameId: string }): Promise<void> {
    const result = await this.run(() =>
      this.gameService.submitAnswer(dto.gameId, dto.optionId, dto.responseTimeMs),
    );
    this.server.to(this.room(dto.gameId)).emit('game:answer:result', result);
  }

  @SubscribeMessage('game:powerup')
  async onPowerup(@MessageBody() dto: UsePowerupDto & { gameId: string }): Promise<void> {
    const result = await this.run(() => this.gameService.usePowerup(dto.gameId, dto.powerup));
    this.server.to(this.room(dto.gameId)).emit('game:powerup:result', result);
  }

  @SubscribeMessage('game:finish')
  async onFinish(@MessageBody() body: { gameId: string }): Promise<void> {
    const result = await this.run(() => this.gameService.finishGame(body.gameId));
    this.server.to(this.room(body.gameId)).emit('game:finished', result);
  }

  private room(gameId: string): string {
    return `game:${gameId}`;
  }

  private extractToken(client: Socket): string {
    const auth = (client.handshake.auth as { token?: string } | undefined)?.token;
    if (auth) return auth;
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    throw new Error('missing token');
  }

  /** Converte erros de dominio (Nest) em WsException legiveis pelo cliente. */
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro no jogo.';
      throw new WsException(message);
    }
  }
}
