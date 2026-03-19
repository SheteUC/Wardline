import { Module } from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { VoiceOrchestratorClient } from './clients/voice-orchestrator.client';
import { CallContextService } from './call-context.service';

@Module({
    controllers: [CallsController],
    providers: [CallsService, VoiceOrchestratorClient, CallContextService],
    exports: [CallsService, VoiceOrchestratorClient, CallContextService],
})
export class CallsModule {}
