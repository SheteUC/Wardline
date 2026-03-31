import { EscalationsService } from './escalations.service';

describe('EscalationsService', () => {
    it('stores transfer target and pending issue context in handoff payload', async () => {
        const prisma: any = {
            handoff: {
                create: jest.fn().mockResolvedValue({ id: 'handoff-1' }),
            },
            callSession: {
                update: jest.fn().mockResolvedValue({ id: 'call-1' }),
            },
        };

        const service = new EscalationsService(prisma);

        const result = await service.escalateToHuman({
            callId: 'call-1',
            businessId: 'business-1',
            callerPhone: '+15550000001',
            callerName: 'Caller',
            isEmergency: false,
            transcript: 'Please transfer me to the front desk.',
            collectedFields: { reasonSummary: 'Medication question' },
            resolvedTurns: [],
            escalationReason: 'Medication question',
            transferTargetLabel: 'front desk',
            transferPhone: '+15551239999',
            attemptMode: 'hybrid_transfer',
            reasonCategory: 'refill',
            callbackPhone: '+15550000001',
            pendingIssues: ['billing request'],
            queueSnapshot: [{ domain: 'billing', summary: 'billing request' }],
            handoffSummary: 'Medication question',
        });

        expect(result).toEqual({
            outcome: 'transferred',
            transferPhone: '+15551239999',
        });
        expect(prisma.handoff.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    callId: 'call-1',
                    payload: expect.objectContaining({
                        transferTargetLabel: 'front desk',
                        transferPhone: '+15551239999',
                        pendingIssues: ['billing request'],
                        queueSnapshot: [{ domain: 'billing', summary: 'billing request' }],
                        summary: 'Medication question',
                    }),
                }),
            }),
        );
    });
});
