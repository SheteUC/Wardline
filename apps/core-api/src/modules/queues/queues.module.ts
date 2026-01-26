import { Module } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { QueueAssignmentService } from './queue-assignment.service';
import { QueuesController } from './queues.controller';

@Module({
    controllers: [QueuesController],
    providers: [QueuesService, QueueAssignmentService],
    exports: [QueuesService, QueueAssignmentService],
})
export class QueuesModule { }
