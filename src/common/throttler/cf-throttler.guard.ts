import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Guard de rate limit que identifica o cliente real por tras da Cloudflare.
 *
 * O `getTracker` padrao do @nestjs/throttler devolve `req.ip`. Como a aplicacao
 * fica atras da Cloudflare, `req.ip` e o IP de BORDA dela — nao o do usuario. O
 * efeito pratico e que todos os usuarios roteados pela mesma borda dividem um
 * unico balde: uma turma inteira estourava o limite de login em segundos.
 *
 * A identificacao aqui tem duas faixas:
 *
 * 1. Requisicao autenticada -> a chave e a ASSINATURA do JWT, com hash.
 *    Isso da um balde por sessao, o que resolve o caso de uma escola inteira
 *    sair pelo mesmo IP publico (NAT) — situacao em que qualquer limite por IP
 *    volta a ser um limite coletivo. Usa-se a assinatura, e nao o `sub`, porque
 *    o `sub` e legivel e forjavel: bastaria variar o campo para ganhar baldes
 *    novos. Sem o segredo nao se produz assinatura valida. Nao ha verificacao
 *    criptografica neste ponto — o guard de JWT do controller ainda roda depois
 *    e devolve 401 —, aqui a assinatura serve apenas como identificador opaco.
 *
 * 2. Requisicao anonima (login, cadastro) -> a chave e o IP do usuario, lido de
 *    `CF-Connecting-IP`.
 *
 * ATENCAO a uma dependencia de ordem: `CF-Connecting-IP` so e confiavel se a
 * origem aceitar conexoes exclusivamente da Cloudflare. Enquanto a porta da
 * aplicacao estiver aberta para `0.0.0.0/0`, qualquer um forja o cabecalho e
 * escapa do limite. O security group precisa ser restringido ANTES — ver
 * `infra/modules/network/main.tf`.
 */
@Injectable()
export class CloudflareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;

    const assinatura = this.assinaturaDoToken(request);
    if (assinatura) return `tok:${assinatura}`;

    return `ip:${this.ipDoCliente(request)}`;
  }

  /**
   * Terceiro segmento do JWT (a assinatura), reduzido a um hash curto para nao
   * guardar material de token na chave do balde. Devolve null quando nao ha
   * Bearer token ou quando ele nao tem as tres partes de um JWT.
   */
  private assinaturaDoToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;

    const partes = header.slice('Bearer '.length).trim().split('.');
    if (partes.length !== 3 || !partes[2]) return null;

    return createHash('sha256').update(partes[2]).digest('hex').slice(0, 32);
  }

  /**
   * `CF-Connecting-IP` carrega sempre um unico endereco — o do cliente — e e
   * reescrito pela Cloudflare a cada requisicao, diferente de `X-Forwarded-For`,
   * que e uma lista acumulada e por isso exige saber quantos saltos confiar.
   * O fallback para `req.ip` cobre acesso direto a origem (ambiente local).
   */
  private ipDoCliente(req: Request): string {
    const cf = req.headers['cf-connecting-ip'];
    const valor = Array.isArray(cf) ? cf[0] : cf;
    return valor?.trim() || req.ip || 'desconhecido';
  }
}
