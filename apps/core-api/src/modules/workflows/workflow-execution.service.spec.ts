import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowExecutionService } from './services/workflow-execution.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueAssignmentService } from '../queues/queue-assignment.service';
import { QueuesService } from '../queues/queues.service';
import { CallContextService } from '../calls/call-context.service';
import { AuditService } from '../../audit/audit.service';
import { SchedulingService } from '../../scheduling/scheduling.service';
import { CallContext, WorkflowNode } from '@wardline/types';

describe('WorkflowExecutionService', () => {
    let service: WorkflowExecutionService;

    const mockCallContext: Partial<CallContext> = {
        callId: 'call-1',
        hospitalId: 'hosp-1',
        transcript: [],
        extractedFields: {},
        isEmergency: false,
        detectedIntent: undefined,
        sentiment: 0.8,
    };

    const mockGraph = { nodes: [], edges: [] };

    const mockPrisma = {
        callSession: { findUnique: jest.fn() },
        callAssignment: { create: jest.fn() },
    };
    const mockQueueAssignment = { assignCallToAgent: jest.fn() };
    const mockQueuesService = {
        findAll: jest.fn().mockResolvedValue({ data: [{ id: 'q-1' }] }),
        create: jest.fn(),
    };
    const mockCallContext$ = {
        getOrCreate: jest.fn().mockImplementation((_id: string, ctx: any) => ({ ...ctx, callId: 'call-1' })),
        update: jest.fn().mockImplementation((_id: string, ctx: any) => ({ ...ctx })),
    };
    const mockAudit = { logAction: jest.fn() };
    const mockScheduling = { getIntegration: jest.fn(), createAppointment: jest.fn() };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WorkflowExecutionService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: QueueAssignmentService, useValue: mockQueueAssignment },
                { provide: QueuesService, useValue: mockQueuesService },
                { provide: CallContextService, useValue: mockCallContext$ },
                { provide: AuditService, useValue: mockAudit },
                { provide: SchedulingService, useValue: mockScheduling },
            ],
        }).compile();
        service = module.get<WorkflowExecutionService>(WorkflowExecutionService);
    });

    afterEach(() => jest.clearAllMocks());

    const makeNode = (type: string, config: Record<string, unknown> = {}): WorkflowNode => ({
        id: `node-${type}`,
        type: type as any,
        config,
    });

    // -----------------------------------------------------------------------
    // start node
    // -----------------------------------------------------------------------

    describe('start node', () => {
        it('returns success', async () => {
            const result = await service.executeNode(makeNode('start'), mockCallContext as any, mockGraph as any);
            expect(result.status).toBe('success');
        });
    });

    // -----------------------------------------------------------------------
    // emergency-screen node
    // -----------------------------------------------------------------------

    describe('emergency-screen node', () => {
        it('returns escalated when context is emergency', async () => {
            const result = await service.executeNode(
                makeNode('emergency-screen'),
                { ...mockCallContext, isEmergency: true } as any,
                mockGraph as any,
            );
            expect(result.status).toBe('escalated');
        });

        it('returns success when context is not emergency', async () => {
            const result = await service.executeNode(
                makeNode('emergency-screen'),
                { ...mockCallContext, isEmergency: false } as any,
                mockGraph as any,
            );
            expect(result.status).toBe('success');
        });
    });

    // -----------------------------------------------------------------------
    // route node
    // -----------------------------------------------------------------------

    describe('route node', () => {
        beforeEach(() => {
            mockPrisma.callSession.findUnique.mockResolvedValue({ hospitalId: 'hosp-1' });
            mockAudit.logAction.mockResolvedValue({});
        });

        it('matches intent equals rule', async () => {
            const node = makeNode('route', {
                routingRules: [{ condition: 'intent equals scheduling', target: 'node-sched' }],
                fallbackTarget: 'node-fallback',
            });
            const ctx = { ...mockCallContext, detectedIntent: 'scheduling', extractedFields: {} };
            const result = await service.executeNode(node, ctx as any, mockGraph as any);
            expect(result.status).toBe('success');
            expect(result.nextNodeId).toBe('node-sched');
        });

        it('falls back when no rule matches', async () => {
            const node = makeNode('route', {
                routingRules: [{ condition: 'intent equals billing', target: 'node-billing' }],
                fallbackTarget: 'node-fallback',
            });
            const ctx = { ...mockCallContext, detectedIntent: 'scheduling', extractedFields: {} };
            const result = await service.executeNode(node, ctx as any, mockGraph as any);
            expect(result.nextNodeId).toBe('node-fallback');
        });

        it('matches field contains rule', async () => {
            const node = makeNode('route', {
                routingRules: [{ condition: 'patient_name contains Smith', target: 'node-vip' }],
            });
            const ctx = { ...mockCallContext, extractedFields: { patient_name: 'John Smith' } };
            const result = await service.executeNode(node, ctx as any, mockGraph as any);
            expect(result.nextNodeId).toBe('node-vip');
        });
    });

    // -----------------------------------------------------------------------
    // webhook node
    // -----------------------------------------------------------------------

    describe('webhook node', () => {
        it('returns error when URL is not configured', async () => {
            const result = await service.executeNode(
                makeNode('webhook', { url: '' }),
                mockCallContext as any,
                mockGraph as any,
            );
            expect(result.status).toBe('error');
        });

        it('makes HTTP request and returns response', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ received: true }),
            });
            global.fetch = mockFetch as any;

            const result = await service.executeNode(
                makeNode('webhook', { url: 'https://example.com/webhook', method: 'POST' }),
                mockCallContext as any,
                mockGraph as any,
            );
            expect(result.status).toBe('success');
            expect(mockFetch).toHaveBeenCalledWith(
                'https://example.com/webhook',
                expect.objectContaining({ method: 'POST' }),
            );

            delete (global as any).fetch;
        });

        it('returns error on non-OK HTTP response', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
                headers: { get: () => 'text/plain' },
                text: async () => 'Internal Server Error',
            }) as any;

            const result = await service.executeNode(
                makeNode('webhook', { url: 'https://example.com/webhook' }),
                mockCallContext as any,
                mockGraph as any,
            );
            expect(result.status).toBe('error');

            delete (global as any).fetch;
        });
    });

    // -----------------------------------------------------------------------
    // integration node
    // -----------------------------------------------------------------------

    describe('integration node', () => {
        it('returns error when timetap integration is not configured', async () => {
            mockScheduling.getIntegration.mockResolvedValue(null);
            const result = await service.executeNode(
                makeNode('integration', { integration: 'timetap', action: 'create_appointment', params: {} }),
                mockCallContext as any,
                mockGraph as any,
            );
            expect(result.status).toBe('error');
        });

        it('delegates create_appointment to scheduling service', async () => {
            mockScheduling.getIntegration.mockResolvedValue({ id: 'int-1', provider: 'timetap' });
            mockScheduling.createAppointment.mockResolvedValue({ id: 'appt-1' });

            const result = await service.executeNode(
                makeNode('integration', {
                    integration: 'timetap',
                    action: 'create_appointment',
                    params: { patientName: 'John', patientPhone: '555-0100', scheduledAt: new Date().toISOString() },
                }),
                mockCallContext as any,
                mockGraph as any,
            );
            expect(result.status).toBe('success');
            expect(mockScheduling.createAppointment).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // end node
    // -----------------------------------------------------------------------

    describe('end node', () => {
        it('returns success', async () => {
            const result = await service.executeNode(makeNode('end'), mockCallContext as any, mockGraph as any);
            expect(result.status).toBe('success');
        });
    });

    // -----------------------------------------------------------------------
    // unknown node type
    // -----------------------------------------------------------------------

    describe('unknown node type', () => {
        it('returns error for unrecognised type', async () => {
            const result = await service.executeNode(makeNode('totally-unknown'), mockCallContext as any, mockGraph as any);
            expect(result.status).toBe('error');
        });
    });
});
