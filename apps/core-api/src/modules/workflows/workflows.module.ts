import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowExecutionService } from './services/workflow-execution.service';
import { WorkflowValidatorService } from './services/workflow-validator.service';
import { QueuesModule } from '../queues/queues.module';

@Module({
    imports: [QueuesModule],
    controllers: [WorkflowsController],
    providers: [
        WorkflowsService,
        WorkflowExecutionService,
        WorkflowValidatorService,
    ],
    exports: [
        WorkflowsService,
        WorkflowExecutionService,
        WorkflowValidatorService,
    ],
})
export class WorkflowsModule { }
