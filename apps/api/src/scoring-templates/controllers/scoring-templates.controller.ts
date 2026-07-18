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
import { ScoringTemplatesService } from '../services/scoring-templates.service';
import { CreateScoringTemplateDto } from '../dto/create-scoring-template.dto';
import { UpdateScoringTemplateDto } from '../dto/update-scoring-template.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

@Controller('scoring-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
export class ScoringTemplatesController {
  constructor(
    private readonly scoringTemplatesService: ScoringTemplatesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateScoringTemplateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringTemplatesService.create(dto, req.user.userId);
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.scoringTemplatesService.findAllForUser(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.scoringTemplatesService.findOneForUser(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateScoringTemplateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scoringTemplatesService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.scoringTemplatesService.remove(id, req.user.userId);
  }
}
