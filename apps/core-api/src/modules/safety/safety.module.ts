import { Module } from '@nestjs/common';
import { MedicalTriageGuardService } from './medical-triage-guard.service';
import { WebSocketModule } from '../../websocket/websocket.module';

@Module({
    imports: [WebSocketModule],
    providers: [MedicalTriageGuardService],
    exports: [MedicalTriageGuardService],
})
export class SafetyModule { }
