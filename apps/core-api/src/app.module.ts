import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { ClerkModule } from './auth/clerk.module';
import { AuthGuard } from './auth/auth.guard';
import { RbacGuard } from './auth/rbac.guard';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { UsersModule } from './modules/users/users.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { CallsModule } from './modules/calls/calls.module';
import { TranscriptRetentionTask } from './tasks/transcript-retention.task';
// Agent Platform Modules
import { AgentsModule } from './modules/agents/agents.module';
import { SafetyModule } from './modules/safety/safety.module';
import { EscalationsModule } from './modules/escalations/escalations.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env.local', '.env'],
        }),
        ScheduleModule.forRoot(),
        PrismaModule,
        CacheModule, // Global in-memory cache for improved performance
        ClerkModule,
        AuditModule,
        BusinessesModule,
        UsersModule,
        WorkflowsModule,
        CallsModule,
        // Agent Platform Modules
        AgentsModule,
        SafetyModule,
        EscalationsModule,
        IntegrationsModule,
    ],
    providers: [
        // Global authentication guard - validates JWT tokens
        {
            provide: APP_GUARD,
            useClass: AuthGuard,
        },
        // Global RBAC guard - checks permissions
        {
            provide: APP_GUARD,
            useClass: RbacGuard,
        },
        // Global audit logging interceptor
        {
            provide: APP_INTERCEPTOR,
            useClass: AuditInterceptor,
        },
        // Nightly transcript retention cleanup
        TranscriptRetentionTask,
    ],
})
export class AppModule { }
