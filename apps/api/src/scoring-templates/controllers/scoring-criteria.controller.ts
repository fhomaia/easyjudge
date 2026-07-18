import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ScoringCriteriaService } from '../services/scoring-criteria.service';
import { CreateScoringCriterionDto } from '../dto/create-scoring-criterion.dto';
import { UpdateScoringCriterionDto } from '../dto/update-scoring-criterion.dto';
import { MoveScoringCriterionDto } from '../dto/move-scoring-criterion.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

@Controller('scoring-templates/:templateId/criteria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
export class ScoringCriteriaController {
  constructor(
    private readonly scoringCriteriaService: ScoringCriteriaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('templateId') templateId: string,
    @Body() dto: CreateScoringCriterionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringCriteriaService.create(templateId, dto, req.user.userId);
  }

  @Get()
  findAll(
    @Param('templateId') templateId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringCriteriaService.findAllForTemplate(
      templateId,
      req.user.userId,
    );
  }

  @Patch(':id')
  update(
    @Param('templateId') templateId: string,
    @Param('id') id: string,
    @Body() dto: UpdateScoringCriterionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringCriteriaService.update(
      templateId,
      id,
      dto,
      req.user.userId,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('templateId') templateId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringCriteriaService.remove(templateId, id, req.user.userId);
  }

  @Post(':id/move')
  move(
    @Param('templateId') templateId: string,
    @Param('id') id: string,
    @Body() dto: MoveScoringCriterionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringCriteriaService.move(
      templateId,
      id,
      dto,
      req.user.userId,
    );
  }
}
