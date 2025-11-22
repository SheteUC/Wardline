import { Module } from '@nestjs/common';
import { IntentsService } from './intents.service';
import { IntentsController } from './intents.controller';

@Module({
    controllers: [IntentsController],
    providers: [IntentsService],
    exports: [IntentsService],
})
export class IntentsModule { }
