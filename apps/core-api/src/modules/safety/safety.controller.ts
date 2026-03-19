import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { SafetyGuardService } from './safety-guard.service';

@Controller('api/safety')
export class SafetyController {
    constructor(private readonly safetyGuard: SafetyGuardService) {}

    /** Called by voice orchestrator to check an utterance in real-time */
    @Post('check')
    @Public()
    async checkSafety(@Body() body: { text: string; businessId: string }) {
        return this.safetyGuard.checkSafety(body.text, body.businessId);
    }

    /** Quick emergency-only check (hot path, no DB hit) */
    @Post('quick-emergency-check')
    @Public()
    quickEmergencyCheck(@Body() body: { text: string }) {
        return this.safetyGuard.quickEmergencyCheck(body.text);
    }

    /** Returns system emergency keywords (displayed in settings UI) */
    @Get('keywords/emergency')
    getSystemEmergencyKeywords() {
        return { keywords: this.safetyGuard.getSystemEmergencyKeywords() };
    }

    /** Returns default out-of-scope keywords */
    @Get('keywords/out-of-scope')
    getDefaultOutOfScopeKeywords() {
        return { keywords: this.safetyGuard.getDefaultOutOfScopeKeywords() };
    }

    /** Returns merged keyword config for a business */
    @Get('businesses/:businessId/keywords')
    async getBusinessKeywords(@Param('businessId') businessId: string) {
        const systemEmergency = this.safetyGuard.getSystemEmergencyKeywords();
        const defaultOutOfScope = this.safetyGuard.getDefaultOutOfScopeKeywords();
        return {
            systemEmergency,
            defaultOutOfScope,
            note: 'Custom keywords are configurable in Business Settings.',
        };
    }
}
