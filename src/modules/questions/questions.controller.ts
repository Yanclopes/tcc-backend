import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OptionalParseIntPipe } from '../../common/pipes/optional-parse-int.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRole } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateQuestionDto } from './dto/create-question.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { Question } from './entities/question.entity';
import { QuestionsService } from './questions.service';

/**
 * Manutencao de perguntas — area administrativa. Todo o controller exige papel
 * admin: as respostas devolvidas incluem a alternativa correta (`answer`), que
 * NAO pode vazar para os jogadores. O jogo usa endpoints proprios (games/*).
 */
@ApiTags('questions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma pergunta com suas 4 alternativas (somente admin)' })
  create(@Body() dto: CreateQuestionDto): Promise<Question> {
    return this.questionsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista perguntas para manutencao (somente admin)' })
  @ApiQuery({ name: 'goalNumber', required: false, type: Number })
  findAll(
    @Query('goalNumber', OptionalParseIntPipe) goalNumber?: number,
  ): Promise<Question[]> {
    return this.questionsService.findAll(goalNumber);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna uma pergunta por id (somente admin)' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Question> {
    return this.questionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma pergunta (somente admin)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuestionDto,
  ): Promise<Question> {
    return this.questionsService.update(id, dto);
  }

  @Patch(':id/active')
  @ApiOperation({ summary: 'Ativa ou desativa a pergunta no jogo (somente admin)' })
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetActiveDto,
  ): Promise<Question> {
    return this.questionsService.setActive(id, dto.isActive);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a pergunta se nao houver respostas (somente admin)' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.questionsService.remove(id);
  }
}
