import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TranscriptionService } from './translate.service';
import { TranscriptionController } from './translate.controller';
import { TranscriptionProcessor } from '../queue/transcription.processor';
import { MongooseModule } from '@nestjs/mongoose';
import { Transcription, TranscriptionSchema } from './schema/transcription.schema';
import { TranscriptionRepository } from './transcription.repository';
import { RecaptchaService } from '../common/recaptcha.service';

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
    providers: [TranscriptionService, TranscriptionProcessor, TranscriptionRepository, RecaptchaService],
})
export class TranslateModule { }
