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
                where: { status: 'ACTIVE', deletedAt: null },
                include: {
                    settings: {
                        select: { transcriptRetentionDays: true },
                    },
                },
            });

            if (businesses.length === 0) {
                this.logger.log('Retention cleanup skipped because there are no active businesses');
                return;
            }

            const retentionWindows = new Map(
                businesses.map((business) => {
                    const retentionDays = business.settings?.transcriptRetentionDays ?? 30;
                    const cutoff = new Date();
                    cutoff.setDate(cutoff.getDate() - retentionDays);
                    return [
                        business.id,
                        {
                            retentionDays,
                            cutoff,
                        },
                    ];
                }),
            );

            const latestCutoff = new Date(
                Math.max(
                    ...Array.from(retentionWindows.values()).map((window) => window.cutoff.getTime()),
                ),
            );

            const expiredCallCandidates = await this.prisma.callSession.findMany({
                where: {
                    businessId: { in: businesses.map((business) => business.id) },
                    startedAt: { lt: latestCutoff },
                },
                select: {
                    id: true,
                    businessId: true,
                    startedAt: true,
                },
            });

            const expiredCallIdsByBusiness = new Map<string, string[]>();
            for (const call of expiredCallCandidates) {
                const retentionWindow = retentionWindows.get(call.businessId);
                if (!retentionWindow || call.startedAt >= retentionWindow.cutoff) {
                    continue;
                }

                const existingCallIds = expiredCallIdsByBusiness.get(call.businessId) ?? [];
                existingCallIds.push(call.id);
                expiredCallIdsByBusiness.set(call.businessId, existingCallIds);
            }

            for (const business of businesses) {
                const retentionWindow = retentionWindows.get(business.id);
                const callIds = expiredCallIdsByBusiness.get(business.id) ?? [];
                if (!retentionWindow || callIds.length === 0) {
                    continue;
                }

                const { retentionDays, cutoff } = retentionWindow;

                const { count } = await this.prisma.transcriptSegment.deleteMany({
                    where: { callId: { in: callIds } },
                });

                const voicemailRedacted = await this.prisma.voicemailRecord.updateMany({
                    where: { callId: { in: callIds } },
                    data: {
                        recordingUrl: '',
                        transcription: null,
                        context: '[Removed per transcript retention policy]',
                        callerName: null,
                    },
                });

                const recordingsCleared = await this.prisma.callSession.updateMany({
                    where: { id: { in: callIds } },
                    data: { recordingUrl: null },
                });

                if (count > 0 || voicemailRedacted.count > 0 || recordingsCleared.count > 0) {
                    totalDeleted += count;
                    this.logger.log(
                        `Retention pass for business ${business.id}: transcript segments deleted=${count}, ` +
                        `voicemails redacted=${voicemailRedacted.count}, call recording URLs cleared=${recordingsCleared.count} ` +
                        `(retention: ${retentionDays} days, cutoff: ${cutoff.toISOString()})`,
                    );

                    await this.auditService.logAction({
                        businessId: business.id,
                        action: 'TRANSCRIPT_RETENTION_CLEANUP',
                        entityType: 'TranscriptSegment',
                        metadata: {
                            deletedTranscriptSegments: count,
                            voicemailsRedacted: voicemailRedacted.count,
                            callRecordingUrlsCleared: recordingsCleared.count,
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
