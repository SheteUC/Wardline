import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AgentSessionStatus, CallAssignmentStatus } from '@wardline/types';
import { AgentsService } from '../modules/agents/agents.service';

@WebSocketGateway({
    cors: {
        origin: [
            process.env.WEB_URL || 'http://localhost:3000',
            'http://localhost:3000',
            'http://localhost:4000',
        ],
        credentials: true,
    },
})
export class AgentWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(AgentWebSocketGateway.name);
    private agentSessions = new Map<string, string>(); // socketId -> agentId

    constructor(private readonly agentsService: AgentsService) { }

    /**
     * Handle client connection
     */
    async handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
        
        // Extract agent ID from handshake auth
        const agentId = client.handshake.auth?.agentId;
        const userId = client.handshake.auth?.userId;

        if (agentId) {
            this.agentSessions.set(client.id, agentId);
            client.join(`agent:${agentId}`);
            this.logger.log(`Agent ${agentId} connected`);
        }

        if (userId) {
            client.join(`user:${userId}`);
        }
    }

    /**
     * Handle client disconnection
     */
    async handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);

        const agentId = this.agentSessions.get(client.id);
        if (agentId) {
            this.agentSessions.delete(client.id);
            
            // Update agent status to offline
            try {
                await this.agentsService.updateAgentSession(agentId, AgentSessionStatus.OFFLINE);
            } catch (error: any) {
                this.logger.error(`Error updating agent session: ${error.message}`);
            }
        }
    }

    /**
     * Agent updates their status (ONLINE, OFFLINE, BUSY, BREAK, AWAY)
     */
    @SubscribeMessage('agent:status')
    async handleAgentStatus(
        @MessageBody() data: { agentId: string; status: AgentSessionStatus }
    ) {
        this.logger.log(`Agent ${data.agentId} status update: ${data.status}`);

        try {
            // Update agent session in database
            const session = await this.agentsService.updateAgentSession(data.agentId, data.status);

            // Broadcast to supervisors
            this.server.emit('agent:status:updated', {
                agentId: data.agentId,
                status: data.status,
                timestamp: new Date(),
            });

            return { success: true, session };
        } catch (error: any) {
            this.logger.error(`Error updating agent status: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Notify agent of new call assignment
     */
    notifyNewAssignment(agentId: string, assignment: any) {
        this.logger.log(`Notifying agent ${agentId} of new assignment ${assignment.id}`);
        
        this.server.to(`agent:${agentId}`).emit('assignment:new', {
            assignment,
            timestamp: new Date(),
        });
    }

    /**
     * Notify about call transfer
     */
    notifyCallTransfer(callId: string, fromAgent: string, toAgent: string, reason?: string) {
        this.logger.log(`Call ${callId} transferred from ${fromAgent} to ${toAgent}`);

        // Notify both agents
        this.server.to(`agent:${fromAgent}`).emit('call:transferred:out', {
            callId,
            toAgent,
            reason,
            timestamp: new Date(),
        });

        this.server.to(`agent:${toAgent}`).emit('call:transferred:in', {
            callId,
            fromAgent,
            reason,
            timestamp: new Date(),
        });
    }

    /**
     * Notify about assignment status change
     */
    notifyAssignmentStatusChange(assignmentId: string, status: CallAssignmentStatus, agentId?: string) {
        this.logger.log(`Assignment ${assignmentId} status changed to ${status}`);

        if (agentId) {
            this.server.to(`agent:${agentId}`).emit('assignment:status:changed', {
                assignmentId,
                status,
                timestamp: new Date(),
            });
        }

        // Broadcast to supervisors/dashboards
        this.server.emit('assignment:status:updated', {
            assignmentId,
            status,
            agentId,
            timestamp: new Date(),
        });
    }

    /**
     * Notify supervisors about emergency
     */
    notifyEmergency(callId: string, reason: string, keywords?: string[]) {
        this.logger.warn(`EMERGENCY: Call ${callId} - ${reason}`);

        // Broadcast to all supervisors
        this.server.emit('emergency:alert', {
            callId,
            reason,
            keywords,
            priority: 'critical',
            timestamp: new Date(),
        });
    }

    /**
     * Notify about queue depth changes
     */
    notifyQueueUpdate(queueId: string, depth: number, avgWaitTime: number) {
        this.server.emit('queue:updated', {
            queueId,
            depth,
            avgWaitTime,
            timestamp: new Date(),
        });
    }

    /**
     * Broadcast call status change
     */
    broadcastCallStatus(callId: string, status: string, data?: any) {
        this.server.emit('call:status:changed', {
            callId,
            status,
            data,
            timestamp: new Date(),
        });
    }

    /**
     * Send message to specific agent
     */
    sendToAgent(agentId: string, event: string, data: any) {
        this.server.to(`agent:${agentId}`).emit(event, {
            ...data,
            timestamp: new Date(),
        });
    }

    /**
     * Send message to specific user
     */
    sendToUser(userId: string, event: string, data: any) {
        this.server.to(`user:${userId}`).emit(event, {
            ...data,
            timestamp: new Date(),
        });
    }

    /**
     * Broadcast to all connected clients
     */
    broadcast(event: string, data: any) {
        this.server.emit(event, {
            ...data,
            timestamp: new Date(),
        });
    }

    /**
     * Get online agents
     */
    @SubscribeMessage('agents:online')
    async getOnlineAgents(@MessageBody() data: { hospitalId: string }): Promise<any> {
        try {
            const agents = await this.agentsService.getAvailableAgents(data.hospitalId);
            return { success: true, agents };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Agent accepts assignment
     */
    @SubscribeMessage('assignment:accept')
    async handleAcceptAssignment(
        @MessageBody() data: { assignmentId: string; agentId: string }
    ) {
        this.logger.log(`Agent ${data.agentId} accepting assignment ${data.assignmentId}`);

        try {
            // This would call the queue assignment service
            // const assignment = await this.queueService.acceptAssignment(data.assignmentId, data.agentId);

            // Notify about acceptance
            this.notifyAssignmentStatusChange(data.assignmentId, CallAssignmentStatus.ACCEPTED, data.agentId);

            return { success: true };
        } catch (error: any) {
            this.logger.error(`Error accepting assignment: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Agent rejects assignment
     */
    @SubscribeMessage('assignment:reject')
    async handleRejectAssignment(
        @MessageBody() data: { assignmentId: string; agentId: string; reason?: string }
    ) {
        this.logger.log(`Agent ${data.agentId} rejecting assignment ${data.assignmentId}`);

        // This would trigger reassignment logic
        return { success: true };
    }
}
