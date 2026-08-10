import RedisMock from 'ioredis-mock';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let client: InstanceType<typeof RedisMock>;

  beforeEach(() => {
    client = new RedisMock();
    // O mock e compativel com a interface do ioredis usada pelo servico.
    service = new RedisService(client as never);
  });

  afterEach(async () => {
    await client.flushall();
  });

  it('grava e le objetos JSON', async () => {
    await service.setJson('k1', { a: 1, b: 'x' });
    const value = await service.getJson<{ a: number; b: string }>('k1');
    expect(value).toEqual({ a: 1, b: 'x' });
  });

  it('retorna null para chave inexistente', async () => {
    expect(await service.getJson('nope')).toBeNull();
  });

  it('remove chaves', async () => {
    await service.setJson('k2', { ok: true });
    expect(await service.exists('k2')).toBe(true);
    await service.del('k2');
    expect(await service.exists('k2')).toBe(false);
  });

  it('gerencia membros de um set', async () => {
    await service.sadd('served', '1', '2');
    expect(await service.sismember('served', '1')).toBe(true);
    expect(await service.sismember('served', '3')).toBe(false);
    expect((await service.smembers('served')).sort()).toEqual(['1', '2']);
  });
});
