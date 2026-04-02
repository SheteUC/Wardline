import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';

@Controller()
export class HealthController {
    @Get('health')
    @Public()
    checkHealth() {
        return {
            status: 'healthy',
            service: 'core-api',
            timestamp: new Date().toISOString(),
        };
    }
}
