/**
 * Papeis de acesso do sistema (hierarquia: master > admin > user).
 * - USER: participante comum — joga apenas.
 * - ADMIN: joga e acessa o dashboard (analise de dados) e a gestao de conteudo.
 * - MASTER: super-admin. Faz tudo do admin e, alem disso, concede/revoga o papel
 *   admin de outros usuarios. Existe apenas um (criado pela seed).
 */
export enum AppRole {
  USER = 'user',
  ADMIN = 'admin',
  MASTER = 'master',
}

/** Papel atribuido por padrao a todo cadastro publico (sem auto-elevacao). */
export const DEFAULT_ROLE = AppRole.USER;

/** Papeis que um master pode atribuir a outros usuarios (nunca 'master'). */
export const ASSIGNABLE_ROLES = [AppRole.USER, AppRole.ADMIN] as const;
