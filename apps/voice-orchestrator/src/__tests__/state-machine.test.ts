import { CallStateMachine } from '../state-machine/call-state-machine';
import { CallContext, VoiceState } from '../state-machine/call-context';

describe('CallStateMachine', () => {
    let context: CallContext;
    let stateMachine: CallStateMachine;

    beforeEach(() => {
        context = {
            callSid: 'test-call-123',
            from: '+15555551234',
            to: '+15555556789',
            hospitalId: 'hospital-1',
            state: VoiceState.INITIALIZING,
            conversationHistory: [],
            extractedFields: {},
            isEmergency: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        stateMachine = new CallStateMachine(context);
    });

    describe('State Transitions', () => {
        it('should transition from INITIALIZING to GREETING on START', async () => {
            await stateMachine.transition('START');

            expect(context.state).toBe(VoiceState.GREETING);
            expect(context.conversationHistory.length).toBeGreaterThan(0);
        });

        it('should transition to ESCALATING on EMERGENCY_DETECTED', async () => {
            context.state = VoiceState.EMERGENCY_SCREENING;

            await stateMachine.transition('EMERGENCY_DETECTED');

            expect(context.state).toBe(VoiceState.ESCALATING);
            expect(context.isEmergency).toBe(true);
        });

        it('should transition to COMPLETED on END', async () => {
            context.state = VoiceState.ENDING;

            await stateMachine.transition('END');

            expect(context.state).toBe(VoiceState.COMPLETED);
        });
    });

    describe('Emergency Detection During Input', () => {
        it('should detect emergency and escalate immediately', async () => {
            context.state = VoiceState.GREETING;

            await stateMachine.handleInput('I have severe chest pain');

            // Should transition to ESCALATING due to emergency
            expect(context.state).toBe(VoiceState.ESCALATING);
            expect(context.isEmergency).toBe(true);
        });

        it('should continue normal flow if no emergency', async () => {
            context.state = VoiceState.GREETING;

            await stateMachine.handleInput('I need to schedule an appointment');

            // Should not be in ESCALATING state
            expect(context.state).not.toBe(VoiceState.ESCALATING);
            expect(context.isEmergency).toBe(false);
        });
    });

    describe('Conversation History', () => {
        it('should add user input to conversation history', async () => {
            const input = 'I need help';

            await stateMachine.handleInput(input);

            const userMessages = context.conversationHistory.filter(m => m.role === 'user');
            expect(userMessages.length).toBeGreaterThan(0);
            expect(userMessages[0].content).toBe(input);
        });
    });

    describe('State-Specific Input Handling', () => {
        it('should move to EMERGENCY_SCREENING from GREETING', async () => {
            context.state = VoiceState.GREETING;

            await stateMachine.handleInput('Hello');

            expect(context.state).toBe(VoiceState.EMERGENCY_SCREENING);
        });

        it('should move to TRIAGE from EMERGENCY_SCREENING if no emergency', async () => {
            context.state = VoiceState.EMERGENCY_SCREENING;

            await stateMachine.handleInput('No emergency');

            expect(context.state).toBe(VoiceState.TRIAGE);
        });
    });
});
