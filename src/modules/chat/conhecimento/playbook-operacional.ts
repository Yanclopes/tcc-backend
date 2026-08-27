import { DocumentoDeConhecimento } from '../chat.types';

/**
 * O que fazer diante de cada sinal.
 *
 * Este e o documento que diferencia o assistente do dashboard. O dashboard
 * mostra o numero e para; aqui esta o que o administrador faz com ele, e onde
 * na interface a acao acontece. Resposta util termina numa acao possivel.
 */
export const playbookOperacional: DocumentoDeConhecimento = {
  fonte: 'curado:playbook-operacional',
  titulo: 'O que fazer com cada sinal (playbook do administrador)',
  texto: `
# Playbook do administrador

Cada secao liga um sinal observavel a uma acao concreta. Ao responder, sempre
que houver acao possivel, diga qual e e onde ela e feita.

## Onde as acoes acontecem

| Acao | Onde |
|---|---|
| Criar, editar, ativar ou desativar pergunta | tela "Perguntas" (/admin/perguntas) |
| Aprovar ou rejeitar escola sugerida por aluno | tela "Escolas" (/admin/escolas) |
| Promover usuario a admin | tela "Usuarios" (so o papel master) |
| Ver os numeros por recorte | tela "Dashboard" |
| Recalcular as materialized views | acao de refresh do modulo de analytics |

## Sinal: pergunta com acerto muito alto (acima de ~90%)

A pergunta nao discrimina. Quase todo mundo acerta, entao ela nao informa nada
sobre quem respondeu — so infla a taxa geral do ODS a que pertence.

Acao: revisar o enunciado para exigir mais do que reconhecimento obvio, ou
desativa-la e substituir por uma mais exigente do mesmo ODS. Desativar
preserva as respostas ja coletadas; apagar nao deve ser feito.

Antes de agir, confira o N. Acerto de 100% com 3 respostas nao e sinal de nada.

## Sinal: pergunta com acerto muito baixo (abaixo de ~30%)

Duas causas possiveis, e elas pedem acoes opostas:

- **Dificil por design** — o assunto e mesmo pouco conhecido. Nada a fazer; e
  justamente o achado que a plataforma existe para produzir.
- **Mal formulada** — enunciado ambiguo, alternativa correta discutivel, duas
  alternativas defensaveis. Precisa de revisao.

O que separa as duas e o **tempo de resposta**. Acerto baixo com tempo alto
sugere que as pessoas ficaram em duvida entre alternativas — indicio de
ambiguidade. Acerto baixo com tempo baixo sugere confianca equivocada, ou seja,
um equivoco consolidado no publico: isso e achado legitimo, nao defeito.

Acao quando o tempo e alto: reler o enunciado e as alternativas na tela de
Perguntas, procurando por duas opcoes defensaveis ao mesmo tempo.

## Sinal: pergunta marcada como "amostra insuficiente"

Nao e defeito da pergunta. Significa que ela ainda nao foi respondida o
bastante para ser julgada. Nao revise, nao desative — deixe rodar.

Se muitas perguntas estao nesse estado, o gargalo e participacao, nao conteudo.
Ver a secao sobre cobertura.

## Cadastrada, ativa, respondida: tres coisas diferentes

Confundir as tres e a origem de resposta errada. Uma pergunta pode estar
cadastrada e inativa; pode estar ativa e ainda sem nenhuma resposta.

Contagem de "perguntas que sustentam uma taxa" conta apenas as que RECEBERAM
resposta. Ela nao serve para dizer quantas perguntas existem para um ODS, e
muito menos para afirmar que um ODS tem perguntas cadastradas.

Para saber o que EXISTE no catalogo — e portanto onde falta conteudo — e
preciso partir do catalogo, nao das respostas. O mesmo vale para escolas e
cidades: consulta que parte das respostas nunca enxerga quem tem zero.

## Sinal: ODS sem nenhuma pergunta cadastrada

Lacuna de conteudo, nao de participacao. O ODS existe na plataforma mas nunca
pode ser sorteado, porque nao ha o que perguntar. Nenhum jogador chega perto
dele, e ele fica invisivel em qualquer relatorio baseado em respostas.

Acao: cadastrar perguntas para esse ODS em /admin/perguntas. E a lacuna mais
barata de corrigir e a que mais amplia o alcance do levantamento.

## Sinal: ODS com poucas perguntas cadastradas

A taxa de acerto de um ODS sustentado por uma unica pergunta mede aquela
pergunta, nao o ODS. Um ODS com uma pergunta facil aparece bem colocado sem que
isso diga nada sobre conhecimento.

Acao: cadastrar mais perguntas para os ODS com cobertura baixa, de preferencia
em dificuldades variadas. Isso melhora o levantamento mais do que qualquer
ajuste de pergunta existente.

Ao comparar ODS entre si, sempre verifique quantas perguntas distintas
sustentam cada um antes de tratar a diferenca como real.

## Dois sinais diferentes: ninguem cadastrado x cadastrado sem jogar

Confundir os dois leva a acao errada, e a resposta a perguntas diferentes:

- **Zero alunos cadastrados** — a divulgacao nao chegou. Ninguem daquela escola
  ou cidade sequer criou conta. Acao: contato e divulgacao.
- **Alunos cadastrados, mas zero partidas** — a divulgacao chegou e a adesao
  nao. Criaram conta e nao jogaram. Acao: reengajamento de quem ja esta la, que
  e um problema diferente e geralmente mais barato de resolver.

Ao responder uma pergunta que combina condicoes ("cadastrados MAS sem
partida"), as duas precisam valer ao mesmo tempo. Quem tem zero cadastrados NAO
satisfaz "tem alunos cadastrados" e nao entra nessa lista. Se nenhum caso
satisfizer as duas condicoes, a resposta correta e "nenhum" — nao uma lista
aproximada.

## Sinal: escola ou cidade com participacao muito baixa ou zero

Para responder "onde a participacao ainda nao chegou" e preciso partir do
CATALOGO de escolas, nao das respostas. Uma consulta que parte de
\`game_answer\` so enxerga quem ja participou — a escola com zero partidas
simplesmente nao aparece, e a resposta acaba listando o oposto do que se pediu.


E onde a divulgacao nao chegou. A cobertura desigual entre municipios do Alto
Vale e a limitacao mais concreta do levantamento, e a unica que se resolve com
acao operacional em vez de mudanca de sistema.

Acao: priorizar contato com as escolas sem participacao. Uma escola cadastrada
com zero partidas e um convite que nao foi feito ou nao foi aceito.

## Sinal: escola sugerida por aluno pendente de revisao

Aluno que nao encontrou a escola no catalogo pode sugerir uma nova. Enquanto
pendente, o cadastro dele fica incompleto.

Para saber se ha alguma pendente, consulte a lista de sugestoes — nao suponha.
Lista vazia significa nenhuma pendente; ausencia de consulta nao significa nada.

Acao: aprovar (vira escola do catalogo) ou rejeitar com motivo (o aluno recebe
a tela de completar perfil e escolhe outra). Deixar pendente trava o aluno.

## Sinal: muitas partidas iniciadas e poucas finalizadas

Abandono. Pode ser tamanho do modo escolhido, dificuldade subindo rapido demais
ou desinteresse.

Cuidado ao interpretar: no modo Sobrevivencia a partida encerra no primeiro
erro por regra, e no modo Infinito o jogador encerra quando quiser. Nenhum dos
dois conta como abandono. Compare abandono so dentro dos modos Rapido e
Classico.

Segundo cuidado, sobre o que o numero cobre: o total de partidas dos
indicadores conta partidas com AO MENOS UMA resposta. Quem abriu e saiu antes
de responder qualquer coisa nao esta ali — nao por erro, mas porque partida sem
resposta nao alimenta nenhuma taxa. Entao o abandono medido e o de quem
comecou a responder e parou, que e o acionavel. Ao apresentar esse numero, diga
"partidas com resposta", nunca "partidas iniciadas": sao coisas diferentes.

Desistencia antes da primeira resposta e outro fenomeno, com outra causa
(primeira pergunta, tempo de carregamento, sessao expirada) e outra acao. Nao
ha consulta que a meca hoje.

## Sinal: numeros do dashboard divergindo entre telas

As tres materialized views refletem o ultimo refresh, nao o instante da
consulta. Se um numero consolidado nao bate com a consulta direta, e defasagem,
nao inconsistencia.

Acao: rodar o refresh das materialized views.
`.trim(),
};
