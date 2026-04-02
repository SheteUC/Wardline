import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { CryptoModule } from './crypto/crypto.module';
import { ClerkModule } from './auth/clerk.module';
import { AuthGuard } from './auth/auth.guard';
import { RbacGuard } from './auth/rbac.guard';
import { InternalApiGuard } from './auth/internal-api.guard';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { UsersModule } from './modules/users/users.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { CallsModule } from './modules/calls/calls.module';
import { TranscriptRetentionTask } from './tasks/transcript-retention.task';
import { SafetyModule } from './modules/safety/safety.module';
import { EscalationsModule } from './modules/escalations/escalations.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { FollowUpTasksModule } from './modules/follow-up-tasks/follow-up-tasks.module';
import { RuntimeActionsModule } from './modules/runtime-actions/runtime-actions.module';
import { HealthController } from './health.controller';
import { ObservabilityModule } from './observability/observability.module';

const rootEnvFilePaths = [
    resolve(__dirname, '../../../.env.local'),
    resolve(__dirname, '../../../.env'),
];

const deprecatedEnvFilePaths = [
    resolve(__dirname, '../.env.local'),
    resolve(__dirname, '../.env'),
];

const deprecatedCoreApiEnvPaths = deprecatedEnvFilePaths.filter((envPath) => existsSync(envPath));
const shouldWarnOnDeprecatedEnvFiles =
    process.env.WARDLINE_WARN_ON_DEPRECATED_ENV_FILES === 'true' ||
    (
        process.env.WARDLINE_WARN_ON_DEPRECATED_ENV_FILES !== 'false' &&
        (process.env.NODE_ENV ?? 'development') !== 'test' &&
        process.env.CI !== 'true'
    );

if (shouldWarnOnDeprecatedEnvFiles && deprecatedCoreApiEnvPaths.length > 0) {
    console.warn(
        `[wardline] Deprecated core-api env file(s) detected: ${deprecatedCoreApiEnvPaths.join(
            ', ',
        )}. These files are ignored; keep runtime values in the repo-root .env.local/.env files instead.`,
    );
}

@Module({
    controllers: [HealthController],
    imports: [
        ObservabilityModule,
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: rootEnvFilePaths,
        }),
        ScheduleModule.forRoot(),
        ThrottlerModule.forRoot({
            throttlers: [
                {
                    name: 'global',
                    ttl: 60_000,
                    limit: 120,
                },
            ],
        }),
        PrismaModule,
        CacheModule, // Global in-memory cache for improved performance
        CryptoModule,
        ClerkModule,
        AuditModule,
        BusinessesModule,
        UsersModule,
        WorkflowsModule,
        CallsModule,
        SafetyModule,
        EscalationsModule,
        IntegrationsModule,
        FollowUpTasksModule,
        RuntimeActionsModule,
    ],
    providers: [
        // Global authentication guard - validates JWT tokens
        {
            provide: APP_GUARD,
            useClass: AuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
        {
            provide: APP_GUARD,
            useClass: InternalApiGuard,
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
