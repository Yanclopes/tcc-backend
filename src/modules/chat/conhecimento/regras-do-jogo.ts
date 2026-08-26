import { DocumentoDeConhecimento } from '../chat.types';

/**
 * As regras do jogo que DISTORCEM a leitura dos dados. Nao e a spec do jogo —
 * e o recorte que um analista precisa saber para nao tirar conclusao errada.
 *
 * MANUTENCAO: se .specs/01-dominio.md mudar, este arquivo precisa acompanhar.
 * Divergencia aqui faz o assistente afirmar coisa errada com confianca.
 */
export const regrasDoJogo: DocumentoDeConhecimento = {
  fonte: 'curado:regras-do-jogo',
  titulo: 'Regras do jogo que afetam a leitura dos dados',
  texto: `
# Regras do jogo que afetam a analise

## Autenticacao obrigatoria

Nao existe partida anonima. Toda linha de \`game_answer\` esta ligada a um
\`game\`, que esta ligado a um \`app_user\` com estado, cidade, escola e
escolaridade preenchidos. Isso garante que todo dado coletado tem recorte
demografico — nao ha respostas orfas.

## Modos de jogo

| Modo | Perguntas | Encerra ao errar |
|---|---|---|
| Rapido (quick) | 5 | nao |
| Classico (classic) | 15 | nao |
| Infinito (endless) | sem limite | nao |
| Sobrevivencia (survival) | sem limite | sim |

Consequencia analitica importante: no modo Sobrevivencia a partida acaba no
primeiro erro. Isso enviesa a distribuicao de \`sequence\` — partidas de
sobrevivencia contribuem com muitos acertos em posicoes iniciais e exatamente
um erro, sempre na ultima posicao. Misturar sobrevivencia com os outros modos
numa analise de fadiga ou de efeito de posicao produz resultado invalido.

O modo Infinito tambem enviesa: quem esta indo bem joga mais, entao posicoes
altas de \`sequence\` sao preenchidas desproporcionalmente por jogadores acima
da media. Isso e sobrevivencia amostral, nao aprendizado.

## Power-ups (ajudas)

Cada partida comeca com uma unidade de cada. Sao tres:

- **fifty** — elimina duas alternativas erradas da pergunta atual. Nao encerra a
  pergunta. Para a analise: dobra a chance de acerto por chute.
- **audience** (plateia) — mostra uma distribuicao percentual por alternativa.
  Se houver 30 ou mais respostas reais registradas para aquela pergunta, e a
  distribuicao REAL dos outros jogadores; abaixo disso, e uma distribuicao
  simulada com vies para a resposta correta (entre 55% e 74%). Nao encerra a
  pergunta.
- **skip** (trocar) — descarta a pergunta atual e serve outra.

REGRA CRITICA PARA ANALISE: o power-up \`skip\` **nao grava linha em
\`game_answer\`** e **nao incrementa** o contador de respondidas. Do ponto de
vista dos dados, e como se a pergunta nunca tivesse sido feita. A pergunta
descartada nao volta na mesma partida.

Isso significa que NAO e possivel medir "quais perguntas as pessoas pulam" a
partir de \`game_answer\` — o pulo nao deixa rastro nessa tabela. Antes de
agosto de 2026 o comportamento era outro (gravava linha com \`is_correct=false\`
e \`option NULL\`), entao dados antigos podem conter esses registros legados.
Analises sobre opcao escolhida devem sempre filtrar \`option IS NOT NULL\`.

Usar \`fifty\` ou \`audience\` reduz a pontuacao da pergunta a metade. Usar
\`skip\` nao pontua, porque a pergunta nao chega a ser respondida.

A coluna \`game_answer.powerup_used\` registra qual ajuda foi usada naquela
resposta, ou NULL. E o que separa acerto puro de acerto assistido.

## Dificuldade adaptativa

A dificuldade da pergunta servida sobe conforme o jogador avanca na partida:
posicoes 1 a 3 usam dificuldade 1, 4 a 6 dificuldade 2, 7 a 9 dificuldade 3,
10 a 12 dificuldade 4, e a partir da 13 dificuldade 5.

Consequencia: \`sequence\` e \`difficulty\` sao correlacionados por construcao.
Qualquer analise que cruze posicao na partida com desempenho precisa controlar
por dificuldade, senao atribui a fadiga o que e so a prova ficando mais dificil.

## Coleta bruta

A tabela \`game_answer\` e a fonte primaria de todo o levantamento. Cada linha e
uma resposta: qual partida, qual pergunta, qual alternativa, se acertou, quanto
tempo levou, em que posicao da partida, e qual ajuda foi usada.

O campo \`is_correct\` e denormalizado de proposito — simplifica as queries
analiticas e evita ter que comparar \`option\` com \`question.answer\` em toda
consulta.
`.trim(),
};
