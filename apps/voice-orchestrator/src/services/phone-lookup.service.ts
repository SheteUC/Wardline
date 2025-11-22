import { CoreApiClient } from '../clients/core-api.client';

/**
 * Phone number lookup utilities
 */
export class PhoneLookupService {
    private coreApiClient: CoreApiClient;

    constructor() {
        this.coreApiClient = new CoreApiClient();
    }

    /**
     * Lookup hospital by phone number
     */
    public async getHospitalByPhoneNumber(phoneNumber: string): Promise<any> {
        try {
            const hospital = await this.coreApiClient.getHospitalByPhone(phoneNumber);
            return hospital;
        } catch (error) {
            console.error('Error looking up hospital by phone:', error);
            return null;
        }
    }

    /**
     * Format phone number for lookup
     */
    public formatPhoneNumber(phoneNumber: string): string {
        // Remove all non-numeric characters
        const cleaned = phoneNumber.replace(/\D/g, '');

        // Add +1 if it's a US number without country code
        if (cleaned.length === 10) {
            return `+1${cleaned}`;
        }

        // Add + if missing
        if (!phoneNumber.startsWith('+')) {
            return `+${cleaned}`;
        }

        return `+${cleaned}`;
    }
}
