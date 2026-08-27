/**
 * Versao vigente do termo de privacidade.
 *
 * Fonte UNICA de proposito. O valor estava repetido como literal em
 * auth.service e users.controller: bastava atualizar um e esquecer o outro para
 * o reconsentimento parar de disparar em silencio — o usuario continuaria
 * aceitando um termo que mudou.
 *
 * Precisa acompanhar o PRIVACY_VERSION exibido em
 * tcc-frontend/src/pages/PrivacyPage.tsx. Divergencia entre os dois faz a tela
 * mostrar uma versao e o servidor cobrar outra.
 *
 * Muda quando a politica muda de forma material — nova finalidade, novo
 * destinatario, transferencia internacional. Correcao de redacao nao muda.
 */
export const PRIVACY_VERSION_ATUAL = process.env.PRIVACY_VERSION ?? '2026-08-v2';
