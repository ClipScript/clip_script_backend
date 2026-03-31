import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const frontendUrl = process.env.FRONTEND_URL || 'https://tiktok-transcribe-frontend.vercel.app';
  const devUrl = 'http://localhost:3000';
  const subDomain = "https://useclipscript.com"
  app.enableCors({
    origin: [frontendUrl, devUrl, subDomain],
    credentials: true,
  });
  // Set up the Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Server is running on port ${port}`);
}
bootstrap();
