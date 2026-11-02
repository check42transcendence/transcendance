import {
  Body,
  Controller,
  Inject,
  Post,
  Get,
  HttpCode,
  Res,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AuthService } from './auth.service.js';
import type { Response } from 'express';
import { AuthSessionService } from './auth-session.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,

    @Inject(AuthSessionService)
    private readonly sessions: AuthSessionService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() input: RegisterDto) {
    return this.authService.register(input);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Res({ passthrough: true }) response: Response,
    @Body() input: LoginDto,
  ) {
    const result = await this.authService.login(input);
    await this.sessions.start(result.user.id, response);
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Res({ passthrough: true }) response: Response): Promise<void> {
    await this.sessions.clear(response);
  }

  @Get('me')
  async me(@CurrentUser() user: { sub: string }) {
    return this.authService.me(user.sub);
  }
}
