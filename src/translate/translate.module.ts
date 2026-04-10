import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TranscriptionService } from './translate.service';
import { TranscriptionController } from './translate.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Transcription, TranscriptionSchema } from './schema/transcription.schema';
import { TranscriptionRepository } from './transcription.repository';
import { RecaptchaService } from '../common/recaptcha.service';
import { ProgressGateway } from 'src/gateways/progress.gateway';
import { CacheService } from 'src/common/cache.service';
import { AbuseProtectionService } from '../common/abuse-protection.service';
import { SupadataService } from 'src/common/supadata.service';
import { TranscriptionEventsHandler } from './events/transcription-events.handler';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
    imports: [
        BullModule.registerQueue(
            { name: 'transcription' },
        ),
        MongooseModule.forFeature([
            { name: Transcription.name, schema: TranscriptionSchema },
        ]),
        EventEmitterModule.forRoot(),
    ],
    controllers: [TranscriptionController],
    providers: [
        TranscriptionService,
        RecaptchaService,
        AbuseProtectionService,
        TranscriptionRepository,
        ProgressGateway,
        CacheService,
        SupadataService,
        TranscriptionEventsHandler,
    ],
    exports: [TranscriptionService],
})
export class TranslateModule { }
