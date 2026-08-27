import { DocumentoDeConhecimento } from '../chat.types';

/**
 * Quando o numero NAO sustenta uma decisao.
 *
 * O documento mais importante do corpus. Um administrador que desativa a
 * pergunta errada por causa de 3 respostas causa dano real ao levantamento —
 * e o assistente e quem deveria ter avisado.
 */
export const quandoNaoAgir: DocumentoDeConhecimento = {
  fonte: 'curado:quando-nao-agir',
  titulo: 'Quando o numero nao sustenta uma decisao',
  texto: `
# Quando NAO agir sobre um numero

Vale para qualquer numero que a plataforma produza. Ao apresentar um dado,
traga a ressalva pertinente junto — nao como rodape opcional.

## Amostra pequena e o caso mais comum

Percentual sobre poucas dezenas de respostas oscila muito. Uma pergunta com
25% de acerto e 4 respostas pode virar 50% com a quinta. Agir sobre isso —
reescrever ou desativar a pergunta — e mexer em algo que talvez nao tenha
problema nenhum.

Regra pratica: **sempre informe o N junto da taxa**. Se o N for baixo, diga
explicitamente que ainda nao da para decidir, e diga quanto falta em vez de
apresentar o percentual como se fosse solido.

Isso vale tambem para comparacoes: diferenca entre dois recortes com poucas
respostas cada nao e diferenca, e ruido.

## A taxa de acerto nao mede so conhecimento

Ela mistura conhecimento, chute e ajuda:

- O chute puro acerta 25% das vezes, porque toda pergunta tem 4 alternativas.
- Com o power-up que elimina duas alternativas, o chute acerta 50%.
- A questao e de multipla escolha, entao mede **reconhecimento**, que e mais
  facil que lembrar sem opcoes na tela.

Para isolar acerto sem ajuda, e preciso considerar apenas respostas sem
power-up. Uma taxa que inclui respostas assistidas superestima o desempenho.

## Quem joga nao representa quem nao joga

Ninguem foi sorteado. Jogou quem quis, ou quem estava numa turma convidada.
Quem se dispoe a jogar um quiz sobre ODS tende a ter mais interesse previo no
tema que a media.

Consequencia pratica: os numeros descrevem **quem participou**. Uma escola com
desempenho alto pode simplesmente ter tido participacao dos alunos mais
engajados. Nao trate o resultado de uma escola como retrato daquela escola.

## Comparar escolas e regioes exige cuidado extra

Alem do tamanho da amostra, dois fatores confundem:

- **Composicao de escolaridade.** Uma escola cujos participantes sao em maioria
  do Ensino Medio nao se compara diretamente a outra de Fundamental II. Antes de
  concluir que uma escola vai melhor, veja se o publico e comparavel.
- **Escola e autodeclarada.** O participante escolhe no cadastro e nao ha
  validacao de vinculo.

## Quem vai mal abandona mais

Partidas incompletas existem, e quem esta indo mal tende a abandonar mais que
quem esta indo bem. Analises restritas a partidas finalizadas herdam esse vies e
mostram desempenho melhor que o real.

## Os modos de jogo distorcem contagens

Sobrevivencia encerra no primeiro erro; Infinito o jogador encerra quando quer.
Misturar os quatro modos numa mesma contagem de "quantas perguntas por partida"
ou "acerto por posicao" produz resultado invalido. Compare dentro do mesmo modo.

## Materialized view nao e o agora

As tres views consolidadas refletem o ultimo refresh. Para decisao sobre o
estado mais recente, prefira a consulta direta do dashboard, e diga qual das
duas voce usou quando a diferenca importar.

## Nunca afirme o que a consulta nao devolveu

Se um dado nao veio de uma ferramenta, ele nao existe para efeito de resposta.
Nao estime, nao complete, nao suponha um valor plausivel. Dizer "essa
informacao eu nao tenho" e uma resposta correta; inventar um numero ao lado de
numeros corretos e o pior erro possivel, porque nao ha como o leitor distinguir
os dois.
`.trim(),
};
