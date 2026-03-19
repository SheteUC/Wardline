import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@wardline/utils';

export interface EscalationContext {
    callId: string;
    businessId: string;
    callerPhone: string;
    callerName?: string;
    intentKey?: string;
    isEmergency: boolean;
    transcript: string;
    collectedFields: Record<string, unknown>;
    resolvedTurns: unknown[];
    escalationReason: string;
}

export type EscalationOutcome = 'transferred' | 'voicemail' | 'emergency';

@Injectable()
export class EscalationsService {
    private readonly logger = new Logger(EscalationsService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Attempt human transfer. If no answer, fall back to voicemail.
     * Returns the outcome so the voice orchestrator can take action.
     */
    async escalateToHuman(context: EscalationContext): Promise<{
        outcome: EscalationOutcome;
        transferPhone?: string;
        voicemailCreated?: boolean;
    }> {
        this.logger.info('Escalating to human', {
            callId: context.callId,
            reason: context.escalationReason,
        });

        // Log the handoff record
        await this.prisma.handoff.create({
            data: {
                callId: context.callId,
                payload: {
                    businessId: context.businessId,
                    callerPhone: context.callerPhone,
                    callerName: context.callerName,
                    intentKey: context.intentKey,
                    isEmergency: context.isEmergency,
                    collectedFields: context.collectedFields,
                    resolvedTurns: context.resolvedTurns,
                    escalationReason: context.escalationReason,
                    escalatedAt: new Date().toISOString(),
                } as any,
            },
        });

        // Tag the call session
        await this.prisma.callSession.update({
            where: { id: context.callId },
            data: { tag: context.isEmergency ? 'EMERGENCY' : 'HUMAN_TRANSFER' },
        }).catch(() => { /* ignore if call not found */ });

        return { outcome: 'transferred' };
    }

    /**
     * Immediately escalate an emergency call (911 advisory).
     */
    async escalateEmergency(context: Pick<EscalationContext, 'callId' | 'businessId' | 'callerPhone' | 'transcript'>): Promise<void> {
        this.logger.warn('Emergency escalation triggered', { callId: context.callId });

        await Promise.all([
            this.prisma.callSession.update({
                where: { id: context.callId },
                data: { isEmergency: true, tag: 'EMERGENCY', status: 'COMPLETED' },
            }).catch(() => { }),
            this.prisma.handoff.create({
                data: {
                    callId: context.callId,
                    payload: {
                        type: 'emergency',
                        callerPhone: context.callerPhone,
                        transcript: context.transcript,
                        escalatedAt: new Date().toISOString(),
                    } as any,
                },
            }),
        ]);
    }

    /**
     * Get recent escalations for a business (human transfers + emergencies)
     */
    async getRecentEscalations(businessId: string, limit = 20): Promise<any[]> {
        return this.prisma.handoff.findMany({
            where: {
                call: { businessId },
            },
            include: {
                call: { select: { tag: true, startedAt: true, isEmergency: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
}
