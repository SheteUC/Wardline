import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueuesService } from '../queues/queues.service';
import { QueueAssignmentService } from '../queues/queue-assignment.service';

export interface EscalationContext {
    call_id: string;
    hospital_id: string;
    queue_id: string;
    priority: number;
    required_skills?: string[];
    
    // Caller information
    caller_phone: string;
    caller_name?: string;
    
    // Call context
    intent?: string;
    is_emergency: boolean;
    transcript: string;
    collected_fields: Record<string, any>;
    
    // Sentiment & analysis
    sentiment: {
        frustration: number;
        urgency: number;
        overall_score: number;
    };
    
    // Escalation details
    escalation_reason: string;
    workflow_path?: string[];
    
    // Additional context
    [key: string]: any;
}

export interface EscalationRequest {
    id: string;
    hospitalId: string;
    callId: string;
    queueId: string;
    status: 'pending' | 'assigned' | 'accepted' | 'completed' | 'cancelled';
    priority: number;
    context: EscalationContext;
    createdAt: Date;
    assignedAt?: Date;
    acceptedAt?: Date;
    completedAt?: Date;
    assignedAgentId?: string;
}

@Injectable()
export class EscalationsService {
    private readonly logger = new Logger(EscalationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly queuesService: QueuesService,
        private readonly assignmentService: QueueAssignmentService,
    ) {}

    /**
     * Create an escalation request from AI to human
     */
    async createEscalation(context: EscalationContext): Promise<EscalationRequest> {
        this.logger.log(`Creating escalation for call ${context.call_id}`);

        // Verify queue exists
        const queue = await this.prisma.callQueue.findUnique({
            where: { id: context.queue_id },
        });

        if (!queue) {
            throw new NotFoundException(`Queue ${context.queue_id} not found`);
        }

        // Create call assignment
        const assignment = await this.assignmentService.assignCallToAgent(
            context.queue_id,
            context.call_id,
            {
                strategy: 'skill_based',
                priorityLevel: context.priority,
                requiredSkills: context.required_skills,
            }
        );

        // Build escalation request
        const escalation: EscalationRequest = {
            id: assignment.id,
            hospitalId: context.hospital_id,
            callId: context.call_id,
            queueId: context.queue_id,
            status: assignment.status === 'QUEUED' ? 'pending' : 'assigned',
            priority: context.priority,
            context,
            createdAt: new Date(),
            assignedAt: assignment.assignedAt || undefined,
            assignedAgentId: assignment.agentId || undefined,
        };

        this.logger.log(`Escalation created: ${escalation.id}`);

        // Emit WebSocket event for real-time notification
        // This would be handled by WebSocketGateway
        // await this.emitEscalationEvent(escalation);

        return escalation;
    }

    /**
     * Get escalation by ID
     */
    async getEscalation(escalationId: string): Promise<EscalationRequest | null> {
        const assignment = await this.prisma.callAssignment.findUnique({
            where: { id: escalationId },
            include: {
                call: true,
                agent: true,
                queue: true,
            },
        });

        if (!assignment) {
            return null;
        }

        // Map to EscalationRequest
        const escalation: EscalationRequest = {
            id: assignment.id,
            hospitalId: assignment.call.hospitalId,
            callId: assignment.callId,
            queueId: assignment.queueId || '',
            status: this.mapAssignmentStatus(assignment.status),
            priority: assignment.queue?.priority || 0,
            context: {} as EscalationContext, // Would be stored separately
            createdAt: assignment.createdAt,
            assignedAt: assignment.assignedAt || undefined,
            acceptedAt: assignment.acceptedAt || undefined,
            completedAt: assignment.completedAt || undefined,
            assignedAgentId: assignment.agentId || undefined,
        };

        return escalation;
    }

    /**
     * Accept an escalation (agent accepts the call)
     */
    async acceptEscalation(escalationId: string, agentId: string): Promise<EscalationRequest> {
        this.logger.log(`Agent ${agentId} accepting escalation ${escalationId}`);

        const assignment = await this.prisma.callAssignment.update({
            where: { id: escalationId },
            data: {
                status: 'ACCEPTED',
                acceptedAt: new Date(),
                agentId,
            },
            include: {
                call: true,
                queue: true,
            },
        });

        // Emit WebSocket event
        // await this.emitAcceptanceEvent(assignment);

        return {
            id: assignment.id,
            hospitalId: assignment.call.hospitalId,
            callId: assignment.callId,
            queueId: assignment.queueId || '',
            status: 'accepted',
            priority: assignment.queue?.priority || 0,
            context: {} as EscalationContext,
            createdAt: assignment.createdAt,
            assignedAt: assignment.assignedAt || undefined,
            acceptedAt: assignment.acceptedAt || undefined,
            assignedAgentId: assignment.agentId || undefined,
        };
    }

    /**
     * Complete an escalation
     */
    async completeEscalation(
        escalationId: string,
        outcome: 'resolved' | 'escalated_further' | 'abandoned',
        notes?: string,
    ): Promise<EscalationRequest> {
        this.logger.log(`Completing escalation ${escalationId} with outcome: ${outcome}`);

        const assignment = await this.prisma.callAssignment.update({
            where: { id: escalationId },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
            },
            include: {
                call: true,
                queue: true,
            },
        });

        // Update call session
        await this.prisma.callSession.update({
            where: { id: assignment.callId },
            data: {
                status: outcome === 'resolved' ? 'COMPLETED' : 'ONGOING',
                handoffTarget: outcome === 'escalated_further' ? 'supervisor' : null,
            },
        });

        return {
            id: assignment.id,
            hospitalId: assignment.call.hospitalId,
            callId: assignment.callId,
            queueId: assignment.queueId || '',
            status: 'completed',
            priority: assignment.queue?.priority || 0,
            context: {} as EscalationContext,
            createdAt: assignment.createdAt,
            assignedAt: assignment.assignedAt || undefined,
            acceptedAt: assignment.acceptedAt || undefined,
            completedAt: assignment.completedAt || undefined,
            assignedAgentId: assignment.agentId || undefined,
        };
    }

    /**
     * Get pending escalations for a queue
     */
    async getPendingEscalations(queueId: string): Promise<EscalationRequest[]> {
        const assignments = await this.prisma.callAssignment.findMany({
            where: {
                queueId,
                status: { in: ['QUEUED', 'ASSIGNED'] },
            },
            include: {
                call: true,
                queue: true,
                agent: true,
            },
            orderBy: [
                { queue: { priority: 'desc' } },
                { createdAt: 'asc' },
            ],
        });

        return assignments.map(a => ({
            id: a.id,
            hospitalId: a.call.hospitalId,
            callId: a.callId,
            queueId: a.queueId || '',
            status: this.mapAssignmentStatus(a.status),
            priority: a.queue?.priority || 0,
            context: {} as EscalationContext,
            createdAt: a.createdAt,
            assignedAt: a.assignedAt || undefined,
            acceptedAt: a.acceptedAt || undefined,
            completedAt: a.completedAt || undefined,
            assignedAgentId: a.agentId || undefined,
        }));
    }

    /**
     * Map CallAssignmentStatus to EscalationRequest status
     */
    private mapAssignmentStatus(status: string): EscalationRequest['status'] {
        const map: Record<string, EscalationRequest['status']> = {
            QUEUED: 'pending',
            ASSIGNED: 'assigned',
            ACCEPTED: 'accepted',
            COMPLETED: 'completed',
            ABANDONED: 'cancelled',
            FAILED: 'cancelled',
        };

        return map[status] || 'pending';
    }
}
