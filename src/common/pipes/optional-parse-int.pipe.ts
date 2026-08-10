import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Converte um query param opcional em inteiro. Retorna `undefined` quando o
 * parametro esta ausente/vazio (sem lancar erro) e valida quando presente.
 *
 * Cuidado importante: o ValidationPipe global (`transform: true`) transforma um
 * query param numerico AUSENTE em `NaN` antes deste pipe rodar. Por isso NaN e
 * tratado como "ausente" (retorna undefined) — do contrario os dropdowns
 * encadeados do cadastro quebrariam ao listar sem filtro.
 */
@Injectable()
export class OptionalParseIntPipe implements PipeTransform<unknown, number | undefined> {
  transform(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      // Param ausente convertido em NaN pelo ValidationPipe -> trata como ausente.
      return undefined;
    }
    if (!Number.isInteger(parsed)) {
      throw new BadRequestException('O parametro deve ser um numero inteiro.');
    }
    return parsed;
  }
}
