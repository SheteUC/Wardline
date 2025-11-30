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
import { InsuranceService } from './insurance.service';
import {
    CreateInsurancePlanDto,
    UpdateInsurancePlanDto,
    CreateInsuranceInquiryDto,
    UpdateInsuranceInquiryDto,
    CreateInsuranceVerificationDto,
    UpdateInsuranceVerificationDto,
    InsurancePlanResponseDto,
    InsuranceVerificationResponseDto,
    EligibilityStatus,
    InsuranceInquiryType,
} from './dto/insurance.dto';
import { Permissions } from '../../auth/permissions.decorator';
import { Auditable } from '../../audit/auditable.decorator';
import { UserRole } from '@wardline/types';

@ApiTags('insurance')
@ApiBearerAuth()
@Controller('insurance')
export class InsuranceController {
    constructor(private readonly insuranceService: InsuranceService) { }

    // Insurance Plan endpoints
    @Post('plans')
    @ApiOperation({ summary: 'Create an insurance plan' })
    @ApiResponse({ status: 201, description: 'Insurance plan created', type: InsurancePlanResponseDto })
    @Permissions(UserRole.ADMIN)
    @Auditable('insurance_plan', 'CREATE')
    createPlan(@Body() createDto: CreateInsurancePlanDto): Promise<any> {
        return this.insuranceService.createPlan(createDto);
    }

    @Get('plans')
    @ApiOperation({ summary: 'Get all insurance plans' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'carrierId', required: false })
    @ApiQuery({ name: 'planType', required: false })
    @ApiQuery({ name: 'isAccepted', required: false, type: Boolean })
    @ApiQuery({ name: 'search', required: false })
    @ApiResponse({ status: 200, description: 'List of insurance plans', type: [InsurancePlanResponseDto] })
    @Permissions(UserRole.READONLY)
    findAllPlans(
        @Query('hospitalId') hospitalId: string,
        @Query('carrierId') carrierId?: string,
        @Query('planType') planType?: string,
        @Query('isAccepted', new ParseBoolPipe({ optional: true })) isAccepted?: boolean,
        @Query('search') search?: string,
    ): Promise<any[]> {
        return this.insuranceService.findAllPlans(hospitalId, { carrierId, planType, isAccepted, search });
    }

    @Get('plans/check')
    @ApiOperation({ summary: 'Check if an insurance plan is accepted' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'carrierName', required: true })
    @ApiQuery({ name: 'planName', required: false })
    @ApiResponse({ status: 200, description: 'Plan acceptance status' })
    @Permissions(UserRole.READONLY)
    checkPlanAcceptance(
        @Query('hospitalId') hospitalId: string,
        @Query('carrierName') carrierName: string,
        @Query('planName') planName?: string,
    ): Promise<any> {
        return this.insuranceService.checkPlanAcceptance(hospitalId, carrierName, planName);
    }

    @Get('plans/:id')
    @ApiOperation({ summary: 'Get insurance plan by ID' })
    @ApiResponse({ status: 200, description: 'Insurance plan found', type: InsurancePlanResponseDto })
    @ApiResponse({ status: 404, description: 'Insurance plan not found' })
    @Permissions(UserRole.READONLY)
    findPlan(@Param('id') id: string): Promise<any> {
        return this.insuranceService.findPlanById(id);
    }

    @Patch('plans/:id')
    @ApiOperation({ summary: 'Update insurance plan' })
    @ApiResponse({ status: 200, description: 'Insurance plan updated', type: InsurancePlanResponseDto })
    @ApiResponse({ status: 404, description: 'Insurance plan not found' })
    @Permissions(UserRole.ADMIN)
    @Auditable('insurance_plan', 'UPDATE')
    updatePlan(@Param('id') id: string, @Body() updateDto: UpdateInsurancePlanDto): Promise<any> {
        return this.insuranceService.updatePlan(id, updateDto);
    }

    @Delete('plans/:id')
    @ApiOperation({ summary: 'Delete insurance plan' })
    @ApiResponse({ status: 200, description: 'Insurance plan deleted' })
    @ApiResponse({ status: 404, description: 'Insurance plan not found' })
    @Permissions(UserRole.ADMIN)
    @Auditable('insurance_plan', 'DELETE')
    deletePlan(@Param('id') id: string): Promise<any> {
        return this.insuranceService.deletePlan(id);
    }

    // Insurance Inquiry endpoints
    @Post('inquiries')
    @ApiOperation({ summary: 'Create an insurance inquiry' })
    @ApiResponse({ status: 201, description: 'Insurance inquiry created' })
    @Permissions(UserRole.AGENT)
    @Auditable('insurance_inquiry', 'CREATE')
    createInquiry(@Body() createDto: CreateInsuranceInquiryDto): Promise<any> {
        return this.insuranceService.createInquiry(createDto);
    }

    @Get('inquiries')
    @ApiOperation({ summary: 'Get all insurance inquiries' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'inquiryType', required: false, enum: InsuranceInquiryType })
    @ApiQuery({ name: 'resolved', required: false, type: Boolean })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'offset', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'List of insurance inquiries' })
    @Permissions(UserRole.READONLY)
    findAllInquiries(
        @Query('hospitalId') hospitalId: string,
        @Query('inquiryType') inquiryType?: InsuranceInquiryType,
        @Query('resolved', new ParseBoolPipe({ optional: true })) resolved?: boolean,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ): Promise<any> {
        return this.insuranceService.findAllInquiries(hospitalId, {
            inquiryType,
            resolved,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }

    @Patch('inquiries/:id')
    @ApiOperation({ summary: 'Update an insurance inquiry' })
    @ApiResponse({ status: 200, description: 'Insurance inquiry updated' })
    @Permissions(UserRole.AGENT)
    @Auditable('insurance_inquiry', 'UPDATE')
    updateInquiry(@Param('id') id: string, @Body() updateDto: UpdateInsuranceInquiryDto): Promise<any> {
        return this.insuranceService.updateInquiry(id, updateDto);
    }

    // Insurance Verification endpoints
    @Post('verifications')
    @ApiOperation({ summary: 'Create an insurance verification' })
    @ApiResponse({ status: 201, description: 'Insurance verification created', type: InsuranceVerificationResponseDto })
    @Permissions(UserRole.AGENT)
    @Auditable('insurance_verification', 'CREATE')
    createVerification(@Body() createDto: CreateInsuranceVerificationDto): Promise<any> {
        return this.insuranceService.createVerification(createDto);
    }

    @Get('verifications')
    @ApiOperation({ summary: 'Get all insurance verifications' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'insurancePlanId', required: false })
    @ApiQuery({ name: 'eligibilityStatus', required: false, enum: EligibilityStatus })
    @ApiQuery({ name: 'authorizationRequired', required: false, type: Boolean })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'offset', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'List of insurance verifications', type: [InsuranceVerificationResponseDto] })
    @Permissions(UserRole.READONLY)
    findAllVerifications(
        @Query('hospitalId') hospitalId: string,
        @Query('insurancePlanId') insurancePlanId?: string,
        @Query('eligibilityStatus') eligibilityStatus?: EligibilityStatus,
        @Query('authorizationRequired', new ParseBoolPipe({ optional: true })) authorizationRequired?: boolean,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ): Promise<any> {
        return this.insuranceService.findAllVerifications(hospitalId, {
            insurancePlanId,
            eligibilityStatus,
            authorizationRequired,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
    }

    @Get('verifications/:id')
    @ApiOperation({ summary: 'Get insurance verification by ID' })
    @ApiResponse({ status: 200, description: 'Insurance verification found', type: InsuranceVerificationResponseDto })
    @ApiResponse({ status: 404, description: 'Insurance verification not found' })
    @Permissions(UserRole.READONLY)
    findVerification(@Param('id') id: string): Promise<any> {
        return this.insuranceService.findVerificationById(id);
    }

    @Patch('verifications/:id')
    @ApiOperation({ summary: 'Update insurance verification' })
    @ApiResponse({ status: 200, description: 'Insurance verification updated', type: InsuranceVerificationResponseDto })
    @ApiResponse({ status: 404, description: 'Insurance verification not found' })
    @Permissions(UserRole.AGENT)
    @Auditable('insurance_verification', 'UPDATE')
    updateVerification(@Param('id') id: string, @Body() updateDto: UpdateInsuranceVerificationDto): Promise<any> {
        return this.insuranceService.updateVerification(id, updateDto);
    }

    // Statistics endpoint
    @Get('stats')
    @ApiOperation({ summary: 'Get insurance statistics and claim denial prevention metrics' })
    @ApiQuery({ name: 'hospitalId', required: true })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    @ApiResponse({ status: 200, description: 'Insurance statistics' })
    @Permissions(UserRole.SUPERVISOR)
    getStats(
        @Query('hospitalId') hospitalId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ): Promise<any> {
        return this.insuranceService.getInsuranceStats(
            hospitalId,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined,
        );
    }
}
