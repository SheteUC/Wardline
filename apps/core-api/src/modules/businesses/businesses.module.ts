import { Module } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
    imports: [WorkflowsModule],
    controllers: [BusinessesController],
    providers: [BusinessesService],
    exports: [BusinessesService],
})
export class BusinessesModule {}
