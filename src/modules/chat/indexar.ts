/* eslint-disable no-console */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { IngestaoService } from './rag/ingestao.service';

/**
 * CLI de indexacao da base de conhecimento do assistente.
 *
 *   npm run chat:indexar        (desenvolvimento, via ts-node)
 *   npm run chat:indexar:prod   (servidor, sobre o dist compilado)
 *
 * Roda no deploy logo depois do seed. Idempotente por hash: rodar duas vezes
 * seguidas nao gasta embedding na segunda. Ver .specs/06-chat-ia.md.
 *
 * Usa createApplicationContext em vez de subir o servidor HTTP: precisamos da
 * injecao de dependencia (ConfigService, repositorios), nao das rotas.
 */
async function main(): Promise<void> {
  const contexto = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingestao = contexto.get(IngestaoService, { strict: false });
    console.log('Indexando a base de conhecimento...');
    const resultado = await ingestao.indexar();

    console.log('');
    console.log('  documentos lidos .......... %d', resultado.documentosLidos);
    console.log('  indexados (novos/mudados) . %d', resultado.documentosIndexados);
    console.log('  inalterados (sem custo) ... %d', resultado.documentosInalterados);
    console.log('  removidos (fora do corpus)  %d', resultado.documentosRemovidos);
    console.log('  trechos gravados .......... %d', resultado.trechosGravados);
    console.log('  tokens estimados .......... ~%d', resultado.tokensEstimados);
    console.log('');
    console.log('Indexacao concluida.');
  } finally {
    await contexto.close();
  }
}

main().catch((erro) => {
  console.error('Falha na indexacao:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
