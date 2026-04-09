// src/transcription/dto/create-transcription.dto.ts
import {
    IsString,
    IsNotEmpty,
    IsUrl,
    Matches,
    MaxLength,
    MinLength
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTranscriptionDto {
    @IsNotEmpty({ message: 'Video URL is required' })
    @IsString({ message: 'Video URL must be a string' })
    @IsUrl(
        {
            protocols: ['http', 'https'],
            require_protocol: true,
        },
        { message: 'Please provide a valid URL' }
    )
    @Matches(
        /^https?:\/\/(www\.)?(tiktok\.com|instagram\.com|youtube\.com|youtu\.be)\/.+/i,
        {
            message: 'URL must be from TikTok, Instagram Reels, or YouTube Shorts',
        }
    )
    @MaxLength(500, { message: 'URL is too long' })
    @Transform(({ value }) => value?.trim())
    videoUrl: string;

    @IsString({ message: 'CAPTCHA token must be a string' })
    @MinLength(10, { message: 'Invalid CAPTCHA token' })
    @MaxLength(2000, { message: 'Invalid CAPTCHA token' })
    captchaToken?: string; // Now optional, only required for suspicious users
}