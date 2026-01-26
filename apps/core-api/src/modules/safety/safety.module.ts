import { Module } from '@nestjs/common';
import { MedicalTriageGuardService } from './medical-triage-guard.service';

@Module({
    providers: [MedicalTriageGuardService],
    exports: [MedicalTriageGuardService],
})
export class SafetyModule { }
