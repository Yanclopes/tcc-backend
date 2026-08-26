import { DocumentoDeConhecimento } from '../chat.types';

/**
 * Dicionario de dados no recorte que interessa a analise. Nao descreve o schema
 * inteiro — descreve o que da para perguntar e por onde.
 */
export const dicionarioDeDados: DocumentoDeConhecimento = {
  fonte: 'curado:dicionario-de-dados',
  titulo: 'Dicionario de dados para analise',
  texto: `
# Dicionario de dados — Desafio ODS

O banco tem oito contextos. Para analise, quatro importam.

## Tabela-fato: game_answer

Uma linha por resposta emitida. E a fonte primaria de todo o levantamento.

| Coluna | Significado |
|---|---|
| game | FK para a partida |
| question | FK para a pergunta |
| option | FK para a alternativa escolhida; pode ser nula em registros legados |
| is_correct | booleano denormalizado do gabarito |
| response_time_ms | tempo ate responder, em milissegundos |
| sequence | posicao da pergunta dentro da partida (1, 2, 3...) |
| powerup_used | FK para a ajuda usada, ou NULL se respondeu sem ajuda |
| answered_at | carimbo temporal |

## Partidas: game

| Coluna | Significado |
|---|---|
| id | UUID |
| user | FK para app_user; obrigatorio, nao existe partida anonima |
| difficulty | FK para game_difficulty (o modo: quick, classic, endless, survival) |
| status | em andamento ou finalizada |
| current_score | pontuacao acumulada |
| current_streak | acertos consecutivos |
| created_at / finished_at | inicio e fim |

## Catalogo de conteudo: goal, question, question_option

\`goal\` guarda os 17 ODS. A chave primaria e \`id\` autoincrement, mas **toda
regra de negocio usa a coluna \`number\`** (1 a 17), que e estavel caso a tabela
seja reseedada. Ao responder sobre um ODS especifico, usar sempre \`number\`.

\`question\` tem quatro alternativas em \`question_option\` e um campo
\`answer\` apontando para a correta. Tem tambem \`difficulty\` (1 a 5),
\`education_level\` (publico-alvo), \`source\` (fonte bibliografica) e
\`is_active\`.

## Recortes demograficos: app_user e a hierarquia geografica

\`app_user\` tem \`state\`, \`city\`, \`school\` e \`education_level\`. Estado,
cidade e escolaridade sao obrigatorios no cadastro. A escola e obrigatoria em
uma de duas formas: escolhida do catalogo, ou sugerida pelo aluno e pendente de
aprovacao do admin.

A hierarquia geografica e \`country -> state -> city -> school\`. Os recortes
possiveis sao por estado, cidade, escola e escolaridade.

Uma escola pode atender varios niveis de escolaridade — a relacao e N:N via
\`school_education_level\`.

## Camada analitica ja materializada

- \`mv_acerto_por_ods\` — taxa de acerto consolidada por ODS
- \`mv_desempenho_por_escolaridade\` — acerto cruzando escolaridade e ODS
- \`mv_calibragem_perguntas\` — perguntas classificadas por qualidade de
  calibragem

Sao materialized views: refletem o estado do ultimo refresh, nao o instante da
consulta. Quando a diferenca importar, dizer isso na resposta.

## O que NAO existe no banco

- Nao ha registro de qual pergunta foi pulada (ver regras do jogo).
- Nao ha texto livre do participante em lugar nenhum. Todo dado e fechado.
- Nao ha geolocalizacao precisa: o recorte geografico mais fino e a escola.
`.trim(),
};
