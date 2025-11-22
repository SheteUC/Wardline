import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

/**
 * HTTP client for Core API integration
 */
export class CoreApiClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: config.coreApi.baseUrl,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Get hospital configuration by phone number
     */
    public async getHospitalByPhone(phoneNumber: string): Promise<any> {
        try {
            const response = await this.client.get(`/api/hospitals/by-phone/${phoneNumber}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching hospital by phone:', error);
            throw error;
        }
    }

    /**
     * Get active workflow for hospital
     */
    public async getActiveWorkflow(hospitalId: string): Promise<any> {
        try {
            const response = await this.client.get(`/api/workflows/${hospitalId}/active`);
            return response.data;
        } catch (error) {
            console.error('Error fetching active workflow:', error);
            throw error;
        }
    }

    /**
     * Get configured intents for hospital
     */
    public async getIntents(hospitalId: string): Promise<any[]> {
        try {
            const response = await this.client.get(`/api/intents`, {
                params: { hospitalId },
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching intents:', error);
            return [];
        }
    }

    /**
     * Create call session
     */
    public async createCall(data: {
        hospitalId: string;
        direction: string;
        fromNumber: string;
        toNumber: string;
        twilioCallSid: string;
    }): Promise<any> {
        try {
            const response = await this.client.post('/api/calls', data);
            return response.data;
        } catch (error) {
            console.error('Error creating call:', error);
            throw error;
        }
    }

    /**
     * Update call status
     */
    public async updateCall(callId: string, data: {
        status?: string;
        duration?: number;
        recordingConsent?: string;
        detectedIntent?: string;
    }): Promise<any> {
        try {
            const response = await this.client.patch(`/api/calls/${callId}`, data);
            return response.data;
        } catch (error) {
            console.error('Error updating call:', error);
            throw error;
        }
    }

    /**
     * Save transcript segments
     */
    public async saveTranscript(callId: string, segments: Array<{
        speaker: string;
        text: string;
        timestamp: Date;
    }>): Promise<any> {
        try {
            const response = await this.client.post(`/api/calls/${callId}/transcript`, {
                segments,
            });
            return response.data;
        } catch (error) {
            console.error('Error saving transcript:', error);
            throw error;
        }
    }

    /**
     * Create audit log entry
     */
    public async createAuditLog(data: {
        userId?: string;
        action: string;
        resourceType: string;
        resourceId: string;
        metadata?: any;
    }): Promise<any> {
        try {
            const response = await this.client.post('/api/audit-logs', data);
            return response.data;
        } catch (error) {
            console.error('Error creating audit log:', error);
            throw error;
        }
    }

    /**
     * Create handoff for escalation
     */
    public async createHandoff(data: {
        callId: string;
        hospitalId: string;
        intentKey: string;
        tag: string;
        summary: string;
        fields: any;
    }): Promise<any> {
        try {
            const response = await this.client.post('/api/handoffs', data);
            return response.data;
        } catch (error) {
            console.error('Error creating handoff:', error);
            throw error;
        }
    }
}
