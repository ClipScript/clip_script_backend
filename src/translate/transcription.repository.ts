import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transcription } from './schema/transcription.schema';

@Injectable()
export class TranscriptionRepository {
    constructor(
        @InjectModel(Transcription.name) private transcriptionModel: Model<Transcription>,
    ) { }

    async create(transcript: string, ip: string, jobId: string) {
        return this.transcriptionModel.create({ transcript, ip, jobId });
    }

    async findByJobId(id: string) {
        return this.transcriptionModel.findById(id);
    }

    async findByIp(ip: string) {
        return this.transcriptionModel.find({ ip }).sort({ createdAt: -1 }).limit(10);
    }
}
