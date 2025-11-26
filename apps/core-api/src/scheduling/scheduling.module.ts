import { Module } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { SchedulingController } from './scheduling.controller';
import { TimeTapService } from './providers/timetap.service';
import { NexHealthService } from './providers/nexhealth.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SchedulingController],
    providers: [SchedulingService, TimeTapService, NexHealthService],
    exports: [SchedulingService],
})
export class SchedulingModule { }
