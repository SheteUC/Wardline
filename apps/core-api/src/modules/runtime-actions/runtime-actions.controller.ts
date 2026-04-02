import { Body, Controller, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/public.decorator';
import { InternalApi } from '../../auth/internal-api.decorator';
import {
    RuntimeAppointmentRequestDto,
    RuntimeBillingRequestDto,
    RuntimeInsuranceCheckDto,
    RuntimeManualFollowUpDto,
    RuntimeRefillRequestDto,
} from './dto/runtime-actions.dto';
import { RuntimeActionsService } from './runtime-actions.service';

@Controller('api/businesses/:businessId/runtime-actions')
@Public()
@InternalApi()
@Throttle({ global: { limit: 200, ttl: 60_000 } })
export class RuntimeActionsController {
    constructor(private readonly runtimeActionsService: RuntimeActionsService) {}

    @Post('appointment-request')
    requestAppointment(
        @Param('businessId') businessId: string,
        @Body() body: RuntimeAppointmentRequestDto,
    ) {
        return this.runtimeActionsService.requestAppointment(businessId, body);
    }

    @Post('refill-request')
    requestRefill(
        @Param('businessId') businessId: string,
        @Body() body: RuntimeRefillRequestDto,
    ) {
        return this.runtimeActionsService.requestRefill(businessId, body);
    }

    @Post('insurance-check')
    checkInsurance(
        @Param('businessId') businessId: string,
        @Body() body: RuntimeInsuranceCheckDto,
    ) {
        return this.runtimeActionsService.checkInsurance(businessId, body);
    }

    @Post('billing-request')
    requestBilling(
        @Param('businessId') businessId: string,
        @Body() body: RuntimeBillingRequestDto,
    ) {
        return this.runtimeActionsService.requestBilling(businessId, body);
    }

    @Post('manual-follow-up')
    captureManualFollowUp(
        @Param('businessId') businessId: string,
        @Body() body: RuntimeManualFollowUpDto,
    ) {
        return this.runtimeActionsService.captureManualFollowUp(businessId, body);
    }
}
