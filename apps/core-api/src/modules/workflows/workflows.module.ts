import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowsApiController, WorkflowsController } from './workflows.controller';
import { WorkflowValidatorService } from './services/workflow-validator.service';
import { CallsModule } from '../calls/calls.module';
import { SafetyModule } from '../safety/safety.module';

@Module({
    imports: [CallsModule, SafetyModule],
    controllers: [WorkflowsController, WorkflowsApiController],
    providers: [WorkflowsService, WorkflowValidatorService],
    exports: [WorkflowsService, WorkflowValidatorService],
})
export class WorkflowsModule {}
