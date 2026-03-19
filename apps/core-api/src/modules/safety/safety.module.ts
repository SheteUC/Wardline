import { Module } from '@nestjs/common';
import { SafetyGuardService } from './safety-guard.service';
import { SafetyController } from './safety.controller';

@Module({
    controllers: [SafetyController],
    providers: [SafetyGuardService],
    exports: [SafetyGuardService],
})
export class SafetyModule {}
