import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuditModule } from '../audit/audit.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { Goal } from '../goals/entities/goal.entity';
import { Question } from '../questions/entities/question.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatConversa } from './entities/chat-conversa.entity';
import { ChatDocumento } from './entities/chat-documento.entity';
import { ChatMensagem } from './entities/chat-mensagem.entity';
import { ChatTrecho } from './entities/chat-trecho.entity';
import { FerramentasService } from './ferramentas/ferramentas.service';
import { IngestaoService } from './rag/ingestao.service';
import { OpenAiService } from './rag/openai.service';
import { RetrieverService } from './rag/retriever.service';

/**
 * Assistente de analise com RAG sobre pgvector. Ver .specs/06-chat-ia.md.
 *
 * Goal e Question entram no forFeature porque a ingestao deriva parte do corpus
 * do proprio banco (Fonte B) — e o que faz a base crescer com o catalogo.
 *
 * IngestaoService e exportado para a CLI `npm run chat:indexar` conseguir
 * resolve-lo fora do ciclo de vida HTTP.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatDocumento,
      ChatTrecho,
      ChatConversa,
      ChatMensagem,
      Goal,
      Question,
    ]),
    DashboardModule,
    AnalyticsModule,
    AuditModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, OpenAiService, RetrieverService, IngestaoService, FerramentasService],
  exports: [IngestaoService],
})
export class ChatModule {}
