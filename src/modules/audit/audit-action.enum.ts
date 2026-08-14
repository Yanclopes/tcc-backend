/**
 * Acoes rastreadas na trilha de auditoria (audit_log). Manter os valores
 * como strings estaveis — sao gravados no banco e consultados por relatorio.
 * Formato: dominio.acao_no_infinitivo (verbo no particulado quando fica melhor).
 */
export enum AuditAction {
  USER_ROLE_CHANGED = 'user.role_changed',
  USER_SELF_DELETED = 'user.self_deleted',
  USER_DATA_EXPORTED = 'user.data_exported',
  SCHOOL_SUGGESTION_APPROVED = 'school.suggestion_approved',
  SCHOOL_SUGGESTION_REJECTED = 'school.suggestion_rejected',
  QUESTION_ACTIVATED = 'question.activated',
  QUESTION_DEACTIVATED = 'question.deactivated',
}
