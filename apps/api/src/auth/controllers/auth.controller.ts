import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { SetPasswordDto } from '../dto/set-password.dto';
import { LoginDto } from '../dto/login.dto';
import { ImpersonateDto } from '../dto/impersonate.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Popup "criar conta" -> submete o formulário
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Tela de "digitar o código"
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  // Reenvio de código, caso o usuário não receba
  @Post('resend-code/:userId')
  @HttpCode(HttpStatus.OK)
  resendCode(@Param('userId') userId: string) {
    return this.authService.resendVerificationCode(userId);
  }

  // Tela de "definir senha" -> já retorna logado (token)
  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  setPassword(@Body() dto: SetPasswordDto) {
    return this.authService.setPassword(dto);
  }

  // Login normal, para acessos futuros
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // "Entrar como" outro usuário — restrito a uma única conta, checado
  // dentro de AuthService.impersonate a partir do JWT de quem chama
  // (não de nada que o cliente possa forjar).
  @Post('impersonate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  impersonate(@Req() req: AuthenticatedRequest, @Body() dto: ImpersonateDto) {
    return this.authService.impersonate(req.user.userId, dto);
  }
}
