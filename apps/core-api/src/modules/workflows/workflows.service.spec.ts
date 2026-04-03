import { WorkflowsService } from './workflows.service';

describe('WorkflowsService', () => {
    let service: WorkflowsService;
    let prisma: any;
    let cache: any;
    const originalSimulationMaxIterations = process.env.WORKFLOW_SIMULATION_MAX_ITERATIONS;

    beforeEach(() => {
        delete process.env.WORKFLOW_SIMULATION_MAX_ITERATIONS;
        prisma = {
            business: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
            },
            user: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                create: jest.fn(),
            },
            businessUser: {
                findFirst: jest.fn(),
                upsert: jest.fn(),
                create: jest.fn(),
            },
            workflow: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            workflowVersion: {
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn(),
            },
            phoneNumber: {
                findUnique: jest.fn(),
            },
        };
        cache = {
            getOrSet: jest.fn(async (_key: string, factory: () => Promise<unknown>) => factory()),
            invalidateByTag: jest.fn().mockResolvedValue(undefined),
            invalidateByPrefix: jest.fn().mockResolvedValue(undefined),
        };

        service = new WorkflowsService(prisma, cache);
    });

    afterAll(() => {
        if (originalSimulationMaxIterations === undefined) {
            delete process.env.WORKFLOW_SIMULATION_MAX_ITERATIONS;
        } else {
            process.env.WORKFLOW_SIMULATION_MAX_ITERATIONS = originalSimulationMaxIterations;
        }
    });

    it('returns the active published workflow for a business', async () => {
        prisma.workflow.findFirst.mockResolvedValue({
            id: 'workflow-1',
            name: 'Practice Setup Runtime',
            description: 'Generated',
            versions: [
                {
                    versionNumber: 1,
                    graphJson: {
                        nodes: [{ id: 'start', type: 'start', config: {} }],
                        edges: [],
                    },
                },
            ],
        });

        const result = await service.getActiveWorkflow('business-1');

        expect(result?.id).toBe('workflow-1');
        expect(result?.graphJson?.nodes).toHaveLength(1);
        expect(prisma.workflow.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    businessId: 'business-1',
                    status: 'PUBLISHED',
                }),
            }),
        );
    });

    it('creates a generated practice workflow from business settings', async () => {
        prisma.business.findFirst.mockResolvedValue({
            id: 'business-1',
            name: 'Family Practice',
            slug: 'family-practice',
            timeZone: 'America/New_York',
            settings: {
                enabledActions: ['appointment-request', 'insurance-check'],
                emergencyKeywords: ['chest pain'],
                outOfScopeKeywords: ['legal advice'],
            },
            integrations: [
                { category: 'SCHEDULING', status: 'CONNECTED' },
                { category: 'INSURANCE', status: 'CONNECTED' },
            ],
        });
        prisma.businessUser.findFirst.mockResolvedValue({ userId: 'user-1' });
        prisma.workflow.findFirst.mockResolvedValue(null);
        prisma.workflow.create.mockResolvedValue({ id: 'workflow-generated' });
        prisma.workflowVersion.create.mockResolvedValue({
            id: 'version-1',
            workflowId: 'workflow-generated',
            versionNumber: 1,
            status: 'PUBLISHED',
        });

        const result = await service.syncPracticeSetupWorkflow('business-1');

        expect(result.versionNumber).toBe(1);
        expect(prisma.workflow.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    name: 'Practice Setup Runtime',
                    businessId: 'business-1',
                }),
            }),
        );
        expect(prisma.workflowVersion.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    workflowId: 'workflow-generated',
                    status: 'PUBLISHED',
                    graphJson: expect.objectContaining({
                        nodes: expect.arrayContaining([
                            expect.objectContaining({ type: 'safety-check' }),
                            expect.objectContaining({ type: 'ai-agent' }),
                            expect.objectContaining({ type: 'integration' }),
                        ]),
                        __practiceSetup: expect.objectContaining({
                            source: 'practice_setup',
                            businessId: 'business-1',
                        }),
                    }),
                }),
            }),
        );
    });

    it('skips creating a new version when the generated practice workflow is unchanged', async () => {
        const graphJson = {
            nodes: [{ id: 'start', type: 'start', position: { x: 0, y: 0 }, config: { greetingMessage: 'hi' } }],
            edges: [],
            __practiceSetup: {
                source: 'practice_setup',
                businessId: 'business-1',
                generatedAt: 'old',
            },
            __runtime: {
                compiledAt: 'old',
                startNodeId: 'start',
                nodeIds: ['start'],
                endNodeIds: [],
                nodeCount: 1,
                edgeCount: 0,
                hasEmergencyScreen: false,
                hasSafetyCheck: false,
                adjacency: {},
            },
        };

        prisma.business.findFirst.mockResolvedValue({
            id: 'business-1',
            name: 'Family Practice',
            slug: 'family-practice',
            timeZone: 'America/New_York',
            settings: {},
            integrations: [],
        });
        prisma.businessUser.findFirst.mockResolvedValue({ userId: 'user-1' });
        prisma.workflow.findFirst.mockResolvedValue({
            id: 'workflow-generated',
            versions: [
                {
                    versionNumber: 3,
                    status: 'PUBLISHED',
                    graphJson,
                },
            ],
        });
        jest.spyOn(service as any, 'compilePracticeSetupGraph').mockReturnValue(graphJson);

        await service.syncPracticeSetupWorkflow('business-1');

        expect(prisma.workflowVersion.create).not.toHaveBeenCalled();
        expect(prisma.workflow.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'workflow-generated' },
            }),
        );
    });

    it('uses the configured simulation iteration cap', async () => {
        process.env.WORKFLOW_SIMULATION_MAX_ITERATIONS = '2';
        service = new WorkflowsService(prisma, cache);

        prisma.workflow.findUnique.mockResolvedValue({
            id: 'workflow-1',
            versions: [
                {
                    versionNumber: 1,
                    graphJson: {
                        nodes: [
                            { id: 'start', type: 'start' },
                            { id: 'loop', type: 'conditional' },
                        ],
                        edges: [
                            { fromNodeId: 'start', toNodeId: 'loop' },
                            { fromNodeId: 'loop', toNodeId: 'loop', condition: 'always' },
                        ],
                    },
                },
            ],
        });

        const result = await service.simulateWorkflow('workflow-1', { callerName: 'Jordan' });

        expect(result.iterations).toBe(2);
        expect(result.executionPath).toEqual(['start', 'loop']);
        expect(result.completed).toBe(false);
    });
});
