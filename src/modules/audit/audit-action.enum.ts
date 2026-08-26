/**
 * Acoes rastreadas na trilha de auditoria (audit_log). Manter os valores
 * como strings estaveis — sao gravados no banco e consultados por relatorio.
 * Formato: dominio.acao_no_infinitivo (verbo no particulado quando fica melhor).
 */
export enum AuditAction {
  USER_ROLE_CHANGED = 'user.role_changed',
  USER_SELF_DELETED = 'user.self_deleted',
  USER_ANONYMIZED = 'user.anonymized',
  USER_DATA_EXPORTED = 'user.data_exported',
  USER_CONSENT_REACCEPTED = 'user.consent_reaccepted',
  USER_LOGIN_BLOCKED = 'user.login_blocked',
  SCHOOL_SUGGESTION_APPROVED = 'school.suggestion_approved',
  SCHOOL_SUGGESTION_LINKED = 'school.suggestion_linked',
  SCHOOL_SUGGESTION_REJECTED = 'school.suggestion_rejected',
  USER_SCHOOL_UPDATED = 'user.school_updated',
  QUESTION_ACTIVATED = 'question.activated',
  QUESTION_DEACTIVATED = 'question.deactivated',
  // Chat com IA: cada pergunta e registrada porque o conteudo sai da
  // aplicacao para um provedor externo (transferencia internacional).
  CHAT_PERGUNTA_ENVIADA = 'chat.pergunta_enviada',
}
