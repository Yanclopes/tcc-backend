import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatConversa } from './entities/chat-conversa.entity';
import { ChatMensagem } from './entities/chat-mensagem.entity';
import { FerramentasService } from './ferramentas/ferramentas.service';
import { OpenAiService } from './rag/openai.service';
import { RetrieverService } from './rag/retriever.service';

/**
 * Isolamento das conversas entre usuarios.
 *
 * Propriedade de seguranca, nao detalhe de implementacao: o historico de um
 * administrador nao pode ser lido por outro. A verificacao NAO olha o papel —
 * filtra por dono —, entao admin, master e usuario comum sao barrados da mesma
 * forma. Estes testes existem para que isso nao se perca num refactor.
 */
describe('ChatService — isolamento por usuario', () => {
  const DONO = 1;
  const OUTRO_ADMIN = 2;
  const CONVERSA = '3f2b1c4e-0000-4000-8000-000000000001';

  let service: ChatService;
  let conversaRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let mensagemRepo: { find: jest.Mock; save: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    conversaRepo = {
      // Simula o comportamento real: so devolve se o dono bater.
      findOne: jest.fn(({ where }: { where: { id: string; usuario: { id: number } } }) =>
        Promise.resolve(
          where.id === CONVERSA && where.usuario.id === DONO
            ? { id: CONVERSA, titulo: 'Conversa do dono' }
            : null,
        ),
      ),
      find: jest.fn(({ where }: { where: { usuario: { id: number } } }) =>
        Promise.resolve(where.usuario.id === DONO ? [{ id: CONVERSA }] : []),
      ),
      remove: jest.fn(() => Promise.resolve()),
      save: jest.fn((v) => Promise.resolve(v)),
      create: jest.fn((v) => v),
    };
    mensagemRepo = {
      find: jest.fn(() => Promise.resolve([])),
      save: jest.fn((v) => Promise.resolve(v)),
      create: jest.fn((v) => v),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(ChatConversa), useValue: conversaRepo },
        { provide: getRepositoryToken(ChatMensagem), useValue: mensagemRepo },
        { provide: OpenAiService, useValue: { habilitado: true } },
        { provide: RetrieverService, useValue: { recuperar: jest.fn(() => Promise.resolve([])) } },
        { provide: FerramentasService, useValue: { declaracoes: [] } },
      ],
    }).compile();

    service = module.get(ChatService);
  });

  it('o dono le a propria conversa', async () => {
    await expect(service.obterConversa(CONVERSA, DONO)).resolves.toBeDefined();
  });

  it('outro admin nao le a conversa alheia', async () => {
    await expect(service.obterConversa(CONVERSA, OUTRO_ADMIN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('outro admin nao apaga a conversa alheia', async () => {
    await expect(service.removerConversa(CONVERSA, OUTRO_ADMIN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(conversaRepo.remove).not.toHaveBeenCalled();
  });

  it('outro admin nao escreve na conversa alheia', async () => {
    await expect(service.perguntar(CONVERSA, OUTRO_ADMIN, 'oi')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // Nem chega a gravar a pergunta: a checagem vem antes.
    expect(mensagemRepo.save).not.toHaveBeenCalled();
  });

  it('a listagem so traz as conversas do proprio usuario', async () => {
    expect(await service.listarConversas(DONO)).toHaveLength(1);
    expect(await service.listarConversas(OUTRO_ADMIN)).toHaveLength(0);
  });

  it('a consulta sempre filtra por dono, nunca so pelo id', async () => {
    // Um refactor que buscasse so por id devolveria a conversa a qualquer um.
    await service.obterConversa(CONVERSA, DONO).catch(() => undefined);

    expect(conversaRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ usuario: { id: DONO } }) }),
    );
  });

  it('nao existe caminho que ignore o dono por causa do papel', async () => {
    // O servico nao recebe o papel do usuario — so o id. Se um dia alguem
    // quiser dar acesso amplo a master, sera uma mudanca explicita de
    // assinatura, e nao um efeito colateral.
    expect(service.obterConversa).toHaveLength(2);
    expect(service.removerConversa).toHaveLength(2);
    expect(service.perguntar).toHaveLength(3);
  });
});
