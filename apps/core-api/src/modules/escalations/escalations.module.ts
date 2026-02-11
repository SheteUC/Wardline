import { Module } from '@nestjs/common';
import { EscalationsController } from './escalations.controller';
import { EscalationsService } from './escalations.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { QueuesModule } from '../queues/queues.module';

@Module({
    imports: [PrismaModule, QueuesModule],
    controllers: [EscalationsController],
    providers: [EscalationsService],
    exports: [EscalationsService],
})
export class EscalationsModule {}
