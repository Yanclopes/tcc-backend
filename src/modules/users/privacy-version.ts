/**
 * Versao vigente do termo de privacidade — fonte unica no back-end.
 *
 * O literal estava repetido em auth.service.ts e users.controller.ts. Duas
 * copias de um valor que precisa casar divergem em silencio: o login compararia
 * contra uma versao e o aceite gravaria outra, e o usuario ficaria preso na tela
 * de reaceite sem erro em lugar nenhum.
 *
 * O front-end tem a sua propria constante (src/lib/privacidade.ts) e precisa
 * carregar o MESMO valor — e o que decide se o participante cai no reaceite.
 *
 * ATENCAO: mudar este valor obriga TODOS os participantes ativos a reaceitar o
 * termo no proximo login. Publique entre aplicacoes com turmas, nunca durante
 * uma coleta em andamento.
 */
export const PRIVACY_VERSION_PADRAO = '2026-10-v2';

/** Versao vigente, permitindo sobrescrita por ambiente sem novo build. */
export function versaoVigenteDoTermo(): string {
  return process.env.PRIVACY_VERSION ?? PRIVACY_VERSION_PADRAO;
}
