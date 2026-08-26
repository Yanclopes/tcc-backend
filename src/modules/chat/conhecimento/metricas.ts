import { DocumentoDeConhecimento } from '../chat.types';

/**
 * Definicao das metricas do levantamento e, principalmente, como NAO
 * interpreta-las errado. Escrito para o assistente — ver .specs/06-chat-ia.md.
 */
export const metricas: DocumentoDeConhecimento = {
  fonte: 'curado:metricas',
  titulo: 'Metricas do levantamento e como interpreta-las',
  texto: `
# Metricas do levantamento Desafio ODS

## Taxa de acerto

Proporcao de respostas corretas sobre o total de respostas registradas, na
tabela \`game_answer\`, usando a coluna denormalizada \`is_correct\`.

Formula: respostas com \`is_correct = true\` dividido pelo total de linhas do
recorte, vezes 100.

Cuidados ao interpretar:

- A taxa de acerto NAO e medida de conhecimento puro. Ela mistura conhecimento,
  chute e uso de ajuda. Uma resposta correta obtida depois do power-up "fifty"
  (que elimina duas alternativas erradas) tem probabilidade de acerto por chute
  de 50%, nao de 25%. Para isolar acerto sem ajuda, filtrar
  \`powerup_used IS NULL\`.
- A taxa de acerto por ODS depende de quais perguntas existem para aquele ODS.
  Um ODS com poucas perguntas, todas faceis, aparece com taxa alta sem que isso
  diga nada sobre o conhecimento do publico.
- Comparar taxa de acerto entre recortes so faz sentido se os recortes tiverem
  numero de respostas comparavel. Um recorte com 8 respostas nao se compara a um
  com 400.

## Tempo de resposta (response_time_ms)

Milissegundos entre a pergunta ser servida e a resposta ser enviada. Registrado
em \`game_answer.response_time_ms\`.

O valor gravado e o MENOR entre o tempo medido no servidor e o tempo informado
pelo cliente. Isso e proposital: impede que um cliente adulterado informe um
tempo artificialmente baixo para inflar o bonus de velocidade. A consequencia
analitica e que o tempo tende a ser levemente subestimado, nunca superestimado.

O tempo distingue "saber" de "hesitar". Uma pergunta com acerto alto e tempo
alto sugere que o publico chega a resposta por eliminacao, nao por dominio.
Uma pergunta com acerto baixo e tempo baixo sugere confianca equivocada — uma
misconcepcao consolidada, nao duvida.

Atencao: o tempo NAO tem teto. Um jogador que deixa a aba aberta e volta depois
gera um valor enorme. Ao calcular media de tempo, considerar mediana ou aparar
os extremos.

## Streak (sequencia de acertos)

Numero de acertos consecutivos dentro da mesma partida. Zera a cada erro.
Guardada no estado da partida e em \`game.current_streak\`.

Serve a pontuacao. Nao e medida de conhecimento: e medida de momento dentro da
partida.

ATENCAO: a streak e registrada, mas NENHUMA consulta disponivel relaciona
streak com desempenho. Nao e possivel responder se acertar em sequencia muda a
chance do proximo acerto.

## Sequencia (sequence)

Posicao da pergunta dentro da partida: 1 para a primeira respondida, 2 para a
segunda, e assim por diante. Coluna \`game_answer.sequence\`.

ATENCAO: a posicao e registrada, mas NENHUMA consulta disponivel cruza posicao
com acerto. **Nao e possivel responder se a taxa de acerto cai ao longo da
partida, nem se existe efeito de fadiga.** Diante dessa pergunta, diga que o
dado foi coletado mas nao ha relatorio que o exponha — e jamais apresente
acerto POR PERGUNTA no lugar de acerto POR POSICAO: sao coisas diferentes, e o
id da pergunta nao e a posicao dela na partida.

Se algum dia houver essa consulta, ela precisara controlar por dificuldade: a
dificuldade sobe conforme o jogador avanca, entao queda de acerto ao longo da
sequencia nao e necessariamente fadiga.

## Calibragem de pergunta

Classificacao de uma pergunta pela sua taxa de acerto, materializada em
\`mv_calibragem_perguntas\`. Pergunta boa e a que discrimina: nem todo mundo
acerta, nem todo mundo erra.

Uma pergunta com acerto proximo de 100% ou proximo de 0% carrega pouca
informacao sobre o publico — no primeiro caso e trivial, no segundo pode estar
mal formulada ou ambigua. A analise A02 cruza acerto baixo com tempo alto
justamente para separar "dificil por design" de "mal escrita".

## Pontuacao

Nao e metrica de pesquisa: e mecanica de jogo. Nao usar pontuacao como proxy de
conhecimento em nenhuma analise.

Formula: base de 100 vezes a dificuldade, mais bonus de velocidade de ate 50
pontos (decrescente ate 15 segundos), mais 25 pontos por acerto consecutivo
acumulado. Se houve power-up na pergunta, o total e reduzido a metade.
Erro pontua zero e zera a sequencia.
`.trim(),
};
