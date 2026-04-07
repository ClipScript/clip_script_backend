import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TranslateModule } from './translate/translate.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { MongooseModule } from '@nestjs/mongoose';
import { DownloaderModule } from './downloader/downloader.module';
import { CacheService } from './common/cache.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      ttl: 60, // fallback to 'ttl' for backward compatibility
      limit: 10, // 10 requests per minute per IP
    } as any), // cast to any to bypass type error for now
    BullModule.forRoot({
      // Redis config: use REDIS_URL if available, else fallback to localhost
      redis: process.env.REDIS_URL
        ? process.env.REDIS_URL
        : { host: 'localhost', port: 6379 },
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || ''),
    TranslateModule,
    DownloaderModule,
  ],
  controllers: [AppController],
  providers: [AppService, CacheService],
  exports: [CacheService],
})
export class AppModule { }
