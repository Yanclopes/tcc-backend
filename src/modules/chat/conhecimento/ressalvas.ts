import { DocumentoDeConhecimento } from '../chat.types';

/**
 * Os limites do que os dados sustentam.
 *
 * Este e o documento mais importante do corpus. Um assistente que responde com
 * numero certo e ressalva errada e mais perigoso num TCC do que um que nao
 * responde — a banca cobra o limite, nao o numero.
 */
export const ressalvas: DocumentoDeConhecimento = {
  fonte: 'curado:ressalvas',
  titulo: 'Ressalvas metodologicas do levantamento',
  texto: `
# Ressalvas metodologicas

Estas ressalvas valem para QUALQUER numero produzido pela plataforma. Ao
responder com dado quantitativo, trazer a ressalva pertinente junto — nao como
rodape opcional.

## A amostra nao e probabilistica

Nao houve sorteio aleatorio de participantes. Quem jogou, jogou porque quis ou
porque a turma foi convidada. Isso e uma amostra **por conveniencia, com
autosselecao**.

Consequencia: os resultados descrevem quem participou. Nao se pode generalizar
para "os estudantes do Alto Vale" nem calcular margem de erro no sentido
inferencial. Toda afirmacao deve ser da forma "entre os participantes, X",
nunca "os jovens da regiao sabem X".

Nao usar linguagem de significancia estatistica (valor-p, intervalo de
confianca) sobre esta amostra sem qualificar pesadamente o que ela nao suporta.

## Autosselecao enviesa para cima

Quem se dispoe a jogar um quiz sobre ODS tende a ter mais interesse e mais
familiaridade previa com o tema do que a media. A taxa de acerto observada
provavelmente **superestima** o conhecimento da populacao geral.

## Vies de abandono

Partidas incompletas existem. Quem esta indo mal tende a abandonar mais que
quem esta indo bem. Analises que so consideram partidas finalizadas herdam esse
vies. Ao comparar recortes, verificar se a taxa de abandono difere entre eles.

## Recorte geografico concentrado

O levantamento e do Alto Vale do Itajai, em Santa Catarina — regiao da AMAVI.
Nao representa Santa Catarina, nem o Sul, nem o Brasil. A cobertura entre os
municipios da propria regiao tambem e desigual.

## Escola e autodeclarada

O participante escolhe a escola no cadastro, ou sugere uma nova. Nao ha
validacao de vinculo. Um recorte por escola pode conter quem nao estuda ali.

## Conhecimento medido e reconhecimento, nao dominio

O instrumento e de multipla escolha com quatro alternativas. Isso mede
**reconhecimento** da resposta correta, que e mais facil que evocacao
espontanea. Alem disso, o chute puro acerta 25% das vezes — e 50% quando o
power-up de eliminar duas alternativas foi usado.

Nao equiparar taxa de acerto a "nivel de conhecimento sobre os ODS".

## O tamanho da base ainda e pequeno

Antes de comparar recortes, olhar o N de cada um. Diferenca entre dois grupos de
poucas dezenas de respostas nao sustenta conclusao. Quando o recorte pedido tiver
poucos dados, dizer isso explicitamente em vez de apresentar o percentual como se
fosse solido.

## As materialized views tem defasagem

As tres MVs refletem o ultimo refresh, nao o instante da consulta. Se a pergunta
for sobre o estado mais recente, preferir as consultas diretas do dashboard.
`.trim(),
};
