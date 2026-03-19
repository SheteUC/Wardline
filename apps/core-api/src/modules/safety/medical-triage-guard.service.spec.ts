import { Test, TestingModule } from '@nestjs/testing';
import { MedicalTriageGuardService } from './medical-triage-guard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentWebSocketGateway } from '../../websocket/websocket.gateway';

describe('MedicalTriageGuardService', () => {
    let service: MedicalTriageGuardService;

    const mockPrisma = {
        callSession: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        transcriptSegment: {
            findMany: jest.fn(),
        },
        auditLog: {
            create: jest.fn(),
            count: jest.fn(),
        },
    };

    const mockWsGateway = {
        notifyEmergency: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MedicalTriageGuardService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: AgentWebSocketGateway, useValue: mockWsGateway },
            ],
        }).compile();
        service = module.get<MedicalTriageGuardService>(MedicalTriageGuardService);
    });

    afterEach(() => jest.clearAllMocks());

    // -----------------------------------------------------------------------
    // detectMedicalContent
    // -----------------------------------------------------------------------

    describe('detectMedicalContent', () => {
        it('returns isMedical=false for routine conversation', async () => {
            const result = await service.detectMedicalContent('I would like to schedule an appointment.');
            expect(result.isMedical).toBe(false);
            expect(result.triggeredKeywords).toHaveLength(0);
            expect(result.requiresHumanEscalation).toBe(false);
        });

        it('detects emergency keywords', async () => {
            const result = await service.detectMedicalContent('I am having chest pain and cannot breathe.');
            expect(result.isMedical).toBe(true);
            expect(result.triggeredKeywords).toContain('chest pain');
            expect(result.requiresHumanEscalation).toBe(true);
        });

        it('detects mental health keywords', async () => {
            const result = await service.detectMedicalContent('I feel suicidal and want to harm myself.');
            expect(result.isMedical).toBe(true);
            expect(result.triggeredKeywords).toContain('suicidal');
            expect(result.requiresHumanEscalation).toBe(true);
        });

        it('detects clinical keywords without requiring escalation', async () => {
            const result = await service.detectMedicalContent('I want to know my test results and symptoms.');
            expect(result.isMedical).toBe(true);
            expect(result.requiresHumanEscalation).toBe(false);
        });

        it('is case-insensitive', async () => {
            const result = await service.detectMedicalContent('CHEST PAIN and STROKE symptoms');
            expect(result.isMedical).toBe(true);
            expect(result.triggeredKeywords).toContain('chest pain');
        });

        it('calculates higher confidence for multiple keywords', async () => {
            const few = await service.detectMedicalContent('chest pain');
            const many = await service.detectMedicalContent(
                'chest pain, stroke, seizure, overdose, suicidal'
            );
            expect(many.confidence).toBeGreaterThan(few.confidence);
        });

        it('boosts confidence for emergency keywords', async () => {
            const clinical = await service.detectMedicalContent('symptoms and treatment');
            const emergency = await service.detectMedicalContent('heart attack');
            expect(emergency.confidence).toBeGreaterThan(clinical.confidence);
        });
    });

    // -----------------------------------------------------------------------
    // enforceHumanEscalation
    // -----------------------------------------------------------------------

    describe('enforceHumanEscalation', () => {
        const callId = 'call-test';

        beforeEach(() => {
            mockPrisma.callSession.findUnique.mockResolvedValue({ hospitalId: 'hosp-1' });
            mockPrisma.callSession.update.mockResolvedValue({});
            mockPrisma.auditLog.create.mockResolvedValue({});
        });

        it('updates call tag to CLINICAL_ESCALATION', async () => {
            await service.enforceHumanEscalation(callId, 'test', ['symptoms']);
            expect(mockPrisma.callSession.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ tag: 'CLINICAL_ESCALATION' }),
                }),
            );
        });

        it('marks call as emergency for critical keywords', async () => {
            await service.enforceHumanEscalation(callId, 'emergency', ['chest pain']);
            expect(mockPrisma.callSession.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ isEmergency: true }),
                }),
            );
        });

        it('sends WebSocket alert for emergency keywords', async () => {
            await service.enforceHumanEscalation(callId, 'emergency', ['heart attack']);
            expect(mockWsGateway.notifyEmergency).toHaveBeenCalledWith(
                callId,
                expect.any(String),
                expect.arrayContaining(['heart attack']),
            );
        });

        it('does not send emergency alert for non-critical keywords', async () => {
            await service.enforceHumanEscalation(callId, 'clinical', ['symptoms']);
            expect(mockWsGateway.notifyEmergency).not.toHaveBeenCalled();
        });

        it('logs a safety event to audit log', async () => {
            await service.enforceHumanEscalation(callId, 'test', ['overdose']);
            expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: 'SAFETY_EVENT',
                        entityType: 'CallSession',
                        entityId: callId,
                    }),
                }),
            );
        });
    });

    // -----------------------------------------------------------------------
    // analyzeTranscript
    // -----------------------------------------------------------------------

    describe('analyzeTranscript', () => {
        it('does not escalate for safe transcripts', async () => {
            mockPrisma.transcriptSegment.findMany.mockResolvedValue([
                { text: 'I need to schedule an appointment', callId: 'call-1' },
            ]);
            mockPrisma.callSession.findUnique.mockResolvedValue({ hospitalId: 'hosp-1' });
            mockPrisma.callSession.update.mockResolvedValue({});
            mockPrisma.auditLog.create.mockResolvedValue({});

            await service.analyzeTranscript('call-1');
            expect(mockPrisma.callSession.update).not.toHaveBeenCalled();
        });

        it('escalates when transcript contains critical keywords', async () => {
            mockPrisma.transcriptSegment.findMany.mockResolvedValue([
                { text: 'The patient is having a heart attack', callId: 'call-2' },
            ]);
            mockPrisma.callSession.findUnique.mockResolvedValue({ hospitalId: 'hosp-1' });
            mockPrisma.callSession.update.mockResolvedValue({});
            mockPrisma.auditLog.create.mockResolvedValue({});

            await service.analyzeTranscript('call-2');
            expect(mockPrisma.callSession.update).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // getSafetyStats
    // -----------------------------------------------------------------------

    describe('getSafetyStats', () => {
        it('returns counts from audit log', async () => {
            mockPrisma.auditLog.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3);
            const stats = await service.getSafetyStats('hosp-1');
            expect(stats.totalSafetyEvents).toBe(10);
            expect(stats.emergencyEscalations).toBe(3);
        });
    });
});
