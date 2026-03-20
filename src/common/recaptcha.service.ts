import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class RecaptchaService {
    constructor(private readonly configService: ConfigService) { }

    async verify(token: string): Promise<boolean> {
        const secret = this.configService.get<string>('RECAPTCHA_SECRET');
        if (!secret) throw new Error('reCAPTCHA secret not configured');
        const response = await axios.post(
            'https://www.google.com/recaptcha/api/siteverify',
            null,
            {
                params: {
                    secret,
                    response: token,
                },
            },
        );
        return response.data.success;
    }
}
