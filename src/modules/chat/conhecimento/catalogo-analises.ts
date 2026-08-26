import { DocumentoDeConhecimento } from '../chat.types';

/**
 * As 10 analises catalogadas em .specs/05-analises.md, no recorte que o
 * assistente precisa: o que cada uma responde, como ler, e se ja existe.
 *
 * MANUTENCAO: se 05-analises.md mudar, este arquivo acompanha.
 */
export const catalogoAnalises: DocumentoDeConhecimento = {
  fonte: 'curado:catalogo-analises',
  titulo: 'Catalogo das analises planejadas (A01 a A10)',
  texto: `
# Catalogo de analises do levantamento

Dez analises estao especificadas. **Nenhuma delas esta implementada ainda** —
sao o plano de trabalho analitico. O que ja existe e o dashboard (visao geral,
por ODS, por regiao, por pergunta) e as tres materialized views.

Quando alguem perguntar por uma dessas analises, deixar claro que e um plano,
nao um resultado disponivel.

## A01 — Alternativas erradas mais escolhidas por pergunta

Por pergunta, ranking das alternativas incorretas mais escolhidas, com
percentual sobre o total de erradas. Mapeia **misconcepcoes especificas**: nao
apenas "40% erra a pergunta X", mas "das erradas, 70% escolhem a opcao Y".

Como ler: uma alternativa errada concentrando mais de 50% dos erros indica um
equivoco consolidado no publico, nao dispersao aleatoria. E o achado com maior
valor pedagogico do conjunto. Alta relevancia para o capitulo 4.

## A02 — Perguntas problematicas (alta latencia + baixa acuracia)

Cruza taxa de acerto abaixo da media com tempo de resposta acima da media.
Separa pergunta "dificil por design" de pergunta "mal formulada ou ambigua".
Complementa a MV de calibragem, que so olha a taxa de acerto.

## A03 — Heatmap escolaridade x ODS

Matriz de taxa de acerto cruzando nivel de escolaridade com ODS. Mostra em que
segmento cada ODS e mais desconhecido.

Cuidado: celulas com poucas respostas produzem percentuais instaveis. Sempre
reportar o N junto da taxa.

## A04 — Padrao de uso de ajudas por pergunta

Quais perguntas concentram uso de power-up. Proxy de dificuldade percebida —
distinto de dificuldade medida pelo acerto. Lembrar que \`skip\` nao deixa
rastro em \`game_answer\`, entao esta analise so enxerga \`fifty\` e
\`audience\`.

## A05 — Efeito de fadiga (acerto x posicao na partida)

Taxa de acerto ao longo da coluna \`sequence\`. **Precisa controlar por
dificuldade**, porque a dificuldade sobe com a posicao por construcao — sem
esse controle, mede-se a prova ficando mais dificil e chama-se isso de fadiga.
Tambem precisa separar os modos: sobrevivencia e infinito enviesam a
distribuicao de posicoes.

## A06 — Efeito de streak

Taxa de acerto apos N acertos consecutivos, comparada a taxa apos um erro.
Investiga se momento dentro da partida afeta desempenho.

## A07 — Retencao de participantes

Quantos voltam a jogar, e quantas partidas por participante. Mede engajamento,
nao conhecimento.

## A08 — Dashboard pessoal do jogador (radar por ODS)

Unica analise voltada ao participante, nao ao pesquisador: mostra ao proprio
jogador seu desempenho por ODS. Valor formativo — devolve algo a quem
participou.

## A09 — Cobertura geografica

Mapa dos municipios do Alto Vale com volume de participacao. Mostra onde a
coleta chegou e, principalmente, onde nao chegou.

## A10 — Export CSV pseudonimizado

Exporta o dataset para analise externa, sem identificadores diretos. Habilita
analise em ferramenta estatistica. Operacao cara: deve ter limite de taxa
proprio.

## Ordem de implementacao recomendada

A01, A02 e A03 primeiro (esforco curto, valor alto), depois A10 (destrava
analise externa), depois A05 e A08 (formativas), e por fim A04, A06, A07 e A09
como visualizacoes complementares.

As mais relevantes para citar no capitulo 4 sao A01, A02, A05, A08 e A10.
`.trim(),
};
