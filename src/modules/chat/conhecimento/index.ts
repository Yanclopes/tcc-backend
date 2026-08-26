import { DocumentoDeConhecimento } from '../chat.types';
import { dicionarioDeDados } from './dicionario-de-dados';
import { metricas } from './metricas';
import { playbookOperacional } from './playbook-operacional';
import { quandoNaoAgir } from './quando-nao-agir';
import { regrasDoJogo } from './regras-do-jogo';

/**
 * Fonte A do corpus: base curada, escrita para o assistente.
 *
 * Mora em TypeScript (e nao em markdown solto) porque o Dockerfile e
 * multi-stage e o estagio final so copia `dist/` — markdown nao chegaria ao
 * servidor. Compilado, este modulo viaja junto com o resto da aplicacao, do
 * mesmo jeito que o seed. Ver .specs/06-chat-ia.md.
 */
export const BASE_CURADA: DocumentoDeConhecimento[] = [
  metricas,
  regrasDoJogo,
  dicionarioDeDados,
  playbookOperacional,
  quandoNaoAgir,
];
