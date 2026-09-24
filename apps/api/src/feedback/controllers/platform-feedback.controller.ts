import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PlatformFeedbackService } from '../services/platform-feedback.service';
import { PlatformFeedbackDto } from '../dto/feedback.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';

@Controller('feedback/platform')
@UseGuards(JwtAuthGuard)
export class PlatformFeedbackController {
  constructor(private readonly feedbackService: PlatformFeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  create(@Req() req: AuthenticatedRequest, @Body() dto: PlatformFeedbackDto) {
    return this.feedbackService.create(req.user.userId, dto);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.feedbackService.list(req.user.userId);
  }
}
