import {
    Controller, Get, Post, Patch, Param, Query, Body,
    HttpCode, HttpStatus, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/public.decorator';
import { InternalApi } from '../../auth/internal-api.decorator';
import { CallsService } from './calls.service';
import {
    BootstrapVoiceSessionDto,
    CallIngestDto,
    CallLogsQueryDto,
    CreateCallDto,
    CreateVoicemailDto,
    UpdateCallDto,
    SaveTranscriptDto,
    CreateHandoffDto,
} from './dto/calls.dto';

@Controller('api')
export class CallsController {
    constructor(private readonly callsService: CallsService) {}

    // -------------------------------------------------------------------------
    // Call Logs (dashboard)
    // -------------------------------------------------------------------------

    @Get('businesses/:businessId/call-logs')
    findAll(@Param('businessId') businessId: string, @Query() filters: CallLogsQueryDto) {
        return this.callsService.findAllByBusiness(businessId, filters);
    }

    @Get('businesses/:businessId/call-logs/analytics')
    getAnalytics(
        @Param('businessId') businessId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.callsService.getAnalytics(
            businessId,
            startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate ? new Date(endDate) : new Date(),
        );
    }

    @Get('businesses/:businessId/call-logs/:id')
    findOne(
        @Param('businessId') businessId: string,
        @Param('id') id: string,
    ) {
        return this.callsService.findOne(id, businessId);
    }

    // -------------------------------------------------------------------------
    // Voicemail records
    // -------------------------------------------------------------------------

    @Get('businesses/:businessId/voicemails')
    getVoicemails(
        @Param('businessId') businessId: string,
        @Query('unlistenedOnly') unlistenedOnly?: string,
    ) {
        return this.callsService.getVoicemails(businessId, unlistenedOnly === 'true');
    }

    @Patch('businesses/:businessId/voicemails/:id/mark-listened')
    markVoicemailListened(
        @Param('businessId') businessId: string,
        @Param('id') id: string,
    ) {
        return this.callsService.markVoicemailListened(id, businessId);
    }

    // -------------------------------------------------------------------------
    // Voice runtime endpoints (public — called by voice-runtime-v2)
    // -------------------------------------------------------------------------

    @Get('calls')
    @Public()
    @InternalApi()
    async getCalls(@Query('twilioCallSid') twilioCallSid?: string) {
        if (twilioCallSid) return this.callsService.findByTwilioSid(twilioCallSid);
        return { data: [], message: 'Provide twilioCallSid query parameter' };
    }

    @Post('internal/voice/bootstrap')
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 60, ttl: 60_000 } })
    @HttpCode(HttpStatus.CREATED)
    async bootstrapVoice(@Body() dto: BootstrapVoiceSessionDto) {
        try {
            return await this.callsService.bootstrapVoiceSession(dto);
        } catch (err: unknown) {
            const error = err as Error;
            if (error.message?.includes('Phone number not found')) {
                throw new BadRequestException(error.message);
            }
            throw err;
        }
    }

    @Post('internal/calls/:id/ingest')
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 300, ttl: 60_000 } })
    @HttpCode(HttpStatus.CREATED)
    async ingestCall(@Param('id') id: string, @Body() dto: CallIngestDto) {
        try {
            return await this.callsService.ingestCall(id, {
                sessionId: dto.sessionId,
                events: dto.events?.map((event) => ({ ...event })),
                transcriptSegments: dto.transcriptSegments?.map((segment) => ({ ...segment })),
                statePatch: dto.statePatch ? { ...dto.statePatch } : undefined,
            });
        } catch (err: unknown) {
            const error = err as Error;
            if (error.message?.includes('Call not found')) {
                throw new NotFoundException(error.message);
            }
            throw err;
        }
    }

    @Get('internal/voice/caller-context')
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 120, ttl: 60_000 } })
    async getCallerContext(
        @Query('businessId') businessId: string,
        @Query('callerPhone') callerPhone: string,
    ) {
        if (!businessId || !callerPhone) {
            throw new BadRequestException('businessId and callerPhone are required');
        }
        return this.callsService.getCallerContext(businessId, callerPhone);
    }

    @Get('internal/calls/cutover-health')
    async getCutoverHealthSummary() {
        return this.callsService.getCutoverHealthSummary();
    }

    @Post('calls')
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 120, ttl: 60_000 } })
    @HttpCode(HttpStatus.CREATED)
    async createCall(@Body() dto: CreateCallDto) {
        try {
            return await this.callsService.create(dto);
        } catch (err: unknown) {
            const error = err as Error;
            if (error.message?.includes('Phone number not found')) {
                throw new BadRequestException(error.message);
            }
            throw err;
        }
    }

    @Patch('calls/:id')
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 300, ttl: 60_000 } })
    async updateCall(@Param('id') id: string, @Body() dto: UpdateCallDto) {
        try {
            return await this.callsService.update(id, dto);
        } catch (err: unknown) {
            const error = err as Error & { code?: string };
            if (error.code === 'P2025') throw new NotFoundException(`Call not found: ${id}`);
            throw err;
        }
    }

    @Post('calls/:id/transcript')
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 400, ttl: 60_000 } })
    @HttpCode(HttpStatus.CREATED)
    async saveTranscript(@Param('id') id: string, @Body() dto: SaveTranscriptDto) {
        try {
            const segments = dto.segments.map(seg => ({
                speaker: seg.speaker,
                text: seg.text,
                timestamp: new Date(seg.timestamp),
                confidence: seg.confidence,
                startTimeMs: seg.startTimeMs,
                endTimeMs: seg.endTimeMs,
            }));
            return await this.callsService.saveTranscript(id, segments);
        } catch (err: unknown) {
            const error = err as Error;
            if (error.message?.includes('Call not found')) throw new NotFoundException(error.message);
            throw err;
        }
    }

    /** Create a voicemail record when no human is available */
    @Post('calls/:id/voicemail')
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 60, ttl: 60_000 } })
    @HttpCode(HttpStatus.CREATED)
    async createVoicemail(@Param('id') callId: string, @Body() body: CreateVoicemailDto) {
        return this.callsService.createVoicemail({ callId, ...body });
    }

    @Post('handoffs')
    @Public()
    @InternalApi()
    @Throttle({ global: { limit: 60, ttl: 60_000 } })
    @HttpCode(HttpStatus.CREATED)
    async createHandoff(@Body() dto: CreateHandoffDto) {
        try {
            return await this.callsService.createHandoff(dto);
        } catch (err: unknown) {
            const error = err as Error & { code?: string };
            if (error.code === 'P2025') throw new NotFoundException(`Call not found: ${dto.callId}`);
            throw err;
        }
    }
}
