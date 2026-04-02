import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './auth/public.decorator';

@Controller()
export class HealthController {
    @Get('health')
    @Public()
    @SkipThrottle()
    checkHealth() {
        return {
            status: 'healthy',
            service: 'core-api',
            timestamp: new Date().toISOString(),
        };
    }
}
