import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../auth/types/authenticated-request';
import { SupportService } from '../services/support.service';
import { ContactSupportDto } from '../dto/contact-support.dto';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('contact')
  @HttpCode(HttpStatus.NO_CONTENT)
  contact(@Body() dto: ContactSupportDto, @Req() req: AuthenticatedRequest) {
    return this.supportService.sendMessage(req.user.userId, dto.message);
  }
}
