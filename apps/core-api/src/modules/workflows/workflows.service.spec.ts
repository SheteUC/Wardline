import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowsService } from './workflows.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('WorkflowsService', () => {
  let service: WorkflowsService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    workflow: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workflowVersion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    phoneNumber: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WorkflowsService>(WorkflowsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveWorkflow', () => {
    it('should return active workflow for business', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        businessId: 'business-1',
        name: 'Main Workflow',
        status: 'PUBLISHED',
        versions: [
          {
            id: 'version-1',
            versionNumber: 1,
            graphJson: {
              nodes: [{ id: 'start', type: 'start' }],
              edges: [],
            },
          },
        ],
      };

      mockPrismaService.workflow.findFirst = jest.fn().mockResolvedValue(mockWorkflow);

      const result = await service.getActiveWorkflow('business-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('workflow-1');
      expect(result.graphJson.nodes).toHaveLength(1);
      expect(prisma.workflow.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'business-1',
            status: 'PUBLISHED',
          }),
        }),
      );
    });

    it('should return null if no active workflow found', async () => {
      mockPrismaService.workflow.findFirst = jest.fn().mockResolvedValue(null);

      const result = await service.getActiveWorkflow('business-nonexistent');

      expect(result).toBeNull();
    });

    it('should filter by phone number if provided', async () => {
      mockPrismaService.phoneNumber.findUnique.mockResolvedValue({
        workflow: {
          id: 'workflow-1',
          name: 'Phone Workflow',
          description: null,
          versions: [{ versionNumber: 1, graphJson: { nodes: [], edges: [] } }],
        },
      });

      const result = await service.getActiveWorkflow('business-1', 'phone-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('workflow-1');
      expect(prisma.phoneNumber.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'phone-1' },
        }),
      );
    });
  });

  describe('validateWorkflow', () => {
    it('should validate a correct workflow', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        versions: [
          {
            graphJson: {
              nodes: [
                { id: 'start', type: 'start' },
                { id: 'ai-1', type: 'ai-agent', config: { systemPrompt: 'Test' } },
                { id: 'end', type: 'end' },
              ],
              edges: [
                { id: 'e1', fromNodeId: 'start', toNodeId: 'ai-1' },
                { id: 'e2', fromNodeId: 'ai-1', toNodeId: 'end' },
              ],
            },
          },
        ],
      };

      mockPrismaService.workflow.findUnique = jest.fn().mockResolvedValue(mockWorkflow);

      const result = await service.validateWorkflow('workflow-1');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing start node', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        versions: [
          {
            graphJson: {
              nodes: [
                { id: 'ai-1', type: 'ai-agent' },
              ],
              edges: [],
            },
          },
        ],
      };

      mockPrismaService.workflow.findUnique = jest.fn().mockResolvedValue(mockWorkflow);

      const result = await service.validateWorkflow('workflow-1');

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'structure',
          message: expect.stringContaining('start node'),
        }),
      );
    });

    it('should detect unreachable nodes', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        versions: [
          {
            graphJson: {
              nodes: [
                { id: 'start', type: 'start' },
                { id: 'orphan', type: 'ai-agent' },
                { id: 'end', type: 'end' },
              ],
              edges: [
                { id: 'e1', fromNodeId: 'start', toNodeId: 'end' },
              ],
            },
          },
        ],
      };

      mockPrismaService.workflow.findUnique = jest.fn().mockResolvedValue(mockWorkflow);

      const result = await service.validateWorkflow('workflow-1');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('unreachable'))).toBe(true);
    });

    it('should throw NotFoundException if workflow not found', async () => {
      mockPrismaService.workflow.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.validateWorkflow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('simulateWorkflow', () => {
    it('should simulate workflow execution', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        versions: [
          {
            graphJson: {
              nodes: [
                { id: 'start', type: 'start' },
                { id: 'ai-1', type: 'ai-agent', config: {} },
                { id: 'end', type: 'end' },
              ],
              edges: [
                { id: 'e1', fromNodeId: 'start', toNodeId: 'ai-1' },
                { id: 'e2', fromNodeId: 'ai-1', toNodeId: 'end' },
              ],
            },
          },
        ],
      };

      mockPrismaService.workflow.findUnique = jest.fn().mockResolvedValue(mockWorkflow);

      const testInputs = {
        userInputs: ['I need an appointment'],
      };

      const result = await service.simulateWorkflow('workflow-1', testInputs);

      expect(result.success).toBe(true);
      expect(result.executionPath).toContain('start');
      expect(result.executionPath).toContain('ai-1');
      expect(result.executionPath).toContain('end');
    });

    it('should handle simulation errors gracefully', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        versions: [
          {
            graphJson: {
              nodes: [
                { id: 'start', type: 'start' },
                { id: 'broken', type: 'invalid-type' },
              ],
              edges: [{ id: 'e1', fromNodeId: 'start', toNodeId: 'broken' }],
            },
          },
        ],
      };

      mockPrismaService.workflow.findUnique = jest.fn().mockResolvedValue(mockWorkflow);

      const result = await service.simulateWorkflow('workflow-1', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createVersion', () => {
    it('should create new workflow version', async () => {
      const workflowData = {
        nodes: [{ id: 'start', type: 'start' }],
        edges: [],
      };

      const mockWorkflow = {
        id: 'workflow-1',
        versions: [{ versionNumber: 1 }],
      };

      const mockNewVersion = {
        id: 'version-2',
        workflowId: 'workflow-1',
        versionNumber: 2,
        graphJson: workflowData,
      };

      mockPrismaService.workflow.findUnique = jest.fn().mockResolvedValue(mockWorkflow);
      mockPrismaService.workflowVersion.create = jest.fn().mockResolvedValue(mockNewVersion);

      const result = await service.createVersion('workflow-1', 'user-1', workflowData);

      expect(result.versionNumber).toBe(2);
      expect(prisma.workflowVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            versionNumber: 2,
            graphJson: workflowData,
            createdByUserId: 'user-1',
          }),
        }),
      );
    });
  });

  describe('publishVersion', () => {
    it('should publish workflow version and unpublish others', async () => {
      const mockVersion = {
        id: 'version-2',
        workflowId: 'workflow-1',
        workflow: { id: 'workflow-1' },
        versionNumber: 2,
        status: 'DRAFT',
      };

      mockPrismaService.workflowVersion.findUnique = jest.fn().mockResolvedValue(mockVersion);
      mockPrismaService.workflowVersion.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      mockPrismaService.workflowVersion.update = jest.fn().mockResolvedValue({
        ...mockVersion,
        status: 'PUBLISHED',
      });

      const result = await service.publishVersion('version-2', 'approver-user-1');

      expect(result.status).toBe('PUBLISHED');

      // Should unpublish other versions first
      expect(prisma.workflowVersion.updateMany).toHaveBeenCalled();

      // Then publish the new version
      expect(prisma.workflowVersion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'version-2' },
          data: expect.objectContaining({ status: 'PUBLISHED' }),
        }),
      );
    });
  });

  describe('performance', () => {
    it('should load workflow in <100ms', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        businessId: 'business-1',
        versions: [
          {
            graphJson: {
              nodes: Array(100).fill(null).map((_, i) => ({ id: `node-${i}`, type: 'ai-agent' })),
              edges: Array(99).fill(null).map((_, i) => ({
                id: `edge-${i}`,
                fromNodeId: `node-${i}`,
                toNodeId: `node-${i + 1}`,
              })),
            },
          },
        ],
      };

      mockPrismaService.workflow.findFirst = jest.fn().mockResolvedValue(mockWorkflow);

      const start = Date.now();
      await service.getActiveWorkflow('business-1');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
