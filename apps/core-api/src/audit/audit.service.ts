import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@wardline/utils';

export interface AuditLogParams {
    hospitalId: string;
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Create an audit log entry for HIPAA compliance
     * @param params Audit log parameters
     */
    async logAction(params: AuditLogParams): Promise<void> {
        try {
            await this.prisma.auditLog.create({
                data: {
                    hospitalId: params.hospitalId,
                    userId: params.userId,
                    action: params.action,
                    entityType: params.entityType,
                    entityId: params.entityId,
                    metadata: params.metadata || {},
                },
            });

            this.logger.debug('Audit log created', {
                hospitalId: params.hospitalId,
                userId: params.userId,
                action: params.action,
                entityType: params.entityType,
            });
        } catch (error) {
            this.logger.error('Failed to create audit log', {
                error,
                params,
            });
            // Don't throw - we don't want audit logging failures to break the application
        }
    }

    /**
     * Log multiple actions in a single transaction
     * @param entries Array of audit log parameters
     */
    async logBatch(entries: AuditLogParams[]): Promise<void> {
        try {
            await this.prisma.auditLog.createMany({
                data: entries.map(params => ({
                    hospitalId: params.hospitalId,
                    userId: params.userId,
                    action: params.action,
                    entityType: params.entityType,
                    entityId: params.entityId,
                    metadata: params.metadata || {},
                })),
            });

            this.logger.debug(`Batch audit log created: ${entries.length} entries`);
        } catch (error) {
            this.logger.error('Failed to create batch audit log', error);
        }
    }

    /**
     * Query audit logs for a hospital
     * @param hospitalId Hospital ID
     * @param options Query options (limit, offset, filters)
     */
    async getAuditLogs(
        hospitalId: string,
        options?: {
            limit?: number;
            offset?: number;
            userId?: string;
            entityType?: string;
            startDate?: Date;
            endDate?: Date;
        },
    ): Promise<any[]> {
        const where: any = { hospitalId };

        if (options?.userId) {
            where.userId = options.userId;
        }

        if (options?.entityType) {
            where.entityType = options.entityType;
        }

        if (options?.startDate || options?.endDate) {
            where.createdAt = {};
            if (options.startDate) {
                where.createdAt.gte = options.startDate;
            }
            if (options.endDate) {
                where.createdAt.lte = options.endDate;
            }
        }

        return this.prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: options?.limit || 100,
            skip: options?.offset || 0,
        });
    }
}
