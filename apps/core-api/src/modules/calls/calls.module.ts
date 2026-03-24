import { Module } from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { FollowUpTasksModule } from '../follow-up-tasks/follow-up-tasks.module';

@Module({
    imports: [FollowUpTasksModule],
    controllers: [CallsController],
    providers: [CallsService],
    exports: [CallsService],
})
export class CallsModule {}
