import { CoreApiClient } from '../clients/core-api.client';

/**
 * Phone lookup service for identifying hospitals by phone number
 */
export class PhoneLookupService {
    private coreApiClient: CoreApiClient;

    constructor() {
        this.coreApiClient = new CoreApiClient();
    }

    /**
     * Look up hospital by called phone number
     */
    async lookupHospitalByPhone(phoneNumber: string): Promise<{
        hospitalId: string;
        name: string;
    } | null> {
        try {
            const normalized = this.normalizePhoneNumber(phoneNumber);
            const hospital = await this.coreApiClient.getHospitalByPhone(normalized);

            console.log(`📞 Phone lookup: ${phoneNumber} -> Hospital ${hospital?.id || 'not found'}`);

            return hospital
                ? {
                    hospitalId: hospital.id,
                    name: hospital.name,
                }
                : null;
        } catch (error) {
            console.error(`Phone lookup failed for ${phoneNumber}:`, error);
            return null;
        }
    }

    /**
     * Normalize phone number to E.164 format
     */
    private normalizePhoneNumber(phone: string): string {
        let normalized = phone.replace(/[^\d+]/g, '');

        if (!normalized.startsWith('+')) {
            if (normalized.length === 10) {
                normalized = `+1${normalized}`;
            } else if (normalized.length === 11 && normalized.startsWith('1')) {
                normalized = `+${normalized}`;
            }
        }

        return normalized;
    }

    /**
     * Format phone number for display
     */
    formatPhoneNumber(phone: string): string {
        const normalized = this.normalizePhoneNumber(phone);

        if (normalized.startsWith('+1') && normalized.length === 12) {
            return `+1 (${normalized.slice(2, 5)}) ${normalized.slice(5, 8)}-${normalized.slice(8)}`;
        }

        return normalized;
    }
}
