import { CoreApiClient } from '../clients/core-api.client';

/**
 * Emergency notification service for immediate escalation
 */
export class EmergencyNotificationService {
    private coreApiClient: CoreApiClient;

    constructor() {
        this.coreApiClient = new CoreApiClient();
    }

    /**
     *  Send emergency alert for immediate escalation
     */
    async notifyEmergency(params: {
        callSid: string;
        hospitalId: string;
        callerPhone: string;
        emergencyType: string;
        confidence: number;
        transcript: string;
    }): Promise<void> {
        try {
            console.log(`🚨 EMERGENCY NOTIFICATION: ${params.emergencyType} detected for call ${params.callSid}`);

            // Create emergency audit log in core-api
            await this.coreApiClient.createAuditLog({
                action: 'EMERGENCY_DETECTED',
                resourceType: 'call',
                resourceId: params.callSid,
                metadata: {
                    emergencyType: params.emergencyType,
                    confidence: params.confidence,
                    callerPhone: params.callerPhone,
                    hospitalId: params.hospitalId,
                    transcript: params.transcript,
                    timestamp: new Date().toISOString(),
                },
            });

            console.log(`✅ Emergency notification sent successfully for call ${params.callSid}`);
        } catch (error) {
            console.error('Failed to send emergency notification:', error);
        }
    }

    /**
     * Create emergency escalation handoff payload
     */
    createHandoffPayload(params: {
        callSid: string;
        callerPhone: string;
        emergencyType: string;
        conversationHistory: Array<{ role: string; content: string }>;
        extractedFields: Record<string, any>;
    }): object {
        return {
            callSid: params.callSid,
            priority: 'EMERGENCY',
            escalationType: 'IMMEDIATE',
            metadata: {
                emergencyType: params.emergencyType,
                callerPhone: params.callerPhone,
                conversationHistory: params.conversationHistory,
                extractedFields: params.extractedFields,
                detectedAt: new Date().toISOString(),
            },
        };
    }
}
