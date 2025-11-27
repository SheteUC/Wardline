import { Module } from '@nestjs/common';
import { MarketingEventsService } from './marketing-events.service';
import { MarketingEventsController } from './marketing-events.controller';

@Module({
    controllers: [MarketingEventsController],
    providers: [MarketingEventsService],
    exports: [MarketingEventsService],
})
export class MarketingEventsModule { }

