import Redis from 'ioredis';
import { config } from '../config.js';

let _redis: Redis | null = null;

export function redis(): Redis {
  if (_redis) return _redis;
  _redis = new Redis(config().REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false
  });
  _redis.on('error', (err) => console.error('Redis error:', err.message));
  return _redis;
}
