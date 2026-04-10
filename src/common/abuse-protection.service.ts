import { Injectable } from '@nestjs/common';
import { RateLimiterMemory } from 'rate-limiter-flexible';

@Injectable()
export class AbuseProtectionService {
    private limiter = new RateLimiterMemory({
        points: 20, // 20 requests
        duration: 600, // per 60 seconds by IP
    });

    async check(ip: string): Promise<{ requireCaptcha: boolean }> {
        try {
            await this.limiter.consume(ip);
            return { requireCaptcha: false };
        } catch {
            // Too many requests
            return { requireCaptcha: true };
        }
    }

    async reset(ip: string) {
        await this.limiter.delete(ip);
    }
}
