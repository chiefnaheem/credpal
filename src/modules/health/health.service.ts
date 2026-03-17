import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  async check() {
    const checks: Record<string, { status: string; latency?: number }> = {};

    checks.database = await this.checkDatabase();
    checks.redis = await this.checkRedis();

    const allHealthy = Object.values(checks).every((c) => c.status === 'up');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async checkDatabase(): Promise<{ status: string; latency: number }> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up', latency: Date.now() - start };
    } catch {
      return { status: 'down', latency: Date.now() - start };
    }
  }

  private async checkRedis(): Promise<{ status: string; latency: number }> {
    const start = Date.now();
    try {
      await this.redisService.set('health:ping', 'pong', 10);
      const val = await this.redisService.get('health:ping');
      return { status: val === 'pong' ? 'up' : 'down', latency: Date.now() - start };
    } catch {
      return { status: 'down', latency: Date.now() - start };
    }
  }
}
