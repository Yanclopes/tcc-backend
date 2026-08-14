import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppUser } from '../users/entities/app-user.entity';
import { AuditAction } from './audit-action.enum';
import { AuditLog } from './entities/audit-log.entity';

interface RecordParams {
  /** Id do usuario que executou a acao. null quando o sistema age sem ator (raro). */
  actorUserId: number | null;
  action: AuditAction;
  /** Tipo do alvo (ex.: 'app_user', 'school_suggestion'). Opcional. */
  targetType?: string;
  /** Id do alvo — convertido para string para acomodar ints, uuids e slugs. */
  targetId?: string | number;
  /** Contexto adicional em JSON (ex.: { oldRole: 'user', newRole: 'admin' }). */
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /**
   * Persiste uma linha de auditoria. Nunca lanca — falha silenciosa
   * (com log) para nao derrubar a operacao principal por causa da trilha.
   */
  async record(params: RecordParams): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          user: params.actorUserId ? ({ id: params.actorUserId } as AppUser) : null,
          action: params.action,
          targetType: params.targetType ?? null,
          targetId: params.targetId != null ? String(params.targetId) : null,
          metadata: params.metadata ?? null,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao gravar audit_log (${params.action}): ${message}`);
    }
  }
}
