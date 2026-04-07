import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TranscriptionService } from './translate.service';
import { TranscriptionController } from './translate.controller';
import { TranscribeProcessor } from 'src/queue/transcription.processor';
import { MongooseModule } from '@nestjs/mongoose';
import { Transcription, TranscriptionSchema } from './schema/transcription.schema';
import { TranscriptionRepository } from './transcription.repository';
import { RecaptchaService } from '../common/recaptcha.service';
import { ProgressGateway } from 'src/gateways/progress.gateway';
import { CacheService } from 'src/common/cache.service';

@Module({
    imports: [
        BullModule.registerQueue(
            { name: 'transcription' },
        ),
        MongooseModule.forFeature([
            { name: Transcription.name, schema: TranscriptionSchema },
        ]),
    ],
    controllers: [TranscriptionController],
    providers: [TranscriptionService, TranscribeProcessor, TranscriptionRepository, RecaptchaService, ProgressGateway, CacheService],
})
export class TranslateModule { }
