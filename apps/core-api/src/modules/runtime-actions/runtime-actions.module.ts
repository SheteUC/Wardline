import { Module } from '@nestjs/common';
import { FollowUpTasksModule } from '../follow-up-tasks/follow-up-tasks.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { RuntimeActionsController } from './runtime-actions.controller';
import { RuntimeActionsService } from './runtime-actions.service';

@Module({
    imports: [FollowUpTasksModule, IntegrationsModule],
    controllers: [RuntimeActionsController],
    providers: [RuntimeActionsService],
    exports: [RuntimeActionsService],
})
export class RuntimeActionsModule {}
