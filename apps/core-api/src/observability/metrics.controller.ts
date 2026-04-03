import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { InternalApi } from '../auth/internal-api.decorator';
import { metricsRegister } from './metrics';

@Controller({ version: VERSION_NEUTRAL })
export class MetricsController {
    @Get('metrics')
    @Public()
    @InternalApi()
    @SkipThrottle()
    @Header('Content-Type', metricsRegister.contentType)
    async metrics(): Promise<string> {
        return metricsRegister.metrics();
    }
}
