/* eslint-disable no-console */
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import dataSource from '../config/data-source';
import { AppRole } from '../modules/auth/role.enum';
import { AppUser } from '../modules/users/entities/app-user.entity';
import { City } from '../modules/geo/entities/city.entity';
import { Country } from '../modules/geo/entities/country.entity';
import { School } from '../modules/geo/entities/school.entity';
import { State } from '../modules/geo/entities/state.entity';
import { GameDifficulty } from '../modules/game/entities/game-difficulty.entity';
import { GameStatus } from '../modules/game/entities/game-status.entity';
import { Goal } from '../modules/goals/entities/goal.entity';
import { Powerup } from '../modules/powerups/entities/powerup.entity';
import { QuestionOption } from '../modules/questions/entities/question-option.entity';
import { Question } from '../modules/questions/entities/question.entity';
import { EducationLevel } from '../modules/users/entities/education-level.entity';
import { Role } from '../modules/users/entities/role.entity';

/** Os 17 ODS com nome em pt-BR e a cor oficial da ONU. */
const GOALS: Array<{ number: number; name: string; color: string }> = [
  { number: 1, name: 'Erradicacao da Pobreza', color: '#E5243B' },
  { number: 2, name: 'Fome Zero e Agricultura Sustentavel', color: '#DDA63A' },
  { number: 3, name: 'Saude e Bem-Estar', color: '#4C9F38' },
  { number: 4, name: 'Educacao de Qualidade', color: '#C5192D' },
  { number: 5, name: 'Igualdade de Genero', color: '#FF3A21' },
  { number: 6, name: 'Agua Potavel e Saneamento', color: '#26BDE2' },
  { number: 7, name: 'Energia Limpa e Acessivel', color: '#FCC30B' },
  { number: 8, name: 'Trabalho Decente e Crescimento Economico', color: '#A21942' },
  { number: 9, name: 'Industria, Inovacao e Infraestrutura', color: '#FD6925' },
  { number: 10, name: 'Reducao das Desigualdades', color: '#DD1367' },
  { number: 11, name: 'Cidades e Comunidades Sustentaveis', color: '#FD9D24' },
  { number: 12, name: 'Consumo e Producao Responsaveis', color: '#BF8B2E' },
  { number: 13, name: 'Acao Contra a Mudanca Global do Clima', color: '#3F7E44' },
  { number: 14, name: 'Vida na Agua', color: '#0A97D9' },
  { number: 15, name: 'Vida Terrestre', color: '#56C02B' },
  { number: 16, name: 'Paz, Justica e Instituicoes Eficazes', color: '#00689D' },
  { number: 17, name: 'Parcerias e Meios de Implementacao', color: '#19486A' },
];

/**
 * Insere um registro apenas se ainda nao existir (idempotente): permite rodar a
 * seed varias vezes sem duplicar dados.
 */
async function upsert<T extends object>(
  repo: import('typeorm').Repository<T>,
  where: import('typeorm').FindOptionsWhere<T>,
  data: Partial<T>,
): Promise<T> {
  const existing = await repo.findOne({ where });
  if (existing) return existing;
  const created = repo.create(data as T);
  return repo.save(created);
}

async function run(): Promise<void> {
  await dataSource.initialize();
  console.log('Conectado ao banco. Iniciando seed...');

  // ----- Status e modos de jogo -----
  const statusRepo = dataSource.getRepository(GameStatus);
  for (const label of ['in_progress', 'finished', 'abandoned']) {
    await upsert(statusRepo, { label } as never, { label });
  }

  const difficultyRepo = dataSource.getRepository(GameDifficulty);
  await upsert(difficultyRepo, { id: 'quick' } as never, {
    id: 'quick',
    title: 'Rapido',
    numberQuestions: 5,
    endsOnWrong: false,
  });
  await upsert(difficultyRepo, { id: 'classic' } as never, {
    id: 'classic',
    title: 'Classico',
    numberQuestions: 15,
    endsOnWrong: false,
  });
  await upsert(difficultyRepo, { id: 'endless' } as never, {
    id: 'endless',
    title: 'Infinito',
    numberQuestions: null,
    endsOnWrong: false,
  });
  // Modo Sobrevivencia: segue ate errar (estilo game show). Encerra na 1a errada.
  await upsert(difficultyRepo, { id: 'survival' } as never, {
    id: 'survival',
    title: 'Sobrevivencia',
    numberQuestions: null,
    endsOnWrong: true,
  });

  // ----- Power-ups -----
  const powerupRepo = dataSource.getRepository(Powerup);
  await upsert(powerupRepo, { name: 'fifty' } as never, {
    name: 'fifty',
    description: 'Elimina duas alternativas incorretas (50:50).',
  });
  await upsert(powerupRepo, { name: 'skip' } as never, {
    name: 'skip',
    description: 'Pula a pergunta atual sem penalidade de pontuacao.',
  });
  await upsert(powerupRepo, { name: 'audience' } as never, {
    name: 'audience',
    description: 'Mostra o placar da galera (distribuicao de votos).',
  });

  // ----- ODS -----
  const goalRepo = dataSource.getRepository(Goal);
  for (const goal of GOALS) {
    await upsert(goalRepo, { number: goal.number } as never, goal);
  }

  // ----- Escolaridade e perfis -----
  const levelRepo = dataSource.getRepository(EducationLevel);
  const levels = [
    'Ensino Fundamental I',
    'Ensino Fundamental II',
    'Ensino Medio',
    'Ensino Superior',
  ];
  const levelEntities: EducationLevel[] = [];
  for (const name of levels) {
    levelEntities.push(await upsert(levelRepo, { name } as never, { name }));
  }

  const roleRepo = dataSource.getRepository(Role);
  for (const name of [AppRole.USER, AppRole.ADMIN, AppRole.MASTER]) {
    await upsert(roleRepo, { name } as never, { name });
  }
  const masterRole = await roleRepo.findOneOrFail({ where: { name: AppRole.MASTER } });

  // ----- Geografia (Alto Vale do Itajai) -----
  const countryRepo = dataSource.getRepository(Country);
  const brasil = await upsert(countryRepo, { name: 'Brasil' } as never, { name: 'Brasil' });

  const stateRepo = dataSource.getRepository(State);
  const sc = await upsert(stateRepo, { code: 'SC' } as never, {
    code: 'SC',
    name: 'Santa Catarina',
    country: brasil,
  });

  const cityRepo = dataSource.getRepository(City);
  const rioDoSul = await upsert(cityRepo, { name: 'Rio do Sul' } as never, {
    name: 'Rio do Sul',
    state: sc,
  });

  const schoolRepo = dataSource.getRepository(School);
  const unidavi = await upsert(schoolRepo, { name: 'UNIDAVI' } as never, {
    name: 'UNIDAVI',
    city: rioDoSul,
  });

  // ----- Administrador inicial -----
  // Credenciais via ambiente (com padrao apenas para desenvolvimento).
  const userRepo = dataSource.getRepository(AppUser);
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@ods.local';
  const existingAdmin = await userRepo.findOne({
    where: { email: adminEmail },
    relations: { role: true },
  });
  if (!existingAdmin) {
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin12345';
    await userRepo.save(
      userRepo.create({
        name: 'Administrador Master',
        email: adminEmail,
        password: await bcrypt.hash(adminPassword, 10),
        role: masterRole,
        school: unidavi,
      }),
    );
    console.log(`Master criado: ${adminEmail} (troque a senha em producao).`);
  } else if (existingAdmin.role?.name !== AppRole.MASTER) {
    // Promove o super-admin inicial existente a master (idempotente).
    existingAdmin.role = masterRole;
    await userRepo.save(existingAdmin);
    console.log(`Usuario ${adminEmail} promovido a master.`);
  }

  // ----- Perguntas de exemplo -----
  await seedSampleQuestions(dataSource, goalRepo, levelEntities[2]);

  console.log('Seed concluida com sucesso.');
  await dataSource.destroy();
}

/** Cria algumas perguntas iniciais (idempotente pelo texto). */
async function seedSampleQuestions(
  ds: import('typeorm').DataSource,
  goalRepo: import('typeorm').Repository<Goal>,
  ensinoMedio: EducationLevel,
): Promise<void> {
  const questionRepo = ds.getRepository(Question);
  const optionRepo = ds.getRepository(QuestionOption);

  const samples: Array<{
    text: string;
    goalNumber: number;
    difficulty: number;
    source: string;
    options: string[];
    correctIndex: number;
  }> = [
    // ---- Dificuldade 1 (faceis) ----
    {
      text: 'Em que ano a ONU aprovou a Agenda 2030 e os Objetivos de Desenvolvimento Sustentavel?',
      goalNumber: 4,
      difficulty: 1,
      source: 'ONU, 2015',
      options: ['2000', '2010', '2015', '2020'],
      correctIndex: 2,
    },
    {
      text: 'Quantos Objetivos de Desenvolvimento Sustentavel (ODS) compoem a Agenda 2030?',
      goalNumber: 4,
      difficulty: 1,
      source: 'ONU, 2015',
      options: ['8', '12', '17', '21'],
      correctIndex: 2,
    },
    {
      text: 'O ODS 1 tem como objetivo principal:',
      goalNumber: 1,
      difficulty: 1,
      source: 'Nacoes Unidas Brasil',
      options: [
        'Erradicacao da pobreza',
        'Energia limpa e acessivel',
        'Vida na agua',
        'Igualdade de genero',
      ],
      correctIndex: 0,
    },
    {
      text: 'O ODS 2 e conhecido pelo lema:',
      goalNumber: 2,
      difficulty: 1,
      source: 'Nacoes Unidas Brasil',
      options: ['Fome Zero', 'Saude e Bem-Estar', 'Trabalho Decente', 'Paz e Justica'],
      correctIndex: 0,
    },
    {
      text: 'Educacao de Qualidade e o tema de qual ODS?',
      goalNumber: 4,
      difficulty: 1,
      source: 'Nacoes Unidas Brasil',
      options: ['ODS 3', 'ODS 4', 'ODS 5', 'ODS 8'],
      correctIndex: 1,
    },
    {
      text: 'Qual ODS trata de Agua Potavel e Saneamento?',
      goalNumber: 6,
      difficulty: 1,
      source: 'Nacoes Unidas Brasil',
      options: ['ODS 3', 'ODS 6', 'ODS 11', 'ODS 14'],
      correctIndex: 1,
    },
    // ---- Dificuldade 2 ----
    {
      text: 'Qual ODS trata especificamente da Acao Contra a Mudanca Global do Clima?',
      goalNumber: 13,
      difficulty: 2,
      source: 'Nacoes Unidas Brasil, 2024',
      options: ['ODS 7', 'ODS 11', 'ODS 13', 'ODS 15'],
      correctIndex: 2,
    },
    {
      text: 'O ODS 5 busca alcancar:',
      goalNumber: 5,
      difficulty: 2,
      source: 'Nacoes Unidas Brasil',
      options: [
        'Igualdade de genero e empoderamento de mulheres e meninas',
        'Reducao do consumo de energia',
        'Ampliacao das exportacoes',
        'Expansao das cidades',
      ],
      correctIndex: 0,
    },
    {
      text: 'Energia Limpa e Acessivel corresponde a qual ODS?',
      goalNumber: 7,
      difficulty: 2,
      source: 'Nacoes Unidas Brasil',
      options: ['ODS 6', 'ODS 7', 'ODS 9', 'ODS 12'],
      correctIndex: 1,
    },
    {
      text: 'O ODS 14 (Vida na Agua) trata da conservacao de:',
      goalNumber: 14,
      difficulty: 2,
      source: 'Nacoes Unidas Brasil',
      options: [
        'Oceanos, mares e recursos marinhos',
        'Florestas tropicais',
        'Cidades costeiras',
        'Industrias pesqueiras',
      ],
      correctIndex: 0,
    },
    // ---- Dificuldade 3 ----
    {
      text: 'Cidades e Comunidades Sustentaveis e o tema de qual ODS?',
      goalNumber: 11,
      difficulty: 3,
      source: 'Nacoes Unidas Brasil',
      options: ['ODS 9', 'ODS 10', 'ODS 11', 'ODS 12'],
      correctIndex: 2,
    },
    {
      text: 'O ODS 12 promove padroes de:',
      goalNumber: 12,
      difficulty: 3,
      source: 'Nacoes Unidas Brasil',
      options: [
        'Consumo e producao responsaveis',
        'Crescimento economico ilimitado',
        'Urbanizacao acelerada',
        'Aumento das exportacoes',
      ],
      correctIndex: 0,
    },
    {
      text: 'O ODS 15 (Vida Terrestre) inclui, entre suas metas, o combate a:',
      goalNumber: 15,
      difficulty: 3,
      source: 'Nacoes Unidas Brasil',
      options: [
        'Desertificacao e perda de biodiversidade',
        'Poluicao sonora urbana',
        'Evasao escolar',
        'Inflacao dos alimentos',
      ],
      correctIndex: 0,
    },
    {
      text: 'O ODS 16 trata de Paz, Justica e:',
      goalNumber: 16,
      difficulty: 3,
      source: 'Nacoes Unidas Brasil',
      options: [
        'Instituicoes Eficazes',
        'Energia Renovavel',
        'Saneamento Basico',
        'Inovacao Industrial',
      ],
      correctIndex: 0,
    },
    // ---- Dificuldade 4 ----
    {
      text: 'Industria, Inovacao e Infraestrutura e o foco de qual ODS?',
      goalNumber: 9,
      difficulty: 4,
      source: 'Nacoes Unidas Brasil',
      options: ['ODS 7', 'ODS 8', 'ODS 9', 'ODS 10'],
      correctIndex: 2,
    },
    {
      text: 'O ODS 17 enfatiza a importancia de:',
      goalNumber: 17,
      difficulty: 4,
      source: 'Nacoes Unidas Brasil',
      options: [
        'Parcerias e meios de implementacao',
        'Turismo internacional',
        'Exploracao mineral',
        'Publicidade corporativa',
      ],
      correctIndex: 0,
    },
    {
      text: 'A Agenda 2030 foi adotada por quantos Estados-membros da ONU em 2015?',
      goalNumber: 17,
      difficulty: 4,
      source: 'ONU, 2015',
      options: ['93', '128', '193', '250'],
      correctIndex: 2,
    },
    // ---- Dificuldade 5 (dificeis) ----
    {
      text: 'Quantas metas (targets) compoem, ao todo, os 17 ODS?',
      goalNumber: 17,
      difficulty: 5,
      source: 'ONU, 2015',
      options: ['100', '169', '200', '231'],
      correctIndex: 1,
    },
    {
      text: 'O Acordo de Paris, associado ao ODS 13, foi adotado em que ano?',
      goalNumber: 13,
      difficulty: 5,
      source: 'UNFCCC, 2015',
      options: ['2010', '2012', '2015', '2018'],
      correctIndex: 2,
    },
    {
      text: 'O ODS 10 tem como objetivo a reducao das:',
      goalNumber: 10,
      difficulty: 5,
      source: 'Nacoes Unidas Brasil',
      options: [
        'Desigualdades dentro dos paises e entre eles',
        'Emissoes de gases de efeito estufa',
        'Barreiras alfandegarias',
        'Taxas de juros globais',
      ],
      correctIndex: 0,
    },
  ];

  for (const sample of samples) {
    const already = await questionRepo.findOne({ where: { text: sample.text } });
    if (already) continue;

    const goal = await goalRepo.findOneOrFail({ where: { number: sample.goalNumber } });
    const question = await questionRepo.save(
      questionRepo.create({
        text: sample.text,
        goal,
        difficulty: sample.difficulty,
        source: sample.source,
        educationLevel: ensinoMedio,
        isActive: true,
      }),
    );

    const options = await optionRepo.save(
      sample.options.map((text) => optionRepo.create({ text, question })),
    );
    question.answerOptionId = options[sample.correctIndex].id;
    await questionRepo.save(question);
  }
}

run().catch((error) => {
  console.error('Falha na seed:', error);
  process.exit(1);
});
