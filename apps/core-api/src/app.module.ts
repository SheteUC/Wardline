import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
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

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env.local', '.env'],
        }),
        PrismaModule,
        ClerkModule,
        AuditModule,
        HospitalsModule,
        UsersModule,
        IntentsModule,
        WorkflowsModule,
        CallsModule,
        SchedulingModule,
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
