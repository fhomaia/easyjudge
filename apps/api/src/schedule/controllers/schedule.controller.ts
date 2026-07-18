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
  UseGuards,
} from '@nestjs/common';
import { ScheduleService } from '../services/schedule.service';
import { UpdateScheduleDayDto } from '../dto/update-schedule-day.dto';
import { CreateScheduleResourceDto } from '../dto/create-schedule-resource.dto';
import { UpdateScheduleResourceDto } from '../dto/update-schedule-resource.dto';
import { MoveScheduleResourceDto } from '../dto/move-schedule-resource.dto';
import { CreateScheduleEntryDto } from '../dto/create-schedule-entry.dto';
import { MoveScheduleEntryDto } from '../dto/move-schedule-entry.dto';
import { AutoGenerateScheduleDto } from '../dto/auto-generate-schedule.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('events/:eventId/schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.JUDGE, UserRole.ORGANIZATION)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('days')
  getDays(@Param('eventId') eventId: string) {
    return this.scheduleService.getDays(eventId);
  }

  @Post('days')
  addDay(@Param('eventId') eventId: string) {
    return this.scheduleService.addDay(eventId);
  }

  @Patch('days/:dayId')
  updateDay(
    @Param('eventId') eventId: string,
    @Param('dayId') dayId: string,
    @Body() dto: UpdateScheduleDayDto,
  ) {
    return this.scheduleService.updateDay(eventId, dayId, dto);
  }

  @Delete('days/:dayId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDay(@Param('eventId') eventId: string, @Param('dayId') dayId: string) {
    return this.scheduleService.removeDay(eventId, dayId);
  }

  @Get('days/:dayId/unscheduled')
  getUnscheduled(
    @Param('eventId') eventId: string,
    @Param('dayId') dayId: string,
  ) {
    return this.scheduleService.getUnscheduled(eventId, dayId);
  }

  @Post('days/:dayId/resources')
  createResource(
    @Param('eventId') eventId: string,
    @Param('dayId') dayId: string,
    @Body() dto: CreateScheduleResourceDto,
  ) {
    return this.scheduleService.createResource(eventId, dayId, dto);
  }

  @Patch('days/:dayId/resources/:resourceId')
  updateResource(
    @Param('eventId') eventId: string,
    @Param('dayId') dayId: string,
    @Param('resourceId') resourceId: string,
    @Body() dto: UpdateScheduleResourceDto,
  ) {
    return this.scheduleService.updateResource(eventId, dayId, resourceId, dto);
  }

  @Delete('days/:dayId/resources/:resourceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeResource(
    @Param('eventId') eventId: string,
    @Param('dayId') dayId: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.scheduleService.removeResource(eventId, dayId, resourceId);
  }

  @Patch('days/:dayId/resources/:resourceId/move')
  moveResource(
    @Param('eventId') eventId: string,
    @Param('dayId') dayId: string,
    @Param('resourceId') resourceId: string,
    @Body() dto: MoveScheduleResourceDto,
  ) {
    return this.scheduleService.moveResource(eventId, dayId, resourceId, dto);
  }

  @Post('days/:dayId/entries')
  createEntry(
    @Param('eventId') eventId: string,
    @Param('dayId') dayId: string,
    @Body() dto: CreateScheduleEntryDto,
  ) {
    return this.scheduleService.createEntry(eventId, dayId, dto);
  }

  @Patch('days/:dayId/entries/:entryId/move')
  moveEntry(
    @Param('eventId') eventId: string,
    @Param('dayId') dayId: string,
    @Param('entryId') entryId: string,
    @Body() dto: MoveScheduleEntryDto,
  ) {
    return this.scheduleService.moveEntry(eventId, dayId, entryId, dto);
  }

  @Delete('days/:dayId/entries/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEntry(
    @Param('eventId') eventId: string,
    @Param('dayId') dayId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.scheduleService.removeEntry(eventId, dayId, entryId);
  }

  @Post('days/:dayId/auto-generate')
  autoGenerate(
    @Param('eventId') eventId: string,
    @Param('dayId') dayId: string,
    @Body() dto: AutoGenerateScheduleDto,
  ) {
    return this.scheduleService.autoGenerate(eventId, dayId, dto);
  }

  @Post('days/:dayId/replicate')
  replicateToAllDays(
    @Param('eventId') eventId: string,
    @Param('dayId') dayId: string,
  ) {
    return this.scheduleService.replicateToAllDays(eventId, dayId);
  }
}
