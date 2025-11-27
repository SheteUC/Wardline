import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Query,
    ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import {
    CreatePrescriptionRefillDto,
    UpdatePrescriptionRefillDto,
    VerifyPatientDto,
    AssignProviderDto,
    UpdateRefillStatusDto,
    PrescriptionRefillResponseDto,
    RefillStatus,
    VerificationStatus,
} from './dto/prescription.dto';
import { Permissions } from '../../auth/permissions.decorator';
import { Auditable } from '../../audit/auditable.decorator';
import { UserRole } from '@wardline/types';

@ApiTags('prescription-refills')
@ApiBearerAuth()
@Controller('prescription-refills')
export class PrescriptionsController {
    constructor(private readonly prescriptionsService: PrescriptionsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a prescription refill request' })
    @ApiResponse({ status: 201, description: 'Refill request created', type: PrescriptionRefillResponseDto })
    @Permissions(UserRole.AGENT)
    @Auditable('prescription_refill', 'CREATE')
    create(@Body() createDto: CreatePrescriptionRefillDto) {
        return this.prescriptionsService.createRefillRequest(createDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all prescription refill requests' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'status', required: false, enum: RefillStatus })
    @ApiQuery({ name: 'verificationStatus', required: false, enum: VerificationStatus })
    @ApiQuery({ name: 'isNewPatient', required: false, type: Boolean })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'offset', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'List of refill requests', type: [PrescriptionRefillResponseDto] })
    @Permissions(UserRole.READONLY)
    findAll(
        @Query('hospitalId') hospitalId: string,
        @Query('status') status?: RefillStatus,
        @Query('verificationStatus') verificationStatus?: VerificationStatus,
        @Query('isNewPatient', new ParseBoolPipe({ optional: true })) isNewPatient?: boolean,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.prescriptionsService.findAllRefills(hospitalId, {
            status,
            verificationStatus,
            isNewPatient,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get prescription refill statistics' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    @ApiResponse({ status: 200, description: 'Refill statistics' })
    @Permissions(UserRole.SUPERVISOR)
    getStats(
        @Query('hospitalId') hospitalId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.prescriptionsService.getRefillStats(
            hospitalId,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
        );
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get prescription refill by ID' })
    @ApiResponse({ status: 200, description: 'Refill request found', type: PrescriptionRefillResponseDto })
    @ApiResponse({ status: 404, description: 'Refill request not found' })
    @Permissions(UserRole.READONLY)
    findOne(@Param('id') id: string) {
        return this.prescriptionsService.findRefillById(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update prescription refill' })
    @ApiResponse({ status: 200, description: 'Refill updated', type: PrescriptionRefillResponseDto })
    @ApiResponse({ status: 404, description: 'Refill not found' })
    @Permissions(UserRole.AGENT)
    @Auditable('prescription_refill', 'UPDATE')
    update(@Param('id') id: string, @Body() updateDto: UpdatePrescriptionRefillDto) {
        return this.prescriptionsService.updateRefill(id, updateDto);
    }

    @Patch(':id/verify')
    @ApiOperation({ summary: 'Verify patient for refill request' })
    @ApiResponse({ status: 200, description: 'Patient verified', type: PrescriptionRefillResponseDto })
    @ApiResponse({ status: 404, description: 'Refill not found' })
    @Permissions(UserRole.AGENT)
    @Auditable('prescription_refill', 'VERIFY_PATIENT')
    verifyPatient(@Param('id') id: string, @Body() verifyDto: VerifyPatientDto) {
        return this.prescriptionsService.verifyPatient(id, verifyDto);
    }

    @Patch(':id/assign-provider')
    @ApiOperation({ summary: 'Assign provider for new patient refill' })
    @ApiResponse({ status: 200, description: 'Provider assigned', type: PrescriptionRefillResponseDto })
    @ApiResponse({ status: 404, description: 'Refill not found' })
    @Permissions(UserRole.AGENT)
    @Auditable('prescription_refill', 'ASSIGN_PROVIDER')
    assignProvider(@Param('id') id: string, @Body() assignDto: AssignProviderDto) {
        return this.prescriptionsService.assignProvider(id, assignDto);
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update refill status (approve/reject/complete)' })
    @ApiResponse({ status: 200, description: 'Status updated', type: PrescriptionRefillResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid status transition' })
    @ApiResponse({ status: 404, description: 'Refill not found' })
    @Permissions(UserRole.SUPERVISOR)
    @Auditable('prescription_refill', 'UPDATE_STATUS')
    updateStatus(@Param('id') id: string, @Body() statusDto: UpdateRefillStatusDto) {
        return this.prescriptionsService.updateRefillStatus(id, statusDto);
    }
}

