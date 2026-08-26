import { DocumentoDeConhecimento } from '../chat.types';

/**
 * O que a plataforma NAO consegue responder hoje, e por que.
 *
 * Medido: sem este documento o assistente, diante de uma pergunta sem dado,
 * substituia por um conjunto vizinho e apresentava como resposta — perguntado
 * sobre queda de acerto ao longo da partida, devolveu uma tabela de acerto por
 * pergunta. E oferecia rodar consultas que nao existem ("quer que eu busque?").
 *
 * MANUTENCAO: ao criar uma ferramenta nova, remova daqui o ponto cego
 * correspondente. Documento desatualizado aqui faz o assistente recusar algo
 * que ele ja sabe responder.
 */
export const pontosCegos: DocumentoDeConhecimento = {
  fonte: 'curado:pontos-cegos',
  titulo: 'O que nao da para responder com os dados de hoje',
  texto: `
# Pontos cegos: o que nao da para responder

Diante de qualquer item desta lista, a resposta correta e dizer que o dado nao
esta disponivel e explicar por que. Nunca substitua por um conjunto parecido:
responder "acerto por pergunta" a quem perguntou "acerto por posicao na
partida" e entregar outra coisa com aparencia de resposta.

E nunca ofereca rodar uma consulta que nao esta na lista de ferramentas. Se a
ferramenta nao existe, dizer "posso buscar isso para voce" e prometer algo que
nao vai acontecer.

## Nao existe no banco

**Quais perguntas foram puladas.** O power-up \`skip\` nao grava linha em
\`game_answer\`. O pulo nao deixa rastro nenhum — nao e questao de consulta, o
dado nao foi coletado. Registros antigos (anteriores a agosto de 2026) podem
conter pulos gravados como resposta sem opcao, mas nao sao comparaveis.

**Qualquer texto escrito pelo participante.** Todo dado e fechado. Nao ha
comentario, justificativa ou campo livre em lugar nenhum.

**Localizacao mais fina que a escola.** Nao ha geolocalizacao.

## Existe no banco, mas nenhuma consulta expoe hoje

Estes casos sao diferentes dos de cima: o dado FOI coletado, so nao ha
ferramenta que o devolva. Diga isso — e uma limitacao de relatorio, nao de
coleta, e pode ser resolvida com desenvolvimento.

**Uso de ajuda por pergunta.** A coluna \`powerup_used\` registra qual ajuda foi
usada em cada resposta, mas nenhuma consulta agrega isso. Nao da para dizer
quais perguntas concentram uso de power-up.

**Efeito de posicao e fadiga.** A coluna \`sequence\` registra em que posicao da
partida cada pergunta foi respondida, mas nenhuma consulta cruza posicao com
acerto. Nao da para dizer se o acerto cai ao longo da partida.

**Efeito de streak.** Mesma situacao: a sequencia de acertos e registrada, mas
nao ha consulta que relacione streak e desempenho.

**Alternativas erradas mais escolhidas.** A opcao escolhida e registrada, mas
nao ha consulta que ranqueie as erradas por pergunta.

**Serie temporal.** Da para recortar um periodo com filtros de data, mas nao ha
consulta que devolva evolucao mes a mes.

## Nao esta disponivel por decisao

**Desempenho individual.** Nenhuma consulta devolve dado de participante
identificado, e isso e proposital: a plataforma coleta dados de estudantes,
possivelmente menores, e o assistente so opera sobre agregados. Perguntas sobre
"qual aluno" ou "quem" nao serao respondidas — nao por falta de ferramenta, mas
por decisao de privacidade. Ofereca o recorte agregado equivalente (por escola,
cidade ou escolaridade).
`.trim(),
};
