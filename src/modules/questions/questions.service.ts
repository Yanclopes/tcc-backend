import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuditAction } from '../audit/audit-action.enum';
import { AuditService } from '../audit/audit.service';
import { Goal } from '../goals/entities/goal.entity';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionOption } from './entities/question-option.entity';
import { Question } from './entities/question.entity';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /**
   * Cria a pergunta e suas opcoes numa transacao e, ao final, aponta a coluna
   * "answer" para o id real da opcao correta (so conhecido apos o insert).
   */
  async create(dto: CreateQuestionDto): Promise<Question> {
    if (dto.correctOptionIndex >= dto.options.length) {
      throw new BadRequestException('correctOptionIndex fora do intervalo de options.');
    }

    const goal = await this.goalRepository.findOne({ where: { number: dto.goalNumber } });
    if (!goal) {
      throw new NotFoundException(`ODS numero ${dto.goalNumber} nao encontrado.`);
    }

    return this.dataSource.transaction(async (manager) => {
      const question = manager.create(Question, {
        text: dto.text,
        goal,
        difficulty: dto.difficulty ?? 1,
        source: dto.source ?? null,
        educationLevel: dto.educationLevelId
          ? ({ id: dto.educationLevelId } as Question['educationLevel'])
          : null,
        isActive: true,
      });
      const savedQuestion = await manager.save(question);

      const options = dto.options.map((option) =>
        manager.create(QuestionOption, { text: option.text, question: savedQuestion }),
      );
      const savedOptions = await manager.save(options);

      // Vincula a resposta correta pelo indice informado.
      savedQuestion.answerOptionId = savedOptions[dto.correctOptionIndex].id;
      await manager.save(savedQuestion);

      savedQuestion.options = savedOptions;
      return savedQuestion;
    });
  }

  /**
   * Atualiza uma pergunta. Campos escalares sao aplicados diretamente; se
   * `options` for enviado, substitui todas as alternativas e re-vincula a
   * correta pelo `correctOptionIndex`, tudo numa transacao.
   */
  async update(id: number, dto: UpdateQuestionDto): Promise<Question> {
    const wantsOptions = dto.options !== undefined;
    if (wantsOptions && dto.correctOptionIndex === undefined) {
      throw new BadRequestException('Ao substituir as alternativas, informe correctOptionIndex.');
    }
    if (wantsOptions && dto.correctOptionIndex! >= dto.options!.length) {
      throw new BadRequestException('correctOptionIndex fora do intervalo de options.');
    }

    if (wantsOptions && (await this.answersCount(id)) > 0) {
      throw new BadRequestException(
        'Esta pergunta ja possui respostas registradas: nao e possivel trocar as ' +
          'alternativas (preservacao do dado). Desative-a e crie uma nova pergunta.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const question = await manager.findOne(Question, {
        where: { id },
        relations: { options: true },
      });
      if (!question) throw new NotFoundException(`Pergunta ${id} nao encontrada.`);

      if (dto.text !== undefined) question.text = dto.text;
      if (dto.difficulty !== undefined) question.difficulty = dto.difficulty;
      if (dto.source !== undefined) question.source = dto.source;
      if (dto.isActive !== undefined) question.isActive = dto.isActive;
      if (dto.educationLevelId !== undefined) {
        question.educationLevel = dto.educationLevelId
          ? ({ id: dto.educationLevelId } as Question['educationLevel'])
          : null;
      }
      if (dto.goalNumber !== undefined) {
        const goal = await manager.findOne(Goal, { where: { number: dto.goalNumber } });
        if (!goal) throw new NotFoundException(`ODS numero ${dto.goalNumber} nao encontrado.`);
        question.goal = goal;
      }

      if (wantsOptions) {
        // Remove o vinculo da resposta antes de apagar as opcoes (FK question.answer).
        question.answerOptionId = null;
        await manager.save(question);
        await manager.delete(QuestionOption, { question: { id } });

        const newOptions = await manager.save(
          dto.options!.map((o) => manager.create(QuestionOption, { text: o.text, question })),
        );
        question.answerOptionId = newOptions[dto.correctOptionIndex!].id;
      }

      await manager.save(question);
      return manager.findOneOrFail(Question, {
        where: { id },
        relations: { goal: true, options: true },
      });
    });
  }

  /** Ativa/desativa a pergunta (atalho de manutencao). */
  async setActive(id: number, isActive: boolean, actorUserId: number): Promise<Question> {
    const question = await this.findOne(id);
    const previousState = question.isActive;
    question.isActive = isActive;
    await this.questionRepository.save(question);
    if (previousState !== isActive) {
      await this.audit.record({
        actorUserId,
        action: isActive ? AuditAction.QUESTION_ACTIVATED : AuditAction.QUESTION_DEACTIVATED,
        targetType: 'question',
        targetId: id,
        metadata: { previousState },
      });
    }
    return question;
  }

  /**
   * Remove a pergunta e suas alternativas. Bloqueia se ja houver respostas
   * registradas (o FK game_answer.question e RESTRICT e o dado deve ser
   * preservado) — nesse caso, oriente a desativar em vez de apagar.
   */
  async remove(id: number): Promise<void> {
    const question = await this.findOne(id);
    if ((await this.answersCount(id)) > 0) {
      throw new BadRequestException(
        'Esta pergunta ja possui respostas registradas e nao pode ser apagada. ' +
          'Use a desativacao (isActive=false) para tira-la do jogo.',
      );
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Question, { id }, { answerOptionId: null });
      await manager.delete(QuestionOption, { question: { id } });
      await manager.delete(Question, { id: question.id });
    });
  }

  /** Quantidade de respostas ja registradas para a pergunta (fato da pesquisa). */
  private async answersCount(questionId: number): Promise<number> {
    const row = await this.dataSource.query(
      'SELECT COUNT(*)::int AS count FROM game_answer WHERE question = $1',
      [questionId],
    );
    return row?.[0]?.count ?? 0;
  }

  findAll(goalNumber?: number): Promise<Question[]> {
    return this.questionRepository.find({
      where: goalNumber ? { goal: { number: goalNumber } } : {},
      relations: { goal: true, options: true, educationLevel: true },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Question> {
    const question = await this.questionRepository.findOne({
      where: { id },
      relations: { goal: true, options: true, educationLevel: true },
    });
    if (!question) {
      throw new NotFoundException(`Pergunta ${id} nao encontrada.`);
    }
    return question;
  }

  /**
   * Seleciona uma pergunta ativa aleatoria para a partida, respeitando a
   * dificuldade e evitando ids ja utilizados na mesma sessao. Retorna null
   * quando o repositorio se esgota (fim de jogo por falta de perguntas).
   */
  async pickForGame(params: {
    difficulty?: number;
    educationLevelId?: number;
    excludeIds: number[];
  }): Promise<Question | null> {
    // 1o passo: sorteia apenas o id, sem joins to-many (evita truncar opcoes
    // por causa do LIMIT). ORDER BY RANDOM() e suficiente para o volume do TCC.
    const qb = this.questionRepository
      .createQueryBuilder('question')
      .select('question.id', 'id')
      .where('question.is_active = true');

    if (params.difficulty) {
      qb.andWhere('question.difficulty = :difficulty', { difficulty: params.difficulty });
    }
    if (params.educationLevelId) {
      qb.andWhere('(question.education_level = :level OR question.education_level IS NULL)', {
        level: params.educationLevelId,
      });
    }
    if (params.excludeIds.length > 0) {
      qb.andWhere('question.id NOT IN (:...excludeIds)', { excludeIds: params.excludeIds });
    }

    const row = await qb.orderBy('RANDOM()').limit(1).getRawOne<{ id: number }>();
    if (!row) return null;

    // 2o passo: carrega a pergunta completa (goal + todas as opcoes).
    return this.findOne(row.id);
  }

  /** Confere se uma opcao pertence a pergunta e se e a correta. */
  async gradeAnswer(
    questionId: number,
    optionId: number,
  ): Promise<{ isCorrect: boolean; correctOptionId: number }> {
    const question = await this.findOne(questionId);
    const optionBelongs = question.options.some((option) => option.id === optionId);
    if (!optionBelongs) {
      throw new BadRequestException('A opcao informada nao pertence a esta pergunta.');
    }
    return {
      isCorrect: question.answerOptionId === optionId,
      correctOptionId: question.answerOptionId!,
    };
  }

  /** Retorna 2 ids de opcoes incorretas para o power-up "fifty" (50:50). */
  async getWrongOptionIds(questionId: number, limit = 2): Promise<number[]> {
    const question = await this.findOne(questionId);
    return question.options
      .filter((option) => option.id !== question.answerOptionId)
      .slice(0, limit)
      .map((option) => option.id);
  }

  async existsActive(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    return this.questionRepository.count({ where: { id: In(ids), isActive: true } });
  }
}
