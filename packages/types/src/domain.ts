import { z } from 'zod';
import { workflowNodeTypeSchema, AgentCatalogId, ToolStatus } from './enums';

// ============================================================================
// Workflow Node & Graph
// ============================================================================

/**
 * Workflow node configuration — 13-node visual palette
 */
export interface WorkflowNode {
    id: string;
    type:
        // Entry / Exit
        | 'greeting'
        | 'end-call'
        // Core routing
        | 'intent-detect'
        | 'route'
        | 'continuation-check'
        // Data collection
        | 'collect-info'
        | 'confirmation'
        // Knowledge & actions
        | 'knowledge-base'
        | 'availability-check'
        | 'action'
        // Escalation paths
        | 'human-transfer'
        | 'voicemail'
        | 'emergency-escalate';
    config: Record<string, unknown>;
    position?: { x: number; y: number };
}

export interface WorkflowEdge {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    condition?: string;
}

export interface WorkflowGraph {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

// ============================================================================
// Agent Catalog & Deployed Agents
// ============================================================================

/**
 * Tool that an agent connects to (external integration)
 */
export interface AgentTool {
    id: string;
    name: string;
    description: string;
    /** e.g. 'scheduling', 'billing', 'ehr', 'insurance', 'knowledge-base' */
    type: string;
    status: ToolStatus;
    /** Credentials / config stored encrypted at rest */
    config: Record<string, unknown>;
    /** JSON Schema of what the business owner must fill in */
    configSchema: ToolConfigField[];
}

export interface ToolConfigField {
    key: string;
    label: string;
    type: 'text' | 'password' | 'url' | 'select' | 'boolean';
    required: boolean;
    placeholder?: string;
    options?: string[];
    helpText?: string;
}

/**
 * Read-only catalog entry (template) — curated by Wardline
 */
export interface AgentCatalogItem {
    catalogId: AgentCatalogId;
    name: string;
    description: string;
    /** Short plain-English statement of what this agent will NOT do */
    scopeBoundary: string;
    icon: string;
    color: string;
    /** Default node graph template */
    defaultNodes: WorkflowGraph;
    /** The tool this agent connects to */
    tool: Omit<AgentTool, 'status' | 'config'>;
    /** What the business owner can configure */
    configSchema: AgentConfigField[];
    /** Tags shown in catalog */
    tags: string[];
}

export interface AgentConfigField {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'toggle' | 'number' | 'select';
    defaultValue?: unknown;
    required: boolean;
    helpText?: string;
    options?: string[];
}

/**
 * A deployed (live) agent instance — copy of a catalog item, per business
 */
export interface DeployedAgent {
    id: string;
    businessId: string;
    catalogId: AgentCatalogId;
    name: string;
    description?: string;
    status: 'ACTIVE' | 'INACTIVE' | 'PAUSED';
    /** Business-specific overrides to the default node graph */
    nodeGraph: WorkflowGraph;
    /** Tool credentials configured by the business owner */
    toolConfig: Record<string, unknown>;
    /** Business-specific config (greeting text, field labels, etc.) */
    agentConfig: Record<string, unknown>;
    callStats?: AgentCallStats;
    createdAt: string;
    updatedAt: string;
}

export interface AgentCallStats {
    totalCalls: number;
    resolvedCalls: number;
    escalatedCalls: number;
    voicemailCalls: number;
    avgHandleTimeMs: number;
    resolutionRate: number;
}

// ============================================================================
// Call Session & Turns (one-problem-at-a-time)
// ============================================================================

/**
 * A single problem-resolution turn within a call session
 */
export interface CallTurn {
    turnNumber: number;
    agentId: string;
    catalogId: AgentCatalogId;
    intentKey: string;
    collectedFields: Record<string, unknown>;
    outcome: 'resolved' | 'escalated' | 'voicemail' | 'emergency' | 'failed';
    startedAt: string;
    resolvedAt?: string;
}

/**
 * Voicemail record created when no human is available
 */
export interface VoicemailRecord {
    id: string;
    callId: string;
    businessId: string;
    callerPhone: string;
    callerName?: string;
    recordingUrl: string;
    transcription?: string;
    context: string;
    isListened: boolean;
    createdAt: string;
}

/**
 * Handoff payload — passed to human staff when transfer occurs
 */
export interface HandoffPayload {
    callId: string;
    businessId: string;
    intentKey: string;
    tag: 'Scheduling' | 'Billing' | 'Insurance' | 'FAQ' | 'Prescription Refill' | 'Emergency';
    caller?: {
        name?: string;
        phone?: string;
        dob?: string;
    };
    summary: string;
    collectedFields: Record<string, unknown>;
    resolvedTurns: CallTurn[];
    transcriptUrl?: string;
    createdAt: string;
}

// ============================================================================
// Intent Configuration
// ============================================================================

export interface IntentConfig {
    requiredFields: IntentField[];
    routingRules: RoutingRule[];
}

export interface IntentField {
    key: string;
    label: string;
    type: 'text' | 'date' | 'select' | 'phone' | 'email';
    required: boolean;
    options?: string[];
    validation?: {
        pattern?: string;
        min?: number;
        max?: number;
    };
}

export interface RoutingRule {
    priority: number;
    conditions: RoutingCondition[];
    target: {
        type: 'phone' | 'agent' | 'voicemail';
        value: string;
    };
    fallback?: {
        type: 'phone' | 'voicemail';
        value: string;
    };
    schedule?: {
        timezone: string;
        hours: BusinessHours[];
    };
}

export interface RoutingCondition {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: string;
}

export interface BusinessHours {
    dayOfWeek: number; // 0-6 (Sunday-Saturday)
    startTime: string; // HH:mm format
    endTime: string;
}

// ============================================================================
// Safety & Emergency Detection
// ============================================================================

export interface SafetyDetectionResult {
    isEmergency: boolean;
    isOutOfScope: boolean;
    confidence: number;
    triggeredKeywords: string[];
    recommendedAction: 'continue' | 'deflect' | 'emergency_escalate' | 'human_transfer';
}

/** @deprecated Use SafetyDetectionResult */
export type EmergencyDetectionResult = SafetyDetectionResult;

export interface OutOfScopeDeflection {
    detectedTopic: string;
    deflectionMessage: string;
    escalateToHuman: boolean;
}

// ============================================================================
// Intent Detection
// ============================================================================

export interface IntentDetectionResult {
    intentKey: string;
    confidence: number;
    subIntent?: string;
    extractedFields: Record<string, unknown>;
    /** Which catalog agent should handle this */
    targetAgentCatalogId?: AgentCatalogId;
}

// ============================================================================
// Call State Machine
// ============================================================================

export type CallState =
    | 'initiated'
    | 'greeting'
    | 'intent-detection'
    | 'agent-handling'
    | 'continuation-check'
    | 'escalating'
    | 'voicemail'
    | 'completed'
    | 'failed';

export interface CallEvent {
    type: string;
    payload?: Record<string, unknown>;
    timestamp: Date;
}

/**
 * Full call context passed through the workflow execution engine
 */
export interface CallContext {
    callId: string;
    businessId: string;
    phoneNumberId: string;
    direction: 'inbound' | 'outbound';
    caller?: {
        name?: string;
        phone?: string;
    };
    transcript: string[];
    currentTurn: number;
    completedTurns: CallTurn[];
    detectedIntent?: string;
    activeAgentId?: string;
    extractedFields: Record<string, unknown>;
    sentiment?: number;
    isEmergency: boolean;
    needsContinuationCheck: boolean;
}

// ============================================================================
// Workflow Execution
// ============================================================================

export interface ExecutionResult {
    status: 'success' | 'waiting_for_input' | 'continuation_check' | 'error' | 'escalated' | 'voicemail';
    nextNodeId?: string;
    data?: Record<string, unknown>;
    error?: string;
    /** Set when status = 'continuation_check' — prompts "Anything else?" */
    continuationPrompt?: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

export interface ValidationError {
    nodeId?: string;
    type: string;
    message: string;
}

export interface ValidationWarning {
    nodeId?: string;
    type: string;
    message: string;
}

// ============================================================================
// Node-specific Config Shapes
// ============================================================================

export interface GreetingNodeConfig {
    businessName: string;
    greetingScript: string;
    /** e.g. "Monday-Friday 9AM-5PM" — injected into greeting if after hours */
    businessHours?: string;
}

export interface IntentDetectNodeConfig {
    /** Which intents (agent catalog IDs) to listen for */
    enabledAgents: AgentCatalogId[];
    confidenceThreshold: number;
    fallbackToHuman: boolean;
}

export interface RouteNodeConfig {
    routes: Array<{
        condition: string;
        targetNodeId: string;
        label: string;
    }>;
    defaultTargetNodeId: string;
}

export interface CollectInfoNodeConfig {
    fields: IntentField[];
    retryAttempts: number;
    timeoutSeconds: number;
}

export interface KnowledgeBaseNodeConfig {
    knowledgeBaseId: string;
    maxResults: number;
    fallbackMessage: string;
}

export interface HumanTransferNodeConfig {
    transferPhone: string;
    transferExtension?: string;
    contextSummary: boolean;
    noAnswerBehavior: 'voicemail' | 'end_call';
}

export interface VoicemailNodeConfig {
    promptScript: string;
    notifyEmail?: string;
    notifyPhone?: string;
    maxDurationSeconds: number;
}

export interface EmergencyEscalateNodeConfig {
    message: string;
    transferToEmergency: boolean;
    transferPhone?: string;
}

export interface ContinuationCheckNodeConfig {
    promptScript: string;
    maxTurns: number;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const workflowNodeSchema = z.object({
    id: z.string(),
    type: workflowNodeTypeSchema,
    config: z.record(z.unknown()),
    position: z.object({
        x: z.number(),
        y: z.number(),
    }).optional(),
});

export const workflowEdgeSchema = z.object({
    id: z.string(),
    fromNodeId: z.string(),
    toNodeId: z.string(),
    condition: z.string().optional(),
});

export const workflowGraphSchema = z.object({
    nodes: z.array(workflowNodeSchema),
    edges: z.array(workflowEdgeSchema),
});

export const handoffPayloadSchema = z.object({
    callId: z.string().uuid(),
    businessId: z.string().uuid(),
    intentKey: z.string(),
    tag: z.enum(['Scheduling', 'Billing', 'Insurance', 'FAQ', 'Prescription Refill', 'Emergency']),
    caller: z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        dob: z.string().optional(),
    }).optional(),
    summary: z.string(),
    collectedFields: z.record(z.unknown()),
    resolvedTurns: z.array(z.any()),
    transcriptUrl: z.string().url().optional(),
    createdAt: z.string().datetime(),
});

export const safetyDetectionResultSchema = z.object({
    isEmergency: z.boolean(),
    isOutOfScope: z.boolean(),
    confidence: z.number().min(0).max(1),
    triggeredKeywords: z.array(z.string()),
    recommendedAction: z.enum(['continue', 'deflect', 'emergency_escalate', 'human_transfer']),
});

export const intentDetectionResultSchema = z.object({
    intentKey: z.string(),
    confidence: z.number().min(0).max(1),
    subIntent: z.string().optional(),
    extractedFields: z.record(z.unknown()),
    targetAgentCatalogId: z.string().optional(),
});

export const callContextSchema = z.object({
    callId: z.string().uuid(),
    businessId: z.string().uuid(),
    phoneNumberId: z.string().uuid(),
    direction: z.enum(['inbound', 'outbound']),
    caller: z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
    }).optional(),
    transcript: z.array(z.string()),
    currentTurn: z.number().min(0),
    completedTurns: z.array(z.any()),
    detectedIntent: z.string().optional(),
    activeAgentId: z.string().optional(),
    extractedFields: z.record(z.unknown()),
    sentiment: z.number().min(-1).max(1).optional(),
    isEmergency: z.boolean(),
    needsContinuationCheck: z.boolean(),
});
