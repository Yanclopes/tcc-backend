import { CloudflareThrottlerGuard } from './cf-throttler.guard';

/**
 * O `getTracker` e `protected`; o teste acessa por um tipo estreito em vez de
 * `any`, para nao perder a checagem do restante da chamada.
 */
type ComTracker = { getTracker(req: unknown): Promise<string> };

function guard(): ComTracker {
  return new CloudflareThrottlerGuard(
    [],
    // As dependencias nao sao exercitadas por getTracker.
    {} as never,
    {} as never,
  ) as unknown as ComTracker;
}

function req(headers: Record<string, string | string[]>, ip = '10.0.0.1') {
  return { headers, ip };
}

/** JWT de mentira: so a forma importa aqui, nao a validade. */
function bearer(assinatura: string): string {
  return `Bearer cabecalho.corpo.${assinatura}`;
}

describe('CloudflareThrottlerGuard', () => {
  describe('requisicao anonima', () => {
    it('usa o IP do usuario final, nao o da borda da Cloudflare', async () => {
      // Este e o bug que o guard existe para corrigir: o IP do soquete e da
      // Cloudflare, e conta-lo faria todos os usuarios de uma mesma borda
      // dividirem um unico balde de rate limit.
      const tracker = await guard().getTracker(
        req({ 'cf-connecting-ip': '189.4.5.6' }, '172.71.238.232'),
      );

      expect(tracker).toBe('ip:189.4.5.6');
      expect(tracker).not.toContain('172.71.238.232');
    });

    it('separa usuarios diferentes atras da mesma borda', async () => {
      const g = guard();
      const a = await g.getTracker(req({ 'cf-connecting-ip': '189.4.5.6' }, '172.71.238.232'));
      const b = await g.getTracker(req({ 'cf-connecting-ip': '200.1.2.3' }, '172.71.238.232'));

      expect(a).not.toBe(b);
    });

    it('cai para o IP do soquete quando nao ha cabecalho da Cloudflare', async () => {
      // Acesso direto a origem, o caso do ambiente local.
      expect(await guard().getTracker(req({}, '127.0.0.1'))).toBe('ip:127.0.0.1');
    });
  });

  describe('requisicao autenticada', () => {
    it('da um balde por sessao, independente do IP', async () => {
      // Uma escola inteira atras de NAT sai por um unico IP publico. Se o balde
      // fosse por IP, o limite voltaria a ser coletivo mesmo com a Cloudflare
      // resolvida.
      const g = guard();
      const mesmoIp = { 'cf-connecting-ip': '189.4.5.6' };

      const alunoA = await g.getTracker(req({ ...mesmoIp, authorization: bearer('aaa') }));
      const alunoB = await g.getTracker(req({ ...mesmoIp, authorization: bearer('bbb') }));

      expect(alunoA).not.toBe(alunoB);
      expect(alunoA).toMatch(/^tok:/);
    });

    it('mantem o mesmo balde para o mesmo token vindo de IPs diferentes', async () => {
      const g = guard();
      const a = await g.getTracker(
        req({ 'cf-connecting-ip': '189.4.5.6', authorization: bearer('zzz') }),
      );
      const b = await g.getTracker(
        req({ 'cf-connecting-ip': '200.1.2.3', authorization: bearer('zzz') }),
      );

      expect(a).toBe(b);
    });

    it('nao expoe material do token na chave', async () => {
      const tracker = await guard().getTracker(
        req({ authorization: bearer('assinatura-secreta') }),
      );

      expect(tracker).not.toContain('assinatura-secreta');
      expect(tracker).toMatch(/^tok:[0-9a-f]{32}$/);
    });

    it('trata token malformado como anonimo', async () => {
      // Sem as tres partes nao ha assinatura em que se apoiar; melhor cair no
      // limite por IP do que inventar um balde novo a cada requisicao torta.
      const g = guard();

      expect(await g.getTracker(req({ authorization: 'Bearer solto' }, '1.2.3.4'))).toBe(
        'ip:1.2.3.4',
      );
      expect(await g.getTracker(req({ authorization: 'Basic abc' }, '1.2.3.4'))).toBe('ip:1.2.3.4');
    });
  });
});
