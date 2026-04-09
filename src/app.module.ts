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
import Redis from 'ioredis';
import { YoutubeCaptionsService } from './common/youtube-captions.service';
import { TikTokCaptionsService } from './common/tiktok-captions.service';
import { InstagramCaptionsService } from './common/instagram-captions.service';
import { CaptionExtractorService } from './common/caption-extractor.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      ttl: 60, // fallback to 'ttl' for backward compatibility
      limit: 10, // 10 requests per minute per IP
    } as any), // cast to any to bypass type error for now
    BullModule.forRootAsync({
      useFactory: () => ({
        createClient: () => {
          return process.env.REDIS_URL
            ? new Redis(process.env.REDIS_URL, {
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
            })
            : new Redis({ host: 'localhost', port: 6379 });
        },
      }),
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || ''),
    TranslateModule,
    DownloaderModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    CacheService,
    YoutubeCaptionsService,
    TikTokCaptionsService,
    InstagramCaptionsService,
    CaptionExtractorService,
  ],
  exports: [CacheService],
})
export class AppModule { }
