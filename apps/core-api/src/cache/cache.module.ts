import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Global cache module - available throughout the application
 * without needing to import it in each module.
 */
@Global()
@Module({
    providers: [CacheService],
    exports: [CacheService],
})
export class CacheModule {}

