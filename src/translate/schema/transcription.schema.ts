import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type Utterance = {
    text: string;
    start: number;
    end: number;
};

@Schema({ timestamps: true })
export class Transcription extends Document {
    @Prop({ required: true })
    transcript: string;

    @Prop({ required: true, index: true })
    ip: string;

    @Prop({ required: true, index: true })
    jobId: string;

    @Prop({ required: true, index: true })
    platform: string;

    @Prop({ required: true })
    videoUrl: string;

    @Prop({
        type: [
            {
                text: { type: String, required: true },
                start: { type: Number, required: true },
                end: { type: Number, required: true },
            }
        ],
        required: true,
        default: [],
    })
    utterances: Utterance[];
}

export const TranscriptionSchema = SchemaFactory.createForClass(Transcription);
