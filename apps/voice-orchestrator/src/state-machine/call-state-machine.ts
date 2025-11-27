import { CallContext } from './call-context';
import { EmergencyDetectionService } from '../services/emergency-detection.service';
import { IntentRecognitionService } from '../services/intent-recognition.service';
import { ConversationManagerService } from '../services/conversation-manager.service';
import { VoiceState } from '@wardline/types';

/**
 * Call state machine for managing conversation flow
 */
export class CallStateMachine {
    private context: CallContext;
    private emergencyDetection: EmergencyDetectionService;
    private intentRecognition: IntentRecognitionService;
    private conversationManager: ConversationManagerService;

    constructor(context: CallContext) {
        this.context = context;
        this.emergencyDetection = new EmergencyDetectionService();
        this.intentRecognition = new IntentRecognitionService();
        this.conversationManager = new ConversationManagerService();
    }

    /**
     * Transition to a new state
     */
    public async transition(event: string): Promise<void> {
        console.log(`🔄 State transition: ${this.context.state} -> ${event}`);

        switch (event) {
            case 'START':
                await this.handleStart();
                break;
            case 'EMERGENCY_DETECTED':
                await this.handleEmergencyDetected();
                break;
            case 'EMERGENCY_CLEARED':
                await this.handleEmergencyCleared();
                break;
            case 'INTENT_DETECTED':
                await this.handleIntentDetected();
                break;
            case 'BOOKING_STARTED':
                await this.handleBookingStarted();
                break;
            case 'ESCALATE':
                await this.handleEscalate();
                break;
            case 'END':
                await this.handleEnd();
                break;
            default:
                console.warn(`Unknown event: ${event}`);
        }

        this.context.updatedAt = new Date();
    }

    /**
     * Handle user input and determine next state
     */
    public async handleInput(input: string): Promise<void> {
        console.log(`💬 User input in state ${this.context.state}: "${input}"`);

        // Add to conversation history
        this.context.conversationHistory.push({
            role: 'user',
            content: input,
        });

        // Emergency detection on every input
        const emergencyResult = await this.emergencyDetection.analyze(input);

        if (emergencyResult.isEmergency && emergencyResult.confidence > 0.7) {
            this.context.isEmergency = true;
            await this.transition('EMERGENCY_DETECTED');
            return;
        }

        // State-specific input handling
        switch (this.context.state) {
            case VoiceState.GREETING:
                await this.handleGreetingInput(input);
                break;
            case VoiceState.EMERGENCY_SCREENING:
                await this.handleEmergencyScreeningInput(input);
                break;
            case VoiceState.TRIAGE:
                await this.handleTriageInput(input);
                break;
            case VoiceState.BOOKING:
                await this.handleBookingInput(input);
                break;
            default:
                console.warn(`No handler for input in state: ${this.context.state}`);
        }
    }

    /**
     * Handle START event
     */
    private async handleStart(): Promise<void> {
        this.context.state = VoiceState.GREETING;

        const greeting = await this.conversationManager.generateGreeting(this.context);
        this.context.conversationHistory.push({
            role: 'assistant',
            content: greeting,
        });

        console.log(`👋 Greeting: ${greeting}`);
    }

    /**
     * Handle emergency detection
     */
    private async handleEmergencyDetected(): Promise<void> {
        this.context.state = VoiceState.ESCALATING;
        this.context.isEmergency = true;

        console.log(`🚨 EMERGENCY DETECTED for call ${this.context.callSid}`);

        // TODO: Trigger immediate escalation to emergency services
        // TODO: Log emergency event to core-api
    }

    /**
     * Handle emergency cleared
     */
    private async handleEmergencyCleared(): Promise<void> {
        this.context.state = VoiceState.TRIAGE;
        this.context.isEmergency = false;

        console.log(`✅ Emergency cleared for call ${this.context.callSid}`);
    }

    /**
     * Handle intent detected
     */
    private async handleIntentDetected(): Promise<void> {
        const intent = this.context.detectedIntent;

        // Map intents to appropriate states
        switch (intent) {
            case 'schedule_appointment':
                this.context.state = VoiceState.BOOKING;
                break;
            case 'department_routing':
                // Handle department routing - collect info and route
                this.context.state = VoiceState.TRIAGE;
                console.log(`📍 Department routing requested - will route to appropriate department`);
                break;
            case 'prescription_refill':
                // Handle prescription refill - verify patient and collect medication info
                this.context.state = VoiceState.TRIAGE;
                console.log(`💊 Prescription refill requested - collecting patient information`);
                break;
            case 'insurance_verification':
                // Handle insurance verification - check plan acceptance
                this.context.state = VoiceState.TRIAGE;
                console.log(`🛡️ Insurance verification requested - checking plan acceptance`);
                break;
            case 'marketing_event':
                // Handle marketing event registration
                this.context.state = VoiceState.TRIAGE;
                console.log(`📅 Marketing event inquiry - providing event information`);
                break;
            default:
                this.context.state = VoiceState.TRIAGE;
        }
    }

    /**
     * Handle booking started
     */
    private async handleBookingStarted(): Promise<void> {
        this.context.state = VoiceState.BOOKING;
    }

    /**
     * Handle escalation
     */
    private async handleEscalate(): Promise<void> {
        this.context.state = VoiceState.ESCALATING;

        console.log(`📞 Escalating call ${this.context.callSid}`);

        // TODO: Create handoff payload and transfer to human
    }

    /**
     * Handle call end
     */
    private async handleEnd(): Promise<void> {
        this.context.state = VoiceState.COMPLETED;

        console.log(`✅ Call ended: ${this.context.callSid}`);

        // TODO: Save transcript to core-api
        // TODO: Create analytics events
    }

    /**
     * Handle input during greeting state
     */
    private async handleGreetingInput(_input: string): Promise<void> {
        // Move to emergency screening
        this.context.state = VoiceState.EMERGENCY_SCREENING;

        const response = await this.conversationManager.generateEmergencyScreening(this.context);
        this.context.conversationHistory.push({
            role: 'assistant',
            content: response,
        });
    }

    /**
     * Handle input during emergency screening
     */
    private async handleEmergencyScreeningInput(input: string): Promise<void> {
        // Check for emergency indicators
        const emergencyResult = await this.emergencyDetection.analyze(input);

        if (emergencyResult.isEmergency) {
            await this.transition('EMERGENCY_DETECTED');
        } else {
            // Move to triage
            this.context.state = VoiceState.TRIAGE;
        }
    }

    /**
     * Handle input during triage
     */
    private async handleTriageInput(input: string): Promise<void> {
        // Detect intent
        const intentResult = await this.intentRecognition.detectIntent(
            input,
            this.context.conversationHistory
        );

        this.context.detectedIntent = intentResult.intentKey;
        this.context.extractedFields = {
            ...this.context.extractedFields,
            ...intentResult.extractedFields,
        };

        await this.transition('INTENT_DETECTED');
    }

    /**
     * Handle input during booking
     */
    private async handleBookingInput(_input: string): Promise<void> {
        // Extract appointment details
        const response = await this.conversationManager.processBookingInput(this.context, _input);

        this.context.conversationHistory.push({
            role: 'assistant',
            content: response,
        });

        // Check if all required fields are collected
        if (this.hasAllRequiredFields()) {
            await this.transition('ESCALATE'); // Hand off to human for confirmation
        }
    }

    /**
     * Check if all required fields are collected
     */
    private hasAllRequiredFields(): boolean {
        // TODO: Check against intent's required fields
        return false;
    }
}
