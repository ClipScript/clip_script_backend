import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';



@Injectable()
export class RedisService {
    private client: Redis;

    constructor() {
        this.client = process.env.REDIS_URL
            ? new Redis(process.env.REDIS_URL)
            : new Redis({
                host: 'localhost',
                port: 6379,
            });
    }

    async set(key: string, value: string) {
        await this.client.set(key, value, 'EX', 60 * 60); // expire in 1 hour
    }

    async get(key: string) {
        return this.client.get(key);
    }

    async del(key: string) {
        return this.client.del(key);
    }
}