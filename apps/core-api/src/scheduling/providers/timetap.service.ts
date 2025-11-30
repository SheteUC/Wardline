import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { AvailableSlot } from '../scheduling.service';

export interface TimeTapConfig {
    apiKey: string;
    baseUrl: string;
    locationId: string;
}

export interface TimeTapAvailability {
    startTime: string;
    endTime: string;
    providerId: string;
    providerName: string;
}

export interface TimeTapAppointment {
    id: string;
    locationId: string;
    serviceId: string;
    providerId?: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    startTime: string;
    duration: number;
    notes?: string;
}

@Injectable()
export class TimeTapService {
    private readonly logger = new Logger(TimeTapService.name);
    private client: AxiosInstance;

    constructor(private config: TimeTapConfig) {
        this.client = axios.create({
            baseURL: config.baseUrl,
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
    }

    /**
     * Search for available time slots
     */
    async getAvailableSlots(
        serviceId: string,
        startDate: Date,
        endDate: Date,
        providerId?: string,
    ): Promise<AvailableSlot[]> {
        try {
            this.logger.log(
                `Fetching availability for service ${serviceId} from ${startDate} to ${endDate}`,
            );

            const response = await this.client.get<TimeTapAvailability[]>(
                `/availability`,
                {
                    params: {
                        locationId: this.config.locationId,
                        serviceId,
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString(),
                        providerId,
                    },
                },
            );

            return response.data.map((slot) => ({
                startTime: new Date(slot.startTime),
                endTime: new Date(slot.endTime),
                providerId: slot.providerId,
                providerName: slot.providerName,
            }));
        } catch (error: any) {
            this.logger.error(`Failed to fetch availability: ${error?.message || 'Unknown error'}`);
            throw new HttpException(
                'Failed to fetch available slots',
                HttpStatus.BAD_GATEWAY,
            );
        }
    }

    /**
     * Create a new appointment in TimeTap
     */
    async createAppointment(
        appointmentData: Omit<TimeTapAppointment, 'id'>,
    ): Promise<TimeTapAppointment> {
        try {
            this.logger.log(
                `Creating TimeTap appointment for ${appointmentData.customerName}`,
            );

            const response = await this.client.post<TimeTapAppointment>(
                `/appointments`,
                {
                    ...appointmentData,
                    locationId: this.config.locationId,
                },
            );

            this.logger.log(`Appointment created with ID: ${response.data.id}`);
            return response.data;
        } catch (error: any) {
            this.logger.error(`Failed to create appointment: ${error?.message || 'Unknown error'}`);
            throw new HttpException(
                'Failed to create appointment',
                HttpStatus.BAD_GATEWAY,
            );
        }
    }

    /**
     * Update an existing appointment
     */
    async updateAppointment(
        appointmentId: string,
        updates: Partial<TimeTapAppointment>,
    ): Promise<TimeTapAppointment> {
        try {
            this.logger.log(`Updating TimeTap appointment ${appointmentId}`);

            const response = await this.client.patch<TimeTapAppointment>(
                `/appointments/${appointmentId}`,
                updates,
            );

            return response.data;
        } catch(error: any) {
            this.logger.error(`Failed to update appointment: ${error?.message || 'Unknown error'}`);
            throw new HttpException(
                'Failed to update appointment',
                HttpStatus.BAD_GATEWAY,
            );
        }
    }

    /**
     * Cancel an appointment
     */
    async cancelAppointment(appointmentId: string): Promise<void> {
        try {
            this.logger.log(`Cancelling TimeTap appointment ${appointmentId}`);

            await this.client.delete(`/appointments/${appointmentId}`);

            this.logger.log(`Appointment ${appointmentId} cancelled`);
        } catch (error: any) {
            this.logger.error(`Failed to cancel appointment: ${error?.message || 'Unknown error'}`);
            throw new HttpException(
                'Failed to cancel appointment',
                HttpStatus.BAD_GATEWAY,
            );
        }
    }

    /**
     * Get appointment details
     */
    async getAppointment(appointmentId: string): Promise<TimeTapAppointment> {
        try {
            const response = await this.client.get<TimeTapAppointment>(
                `/appointments/${appointmentId}`,
            );

            return response.data;
        } catch (error: any) {
            this.logger.error(`Failed to get appointment: ${error?.message || 'Unknown error'}`);
            throw new HttpException(
                'Failed to get appointment',
                HttpStatus.BAD_GATEWAY,
            );
        }
    }
}
