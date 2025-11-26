import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { AvailableSlot } from '../scheduling.service';

/**
 * NexHealth integration service
 * This is a placeholder for future implementation
 */
@Injectable()
export class NexHealthService {
    private readonly logger = new Logger(NexHealthService.name);

    async getAvailableSlots(
        _serviceId: string,
        _startDate: Date,
        _endDate: Date,
        _providerId?: string,
    ): Promise<AvailableSlot[]> {
        this.logger.warn('NexHealth integration not yet implemented');
        throw new NotImplementedException(
            'NexHealth integration is not yet available',
        );
    }

    async createAppointment(_appointmentData: any): Promise<any> {
        this.logger.warn('NexHealth integration not yet implemented');
        throw new NotImplementedException(
            'NexHealth integration is not yet available',
        );
    }

    async updateAppointment(_appointmentId: string, _updates: any): Promise<any> {
        this.logger.warn('NexHealth integration not yet implemented');
        throw new NotImplementedException(
            'NexHealth integration is not yet available',
        );
    }

    async cancelAppointment(_appointmentId: string): Promise<void> {
        this.logger.warn('NexHealth integration not yet implemented');
        throw new NotImplementedException(
            'NexHealth integration is not yet available',
        );
    }

    async getAppointment(_appointmentId: string): Promise<any> {
        this.logger.warn('NexHealth integration not yet implemented');
        throw new NotImplementedException(
            'NexHealth integration is not yet available',
        );
    }
}
