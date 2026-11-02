import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ApiExpressAdapter } from './common/http/api-express.adapter.js';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ApiExpressAdapter());

  app.use(cookieParser());
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
