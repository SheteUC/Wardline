import { Module } from '@nestjs/common';
import { CallIngestService } from './call-ingest.service';
import { CallProjectionService } from './call-projection.service';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { FollowUpTasksModule } from '../follow-up-tasks/follow-up-tasks.module';
import { CallCutoverMetricsService } from './call-cutover-metrics.service';

@Module({
    imports: [FollowUpTasksModule],
    controllers: [CallsController],
    providers: [CallProjectionService, CallCutoverMetricsService, CallIngestService, CallsService],
    exports: [CallProjectionService, CallCutoverMetricsService, CallIngestService, CallsService],
})
export class CallsModule {}
