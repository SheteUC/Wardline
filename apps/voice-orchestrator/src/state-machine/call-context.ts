/**
 * Call state machine states
 */
export enum VoiceState {
    INITIALIZING = 'INITIALIZING',
    GREETING = 'GREETING',
    EMERGENCY_SCREENING = 'EMERGENCY_SCREENING',
    TRIAGE = 'TRIAGE',
    BOOKING = 'BOOKING',
    ESCALATING = 'ESCALATING',
    ENDING = 'ENDING',
    COMPLETED = 'COMPLETED',
}

/**
 * Call context data
 */
export interface CallContext {
    callSid: string;
    from: string;
    to: string;
    hospitalId: string;
    state: VoiceState;
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    extractedFields: Record<string, any>;
    detectedIntent?: string;
    isEmergency: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Manages call contexts in memory
 */
export class CallContextManager {
    private contexts: Map<string, CallContext> = new Map();

    /**
     * Create new call context
     */
    public createContext(
        callSid: string,
        data: { from: string; to: string; hospitalId: string }
    ): CallContext {
        const context: CallContext = {
            callSid,
            from: data.from,
            to: data.to,
            hospitalId: data.hospitalId,
            state: VoiceState.INITIALIZING,
            conversationHistory: [],
            extractedFields: {},
            isEmergency: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.contexts.set(callSid, context);
        console.log(`✅ Created context for call ${callSid}`);

        return context;
    }

    /**
     * Get call context
     */
    public getContext(callSid: string): CallContext | undefined {
        return this.contexts.get(callSid);
    }

    /**
     * Update call context
     */
    public updateContext(callSid: string, updates: Partial<CallContext>): void {
        const context = this.contexts.get(callSid);
        if (context) {
            Object.assign(context, { ...updates, updatedAt: new Date() });
            this.contexts.set(callSid, context);
        }
    }

    /**
     * Remove call context
     */
    public removeContext(callSid: string): void {
        this.contexts.delete(callSid);
    }

    /**
     * Get all active contexts
     */
    public getAllContexts(): CallContext[] {
        return Array.from(this.contexts.values());
    }

    /**
     * Cleanup old contexts (older than 1 hour)
     */
    public cleanupOldContexts(): void {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        for (const [callSid, context] of this.contexts.entries()) {
            if (context.updatedAt < oneHourAgo) {
                this.contexts.delete(callSid);
                console.log(`🗑️ Cleaned up stale context for call ${callSid}`);
            }
        }
    }
}

// Singleton instance
export const callContextManager = new CallContextManager();

// Cleanup old contexts every 15 minutes
setInterval(() => {
    callContextManager.cleanupOldContexts();
}, 15 * 60 * 1000);
