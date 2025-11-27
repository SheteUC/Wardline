import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { MarketingEventsService } from './marketing-events.service';
import {
    CreateMarketingEventDto,
    UpdateMarketingEventDto,
    CreateEventRegistrationDto,
    UpdateEventRegistrationDto,
    UpdateAttendanceDto,
    TrackConversionDto,
    MarketingEventResponseDto,
    EventRegistrationResponseDto,
    EventType,
    EventStatus,
    RegistrationStatus,
} from './dto/marketing-event.dto';
import { Permissions } from '../../auth/permissions.decorator';
import { Auditable } from '../../audit/auditable.decorator';
import { UserRole } from '@wardline/types';

@ApiTags('marketing-events')
@ApiBearerAuth()
@Controller('marketing-events')
export class MarketingEventsController {
    constructor(private readonly marketingEventsService: MarketingEventsService) { }

    // Marketing Event endpoints
    @Post()
    @ApiOperation({ summary: 'Create a marketing event' })
    @ApiResponse({ status: 201, description: 'Marketing event created', type: MarketingEventResponseDto })
    @Permissions(UserRole.ADMIN)
    @Auditable('marketing_event', 'CREATE')
    createEvent(@Body() createDto: CreateMarketingEventDto) {
        return this.marketingEventsService.createEvent(createDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all marketing events' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'eventType', required: false, enum: EventType })
    @ApiQuery({ name: 'status', required: false, enum: EventStatus })
    @ApiQuery({ name: 'specialty', required: false })
    @ApiQuery({ name: 'upcoming', required: false, type: Boolean })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'offset', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'List of marketing events', type: [MarketingEventResponseDto] })
    @Permissions(UserRole.READONLY)
    findAllEvents(
        @Query('hospitalId') hospitalId: string,
        @Query('eventType') eventType?: EventType,
        @Query('status') status?: EventStatus,
        @Query('specialty') specialty?: string,
        @Query('upcoming', new ParseBoolPipe({ optional: true })) upcoming?: boolean,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.marketingEventsService.findAllEvents(hospitalId, {
            eventType,
            status,
            specialty,
            upcoming,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }

    @Get('analytics')
    @ApiOperation({ summary: 'Get marketing event analytics and ROI metrics' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    @ApiResponse({ status: 200, description: 'Marketing analytics' })
    @Permissions(UserRole.SUPERVISOR)
    getAnalytics(
        @Query('hospitalId') hospitalId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.marketingEventsService.getEventAnalytics(
            hospitalId,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
        );
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get marketing event by ID' })
    @ApiResponse({ status: 200, description: 'Marketing event found', type: MarketingEventResponseDto })
    @ApiResponse({ status: 404, description: 'Marketing event not found' })
    @Permissions(UserRole.READONLY)
    findEvent(@Param('id') id: string) {
        return this.marketingEventsService.findEventById(id);
    }

    @Get(':id/roi')
    @ApiOperation({ summary: 'Get ROI metrics for a specific event' })
    @ApiResponse({ status: 200, description: 'Event ROI metrics' })
    @ApiResponse({ status: 404, description: 'Marketing event not found' })
    @Permissions(UserRole.SUPERVISOR)
    getEventROI(@Param('id') id: string) {
        return this.marketingEventsService.getEventROI(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update marketing event' })
    @ApiResponse({ status: 200, description: 'Marketing event updated', type: MarketingEventResponseDto })
    @ApiResponse({ status: 404, description: 'Marketing event not found' })
    @Permissions(UserRole.ADMIN)
    @Auditable('marketing_event', 'UPDATE')
    updateEvent(@Param('id') id: string, @Body() updateDto: UpdateMarketingEventDto) {
        return this.marketingEventsService.updateEvent(id, updateDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Cancel marketing event' })
    @ApiResponse({ status: 200, description: 'Marketing event cancelled' })
    @ApiResponse({ status: 400, description: 'Cannot cancel event' })
    @ApiResponse({ status: 404, description: 'Marketing event not found' })
    @Permissions(UserRole.ADMIN)
    @Auditable('marketing_event', 'CANCEL')
    cancelEvent(@Param('id') id: string) {
        return this.marketingEventsService.cancelEvent(id);
    }

    // Event Registration endpoints
    @Post(':id/register')
    @ApiOperation({ summary: 'Register an attendee for an event' })
    @ApiResponse({ status: 201, description: 'Registration created', type: EventRegistrationResponseDto })
    @ApiResponse({ status: 400, description: 'Registration deadline passed or event full' })
    @ApiResponse({ status: 404, description: 'Marketing event not found' })
    @Permissions(UserRole.AGENT)
    @Auditable('event_registration', 'CREATE')
    registerAttendee(
        @Param('id') eventId: string,
        @Body() createDto: Omit<CreateEventRegistrationDto, 'eventId'>,
    ) {
        return this.marketingEventsService.registerAttendee({ ...createDto, eventId });
    }

    @Get(':id/registrations')
    @ApiOperation({ summary: 'Get all registrations for an event' })
    @ApiQuery({ name: 'status', required: false, enum: RegistrationStatus })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'offset', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'List of registrations', type: [EventRegistrationResponseDto] })
    @Permissions(UserRole.READONLY)
    findRegistrations(
        @Param('id') eventId: string,
        @Query('status') status?: RegistrationStatus,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.marketingEventsService.findEventRegistrations(eventId, {
            status,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }

    @Patch('registrations/:id')
    @ApiOperation({ summary: 'Update an event registration' })
    @ApiResponse({ status: 200, description: 'Registration updated', type: EventRegistrationResponseDto })
    @Permissions(UserRole.AGENT)
    @Auditable('event_registration', 'UPDATE')
    updateRegistration(
        @Param('id') id: string,
        @Body() updateDto: UpdateEventRegistrationDto,
    ) {
        return this.marketingEventsService.updateRegistration(id, updateDto);
    }

    @Patch('registrations/:id/attendance')
    @ApiOperation({ summary: 'Mark attendance for a registration' })
    @ApiResponse({ status: 200, description: 'Attendance marked', type: EventRegistrationResponseDto })
    @Permissions(UserRole.AGENT)
    @Auditable('event_registration', 'MARK_ATTENDANCE')
    markAttendance(
        @Param('id') id: string,
        @Body() attendanceDto: UpdateAttendanceDto,
    ) {
        return this.marketingEventsService.markAttendance(id, attendanceDto);
    }

    @Patch('registrations/:id/conversion')
    @ApiOperation({ summary: 'Track if attendee became a patient (conversion tracking)' })
    @ApiResponse({ status: 200, description: 'Conversion tracked', type: EventRegistrationResponseDto })
    @Permissions(UserRole.SUPERVISOR)
    @Auditable('event_registration', 'TRACK_CONVERSION')
    trackConversion(
        @Param('id') id: string,
        @Body() conversionDto: TrackConversionDto,
    ) {
        return this.marketingEventsService.trackConversion(id, conversionDto);
    }
}

