import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GameAnswer } from '../../game/entities/game-answer.entity';
import { School } from '../../geo/entities/school.entity';
import { Goal } from '../../goals/entities/goal.entity';
import { EducationLevel } from '../../users/entities/education-level.entity';
import { Question } from '../../questions/entities/question.entity';
import { SchoolSuggestion } from '../../schools/entities/school-suggestion.entity';
import { AcoesService } from './acoes.service';

describe('AcoesService', () => {
  let service: AcoesService;
  let sugestaoRepo: { findOne: jest.Mock; find: jest.Mock };
  let escolaRepo: { findOne: jest.Mock; find: jest.Mock };
  let perguntaRepo: { findOne: jest.Mock; count: jest.Mock };
  let odsRepo: { findOne: jest.Mock };
  let respostaRepo: { count: jest.Mock };
  let escolaridadeRepo: { find: jest.Mock };

  const sugestaoPendente = {
    id: 1,
    name: 'EEB Frei Godofredo',
    status: 'pending',
    city: { id: 5, name: 'Ituporanga' },
  };

  const perguntaExistente = {
    id: 7,
    text: 'Qual ODS trata de agua?',
    isActive: true,
    goal: { id: 6, number: 6, name: 'Agua Potavel' },
    options: [],
  };

  beforeEach(async () => {
    sugestaoRepo = {
      findOne: jest.fn(() => Promise.resolve(sugestaoPendente)),
      find: jest.fn(() => Promise.resolve([sugestaoPendente])),
    };
    escolaRepo = { findOne: jest.fn(), find: jest.fn(() => Promise.resolve([])) };
    perguntaRepo = {
      findOne: jest.fn(() => Promise.resolve(perguntaExistente)),
      count: jest.fn(() => Promise.resolve(2)),
    };
    odsRepo = { findOne: jest.fn(() => Promise.resolve({ id: 6, number: 6, name: 'Agua' })) };
    respostaRepo = { count: jest.fn(() => Promise.resolve(0)) };
    escolaridadeRepo = {
      find: jest.fn(() =>
        Promise.resolve([
          { id: 2, name: 'Ensino Fundamental II' },
          { id: 3, name: 'Ensino Medio' },
        ]),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcoesService,
        { provide: getRepositoryToken(SchoolSuggestion), useValue: sugestaoRepo },
        { provide: getRepositoryToken(School), useValue: escolaRepo },
        { provide: getRepositoryToken(Question), useValue: perguntaRepo },
        { provide: getRepositoryToken(Goal), useValue: odsRepo },
        { provide: getRepositoryToken(GameAnswer), useValue: respostaRepo },
        { provide: getRepositoryToken(EducationLevel), useValue: escolaridadeRepo },
      ],
    }).compile();

    service = module.get(AcoesService);
  });

  describe('sugestoes de escola', () => {
    it('monta a requisicao para o endpoint existente, sem executar nada', async () => {
      // O assistente nunca escreve: ele preenche o mesmo formulario que o
      // administrador preencheria, e o clique dele e que dispara.
      const acao = await service.aprovarSugestaoEscola(1, [2, 3]);

      expect(acao.requisicao).toEqual({
        metodo: 'POST',
        caminho: '/schools/suggestions/1/approve',
        corpo: { educationLevelIds: [2, 3] },
      });
    });

    it('alerta sobre escola parecida ja existente na mesma cidade', async () => {
      // "EEB Frei Godofredo" x "E.E.B. Frei Godofredo" viram duas escolas se
      // ninguem olhar, e o recorte por escola fica partido ao meio.
      escolaRepo.find.mockResolvedValue([{ id: 9, name: 'E.E.B. Frei Godofredo' }]);

      const acao = await service.aprovarSugestaoEscola(1, [2]);

      expect(acao.avisos.some((a) => a.nivel === 'atencao' && /VINCULAR/.test(a.texto))).toBe(true);
    });

    it('mostra o NOME da escolaridade, nao so o id', async () => {
      // Medido: pedindo "Ensino Medio" o modelo enviou o id 2, que e
      // "Ensino Fundamental II". Com so o numero na tela, o administrador
      // confirmaria sem perceber a troca.
      const acao = await service.aprovarSugestaoEscola(1, [2]);

      const linha = acao.detalhes.find((d) => d.rotulo === 'Escolaridades');
      expect(linha?.valor).toContain('Ensino Fundamental II');
    });

    it('recusa escolaridade inexistente', async () => {
      escolaridadeRepo.find.mockResolvedValue([]);

      await expect(service.aprovarSugestaoEscola(1, [99])).rejects.toThrow(
        /Nao existe escolaridade com id 99/,
      );
    });

    it('alerta quando nenhuma escolaridade foi informada', async () => {
      const acao = await service.aprovarSugestaoEscola(1, []);

      expect(acao.avisos.some((a) => /escolaridade/i.test(a.texto))).toBe(true);
    });

    it('recusa decidir sugestao que ja foi resolvida, e diz quais estao pendentes', async () => {
      // Medido: o botao de resposta rapida dizia so "Aprovar a sugestao", sem
      // id, e o modelo agiu sobre uma ja rejeitada. Listar as pendentes no erro
      // permite que ele corrija em vez de so reportar a falha.
      sugestaoRepo.findOne.mockResolvedValue({ ...sugestaoPendente, status: 'rejected' });
      sugestaoRepo.find.mockResolvedValue([{ id: 3, name: 'EEB Frei Godofredo [TESTE]' }]);

      await expect(service.aprovarSugestaoEscola(1, [2])).rejects.toThrow(
        /ja foi rejeitada.*Pendentes hoje: 3 \(EEB Frei Godofredo \[TESTE\]\)/s,
      );
    });

    it('avisa quando nao ha nenhuma pendente', async () => {
      sugestaoRepo.findOne.mockResolvedValue({ ...sugestaoPendente, status: 'approved' });
      sugestaoRepo.find.mockResolvedValue([]);

      await expect(service.aprovarSugestaoEscola(1, [2])).rejects.toThrow(
        /Nao ha nenhuma sugestao pendente/,
      );
    });

    it('recusa rejeitar sem motivo — o aluno le esse texto', async () => {
      await expect(service.rejeitarSugestaoEscola(1, '   ')).rejects.toThrow(/motivo/i);
    });

    it('alerta quando a escola de destino fica em outra cidade', async () => {
      escolaRepo.findOne.mockResolvedValue({
        id: 9,
        name: 'Outra Escola',
        city: { id: 99, name: 'Taio' },
      });

      const acao = await service.vincularSugestaoEscola(1, 9);

      expect(acao.avisos.some((a) => a.nivel === 'atencao')).toBe(true);
    });

    it('nao usa chaves que o guard de LGPD remove', async () => {
      // O guard apaga qualquer campo 'nome'/'name' por nao ter como saber se e
      // nome de pessoa. Usar essas chaves aqui fez o assistente perder o nome
      // da escola e responder sem dizer qual era.
      const [sugestao] = await service.listarSugestoesPendentes();

      expect(sugestao.escolaSugerida).toBe('EEB Frei Godofredo');
      expect(sugestao).not.toHaveProperty('nome');
      expect(sugestao).not.toHaveProperty('name');
      // 'id' sozinho e ambiguo num payload que traz sugestao e duplicata: o
      // assistente citou o id da duplicata achando que era o da sugestao.
      expect(sugestao.sugestaoId).toBe(1);
      expect(sugestao).not.toHaveProperty('id');
    });

    it('lista escolaridades sem chave ambigua', async () => {
      const niveis = await service.listarEscolaridades();

      expect(niveis[0].escolaridade).toBe('Ensino Fundamental II');
      expect(niveis[0]).not.toHaveProperty('nome');
    });
  });

  describe('ativar e desativar pergunta', () => {
    it('avisa que desativar preserva as respostas coletadas', async () => {
      respostaRepo.count.mockResolvedValue(40);

      const acao = await service.definirPerguntaAtiva(7, false);

      expect(acao.avisos.some((a) => /preservad/i.test(a.texto))).toBe(true);
      expect(acao.requisicao.corpo).toEqual({ isActive: false });
    });

    it('alerta ao desativar com amostra pequena', async () => {
      // Desativar por causa de 3 respostas e agir sobre ruido.
      respostaRepo.count.mockResolvedValue(3);

      const acao = await service.definirPerguntaAtiva(7, false);

      expect(
        acao.avisos.some((a) => a.nivel === 'atencao' && /amostra pequena/i.test(a.texto)),
      ).toBe(true);
    });

    it('nao alerta amostra pequena ao ATIVAR', async () => {
      respostaRepo.count.mockResolvedValue(3);

      const acao = await service.definirPerguntaAtiva(7, true);

      expect(acao.avisos.some((a) => /amostra pequena/i.test(a.texto))).toBe(false);
    });

    it('avisa quando a acao nao muda nada', async () => {
      const acao = await service.definirPerguntaAtiva(7, true); // ja esta ativa

      expect(acao.avisos.some((a) => /ja esta ativa/i.test(a.texto))).toBe(true);
    });
  });

  describe('criar pergunta', () => {
    const validas = ['Alternativa A', 'Alternativa B', 'Alternativa C', 'Alternativa D'];

    it('exige exatamente 4 alternativas', async () => {
      await expect(
        service.criarPergunta({
          texto: 'Enunciado',
          odsNumero: 6,
          alternativas: ['A', 'B', 'C'],
          indiceCorreto: 0,
        }),
      ).rejects.toThrow(/4 alternativas/);
    });

    it('recusa alternativas repetidas', async () => {
      // Duas iguais tornam o gabarito indefensavel.
      await expect(
        service.criarPergunta({
          texto: 'Enunciado',
          odsNumero: 6,
          alternativas: ['A', 'A', 'C', 'D'],
          indiceCorreto: 0,
        }),
      ).rejects.toThrow(/repetidas/i);
    });

    it('recusa indice de correta fora da faixa', async () => {
      await expect(
        service.criarPergunta({
          texto: 'Enunciado',
          odsNumero: 6,
          alternativas: validas,
          indiceCorreto: 4,
        }),
      ).rejects.toThrow(/entre 0 e 3/);
    });

    it('recusa ODS inexistente', async () => {
      odsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.criarPergunta({
          texto: 'Enunciado',
          odsNumero: 99,
          alternativas: validas,
          indiceCorreto: 0,
        }),
      ).rejects.toThrow(/ODS de numero 99/);
    });

    it('sempre pede revisao do texto antes de confirmar', async () => {
      const acao = await service.criarPergunta({
        texto: 'Enunciado',
        odsNumero: 6,
        alternativas: validas,
        indiceCorreto: 2,
      });

      expect(acao.avisos.some((a) => a.nivel === 'atencao' && /Revise/.test(a.texto))).toBe(true);
      expect(acao.detalhes.some((d) => d.rotulo.includes('(correta)'))).toBe(true);
    });
  });

  describe('editar pergunta', () => {
    it('alerta que a edicao muda o significado de dados ja coletados', async () => {
      respostaRepo.count.mockResolvedValue(23);

      const acao = await service.editarPergunta({ id: 7, texto: 'Novo enunciado' });

      const aviso = acao.avisos.find((a) => a.nivel === 'atencao');
      expect(aviso?.texto).toMatch(/23 resposta/);
      expect(aviso?.texto).toMatch(/texto que nao existe mais/);
    });

    it('nao alerta quando a pergunta ainda nao tem respostas', async () => {
      respostaRepo.count.mockResolvedValue(0);

      const acao = await service.editarPergunta({ id: 7, texto: 'Novo enunciado' });

      expect(acao.avisos).toHaveLength(0);
    });

    it('nao alerta quando a edicao nao toca no conteudo', async () => {
      // Mudar so a dificuldade nao altera o significado do que foi respondido.
      respostaRepo.count.mockResolvedValue(23);

      const acao = await service.editarPergunta({ id: 7, dificuldade: 4 });

      expect(acao.avisos).toHaveLength(0);
    });

    it('exige o indice da correta ao trocar as alternativas', async () => {
      await expect(
        service.editarPergunta({ id: 7, alternativas: ['A', 'B', 'C', 'D'] }),
      ).rejects.toThrow(/qual delas passa a ser a correta/i);
    });

    it('recusa edicao vazia', async () => {
      await expect(service.editarPergunta({ id: 7 })).rejects.toThrow(/Nada a alterar/);
    });
  });
});
