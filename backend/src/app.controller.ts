import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator.js';

@Controller('health')
export class AppController {
  @Public()
  @Get()
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
