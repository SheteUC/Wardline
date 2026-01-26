import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIAgentConfig } from '@wardline/types';

@Injectable()
export class VoiceOrchestratorClient {
    private readonly logger = new Logger(VoiceOrchestratorClient.name);
    private readonly orchestratorUrl: string;

    constructor(private readonly configService: ConfigService) {
        this.orchestratorUrl = this.configService.get<string>('VOICE_ORCHESTRATOR_URL') || 'http://localhost:3002';
    }

    /**
     * Update AI agent configuration mid-call
     * This changes the AI's behavior, system prompt, and capabilities during an active call
     */
    async updateAIConfig(callId: string, config: AIAgentConfig): Promise<void> {
        try {
            this.logger.log(`Updating AI config for call ${callId} with persona: ${config.persona}`);

            const response = await fetch(`${this.orchestratorUrl}/calls/${callId}/ai-config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    persona: config.persona,
                    systemPrompt: config.systemPrompt,
                    capabilities: config.capabilities,
                    knowledgeBase: config.knowledgeBase,
                    maxInteractions: config.maxInteractions,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to update AI config: ${response.statusText}`);
            }

            this.logger.log(`Successfully updated AI config for call ${callId}`);
        } catch (error: any) {
            this.logger.error(`Error updating AI config for call ${callId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Put call on hold with a message
     * Used when waiting for human agent availability
     */
    async putCallOnHold(callId: string, message: string): Promise<void> {
        try {
            this.logger.log(`Putting call ${callId} on hold`);

            const response = await fetch(`${this.orchestratorUrl}/calls/${callId}/hold`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to put call on hold: ${response.statusText}`);
            }

            this.logger.log(`Successfully put call ${callId} on hold`);
        } catch (error: any) {
            this.logger.error(`Error putting call ${callId} on hold: ${error.message}`);
            throw error;
        }
    }

    /**
     * Resume call from hold
     */
    async resumeCall(callId: string): Promise<void> {
        try {
            this.logger.log(`Resuming call ${callId} from hold`);

            const response = await fetch(`${this.orchestratorUrl}/calls/${callId}/resume`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to resume call: ${response.statusText}`);
            }

            this.logger.log(`Successfully resumed call ${callId}`);
        } catch (error: any) {
            this.logger.error(`Error resuming call ${callId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Transfer call to human agent
     * Can provide phone number for phone transfer or join URL for web-based transfer
     */
    async transferToHuman(callId: string, transferOptions: {
        type: 'phone' | 'web';
        target: string; // Phone number or URL
        agentName?: string;
    }): Promise<void> {
        try {
            this.logger.log(`Transferring call ${callId} to human agent via ${transferOptions.type}`);

            const response = await fetch(`${this.orchestratorUrl}/calls/${callId}/transfer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(transferOptions),
            });

            if (!response.ok) {
                throw new Error(`Failed to transfer call: ${response.statusText}`);
            }

            this.logger.log(`Successfully initiated transfer for call ${callId}`);
        } catch (error: any) {
            this.logger.error(`Error transferring call ${callId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update call context mid-call
     * Used to provide additional information to the AI (e.g., patient record found)
     */
    async updateCallContext(callId: string, context: Record<string, any>): Promise<void> {
        try {
            this.logger.log(`Updating context for call ${callId}`);

            const response = await fetch(`${this.orchestratorUrl}/calls/${callId}/context`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ context }),
            });

            if (!response.ok) {
                throw new Error(`Failed to update call context: ${response.statusText}`);
            }

            this.logger.log(`Successfully updated context for call ${callId}`);
        } catch (error: any) {
            this.logger.error(`Error updating context for call ${callId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * End call gracefully
     */
    async endCall(callId: string, reason?: string): Promise<void> {
        try {
            this.logger.log(`Ending call ${callId}. Reason: ${reason || 'Not specified'}`);

            const response = await fetch(`${this.orchestratorUrl}/calls/${callId}/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
            });

            if (!response.ok) {
                throw new Error(`Failed to end call: ${response.statusText}`);
            }

            this.logger.log(`Successfully ended call ${callId}`);
        } catch (error: any) {
            this.logger.error(`Error ending call ${callId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send a message to the caller
     * Used for notifications or updates
     */
    async sendMessage(callId: string, message: string): Promise<void> {
        try {
            this.logger.log(`Sending message to call ${callId}`);

            const response = await fetch(`${this.orchestratorUrl}/calls/${callId}/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
            });

            if (!response.ok) {
                throw new Error(`Failed to send message: ${response.statusText}`);
            }

            this.logger.log(`Successfully sent message to call ${callId}`);
        } catch (error: any) {
            this.logger.error(`Error sending message to call ${callId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get current call state from voice orchestrator
     */
    async getCallState(callId: string): Promise<any> {
        try {
            const response = await fetch(`${this.orchestratorUrl}/calls/${callId}/state`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to get call state: ${response.statusText}`);
            }

            return await response.json();
        } catch (error: any) {
            this.logger.error(`Error getting state for call ${callId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Trigger escalation flow
     */
    async triggerEscalation(callId: string, reason: string): Promise<void> {
        try {
            this.logger.log(`Triggering escalation for call ${callId}. Reason: ${reason}`);

            const response = await fetch(`${this.orchestratorUrl}/calls/${callId}/escalate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
            });

            if (!response.ok) {
                throw new Error(`Failed to trigger escalation: ${response.statusText}`);
            }

            this.logger.log(`Successfully triggered escalation for call ${callId}`);
        } catch (error: any) {
            this.logger.error(`Error triggering escalation for call ${callId}: ${error.message}`);
            throw error;
        }
    }
}
