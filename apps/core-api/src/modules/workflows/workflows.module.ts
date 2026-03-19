import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowExecutionService } from './services/workflow-execution.service';
import { WorkflowValidatorService } from './services/workflow-validator.service';
import { CallsModule } from '../calls/calls.module';
import { SafetyModule } from '../safety/safety.module';

@Module({
    imports: [CallsModule, SafetyModule],
    controllers: [WorkflowsController],
    providers: [WorkflowsService, WorkflowExecutionService, WorkflowValidatorService],
    exports: [WorkflowsService, WorkflowExecutionService, WorkflowValidatorService],
})
export class WorkflowsModule {}
