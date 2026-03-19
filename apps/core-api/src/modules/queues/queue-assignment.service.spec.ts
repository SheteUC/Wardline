import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { QueueAssignmentService } from './queue-assignment.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('QueueAssignmentService', () => {
    let service: QueueAssignmentService;

    const mockQueue = { id: 'queue-1', hospitalId: 'hosp-1', specialization: 'general' };

    const makeAgent = (id: string, skills: string[] = [], activeCalls = 0, priority = 0) => ({
        id,
        humanProfile: { skills, priorityLevel: priority, maxConcurrentCalls: 3, specialization: ['general'] },
        callAssignments: Array.from({ length: activeCalls }, (_, i) => ({ id: `assign-${id}-${i}` })),
    });

    const mockPrisma = {
        callQueue: { findUnique: jest.fn() },
        agentSession: { findMany: jest.fn() },
        callAssignment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                QueueAssignmentService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();
        service = module.get<QueueAssignmentService>(QueueAssignmentService);
    });

    afterEach(() => jest.clearAllMocks());

    // -----------------------------------------------------------------------
    // assignCallToAgent
    // -----------------------------------------------------------------------

    describe('assignCallToAgent', () => {
        it('throws NotFoundException when queue does not exist', async () => {
            mockPrisma.callQueue.findUnique.mockResolvedValue(null);
            await expect(service.assignCallToAgent('bad-id', 'call-1')).rejects.toThrow(NotFoundException);
        });

        it('creates a QUEUED assignment when no agents are available', async () => {
            mockPrisma.callQueue.findUnique.mockResolvedValue(mockQueue);
            mockPrisma.agentSession.findMany.mockResolvedValue([]);
            mockPrisma.callAssignment.create.mockResolvedValue({ id: 'a1', status: 'QUEUED' });

            const result = await service.assignCallToAgent('queue-1', 'call-1');
            expect(result.status).toBe('QUEUED');
            expect(mockPrisma.callAssignment.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ status: 'QUEUED' }) }),
            );
        });

        it('creates an ASSIGNED assignment when agents are available', async () => {
            mockPrisma.callQueue.findUnique.mockResolvedValue(mockQueue);
            mockPrisma.agentSession.findMany.mockResolvedValue([
                { agent: makeAgent('agent-1', ['general']) },
            ]);
            mockPrisma.callAssignment.create.mockResolvedValue({ id: 'a2', status: 'ASSIGNED', agentId: 'agent-1' });

            const result = await service.assignCallToAgent('queue-1', 'call-1', { strategy: 'least_busy' });
            expect(result.status).toBe('ASSIGNED');
        });
    });

    // -----------------------------------------------------------------------
    // Strategy: skill_based
    // -----------------------------------------------------------------------

    describe('skill_based strategy', () => {
        it('selects agent with the most matching skills', async () => {
            mockPrisma.callQueue.findUnique.mockResolvedValue(mockQueue);
            const agents = [
                { agent: makeAgent('agent-low', ['general']) },
                { agent: makeAgent('agent-high', ['general', 'billing', 'clinical']) },
            ];
            mockPrisma.agentSession.findMany.mockResolvedValue(agents);
            mockPrisma.callAssignment.create.mockResolvedValue({ id: 'a3', agentId: 'agent-high', status: 'ASSIGNED' });

            await service.assignCallToAgent('queue-1', 'call-1', {
                strategy: 'skill_based',
                requiredSkills: ['billing', 'clinical'],
            });

            expect(mockPrisma.callAssignment.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ agentId: 'agent-high' }),
                }),
            );
        });
    });

    // -----------------------------------------------------------------------
    // Strategy: round_robin
    // -----------------------------------------------------------------------

    describe('round_robin strategy', () => {
        it('cycles through agents in order', async () => {
            mockPrisma.callQueue.findUnique.mockResolvedValue(mockQueue);
            const agents = [
                { agent: makeAgent('agent-a') },
                { agent: makeAgent('agent-b') },
            ];
            mockPrisma.agentSession.findMany.mockResolvedValue(agents);
            mockPrisma.callAssignment.create.mockResolvedValue({ id: 'rr', agentId: 'agent-a', status: 'ASSIGNED' });

            await service.assignCallToAgent('queue-1', 'call-1', { strategy: 'round_robin' });
            await service.assignCallToAgent('queue-1', 'call-2', { strategy: 'round_robin' });

            const calls = mockPrisma.callAssignment.create.mock.calls;
            const firstAgent = calls[0][0].data.agentId;
            const secondAgent = calls[1][0].data.agentId;
            expect(firstAgent).not.toBe(secondAgent);
        });
    });

    // -----------------------------------------------------------------------
    // Strategy: least_busy
    // -----------------------------------------------------------------------

    describe('least_busy strategy', () => {
        it('selects agent with fewest active calls', async () => {
            mockPrisma.callQueue.findUnique.mockResolvedValue(mockQueue);
            mockPrisma.agentSession.findMany.mockResolvedValue([
                { agent: makeAgent('busy-agent', [], 2) },
                { agent: makeAgent('idle-agent', [], 0) },
            ]);
            mockPrisma.callAssignment.create.mockResolvedValue({ id: 'lb', agentId: 'idle-agent', status: 'ASSIGNED' });

            await service.assignCallToAgent('queue-1', 'call-1', { strategy: 'least_busy' });
            expect(mockPrisma.callAssignment.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ agentId: 'idle-agent' }),
                }),
            );
        });
    });

    // -----------------------------------------------------------------------
    // Strategy: priority_based
    // -----------------------------------------------------------------------

    describe('priority_based strategy', () => {
        it('selects agent with highest priority level', async () => {
            mockPrisma.callQueue.findUnique.mockResolvedValue(mockQueue);
            mockPrisma.agentSession.findMany.mockResolvedValue([
                { agent: makeAgent('low-prio', [], 0, 1) },
                { agent: makeAgent('high-prio', [], 0, 10) },
            ]);
            mockPrisma.callAssignment.create.mockResolvedValue({ id: 'pb', agentId: 'high-prio', status: 'ASSIGNED' });

            await service.assignCallToAgent('queue-1', 'call-1', { strategy: 'priority_based' });
            expect(mockPrisma.callAssignment.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ agentId: 'high-prio' }),
                }),
            );
        });
    });

    // -----------------------------------------------------------------------
    // acceptAssignment / completeAssignment / abandonAssignment
    // -----------------------------------------------------------------------

    describe('acceptAssignment', () => {
        it('updates status to ACCEPTED', async () => {
            mockPrisma.callAssignment.findUnique.mockResolvedValue({ id: 'a1', agentId: 'agent-1' });
            mockPrisma.callAssignment.update.mockResolvedValue({ id: 'a1', status: 'ACCEPTED' });
            const result = await service.acceptAssignment('a1', 'agent-1');
            expect(result.status).toBe('ACCEPTED');
        });

        it('throws NotFoundException when assignment not found', async () => {
            mockPrisma.callAssignment.findUnique.mockResolvedValue(null);
            await expect(service.acceptAssignment('bad', 'agent-1')).rejects.toThrow(NotFoundException);
        });

        it('throws when wrong agent tries to accept', async () => {
            mockPrisma.callAssignment.findUnique.mockResolvedValue({ id: 'a1', agentId: 'agent-1' });
            await expect(service.acceptAssignment('a1', 'other-agent')).rejects.toThrow();
        });
    });

    describe('completeAssignment', () => {
        it('updates status to COMPLETED', async () => {
            mockPrisma.callAssignment.update.mockResolvedValue({ id: 'a1', status: 'COMPLETED' });
            const result = await service.completeAssignment('a1');
            expect(result.status).toBe('COMPLETED');
        });
    });

    describe('abandonAssignment', () => {
        it('updates status to ABANDONED', async () => {
            mockPrisma.callAssignment.update.mockResolvedValue({ id: 'a1', status: 'ABANDONED' });
            const result = await service.abandonAssignment('a1');
            expect(result.status).toBe('ABANDONED');
        });
    });
});
