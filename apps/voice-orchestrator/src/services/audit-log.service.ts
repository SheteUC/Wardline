import { CoreApiClient } from '../clients/core-api.client';

/**
 * Audit logging service for HIPAA compliance
 */
export class AuditLogService {
    private coreApiClient: CoreApiClient;

    constructor() {
        this.coreApiClient = new CoreApiClient();
    }

    /**
     * Log emergency detection event
     */
    async logEmergencyDetection(params: {
        callSid: string;
        hospitalId: string;
        emergencyType: string;
        confidence: number;
        detectedKeywords: string[];
    }): Promise<void> {
        await this.coreApiClient.createAuditLog({
            action: 'EMERGENCY_DETECTED',
            resourceType: 'call',
            resourceId: params.callSid,
            metadata: {
                hospitalId: params.hospitalId,
                emergencyType: params.emergencyType,
                confidence: params.confidence,
                detectedKeywords: params.detectedKeywords,
                timestamp: new Date().toISOString(),
            },
        });

        console.log(`📝 Audit log: Emergency detected for call ${params.callSid}`);
    }

    /**
     * Log call state transition
     */
    async logStateTransition(params: {
        callSid: string;
        hospitalId: string;
        fromState: string;
        toState: string;
        trigger: string;
    }): Promise<void> {
        await this.coreApiClient.createAuditLog({
            action: 'STATE_TRANSITION',
            resourceType: 'call',
            resourceId: params.callSid,
            metadata: {
                hospitalId: params.hospitalId,
                fromState: params.fromState,
                toState: params.toState,
                trigger: params.trigger,
                timestamp: new Date().toISOString(),
            },
        });
    }

    /**
     * Log call completion with transcript
     */
    async logCallCompletion(params: {
        callSid: string;
        hospitalId: string;
        duration: number;
        finalState: string;
        transcriptId?: string;
    }): Promise<void> {
        await this.coreApiClient.createAuditLog({
            action: 'CALL_COMPLETED',
            resourceType: 'call',
            resourceId: params.callSid,
            metadata: {
                hospitalId: params.hospitalId,
                duration: params.duration,
                finalState: params.finalState,
                transcriptId: params.transcriptId,
                timestamp: new Date().toISOString(),
            },
        });

        console.log(`📝 Audit log: Call ${params.callSid} completed`);
    }

    /**
     * Log PHI access (redacted)
     */
    async logPhiAccess(params: {
        callSid: string;
        hospitalId: string;
        action: string;
        fieldAccessed: string;
    }): Promise<void> {
        await this.coreApiClient.createAuditLog({
            action: 'PHI_ACCESS',
            resourceType: 'call',
            resourceId: params.callSid,
            metadata: {
                hospitalId: params.hospitalId,
                action: params.action,
                fieldAccessed: params.fieldAccessed,
                timestamp: new Date().toISOString(),
            },
        });
    }
}
