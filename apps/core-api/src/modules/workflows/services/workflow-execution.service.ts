import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
    WorkflowNode,
    WorkflowGraph,
    CallContext,
    ExecutionResult,
    AIAgentConfig,
} from '@wardline/types';
import { QueueAssignmentService } from '../../queues/queue-assignment.service';
import { QueuesService } from '../../queues/queues.service';

@Injectable()
export class WorkflowExecutionService {
    private readonly logger = new Logger(WorkflowExecutionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly queuesService: QueuesService,
        private readonly assignmentService: QueueAssignmentService,
    ) { }

    /**
     * Execute a workflow node
     */
    async executeNode(
        node: WorkflowNode,
        callContext: CallContext,
        workflow: WorkflowGraph
    ): Promise<ExecutionResult> {
        this.logger.log(`Executing node ${node.id} of type ${node.type}`);

        try {
            switch (node.type) {
                case 'start':
                    return this.executeStart(node, callContext);
                case 'emergency-screen':
                    return this.executeEmergencyScreen(node, callContext);
                case 'intent-detect':
                    return this.executeIntentDetect(node, callContext);
                case 'question':
                    return this.executeQuestion(node, callContext);
                case 'route':
                    return this.executeRoute(node, callContext);
                case 'webhook':
                    return this.executeWebhook(node, callContext);
                case 'ai-agent':
                    return this.executeAIAgent(node, callContext);
                case 'human-agent-queue':
                    return this.queueForHumanAgent(node, callContext);
                case 'human-agent-direct':
                    return this.assignToHumanAgent(node, callContext);
                case 'conditional':
                    return this.evaluateCondition(node, callContext, workflow);
                case 'safety-check':
                    return this.performSafetyCheck(node, callContext);
                case 'collect-info':
                    return this.collectInformation(node, callContext);
                case 'integration':
                    return this.executeIntegration(node, callContext);
                case 'end':
                    return this.executeEnd(node, callContext);
                default:
                    return {
                        status: 'error',
                        error: `Unknown node type: ${node.type}`,
                    };
            }
        } catch (error: any) {
            this.logger.error(`Error executing node ${node.id}: ${error.message}`);
            return {
                status: 'error',
                error: error.message,
            };
        }
    }

    /**
     * Execute start node
     */
    private async executeStart(_node: WorkflowNode, _callContext: CallContext): Promise<ExecutionResult> {
        return {
            status: 'success',
            data: { message: 'Call started' },
        };
    }

    /**
     * Execute emergency screening node
     */
    private async executeEmergencyScreen(_node: WorkflowNode, callContext: CallContext): Promise<ExecutionResult> {
        // Emergency detection logic would go here
        // For now, check if the call is already marked as emergency
        if (callContext.isEmergency) {
            return {
                status: 'escalated',
                data: { emergency: true },
            };
        }

        return {
            status: 'success',
            data: { emergency: false },
        };
    }

    /**
     * Execute intent detection node
     */
    private async executeIntentDetect(_node: WorkflowNode, callContext: CallContext): Promise<ExecutionResult> {
        // Intent detection would be done by the voice orchestrator
        // Here we just return the detected intent from context
        return {
            status: 'success',
            data: {
                intent: callContext.detectedIntent,
                fields: callContext.extractedFields,
            },
        };
    }

    /**
     * Execute question node
     */
    private async executeQuestion(node: WorkflowNode, _callContext: CallContext): Promise<ExecutionResult> {
        // Question execution would be handled by voice orchestrator
        const config = node.config as { question: string; field: string };
        return {
            status: 'success',
            data: { question: config.question },
        };
    }

    /**
     * Execute route node
     */
    private async executeRoute(_node: WorkflowNode, _callContext: CallContext): Promise<ExecutionResult> {
        // const _config = _node.config as { routingRules: any[] };
        // Routing logic based on rules
        return {
            status: 'success',
            data: { routed: true },
        };
    }

    /**
     * Execute webhook node
     */
    private async executeWebhook(_node: WorkflowNode, _callContext: CallContext): Promise<ExecutionResult> {
        // const _config = _node.config as { url: string; method: string; headers?: Record<string, string> };
        // Webhook execution would make HTTP request
        return {
            status: 'success',
            data: { webhookCalled: true },
        };
    }

    /**
     * Execute AI agent node - configures AI behavior
     */
    private async executeAIAgent(node: WorkflowNode, callContext: CallContext): Promise<ExecutionResult> {
        const aiConfig = node.config as unknown as AIAgentConfig;

        this.logger.log(`Configuring AI agent with persona: ${aiConfig.persona}`);

        // Send config to voice orchestrator to update AI behavior
        // This would typically call the VoiceOrchestratorClient

        // Check escalation rules
        const shouldEscalate = this.checkEscalationRules(aiConfig.escalationRules, callContext);

        if (shouldEscalate) {
            this.logger.log('Escalation rule triggered');
            return {
                status: 'escalated',
                data: { reason: 'Escalation rule matched' },
            };
        }

        return {
            status: 'success',
            data: {
                aiConfig: {
                    persona: aiConfig.persona,
                    capabilities: aiConfig.capabilities,
                },
            },
        };
    }

    /**
     * Queue call for human agent
     */
    private async queueForHumanAgent(node: WorkflowNode, callContext: CallContext): Promise<ExecutionResult> {
        const queueConfig = node.config as {
            specialization: string;
            priority?: number;
        };

        this.logger.log(`Queueing call for human agent with specialization: ${queueConfig.specialization}`);

        // Find or create queue
        const queues = await this.queuesService.findAll(callContext.hospitalId, {
            specialization: queueConfig.specialization,
        });

        let queue;
        if (queues.data.length === 0) {
            // Create queue if it doesn't exist
            queue = await this.queuesService.create(callContext.hospitalId, {
                name: `${queueConfig.specialization} Queue`,
                specialization: queueConfig.specialization,
                priority: queueConfig.priority || 0,
            });
        } else {
            queue = queues.data[0];
        }

        // Assign call to queue
        const assignment = await this.assignmentService.assignCallToAgent(
            queue.id,
            callContext.callId,
            { strategy: 'skill_based', priorityLevel: queueConfig.priority }
        );

        // Log to audit
        await this.logRoutingDecision(callContext.callId, {
            type: 'queue',
            target: queue.id,
            specialization: queueConfig.specialization,
        });

        return {
            status: 'waiting_for_agent',
            data: {
                queueId: queue.id,
                assignmentId: assignment.id,
                assignmentStatus: assignment.status,
            },
        };
    }

    /**
     * Assign call directly to a specific human agent
     */
    private async assignToHumanAgent(node: WorkflowNode, callContext: CallContext): Promise<ExecutionResult> {
        const config = node.config as { agentId: string };

        this.logger.log(`Assigning call directly to agent: ${config.agentId}`);

        // Create direct assignment
        const assignment = await this.prisma.callAssignment.create({
            data: {
                callId: callContext.callId,
                agentId: config.agentId,
                status: 'ASSIGNED',
                assignedAt: new Date(),
            },
        });

        // Log to audit
        await this.logRoutingDecision(callContext.callId, {
            type: 'direct_agent',
            target: config.agentId,
        });

        return {
            status: 'waiting_for_agent',
            data: {
                agentId: config.agentId,
                assignmentId: assignment.id,
            },
        };
    }

    /**
     * Evaluate conditional node (if/else logic)
     */
    private async evaluateCondition(
        node: WorkflowNode,
        callContext: CallContext,
        _workflow: WorkflowGraph
    ): Promise<ExecutionResult> {
        const config = node.config as {
            condition: {
                field: string;
                operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
                value: string | number;
            };
            trueNodeId: string;
            falseNodeId: string;
        };

        const fieldValue = callContext.extractedFields[config.condition.field];
        let conditionMet = false;

        switch (config.condition.operator) {
            case 'equals':
                conditionMet = fieldValue === config.condition.value;
                break;
            case 'contains':
                conditionMet = String(fieldValue).includes(String(config.condition.value));
                break;
            case 'greater_than':
                conditionMet = Number(fieldValue) > Number(config.condition.value);
                break;
            case 'less_than':
                conditionMet = Number(fieldValue) < Number(config.condition.value);
                break;
        }

        return {
            status: 'success',
            nextNodeId: conditionMet ? config.trueNodeId : config.falseNodeId,
            data: { conditionMet },
        };
    }

    /**
     * Perform safety check for medical keywords
     */
    private async performSafetyCheck(node: WorkflowNode, callContext: CallContext): Promise<ExecutionResult> {
        const config = node.config as {
            keywords: string[];
            action: 'escalate' | 'flag' | 'notify';
        };

        const transcript = callContext.transcript.join(' ').toLowerCase();
        const triggeredKeywords = config.keywords.filter(keyword =>
            transcript.includes(keyword.toLowerCase())
        );

        if (triggeredKeywords.length > 0) {
            this.logger.warn(`Safety check triggered: ${triggeredKeywords.join(', ')}`);

            // Log safety event
            await this.logSafetyCheck(callContext.callId, triggeredKeywords);

            if (config.action === 'escalate') {
                return {
                    status: 'escalated',
                    data: {
                        reason: 'Medical keywords detected',
                        keywords: triggeredKeywords,
                    },
                };
            }
        }

        return {
            status: 'success',
            data: {
                safetyCheckPassed: triggeredKeywords.length === 0,
                triggeredKeywords,
            },
        };
    }

    /**
     * Collect information from caller
     */
    private async collectInformation(node: WorkflowNode, _callContext: CallContext): Promise<ExecutionResult> {
        const config = node.config as {
            fields: { name: string; type: string; required: boolean }[];
        };

        // Information collection would be handled by voice orchestrator
        return {
            status: 'success',
            data: { fieldsToCollect: config.fields },
        };
    }

    /**
     * Execute external integration
     */
    private async executeIntegration(node: WorkflowNode, _callContext: CallContext): Promise<ExecutionResult> {
        const config = node.config as {
            integration: string;
            action: string;
            params: Record<string, any>;
        };

        // Integration logic would go here (e.g., TimeTap, NexHealth)
        this.logger.log(`Executing integration: ${config.integration}.${config.action}`);

        return {
            status: 'success',
            data: { integrationCalled: true },
        };
    }

    /**
     * Execute end node
     */
    private async executeEnd(_node: WorkflowNode, _callContext: CallContext): Promise<ExecutionResult> {
        return {
            status: 'success',
            data: { message: 'Call ended' },
        };
    }

    /**
     * Check if any escalation rules are triggered
     */
    private checkEscalationRules(rules: any[], callContext: CallContext): boolean {
        for (const rule of rules) {
            const { condition } = rule;

            switch (condition.type) {
                case 'keyword':
                    const transcript = callContext.transcript.join(' ').toLowerCase();
                    if (transcript.includes(String(condition.value).toLowerCase())) {
                        return true;
                    }
                    break;
                case 'sentiment':
                    if (callContext.sentiment && callContext.sentiment < Number(condition.value)) {
                        return true;
                    }
                    break;
                case 'duration':
                    // Would check call duration
                    break;
                case 'interaction_count':
                    // Would check number of interactions
                    break;
            }
        }

        return false;
    }

    /**
     * Log routing decision to audit
     */
    private async logRoutingDecision(callId: string, decision: any) {
        // This would create an audit log entry
        this.logger.log(`Routing decision for call ${callId}:`, decision);
        // await this.auditService.log(...);
    }

    /**
     * Log safety check event
     */
    private async logSafetyCheck(callId: string, keywords: string[]) {
        // This would create a safety event log
        this.logger.log(`Safety check for call ${callId}: ${keywords.join(', ')}`);
        // await this.auditService.logSafety(...);
    }
}
