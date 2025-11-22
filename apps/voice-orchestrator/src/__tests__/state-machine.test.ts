import { CallStateMachine } from '../state-machine/call-state-machine';
import { callContextManager } from '../state-machine/call-context';
import { VoiceState } from '@wardline/types';

describe('CallStateMachine', () => {
    describe('State Transitions', () => {
        it('should transition from INITIALIZING to GREETING on START', async () => {
            const context = callContextManager.createContext('test-call-123', 'US', '+1234567890');
            const stateMachine = new CallStateMachine(context);

            await stateMachine.transition('START');

            expect(context.state).toBe(VoiceState.GREETING);
            expect(context.conversationHistory.length).toBeGreaterThan(0);
        });

        it('should transition to ESCALATING on EMERGENCY_DETECTED', async () => {
            const context = callContextManager.createContext('test-call-123', 'US', '+1234567890');
            context.state = VoiceState.EMERGENCY_SCREENING;

            const stateMachine = new CallStateMachine(context);
            await stateMachine.transition('EMERGENCY_DETECTED');

            expect(context.state).toBe(VoiceState.ESCALATING);
            expect(context.isEmergency).toBe(true);
        });

        it('should transition to COMPLETED on END', async () => {
            const context = callContextManager.createContext('test-call-123', 'US', '+1234567890');
            context.state = VoiceState.ENDING;

            const stateMachine = new CallStateMachine(context);
            await stateMachine.transition('END');

            expect(context.state).toBe(VoiceState.COMPLETED);
        });
    });

    describe('Emergency Detection During Input', () => {
        it('should detect emergency and escalate immediately', async () => {
            const context = callContextManager.createContext('test-call-123', 'US', '+1234567890');
            context.state = VoiceState.GREETING;

            const stateMachine = new CallStateMachine(context);
            await stateMachine.handleInput('I have severe chest pain');

            expect(context.state).toBe(VoiceState.ESCALATING);
            expect(context.isEmergency).toBe(true);
        });

        it('should continue normal flow if no emergency', async () => {
            const context = callContextManager.createContext('test-call-123', 'US', '+1234567890');
            context.state = VoiceState.GREETING;

            const stateMachine = new CallStateMachine(context);
            await stateMachine.handleInput('I need to schedule an appointment');

            expect(context.state).not.toBe(VoiceState.ESCALATING);
            expect(context.isEmergency).toBe(false);
        });
    });

    describe('Conversation History', () => {
        it('should add user input to conversation history', async () => {
            const context = callContextManager.createContext('test-call-123', 'US', '+1234567890');
            const stateMachine = new CallStateMachine(context);
            const input = 'I need help';

            await stateMachine.handleInput(input);

            const userMessages = context.conversationHistory.filter((m) => m.role === 'user');
            expect(userMessages.length).toBeGreaterThan(0);
            expect(userMessages[0].content).toBe(input);
        });
    });

    describe('State-Specific Input Handling', () => {
        it('should move to EMERGENCY_SCREENING from GREETING', async () => {
            const context = callContextManager.createContext('test-call-123', 'US', '+1234567890');
            context.state = VoiceState.GREETING;

            const stateMachine = new CallStateMachine(context);
            await stateMachine.handleInput('Hello');

            expect(context.state).toBe(VoiceState.EMERGENCY_SCREENING);
        });

        it('should move to TRIAGE from EMERGENCY_SCREENING if no emergency', async () => {
            const context = callContextManager.createContext('test-call-123', 'US', '+1234567890');
            context.state = VoiceState.EMERGENCY_SCREENING;

            const stateMachine = new CallStateMachine(context);
            await stateMachine.handleInput('Everything is fine');

            expect(context.state).toBe(VoiceState.TRIAGE);
        });
    });
});
