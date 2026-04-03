import { MODULE_METADATA } from '@nestjs/common/constants';
import { WorkflowsApiController, WorkflowsController } from './workflows.controller';
import { WorkflowsModule } from './workflows.module';

describe('WorkflowsModule', () => {
    it('registers the public workflow API controller', () => {
        const controllers =
            Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, WorkflowsModule) ?? [];

        expect(controllers).toEqual(
            expect.arrayContaining([WorkflowsController, WorkflowsApiController]),
        );
    });
});
