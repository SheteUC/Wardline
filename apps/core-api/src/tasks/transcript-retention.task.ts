import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Nightly task that deletes TranscriptSegment records beyond each business's
 * configured retention window (BusinessSettings.transcriptRetentionDays).
 *
 * HIPAA requires that PHI not be retained longer than necessary.
 * Default retention is 30 days; businesses can configure this in their settings.
 */
@Injectable()
export class TranscriptRetentionTask {
    private readonly logger = new Logger(TranscriptRetentionTask.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService,
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_2AM, { timeZone: 'UTC' })
    async runRetentionCleanup(): Promise<void> {
        this.logger.log('Starting nightly transcript retention cleanup');
        let totalDeleted = 0;

        try {
            const businesses = await this.prisma.business.findMany({
                where: { status: 'ACTIVE' },
                include: {
                    settings: {
                        select: { transcriptRetentionDays: true },
                    },
                },
            });

            for (const business of businesses) {
                const retentionDays = business.settings?.transcriptRetentionDays ?? 30;
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - retentionDays);

                // Find calls for this business older than the retention cutoff
                const oldCalls = await this.prisma.callSession.findMany({
                    where: {
                        businessId: business.id,
                        startedAt: { lt: cutoff },
                    },
                    select: { id: true },
                });

                if (oldCalls.length === 0) continue;

                const callIds = oldCalls.map((c) => c.id);

                const { count } = await this.prisma.transcriptSegment.deleteMany({
                    where: { callId: { in: callIds } },
                });

                if (count > 0) {
                    totalDeleted += count;
                    this.logger.log(
                        `Deleted ${count} transcript segments for business ${business.id} ` +
                        `(retention: ${retentionDays} days, cutoff: ${cutoff.toISOString()})`,
                    );

                    await this.auditService.logAction({
                        businessId: business.id,
                        action: 'TRANSCRIPT_RETENTION_CLEANUP',
                        entityType: 'TranscriptSegment',
                        metadata: {
                            deletedCount: count,
                            retentionDays,
                            cutoffDate: cutoff.toISOString(),
                            affectedCallIds: callIds,
                        },
                    });
                }
            }

            this.logger.log(`Retention cleanup complete. Total segments deleted: ${totalDeleted}`);
        } catch (error: any) {
            this.logger.error(`Retention cleanup failed: ${error?.message}`, error?.stack);
        }
    }
}
