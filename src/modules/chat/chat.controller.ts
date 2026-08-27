import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuditAction } from '../audit/audit-action.enum';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRole } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ChatService } from './chat.service';
import {
  ConversaDto,
  CriarConversaDto,
  MensagemDto,
  PerguntarDto,
  RespostaDto,
  StatusDoChatDto,
} from './dto/chat.dto';
import { RetrieverService } from './rag/retriever.service';

/**
 * Assistente de analise com RAG. Exclusivo de admin — ver tcc-docs/specs/06-chat-ia.md.
 *
 * O limite de taxa e proprio e bem mais baixo que o global de 120/min: cada
 * mensagem dispara embedding + uma ou mais chamadas de modelo, e isso custa.
 */
@ApiTags('chat')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly retriever: RetrieverService,
    private readonly audit: AuditService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Diz se o assistente esta configurado e quanto ha indexado' })
  async status(): Promise<StatusDoChatDto> {
    return {
      habilitado: this.chat.habilitado,
      trechosIndexados: await this.retriever.contarTrechos(),
      modelo: process.env.OPENAI_MODEL_CHAT ?? 'gpt-4o-mini',
    };
  }

  @Get('conversas')
  @ApiOperation({ summary: 'Lista as conversas do usuario autenticado' })
  async listar(@CurrentUser() user: JwtUser): Promise<ConversaDto[]> {
    return this.chat.listarConversas(user.userId);
  }

  @Post('conversas')
  @ApiOperation({ summary: 'Abre uma conversa nova' })
  async criar(@Body() dto: CriarConversaDto, @CurrentUser() user: JwtUser): Promise<ConversaDto> {
    return this.chat.criarConversa(user.userId, dto.titulo);
  }

  @Get('conversas/:id')
  @ApiOperation({ summary: 'Retorna uma conversa com todas as suas mensagens' })
  async obter(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<{ conversa: ConversaDto; mensagens: MensagemDto[] }> {
    return this.chat.obterConversa(id, user.userId);
  }

  @Delete('conversas/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Apaga uma conversa e suas mensagens' })
  async remover(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    return this.chat.removerConversa(id, user.userId);
  }

  @Post('conversas/:id/mensagens')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Envia uma pergunta e recebe a resposta do assistente' })
  async perguntar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PerguntarDto,
    @CurrentUser() user: JwtUser,
  ): Promise<RespostaDto> {
    // Registrado ANTES da chamada: o que importa auditar e que o conteudo saiu
    // da aplicacao para um provedor externo, tenha a resposta vindo ou nao.
    await this.audit.record({
      actorUserId: user.userId,
      action: AuditAction.CHAT_PERGUNTA_ENVIADA,
      targetType: 'chat_conversa',
      targetId: id,
      metadata: { tamanhoDaPergunta: dto.pergunta.length },
    });

    return this.chat.perguntar(id, user.userId, dto.pergunta);
  }
}
