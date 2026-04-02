import { Body, Controller, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/public.decorator';
import { InternalApi } from '../../auth/internal-api.decorator';
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
        @Body() body: {
            callId?: string;
            callerName?: string;
            callerPhone: string;
            serviceType: string;
            preferredDate?: string;
            preferredTime?: string;
            notes?: string;
            confirmed?: boolean;
        },
    ) {
        return this.runtimeActionsService.requestAppointment(businessId, body);
    }

    @Post('refill-request')
    requestRefill(
        @Param('businessId') businessId: string,
        @Body() body: {
            callId?: string;
            callerName: string;
            callerPhone: string;
            callerDob?: string;
            medicationName: string;
            prescriberName?: string;
            pharmacyName?: string;
            pharmacyPhone?: string;
            notes?: string;
            confirmed?: boolean;
        },
    ) {
        return this.runtimeActionsService.requestRefill(businessId, body);
    }

    @Post('insurance-check')
    checkInsurance(
        @Param('businessId') businessId: string,
        @Body() body: {
            callId?: string;
            callerName?: string;
            callerPhone?: string;
            carrierName: string;
            planName?: string;
            inquiryType?: string;
            patientName?: string;
            patientDob?: string;
            memberId?: string;
            groupNumber?: string;
            subscriberRelation?: string;
            serviceType?: string;
            callbackPhone?: string;
            notes?: string;
        },
    ) {
        return this.runtimeActionsService.checkInsurance(businessId, body);
    }

    @Post('billing-request')
    requestBilling(
        @Param('businessId') businessId: string,
        @Body() body: {
            callId?: string;
            callerName: string;
            callerPhone: string;
            billingTopic: string;
            accountReference?: string;
            notes?: string;
            confirmed?: boolean;
        },
    ) {
        return this.runtimeActionsService.requestBilling(businessId, body);
    }

    @Post('manual-follow-up')
    captureManualFollowUp(
        @Param('businessId') businessId: string,
        @Body() body: {
            callId?: string;
            callerName?: string;
            callerPhone?: string;
            title: string;
            summary: string;
            priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
            urgencyKeywords?: string[];
            metadata?: Record<string, unknown>;
        },
    ) {
        return this.runtimeActionsService.captureManualFollowUp(businessId, body);
    }
}
