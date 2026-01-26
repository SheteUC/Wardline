import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { ClerkModule } from './auth/clerk.module';
import { AuthGuard } from './auth/auth.guard';
import { RbacGuard } from './auth/rbac.guard';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { HospitalsModule } from './modules/hospitals/hospitals.module';
import { UsersModule } from './modules/users/users.module';
import { IntentsModule } from './modules/intents/intents.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { CallsModule } from './modules/calls/calls.module';
import { SchedulingModule } from './scheduling/scheduling.module';
// Call Center Feature Modules
import { DepartmentsModule } from './modules/departments/departments.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { InsuranceModule } from './modules/insurance/insurance.module';
import { MarketingEventsModule } from './modules/marketing-events/marketing-events.module';
// Multi-Agent Platform Modules
import { AgentsModule } from './modules/agents/agents.module';
import { QueuesModule } from './modules/queues/queues.module';
import { SafetyModule } from './modules/safety/safety.module';
import { WebSocketModule } from './websocket/websocket.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env.local', '.env'],
        }),
        PrismaModule,
        CacheModule, // Global in-memory cache for improved performance
        ClerkModule,
        AuditModule,
        WebSocketModule, // WebSocket for real-time updates
        HospitalsModule,
        UsersModule,
        IntentsModule,
        WorkflowsModule,
        CallsModule,
        SchedulingModule,
        // Call Center Feature Modules
        DepartmentsModule,
        PrescriptionsModule,
        InsuranceModule,
        MarketingEventsModule,
        // Multi-Agent Platform Modules
        AgentsModule,
        QueuesModule,
        SafetyModule,
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
    ],
})
export class AppModule { }
