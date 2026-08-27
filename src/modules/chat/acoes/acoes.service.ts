import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameAnswer } from '../../game/entities/game-answer.entity';
import { School } from '../../geo/entities/school.entity';
import { SchoolSuggestion } from '../../schools/entities/school-suggestion.entity';
import { Goal } from '../../goals/entities/goal.entity';
import { EducationLevel } from '../../users/entities/education-level.entity';
import { Question } from '../../questions/entities/question.entity';
import { AcaoProposta, AvisoDaAcao } from '../chat.types';

/**
 * Monta acoes administrativas PROPOSTAS. Ver .specs/06-chat-ia.md.
 *
 * Este servico nao escreve nada. Ele valida a proposta contra o banco, monta o
 * resumo e os avisos, e devolve a requisicao exata que a interface disparara
 * quando o administrador confirmar. A escrita acontece pelos endpoints que ja
 * existem, com RolesGuard, validacao de DTO e audit_log intactos.
 *
 * O motivo de nao executar direto e medido: o assistente ja inventou contagem,
 * rotulo e analise nesta base. Erro de leitura mostra numero errado; erro de
 * escrita danifica o levantamento.
 */
@Injectable()
export class AcoesService {
  constructor(
    @InjectRepository(SchoolSuggestion)
    private readonly sugestaoRepo: Repository<SchoolSuggestion>,
    @InjectRepository(School)
    private readonly escolaRepo: Repository<School>,
    @InjectRepository(Question)
    private readonly perguntaRepo: Repository<Question>,
    @InjectRepository(Goal)
    private readonly odsRepo: Repository<Goal>,
    @InjectRepository(GameAnswer)
    private readonly respostaRepo: Repository<GameAnswer>,
    @InjectRepository(EducationLevel)
    private readonly escolaridadeRepo: Repository<EducationLevel>,
  ) {}

  // ------------------------------------------------------------------
  // Leituras que sustentam as propostas
  // ------------------------------------------------------------------

  /**
   * Sugestoes de escola aguardando decisao, com a duplicata provavel ja
   * apontada.
   *
   * Sem esta leitura o assistente nao tinha como responder "tem sugestao
   * pendente?" — e, sem dado, afirmou que nao havia. Faltar ferramenta faz o
   * modelo preencher o buraco; e o padrao que se repetiu neste modulo inteiro.
   *
   * NAO devolve quem sugeriu: o nome do aluno nao precisa sair da aplicacao.
   */
  async listarSugestoesPendentes(): Promise<
    Array<{
      id: number;
      nome: string;
      cidade: string;
      criadaEm: Date;
      possivelDuplicata: { id: number; nome: string } | null;
    }>
  > {
    const pendentes = await this.sugestaoRepo.find({
      where: { status: 'pending' },
      relations: { city: true },
      order: { createdAt: 'DESC' },
    });

    return Promise.all(
      pendentes.map(async (sugestao) => {
        const duplicata = await this.possivelDuplicata(sugestao);
        return {
          id: sugestao.id,
          nome: sugestao.name,
          cidade: sugestao.city?.name ?? '—',
          criadaEm: sugestao.createdAt,
          possivelDuplicata: duplicata ? { id: duplicata.id, nome: duplicata.name } : null,
        };
      }),
    );
  }

  /** Niveis de escolaridade, necessarios para aprovar uma sugestao. */
  async listarEscolaridades(): Promise<Array<{ id: number; nome: string }>> {
    const niveis = await this.escolaridadeRepo.find({ order: { id: 'ASC' } });
    return niveis.map((nivel) => ({ id: nivel.id, nome: nivel.name }));
  }

  // ------------------------------------------------------------------
  // Sugestoes de escola
  // ------------------------------------------------------------------
  private async sugestaoOuErro(id: number): Promise<SchoolSuggestion> {
    const sugestao = await this.sugestaoRepo.findOne({
      where: { id },
      relations: { city: true },
    });
    if (!sugestao) throw new Error(`Sugestao ${id} nao existe.`);
    if (sugestao.status !== 'pending') {
      throw new Error(`Sugestao ${id} ja foi ${sugestao.status}; nao ha o que decidir.`);
    }
    return sugestao;
  }

  /**
   * Procura escola de nome parecido na mesma cidade.
   *
   * O aluno digita o nome livremente, entao "EEB Frei Godofredo" e "E.E.B Frei
   * Godofredo" viram duas escolas se ninguem olhar — e o recorte por escola
   * fica partido ao meio. Aprovar sem checar isso e o erro mais provavel aqui.
   */
  private async possivelDuplicata(sugestao: SchoolSuggestion): Promise<School | null> {
    const cityId = sugestao.city?.id;
    if (!cityId) return null;

    const candidatas = await this.escolaRepo.find({ where: { city: { id: cityId } } });
    const normalizar = (texto: string) =>
      texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '');

    const alvo = normalizar(sugestao.name);
    return (
      candidatas.find((escola) => {
        const nome = normalizar(escola.name);
        return nome === alvo || nome.includes(alvo) || alvo.includes(nome);
      }) ?? null
    );
  }

  async aprovarSugestaoEscola(id: number, niveisIds: number[]): Promise<AcaoProposta> {
    const sugestao = await this.sugestaoOuErro(id);
    const avisos: AvisoDaAcao[] = [];

    // Resolve os ids em NOMES antes de mostrar a proposta.
    //
    // Medido: pedindo "Ensino Medio" o modelo enviou o id 2, que e "Ensino
    // Fundamental II" — chutou em vez de consultar. Exibindo so o numero, o
    // administrador confirmaria sem perceber. Com o nome na tela, o erro fica
    // visivel antes do clique, que e exatamente para isso que a confirmacao
    // existe.
    const niveis = niveisIds.length
      ? await this.escolaridadeRepo.find({ where: niveisIds.map((idNivel) => ({ id: idNivel })) })
      : [];
    const encontrados = new Map(niveis.map((nivel) => [nivel.id, nivel.name]));
    const inexistentes = niveisIds.filter((idNivel) => !encontrados.has(idNivel));
    if (inexistentes.length) {
      throw new Error(
        `Nao existe escolaridade com id ${inexistentes.join(', ')}. ` +
          'Consulte listar_escolaridades antes de propor.',
      );
    }

    const duplicata = await this.possivelDuplicata(sugestao);
    if (duplicata) {
      avisos.push({
        nivel: 'atencao',
        texto:
          `Ja existe "${duplicata.name}" (id ${duplicata.id}) na mesma cidade. Aprovar cria uma ` +
          'escola separada e parte o recorte em duas. Considere VINCULAR a existente.',
      });
    }
    if (niveisIds.length === 0) {
      avisos.push({
        nivel: 'atencao',
        texto: 'Nenhuma escolaridade informada — a escola nao aceitara alunos de nenhum segmento.',
      });
    }

    return {
      id: randomUUID(),
      tipo: 'aprovar_sugestao_escola',
      resumo: `Criar a escola "${sugestao.name}" em ${sugestao.city?.name ?? '?'} e vincular o aluno que a sugeriu.`,
      detalhes: [
        { rotulo: 'Nome', valor: sugestao.name },
        { rotulo: 'Cidade', valor: sugestao.city?.name ?? '—' },
        {
          rotulo: 'Escolaridades',
          valor: niveisIds.length
            ? niveisIds.map((idNivel) => `${encontrados.get(idNivel)} (id ${idNivel})`).join(', ')
            : '(nenhuma)',
        },
      ],
      avisos,
      requisicao: {
        metodo: 'POST',
        caminho: `/schools/suggestions/${id}/approve`,
        corpo: { educationLevelIds: niveisIds },
      },
    };
  }

  async vincularSugestaoEscola(id: number, escolaId: number): Promise<AcaoProposta> {
    const sugestao = await this.sugestaoOuErro(id);
    const escola = await this.escolaRepo.findOne({
      where: { id: escolaId },
      relations: { city: true },
    });
    if (!escola) throw new Error(`Escola ${escolaId} nao existe.`);

    const avisos: AvisoDaAcao[] = [];
    if (escola.city?.id !== sugestao.city?.id) {
      avisos.push({
        nivel: 'atencao',
        texto:
          `A escola escolhida fica em ${escola.city?.name ?? '?'}, mas o aluno indicou ` +
          `${sugestao.city?.name ?? '?'}. Confirme que e a mesma instituicao.`,
      });
    }

    return {
      id: randomUUID(),
      tipo: 'vincular_sugestao_escola',
      resumo: `Vincular o aluno a "${escola.name}" em vez de criar "${sugestao.name}".`,
      detalhes: [
        { rotulo: 'Aluno sugeriu', valor: sugestao.name },
        { rotulo: 'Sera vinculado a', valor: `${escola.name} (id ${escola.id})` },
        { rotulo: 'Cidade da escola', valor: escola.city?.name ?? '—' },
      ],
      avisos,
      requisicao: {
        metodo: 'POST',
        caminho: `/schools/suggestions/${id}/link`,
        corpo: { schoolId: escolaId },
      },
    };
  }

  async rejeitarSugestaoEscola(id: number, motivo: string): Promise<AcaoProposta> {
    const sugestao = await this.sugestaoOuErro(id);
    if (!motivo?.trim()) throw new Error('A rejeicao exige um motivo — o aluno vai le-lo.');

    return {
      id: randomUUID(),
      tipo: 'rejeitar_sugestao_escola',
      resumo: `Rejeitar a sugestao "${sugestao.name}".`,
      detalhes: [
        { rotulo: 'Sugestao', valor: sugestao.name },
        { rotulo: 'Motivo (o aluno le)', valor: motivo },
      ],
      avisos: [
        {
          nivel: 'informacao',
          texto:
            'O aluno sera obrigado a refazer o vinculo de escola no proximo acesso, e fica ' +
            'bloqueado ate escolher outra.',
        },
      ],
      requisicao: {
        metodo: 'POST',
        caminho: `/schools/suggestions/${id}/reject`,
        corpo: { reason: motivo },
      },
    };
  }

  // ------------------------------------------------------------------
  // Perguntas
  // ------------------------------------------------------------------
  private async perguntaOuErro(id: number): Promise<Question> {
    const pergunta = await this.perguntaRepo.findOne({
      where: { id },
      relations: { goal: true, options: true },
    });
    if (!pergunta) throw new Error(`Pergunta ${id} nao existe.`);
    return pergunta;
  }

  private contarRespostas(questionId: number): Promise<number> {
    return this.respostaRepo.count({ where: { question: { id: questionId } } });
  }

  async definirPerguntaAtiva(id: number, ativa: boolean): Promise<AcaoProposta> {
    const pergunta = await this.perguntaOuErro(id);
    const respostas = await this.contarRespostas(id);
    const avisos: AvisoDaAcao[] = [];

    if (pergunta.isActive === ativa) {
      avisos.push({
        nivel: 'informacao',
        texto: `A pergunta ja esta ${ativa ? 'ativa' : 'inativa'}; a acao nao muda nada.`,
      });
    }
    if (!ativa && respostas > 0 && respostas < 10) {
      // Desativar com base em ruido e o erro mais provavel desta acao.
      avisos.push({
        nivel: 'atencao',
        texto:
          `Esta pergunta tem apenas ${respostas} resposta(s). E amostra pequena demais para ` +
          'concluir que ela e ruim — considere deixar rodar mais antes de desativar.',
      });
    }
    if (!ativa) {
      avisos.push({
        nivel: 'informacao',
        texto: `As ${respostas} resposta(s) ja coletadas sao preservadas; a pergunta so deixa de ser sorteada.`,
      });
    }

    return {
      id: randomUUID(),
      tipo: 'definir_pergunta_ativa',
      resumo: `${ativa ? 'Ativar' : 'Desativar'} a pergunta ${id}.`,
      detalhes: [
        { rotulo: 'Pergunta', valor: pergunta.text },
        { rotulo: 'ODS', valor: String(pergunta.goal?.number ?? '—') },
        { rotulo: 'Estado atual', valor: pergunta.isActive ? 'ativa' : 'inativa' },
        { rotulo: 'Respostas coletadas', valor: String(respostas) },
      ],
      avisos,
      requisicao: {
        metodo: 'PATCH',
        caminho: `/questions/${id}/active`,
        corpo: { isActive: ativa },
      },
    };
  }

  /** Regras que valem tanto para criar quanto para editar alternativas. */
  private validarAlternativas(alternativas: string[], indiceCorreto: number): void {
    if (alternativas.length !== 4) {
      throw new Error(`Sao necessarias exatamente 4 alternativas; vieram ${alternativas.length}.`);
    }
    if (alternativas.some((texto) => !texto?.trim())) {
      throw new Error('Nenhuma alternativa pode estar vazia.');
    }
    if (indiceCorreto < 0 || indiceCorreto > 3) {
      throw new Error('O indice da alternativa correta precisa estar entre 0 e 3.');
    }
    const normalizadas = alternativas.map((t) => t.trim().toLowerCase());
    if (new Set(normalizadas).size !== normalizadas.length) {
      throw new Error('Ha alternativas repetidas — cada uma precisa ser distinta.');
    }
  }

  async criarPergunta(params: {
    texto: string;
    odsNumero: number;
    alternativas: string[];
    indiceCorreto: number;
    dificuldade?: number;
    fonte?: string;
  }): Promise<AcaoProposta> {
    if (!params.texto?.trim()) throw new Error('O enunciado nao pode estar vazio.');
    this.validarAlternativas(params.alternativas, params.indiceCorreto);

    const ods = await this.odsRepo.findOne({ where: { number: params.odsNumero } });
    if (!ods) throw new Error(`Nao existe ODS de numero ${params.odsNumero}.`);

    const avisos: AvisoDaAcao[] = [
      {
        nivel: 'atencao',
        texto:
          'Revise o enunciado, as quatro alternativas e o gabarito antes de confirmar. Uma ' +
          'pergunta com duas alternativas defensaveis contamina o levantamento e so aparece ' +
          'depois, como acerto baixo com tempo alto.',
      },
    ];

    const quantasNoOds = await this.perguntaRepo.count({ where: { goal: { id: ods.id } } });
    if (quantasNoOds === 0) {
      avisos.push({
        nivel: 'informacao',
        texto: `Sera a primeira pergunta do ODS ${ods.number} — hoje ele nao pode ser sorteado.`,
      });
    }

    return {
      id: randomUUID(),
      tipo: 'criar_pergunta',
      resumo: `Criar uma pergunta nova para o ODS ${ods.number} (${ods.name}).`,
      detalhes: [
        { rotulo: 'Enunciado', valor: params.texto },
        ...params.alternativas.map((texto, i) => ({
          rotulo: `Alternativa ${i + 1}${i === params.indiceCorreto ? ' (correta)' : ''}`,
          valor: texto,
        })),
        { rotulo: 'ODS', valor: `${ods.number} — ${ods.name}` },
        { rotulo: 'Dificuldade', valor: String(params.dificuldade ?? 1) },
        { rotulo: 'Fonte', valor: params.fonte ?? '(nao informada)' },
      ],
      avisos,
      requisicao: {
        metodo: 'POST',
        caminho: '/questions',
        corpo: {
          text: params.texto,
          goalNumber: ods.number,
          options: params.alternativas.map((texto) => ({ text: texto })),
          correctOptionIndex: params.indiceCorreto,
          difficulty: params.dificuldade ?? 1,
          ...(params.fonte ? { source: params.fonte } : {}),
        },
      },
    };
  }

  async editarPergunta(params: {
    id: number;
    texto?: string;
    alternativas?: string[];
    indiceCorreto?: number;
    dificuldade?: number;
  }): Promise<AcaoProposta> {
    const pergunta = await this.perguntaOuErro(params.id);
    const respostas = await this.contarRespostas(params.id);
    const avisos: AvisoDaAcao[] = [];

    const mudaConteudo = params.texto !== undefined || params.alternativas !== undefined;

    if (params.alternativas) {
      if (params.indiceCorreto === undefined) {
        throw new Error('Ao trocar as alternativas, informe qual delas passa a ser a correta.');
      }
      this.validarAlternativas(params.alternativas, params.indiceCorreto);
    }

    if (mudaConteudo && respostas > 0) {
      // O aviso mais importante deste servico: dado coletado passa a se referir
      // a um texto que nao existe mais.
      avisos.push({
        nivel: 'atencao',
        texto:
          `Esta pergunta ja tem ${respostas} resposta(s) coletada(s). Mudar o enunciado ou as ` +
          'alternativas faz esses dados passarem a se referir a um texto que nao existe mais, e ' +
          'nao ha como separar as respostas antigas das novas depois. Uma alternativa e criar ' +
          'uma pergunta nova e desativar esta, preservando o significado do que ja foi coletado.',
      });
    }

    const corpo: Record<string, unknown> = {};
    const detalhes: Array<{ rotulo: string; valor: string }> = [
      { rotulo: 'Pergunta', valor: `${pergunta.id} — ${pergunta.text}` },
      { rotulo: 'Respostas coletadas', valor: String(respostas) },
    ];

    if (params.texto !== undefined) {
      corpo.text = params.texto;
      detalhes.push({ rotulo: 'Novo enunciado', valor: params.texto });
    }
    if (params.alternativas) {
      corpo.options = params.alternativas.map((texto) => ({ text: texto }));
      corpo.correctOptionIndex = params.indiceCorreto;
      detalhes.push(
        ...params.alternativas.map((texto, i) => ({
          rotulo: `Nova alternativa ${i + 1}${i === params.indiceCorreto ? ' (correta)' : ''}`,
          valor: texto,
        })),
      );
    }
    if (params.dificuldade !== undefined) {
      corpo.difficulty = params.dificuldade;
      detalhes.push({ rotulo: 'Nova dificuldade', valor: String(params.dificuldade) });
    }

    if (Object.keys(corpo).length === 0) {
      throw new Error('Nada a alterar: informe enunciado, alternativas ou dificuldade.');
    }

    return {
      id: randomUUID(),
      tipo: 'editar_pergunta',
      resumo: `Editar a pergunta ${pergunta.id}.`,
      detalhes,
      avisos,
      requisicao: { metodo: 'PATCH', caminho: `/questions/${pergunta.id}`, corpo },
    };
  }
}
