import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkflowNode, WorkflowGraph, CallContext, ExecutionResult } from '@wardline/types';
import { CallContextService } from '../../calls/call-context.service';
import { SafetyGuardService } from '../../safety/safety-guard.service';
import { Logger } from '@wardline/utils';

const MAX_TURNS_PER_CALL = 5;

@Injectable()
export class WorkflowExecutionService {
    private readonly logger = new Logger(WorkflowExecutionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly callContextService: CallContextService,
        private readonly safetyGuard: SafetyGuardService,
    ) {}

    /**
     * Main entry point — execute a single node within the call workflow.
     * Always runs the safety check before any node logic.
     */
    async executeNode(
        node: WorkflowNode,
        callContext: CallContext,
        workflow: WorkflowGraph,
    ): Promise<ExecutionResult> {
        this.logger.info(`Executing node ${node.id} (${node.type})`, { callId: callContext.callId });

        // Sync live context
        const ctx = this.callContextService.getOrCreate(callContext.callId, callContext);
        if (callContext.transcript?.length) {
            this.callContextService.update(ctx.callId, {
                transcript: callContext.transcript,
                extractedFields: callContext.extractedFields,
                sentiment: callContext.sentiment,
                detectedIntent: callContext.detectedIntent,
                isEmergency: callContext.isEmergency,
            });
        }

        // Safety check runs on every turn — cannot be bypassed
        if (callContext.transcript?.length) {
            const latestUtterance = callContext.transcript[callContext.transcript.length - 1] ?? '';
            const safety = this.safetyGuard.quickEmergencyCheck(latestUtterance);
            if (safety.isEmergency) {
                this.logger.warn('Emergency detected mid-execution', { callId: callContext.callId, keywords: safety.triggeredKeywords });
                return {
                    status: 'escalated',
                    data: { isEmergency: true, triggeredKeywords: safety.triggeredKeywords },
                    nextNodeId: this.findNodeByType(workflow, 'emergency-escalate')?.id,
                };
            }
        }

        try {
            switch (node.type) {
                case 'greeting':
                    return this.executeGreeting(node, callContext);
                case 'intent-detect':
                    return this.executeIntentDetect(node, callContext);
                case 'route':
                    return this.executeRoute(node, callContext, workflow);
                case 'continuation-check':
                    return this.executeContinuationCheck(node, callContext);
                case 'collect-info':
                    return this.executeCollectInfo(node, callContext);
                case 'confirmation':
                    return this.executeConfirmation(node, callContext);
                case 'knowledge-base':
                    return this.executeKnowledgeBase(node, callContext);
                case 'availability-check':
                    return this.executeAvailabilityCheck(node, callContext);
                case 'action':
                    return this.executeAction(node, callContext);
                case 'human-transfer':
                    return this.executeHumanTransfer(node, callContext);
                case 'voicemail':
                    return this.executeVoicemail(node, callContext);
                case 'emergency-escalate':
                    return this.executeEmergencyEscalate(node, callContext);
                case 'end-call':
                    return this.executeEndCall(node, callContext);
                default:
                    this.logger.warn(`Unknown node type: ${(node as any).type}`);
                    return { status: 'error', error: `Unknown node type: ${(node as any).type}` };
            }
        } catch (err: unknown) {
            const error = err as Error;
            this.logger.error(`Node execution error`, { nodeId: node.id, error: error.message });
            return { status: 'error', error: error.message };
        }
    }

    // -------------------------------------------------------------------------
    // Node Handlers
    // -------------------------------------------------------------------------

    private executeGreeting(node: WorkflowNode, ctx: CallContext): ExecutionResult {
        const config = node.config as any;
        return {
            status: 'success',
            data: {
                speak: config.greetingScript
                    ?.replace('{businessName}', config.businessName ?? 'our clinic')
                    ?? `Thank you for calling. How can I help you today?`,
            },
            nextNodeId: this.getEdgeTarget(null, 'default', ctx.callId),
        };
    }

    private executeIntentDetect(_node: WorkflowNode, _ctx: CallContext): ExecutionResult {
        // Intent detection is handled by the voice orchestrator (LLM).
        // This node signals to the orchestrator to run intent classification.
        return {
            status: 'waiting_for_input',
            data: { action: 'detect_intent' },
        };
    }

    private executeRoute(node: WorkflowNode, ctx: CallContext, workflow: WorkflowGraph): ExecutionResult {
        const config = node.config as any;
        const routes = config.routes as Array<{ condition: string; targetNodeId: string; label: string }>;
        const intent = ctx.detectedIntent ?? '';

        for (const route of routes ?? []) {
            if (intent.includes(route.condition) || route.condition === intent) {
                return { status: 'success', nextNodeId: route.targetNodeId, data: { matchedRoute: route.label } };
            }
        }

        const defaultNode = workflow.nodes.find(n => n.id === config.defaultTargetNodeId);
        return {
            status: 'success',
            nextNodeId: defaultNode?.id ?? config.defaultTargetNodeId,
            data: { matchedRoute: 'default' },
        };
    }

    /**
     * Continuation check — the "one problem at a time" loop gate.
     * After each agent resolves a problem, the call passes through here.
     * The orchestrator asks "Anything else?" and routes back to intent-detect
     * or to end-call.
     */
    private executeContinuationCheck(node: WorkflowNode, ctx: CallContext): ExecutionResult {
        const config = node.config as any;
        const maxTurns = config.maxTurns ?? MAX_TURNS_PER_CALL;

        if (ctx.currentTurn >= maxTurns) {
            this.logger.info('Max turns reached — ending call', { callId: ctx.callId, turns: ctx.currentTurn });
            return {
                status: 'success',
                data: {
                    speak: "We've addressed several things today. Is there one last thing I can help with?",
                    maxTurnsReached: true,
                },
                nextNodeId: null,
            };
        }

        return {
            status: 'continuation_check',
            continuationPrompt: config.promptScript ?? 'Is there anything else I can help you with today?',
            data: { currentTurn: ctx.currentTurn, maxTurns },
        };
    }

    private executeCollectInfo(_node: WorkflowNode, _ctx: CallContext): ExecutionResult {
        return {
            status: 'waiting_for_input',
            data: { action: 'collect_fields' },
        };
    }

    private executeConfirmation(node: WorkflowNode, ctx: CallContext): ExecutionResult {
        const config = node.config as any;
        let script: string = config.script ?? 'To confirm: {summary}';
        for (const [k, v] of Object.entries(ctx.extractedFields)) {
            script = script.replace(`{${k}}`, String(v));
        }
        return { status: 'success', data: { speak: script } };
    }

    private executeKnowledgeBase(_node: WorkflowNode, _ctx: CallContext): ExecutionResult {
        return {
            status: 'waiting_for_input',
            data: { action: 'knowledge_base_lookup' },
        };
    }

    private executeAvailabilityCheck(_node: WorkflowNode, _ctx: CallContext): ExecutionResult {
        return {
            status: 'waiting_for_input',
            data: { action: 'availability_check' },
        };
    }

    private executeAction(node: WorkflowNode, _ctx: CallContext): ExecutionResult {
        const config = node.config as any;
        return {
            status: 'waiting_for_input',
            data: { action: 'external_tool_call', tool: config.tool, outputKey: config.outputKey },
        };
    }

    private executeHumanTransfer(node: WorkflowNode, ctx: CallContext): ExecutionResult {
        const config = node.config as any;
        this.logger.info('Human transfer initiated', { callId: ctx.callId, phone: config.transferPhone });
        return {
            status: 'escalated',
            data: {
                action: 'human_transfer',
                transferPhone: config.transferPhone,
                contextSummary: config.contextSummary,
                noAnswerBehavior: config.noAnswerBehavior ?? 'voicemail',
                speak: "I'll connect you with a staff member now. Please hold.",
            },
        };
    }

    private executeVoicemail(node: WorkflowNode, ctx: CallContext): ExecutionResult {
        const config = node.config as any;
        this.logger.info('Voicemail initiated', { callId: ctx.callId });
        return {
            status: 'voicemail',
            data: {
                action: 'record_voicemail',
                promptScript: config.promptScript,
                notifyEmail: config.notifyEmail,
                notifyPhone: config.notifyPhone,
                maxDurationSeconds: config.maxDurationSeconds ?? 120,
            },
        };
    }

    private executeEmergencyEscalate(node: WorkflowNode, _ctx: CallContext): ExecutionResult {
        const config = node.config as any;
        this.logger.warn('Emergency escalation node executed');
        return {
            status: 'escalated',
            data: {
                isEmergency: true,
                action: 'emergency_escalate',
                speak: config.message ??
                    "If this is a life-threatening emergency, please hang up and call 911 immediately. " +
                    "I'm connecting you now.",
                transferToEmergency: config.transferToEmergency ?? false,
                transferPhone: config.transferPhone,
            },
        };
    }

    private executeEndCall(node: WorkflowNode, _ctx: CallContext): ExecutionResult {
        const config = node.config as any;
        return {
            status: 'success',
            data: {
                action: 'end_call',
                speak: config.script ?? 'Thank you for calling. Have a great day!',
            },
        };
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private findNodeByType(workflow: WorkflowGraph, type: string): WorkflowNode | undefined {
        return workflow.nodes.find(n => n.type === type);
    }

    private getEdgeTarget(_condition: string | null, _label: string, _callId: string): string | undefined {
        return undefined;
    }

    /**
     * Advance the call's turn counter after a problem is resolved.
     */
    async incrementTurn(callId: string): Promise<void> {
        try {
            await this.prisma.callSession.update({
                where: { id: callId },
                data: { turnCount: { increment: 1 } },
            });
        } catch {
            // Non-critical
        }
    }

    /**
     * Append a resolved turn to the call's turnsJson record.
     */
    async recordTurn(callId: string, turn: Record<string, unknown>): Promise<void> {
        try {
            const call = await this.prisma.callSession.findUnique({
                where: { id: callId },
                select: { turnsJson: true },
            });
            const turns = (call?.turnsJson as unknown[]) ?? [];
            turns.push(turn);
            await this.prisma.callSession.update({
                where: { id: callId },
                data: { turnsJson: turns as any, turnCount: turns.length },
            });
        } catch {
            // Non-critical
        }
    }
}
