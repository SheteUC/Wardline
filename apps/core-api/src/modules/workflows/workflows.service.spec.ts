import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowsService } from './workflows.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('WorkflowsService', () => {
  let service: WorkflowsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    workflow: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workflowVersion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
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
    it('should return active workflow for hospital', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        hospitalId: 'hospital-1',
        name: 'Main Workflow',
        status: 'active',
        versions: [
          {
            id: 'version-1',
            version: 1,
            isPublished: true,
            workflowData: {
              nodes: [{ id: 'start', type: 'start' }],
              edges: [],
            },
          },
        ],
      };

      mockPrismaService.workflow.findFirst = jest.fn().mockResolvedValue(mockWorkflow);

      const result = await service.getActiveWorkflow('hospital-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('workflow-1');
      expect(result.nodes).toHaveLength(1);
      expect(prisma.workflow.findFirst).toHaveBeenCalledWith({
        where: {
          hospitalId: 'hospital-1',
          status: 'active',
        },
        include: {
          versions: {
            where: { isPublished: true },
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      });
    });

    it('should return null if no active workflow found', async () => {
      mockPrismaService.workflow.findFirst = jest.fn().mockResolvedValue(null);

      const result = await service.getActiveWorkflow('hospital-nonexistent');

      expect(result).toBeNull();
    });

    it('should filter by phone number if provided', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        hospitalId: 'hospital-1',
        phoneNumberId: 'phone-1',
        versions: [
          {
            workflowData: { nodes: [], edges: [] },
          },
        ],
      };

      mockPrismaService.workflow.findFirst = jest.fn().mockResolvedValue(mockWorkflow);

      await service.getActiveWorkflow('hospital-1', 'phone-1');

      expect(prisma.workflow.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            phoneNumberId: 'phone-1',
          }),
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
            workflowData: {
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
            workflowData: {
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
            workflowData: {
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
            workflowData: {
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
            workflowData: {
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
        versions: [{ version: 1 }],
      };

      const mockNewVersion = {
        id: 'version-2',
        workflowId: 'workflow-1',
        version: 2,
        workflowData,
      };

      mockPrismaService.workflow.findUnique = jest.fn().mockResolvedValue(mockWorkflow);
      mockPrismaService.workflowVersion.create = jest.fn().mockResolvedValue(mockNewVersion);

      const result = await service.createVersion('workflow-1', workflowData, 'user-1');

      expect(result.version).toBe(2);
      expect(prisma.workflowVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 2,
            workflowData,
            createdBy: 'user-1',
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
        version: 2,
        isPublished: false,
      };

      mockPrismaService.workflowVersion.findUnique = jest.fn().mockResolvedValue(mockVersion);
      mockPrismaService.workflowVersion.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      mockPrismaService.workflowVersion.update = jest.fn().mockResolvedValue({
        ...mockVersion,
        isPublished: true,
      });

      const result = await service.publishVersion('version-2');

      expect(result.isPublished).toBe(true);

      // Should unpublish other versions first
      expect(prisma.workflowVersion.updateMany).toHaveBeenCalledWith({
        where: { workflowId: 'workflow-1' },
        data: { isPublished: false },
      });

      // Then publish the new version
      expect(prisma.workflowVersion.update).toHaveBeenCalledWith({
        where: { id: 'version-2' },
        data: { isPublished: true },
      });
    });
  });

  describe('performance', () => {
    it('should load workflow in <100ms', async () => {
      const mockWorkflow = {
        id: 'workflow-1',
        hospitalId: 'hospital-1',
        versions: [
          {
            workflowData: {
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
      await service.getActiveWorkflow('hospital-1');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
