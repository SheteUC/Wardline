import {
    Controller, Get, Post, Patch, Param, Query, Body,
    HttpCode, HttpStatus, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { CallsService } from './calls.service';
import { CreateCallDto, UpdateCallDto, SaveTranscriptDto, CreateHandoffDto } from './dto/calls.dto';

@Controller('api')
export class CallsController {
    constructor(private readonly callsService: CallsService) {}

    // -------------------------------------------------------------------------
    // Call Logs (dashboard)
    // -------------------------------------------------------------------------

    @Get('businesses/:businessId/call-logs')
    findAll(@Param('businessId') businessId: string, @Query() filters: any) {
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
    findOne(@Param('id') id: string) {
        return this.callsService.findOne(id);
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

    @Patch('voicemails/:id/mark-listened')
    markVoicemailListened(@Param('id') id: string) {
        return this.callsService.markVoicemailListened(id);
    }

    // -------------------------------------------------------------------------
    // Voice orchestrator endpoints (public — called by Pipecat)
    // -------------------------------------------------------------------------

    @Get('calls')
    @Public()
    async getCalls(@Query('twilioCallSid') twilioCallSid?: string) {
        if (twilioCallSid) return this.callsService.findByTwilioSid(twilioCallSid);
        return { data: [], message: 'Provide twilioCallSid query parameter' };
    }

    @Post('calls')
    @Public()
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
    @HttpCode(HttpStatus.CREATED)
    async saveTranscript(@Param('id') id: string, @Body() dto: SaveTranscriptDto) {
        try {
            const segments = dto.segments.map(seg => ({
                speaker: seg.speaker,
                text: seg.text,
                timestamp: new Date(seg.timestamp),
                confidence: seg.confidence,
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
    @HttpCode(HttpStatus.CREATED)
    async createVoicemail(
        @Param('id') callId: string,
        @Body() body: {
            businessId: string;
            callerPhone: string;
            callerName?: string;
            recordingUrl: string;
            transcription?: string;
            context: string;
        },
    ) {
        return this.callsService.createVoicemail({ callId, ...body });
    }

    @Post('handoffs')
    @Public()
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
