import { ApiProperty } from '@nestjs/swagger';

/**
 * Payload retornado por GET /users/me/export — atende ao direito de
 * portabilidade previsto na LGPD (art. 18, V). Contem TODO o dado pessoal
 * armazenado sobre o titular, em formato legivel por maquina (JSON).
 */
export class UserDataExportDto {
  @ApiProperty({ example: '2026-08-13T10:00:00.000Z' })
  exportedAt: string;

  @ApiProperty({
    example: 'Este arquivo contem todos os dados pessoais que a plataforma armazena sobre voce.',
  })
  disclaimer: string;

  @ApiProperty()
  profile: {
    id: number;
    name: string;
    email: string;
    role: string | null;
    school: { id: number; name: string } | null;
    educationLevel: { id: number; name: string } | null;
    createdAt: string;
  };

  @ApiProperty()
  consents: Array<{
    consentVersion: string;
    grantedAt: string;
  }>;

  @ApiProperty()
  games: Array<{
    id: string;
    difficultyId: string | null;
    status: string | null;
    score: number;
    streak: number;
    createdAt: string;
    finishedAt: string | null;
    answers: Array<{
      questionId: number;
      goalNumber: number | null;
      chosenOptionId: number | null;
      isCorrect: boolean;
      responseTimeMs: number | null;
      sequence: number;
      powerupUsed: string | null;
      answeredAt: string;
    }>;
  }>;

  @ApiProperty()
  rankings: Array<{
    id: number;
    gameId: string;
    score: number;
    completedAt: string;
  }>;

  @ApiProperty()
  schoolSuggestions: Array<{
    id: number;
    name: string;
    status: string;
    createdAt: string;
    resolvedAt: string | null;
  }>;
}
