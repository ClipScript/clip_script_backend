import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type Utterance = {
    text: string;
    start: number;
    end: number;
};

export type Author = {
    username: string;
    displayName: string;
    avatarUrl: string;
};

export type Media = {
    thumbnailUrl: string;
};

export type Stats = {
    views: number;
    likes: number;
    comments: number;
    shares: number;
};

export type Metadata = {
    platform?: string;
    videoUrl?: string;
    description?: string;
    author: Author;
    media: Media;
    stats: Stats;
};

@Schema({ timestamps: true })
export class Transcription extends Document {
    @Prop({ required: true })
    transcript: string;

    @Prop({ required: true, index: true })
    ip: string;

    @Prop({
        type: {
            platform: { type: String },
            videoUrl: { type: String },
            description: { type: String },
            author: {
                username: { type: String, required: true },
                displayName: { type: String, required: true },
                avatarUrl: { type: String, required: true },
            },
            media: {
                thumbnailUrl: { type: String, required: true },
            },
            stats: {
                views: { type: Number, required: true },
                likes: { type: Number, required: true },
                comments: { type: Number, required: true },
                shares: { type: Number, required: true },
            },
        },
        required: true,
    })
    metadata: Metadata;

    @Prop({
        type: [
            {
                text: { type: String, required: true },
                start: { type: Number, required: true },
                end: { type: Number, required: true },
            }
        ],
        required: false,
        default: [],
    })
    utterances?: Utterance[];
}

export const TranscriptionSchema = SchemaFactory.createForClass(Transcription);
