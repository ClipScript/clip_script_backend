import { Module } from '@nestjs/common';
import { DownloaderController } from './downloader.controller';
import { DownloaderService } from './downloader.service';
import { RecaptchaService } from 'src/common/recaptcha.service';
import { BullModule } from '@nestjs/bull';
import { VideoProcessor } from 'src/queue/video.processor';
import { ProgressGateway } from 'src/gateways/progress.gateway';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'video-download' },
    ),
  ],
  controllers: [DownloaderController],
  providers: [DownloaderService, RecaptchaService, VideoProcessor, ProgressGateway],
  exports: [DownloaderService],
})
export class DownloaderModule { }
