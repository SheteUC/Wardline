import { CoreApiClient } from '../clients/core-api.client';

/**
 * Analytics event types
 */
export enum AnalyticsEvent {
    CALL_STARTED = 'call_started',
    CALL_ENDED = 'call_ended',
    EMERGENCY_DETECTED = 'emergency_detected',
    INTENT_RECOGNIZED = 'intent_recognized',
    STATE_TRANSITION = 'state_transition',
    BOOKING_INITIATED = 'booking_initiated',
    BOOKING_COMPLETED = 'booking_completed',
    ESCALATION_TRIGGERED = 'escalation_triggered',
    STT_ERROR = 'stt_error',
    TTS_ERROR = 'tts_error',
    LLM_ERROR = 'llm_error',
}

/**
 * Analytics service for publishing events
 */
export class AnalyticsService {
    private coreApiClient: CoreApiClient;

    constructor() {
        this.coreApiClient = new CoreApiClient();
    }

    /**
     * Publish analytics event
     */
    async publishEvent(params: {
        event: AnalyticsEvent;
        callSid: string;
        hospitalId: string;
        metadata?: Record<string, any>;
    }): Promise<void> {
        try {
            const eventData = {
                event: params.event,
                callSid: params.callSid,
                hospitalId: params.hospitalId,
                timestamp: new Date().toISOString(),
                metadata: params.metadata || {},
            };

            // Log event to core-api for analytics
            await this.coreApiClient.createAuditLog({
                action: `ANALYTICS_${params.event.toUpperCase()}`,
                resourceType: 'call',
                resourceId: params.callSid,
                metadata: eventData,
            });

            console.log(`📊 Analytics event published: ${params.event} for call ${params.callSid}`);
        } catch (error) {
            console.error(`Failed to publish analytics event ${params.event}:`, error);
        }
    }

    /**
     * Track call metrics
     */
    async trackCallMetrics(params: {
        callSid: string;
        hospitalId: string;
        duration: number;
        stateTransitions: number;
        wasEmergency: boolean;
        wasEscalated: boolean;
        detectedIntent?: string;
    }): Promise<void> {
        await this.publishEvent({
            event: AnalyticsEvent.CALL_ENDED,
            callSid: params.callSid,
            hospitalId: params.hospitalId,
            metadata: {
                duration: params.duration,
                stateTransitions: params.stateTransitions,
                wasEmergency: params.wasEmergency,
                wasEscalated: params.wasEscalated,
                detectedIntent: params.detectedIntent,
            },
        });
    }
}
