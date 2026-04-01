import { SafetyGuardService } from './safety-guard.service';

describe('SafetyGuardService', () => {
    let service: SafetyGuardService;
    let prisma: any;

    beforeEach(() => {
        prisma = {
            businessSettings: {
                findUnique: jest.fn().mockResolvedValue({
                    outOfScopeKeywords: ['estate dispute'],
                    emergencyKeywords: ['code red'],
                }),
            },
        };
        service = new SafetyGuardService(prisma);
    });

    it('quickEmergencyCheck includes mental health and violence emergency phrases', () => {
        expect(service.quickEmergencyCheck('I want to kill myself')).toEqual(
            expect.objectContaining({
                isEmergency: true,
                triggeredKeywords: expect.arrayContaining([expect.stringContaining('kill\\s+myself')]),
            }),
        );

        expect(service.quickEmergencyCheck("I'm not safe at home")).toEqual(
            expect.objectContaining({
                isEmergency: true,
                triggeredKeywords: expect.arrayContaining([expect.stringContaining('unsafe\\s+at\\s+home')]),
            }),
        );
    });

    it('checkSafety distinguishes urgent clinical guidance from nonclinical out-of-scope requests', async () => {
        await expect(service.checkSafety('Can you tell me what these lab results mean?', 'business-1')).resolves.toEqual(
            expect.objectContaining({
                isEmergency: false,
                isOutOfScope: false,
                recommendedAction: 'human_transfer',
                triggeredKeywords: expect.arrayContaining([expect.stringContaining('lab\\s+results')]),
            }),
        );

        await expect(service.checkSafety('I need legal advice about a lawsuit.', 'business-1')).resolves.toEqual(
            expect.objectContaining({
                isEmergency: false,
                isOutOfScope: true,
                recommendedAction: 'human_transfer',
            }),
        );
    });

    it('merges custom emergency keywords into the medical emergency set', async () => {
        await expect(service.checkSafety('This is a code red situation.', 'business-1')).resolves.toEqual(
            expect.objectContaining({
                isEmergency: true,
                recommendedAction: 'emergency_escalate',
                triggeredKeywords: expect.arrayContaining([expect.stringContaining('code\\s+red')]),
            }),
        );
    });
});

