import { Injectable, Logger } from '@nestjs/common';
import { CallContext } from '@wardline/types';

/**
 * Service to manage stateful call contexts in memory
 * Maintains context throughout the call lifecycle to avoid recreation on each workflow node execution
 */
@Injectable()
export class CallContextService {
    private readonly logger = new Logger(CallContextService.name);
    private readonly contexts: Map<string, CallContext> = new Map();

    /**
     * Get or create call context
     */
    getOrCreate(callId: string, initialContext: Partial<CallContext>): CallContext {
        if (this.contexts.has(callId)) {
            this.logger.debug(`Retrieved existing context for call ${callId}`);
            return this.contexts.get(callId)!;
        }

        // Create new context with defaults
        const context: CallContext = {
            callId,
            hospitalId: initialContext.hospitalId || '',
            phoneNumberId: initialContext.phoneNumberId || '',
            direction: initialContext.direction || 'inbound',
            caller: initialContext.caller,
            transcript: initialContext.transcript || [],
            detectedIntent: initialContext.detectedIntent,
            extractedFields: initialContext.extractedFields || {},
            sentiment: initialContext.sentiment,
            isEmergency: initialContext.isEmergency || false,
        };

        this.contexts.set(callId, context);
        this.logger.log(`Created new context for call ${callId}`);

        return context;
    }

    /**
     * Update call context
     */
    update(callId: string, updates: Partial<CallContext>): CallContext {
        const context = this.contexts.get(callId);

        if (!context) {
            throw new Error(`Context not found for call ${callId}`);
        }

        // Merge updates
        Object.assign(context, updates);

        // Ensure arrays are properly merged
        if (updates.transcript) {
            context.transcript = [...(context.transcript || []), ...updates.transcript];
        }

        if (updates.extractedFields) {
            context.extractedFields = {
                ...context.extractedFields,
                ...updates.extractedFields,
            };
        }

        this.logger.debug(`Updated context for call ${callId}`);
        return context;
    }

    /**
     * Add transcript segment to context
     */
    addTranscript(callId: string, text: string): void {
        const context = this.contexts.get(callId);
        if (context) {
            context.transcript.push(text);
            this.logger.debug(`Added transcript to call ${callId}: ${text.substring(0, 50)}...`);
        }
    }

    /**
     * Update extracted fields
     */
    updateFields(callId: string, fields: Record<string, unknown>): void {
        const context = this.contexts.get(callId);
        if (context) {
            context.extractedFields = {
                ...context.extractedFields,
                ...fields,
            };
            this.logger.debug(`Updated fields for call ${callId}:`, Object.keys(fields));
        }
    }

    /**
     * Mark call as emergency
     */
    markEmergency(callId: string, reason?: string): void {
        const context = this.contexts.get(callId);
        if (context) {
            context.isEmergency = true;
            this.logger.warn(`Call ${callId} marked as emergency${reason ? `: ${reason}` : ''}`);
        }
    }

    /**
     * Get current context
     */
    get(callId: string): CallContext | undefined {
        return this.contexts.get(callId);
    }

    /**
     * Check if context exists
     */
    has(callId: string): boolean {
        return this.contexts.has(callId);
    }

    /**
     * Remove context (cleanup after call ends)
     */
    remove(callId: string): void {
        if (this.contexts.delete(callId)) {
            this.logger.log(`Removed context for call ${callId}`);
        }
    }

    /**
     * Get all active call contexts
     */
    getAll(): CallContext[] {
        return Array.from(this.contexts.values());
    }

    /**
     * Get count of active contexts
     */
    getActiveCount(): number {
        return this.contexts.size;
    }

    /**
     * Cleanup old contexts (call this periodically)
     * Removes contexts that are older than maxAge milliseconds
     */
    cleanup(_maxAgeMs: number = 3600000): number {
        // Note: This would require adding a timestamp to CallContext
        // For now, we'll rely on explicit removal when calls end
        
        const activeCount = this.contexts.size;
        this.logger.debug(`Active contexts: ${activeCount}`);
        return 0; // No cleanup performed yet
    }

    /**
     * Get conversation history for a call
     */
    getConversationHistory(callId: string, lastN?: number): string[] {
        const context = this.contexts.get(callId);
        if (!context || !context.transcript) {
            return [];
        }

        if (lastN) {
            return context.transcript.slice(-lastN);
        }

        return context.transcript;
    }

    /**
     * Get full conversation as text
     */
    getConversationText(callId: string): string {
        const context = this.contexts.get(callId);
        if (!context || !context.transcript) {
            return '';
        }

        return context.transcript.join('\n');
    }
}
