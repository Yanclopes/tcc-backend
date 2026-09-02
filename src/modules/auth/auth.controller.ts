import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentUser, JwtUser } from './current-user.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Rate limit mais apertado que o global para dificultar brute force e cadastro
  // em massa. Override do bucket 'default' apenas nestes endpoints.
  //
  // Login e cadastro sao anonimos: nao ha token, entao o balde e por IP (ver
  // CloudflareThrottlerGuard). E um limite COLETIVO sempre que varios usuarios
  // saem pelo mesmo IP publico — o caso de um laboratorio de escola atras de
  // NAT. Por isso 20/min, e nao 5: com 5, uma turma de 50 alunos entrando junto
  // no inicio da aula recebia 429 em massa, e o sistema parecia fora do ar.
  // Contra brute force 20/min continua restritivo; a defesa de volume propria
  // fica na Cloudflare, na frente.
  @Post('register')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cria uma conta e retorna o token de acesso' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica com e-mail e senha' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Dados basicos do token autenticado' })
  profile(@CurrentUser() user: JwtUser): JwtUser {
    return user;
  }
}
