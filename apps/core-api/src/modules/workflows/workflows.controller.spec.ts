import { BadRequestException } from '@nestjs/common';
import { WorkflowsController, WorkflowsApiController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';

describe('WorkflowsController', () => {
    it('create strips userId from payload passed to service', async () => {
        const workflowsService = {
            create: jest.fn().mockResolvedValue({ id: 'wf1' }),
        };
        const controller = new WorkflowsController(workflowsService as unknown as WorkflowsService);
        await controller.create('biz1', {
            name: 'Test',
            userId: 'actor1',
            description: 'd',
        } as any);
        expect(workflowsService.create).toHaveBeenCalledWith('biz1', 'actor1', {
            name: 'Test',
            description: 'd',
        });
    });

    it('simulateWorkflow throws BadRequestException for non-object body', () => {
        const workflowsService = { simulateWorkflow: jest.fn() };
        const controller = new WorkflowsController(workflowsService as unknown as WorkflowsService);
        expect(() => controller.simulateWorkflow('wf1', [] as unknown as object)).toThrow(
            BadRequestException,
        );
        expect(workflowsService.simulateWorkflow).not.toHaveBeenCalled();
    });
});

describe('WorkflowsApiController', () => {
    it('getActiveWorkflow delegates', async () => {
        const workflowsService = {
            getActiveWorkflow: jest.fn().mockResolvedValue(null),
        };
        const controller = new WorkflowsApiController(workflowsService as unknown as WorkflowsService);
        await controller.getActiveWorkflow('biz1', undefined);
        expect(workflowsService.getActiveWorkflow).toHaveBeenCalledWith('biz1', undefined);
    });
});
