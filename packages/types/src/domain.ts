import { z } from 'zod';
import { workflowNodeTypeSchema } from './enums';

/**
 * Workflow node configuration
 */
export interface WorkflowNode {
    id: string;
    type: 
        | 'start'
        | 'emergency-screen'
        | 'intent-detect'
        | 'question'
        | 'route'
        | 'webhook'
        | 'end'
        // Multi-Agent Platform node types
        | 'ai-agent'
        | 'human-agent-queue'
        | 'human-agent-direct'
        | 'conditional'
        | 'safety-check'
        | 'collect-info'
        | 'integration';
    config: Record<string, unknown>;
    position?: { x: number; y: number };
}

/**
 * Workflow edge (connection between nodes)
 */
export interface WorkflowEdge {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    condition?: string;
}

/**
 * Workflow graph structure
 */
export interface WorkflowGraph {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

/**
 * Handoff payload structure
 */
export interface HandoffPayload {
    callId: string;
    hospitalId: string;
    intentKey: string;
    tag: 'Scheduling' | 'Billing/Insurance' | 'Records/Forms' | 'Refill/Prior-Auth' | 'Clinical Escalation';
    patient?: {
        externalId?: string;
        name?: string;
        dob?: string;
        phone?: string;
    };
    summary: string;
    fields: Record<string, unknown>;
    transcriptUrl?: string;
    createdAt: string;
}

/**
 * Intent configuration (stored in JSON fields)
 */
export interface IntentConfig {
    requiredFields: IntentField[];
    routingRules: RoutingRule[];
}

/**
 * Intent field definition
 */
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

/**
 * Routing rule definition
 */
export interface RoutingRule {
    priority: number;
    conditions: RoutingCondition[];
    target: {
        type: 'phone' | 'queue' | 'webhook';
        value: string;
    };
    fallback?: {
        type: 'phone' | 'queue';
        value: string;
    };
    schedule?: {
        timezone: string;
        hours: BusinessHours[];
    };
}

/**
 * Routing condition
 */
export interface RoutingCondition {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: string;
}

/**
 * Business hours definition
 */
export interface BusinessHours {
    dayOfWeek: number; // 0-6 (Sunday-Saturday)
    startTime: string; // HH:mm format
    endTime: string;   // HH:mm format
}

/**
 * Emergency detection result
 */
export interface EmergencyDetectionResult {
    isEmergency: boolean;
    confidence: number;
    triggeredKeywords: string[];
    mlScore?: number;
}

/**
 * Intent detection result
 */
export interface IntentDetectionResult {
    intentKey: string;
    confidence: number;
    subIntent?: string;
    extractedFields: Record<string, unknown>;
}

/**
 * Call state machine states
 */
export type CallState =
    | 'initiated'
    | 'consent'
    | 'emergency-screen'
    | 'intake'
    | 'scheduling'
    | 'handoff'
    | 'completed'
    | 'failed';

/**
 * Call event for state machine transitions
 */
export interface CallEvent {
    type: string;
    payload?: Record<string, unknown>;
    timestamp: Date;
}

// Zod schemas for validation

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
    hospitalId: z.string().uuid(),
    intentKey: z.string(),
    tag: z.enum(['Scheduling', 'Billing/Insurance', 'Records/Forms', 'Refill/Prior-Auth', 'Clinical Escalation']),
    patient: z.object({
        externalId: z.string().optional(),
        name: z.string().optional(),
        dob: z.string().optional(),
        phone: z.string().optional(),
    }).optional(),
    summary: z.string(),
    fields: z.record(z.unknown()),
    transcriptUrl: z.string().url().optional(),
    createdAt: z.string().datetime(),
});

export const emergencyDetectionResultSchema = z.object({
    isEmergency: z.boolean(),
    confidence: z.number().min(0).max(1),
    triggeredKeywords: z.array(z.string()),
    mlScore: z.number().min(0).max(1).optional(),
});

export const intentDetectionResultSchema = z.object({
    intentKey: z.string(),
    confidence: z.number().min(0).max(1),
    subIntent: z.string().optional(),
    extractedFields: z.record(z.unknown()),
});

// ============================================================================
// Multi-Agent Platform Interfaces
// ============================================================================

/**
 * AI Agent Configuration
 */
export interface AIAgentConfig {
    persona: string; // e.g., "Scheduling Assistant", "Billing Specialist"
    systemPrompt: string; // LLM system prompt
    capabilities: string[]; // ["schedule_appointments", "answer_billing_questions"]
    knowledgeBase?: string; // Optional knowledge base reference
    escalationRules: EscalationRule[]; // When to escalate to human
    maxInteractions?: number; // Auto-escalate after N turns
}

/**
 * Human Agent Profile
 */
export interface HumanAgentProfile {
    userId: string; // Link to User model
    specialization: string[]; // ["clinical", "scheduling", "billing"]
    skills: string[]; // Detailed skill tags
    availability: AvailabilitySchedule;
    maxConcurrentCalls: number;
    contactInfo: {
        phone?: string;
        email?: string;
        sms?: string;
    };
    notificationPreferences: {
        inApp: boolean;
        sms: boolean;
        email: boolean;
    };
}

/**
 * Availability Schedule
 */
export interface AvailabilitySchedule {
    timezone: string;
    schedule: ScheduleBlock[];
    breaks?: BreakSchedule[];
}

/**
 * Schedule Block
 */
export interface ScheduleBlock {
    dayOfWeek: number; // 0-6 (Sunday-Saturday)
    startTime: string; // "09:00"
    endTime: string; // "17:00"
}

/**
 * Break Schedule
 */
export interface BreakSchedule {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    type: 'lunch' | 'break';
}

/**
 * Escalation Rule
 */
export interface EscalationRule {
    condition: {
        type: 'keyword' | 'intent' | 'sentiment' | 'duration' | 'interaction_count';
        value: string | number;
        operator: 'contains' | 'equals' | 'greater_than' | 'less_than';
    };
    action: {
        type: 'route_to_queue' | 'assign_to_agent' | 'notify';
        target: string; // queue name or agent ID
    };
    priority: number;
}

/**
 * Call Context for Workflow Execution
 */
export interface CallContext {
    callId: string;
    hospitalId: string;
    phoneNumberId: string;
    direction: 'inbound' | 'outbound';
    caller?: {
        name?: string;
        phone?: string;
    };
    transcript: string[];
    detectedIntent?: string;
    extractedFields: Record<string, unknown>;
    sentiment?: number;
    isEmergency: boolean;
}

/**
 * Workflow Execution Result
 */
export interface ExecutionResult {
    status: 'success' | 'waiting_for_agent' | 'error' | 'escalated';
    nextNodeId?: string;
    data?: Record<string, unknown>;
    error?: string;
}

/**
 * Validation Result
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

/**
 * Validation Error
 */
export interface ValidationError {
    nodeId?: string;
    type: string;
    message: string;
}

/**
 * Validation Warning
 */
export interface ValidationWarning {
    nodeId?: string;
    type: string;
    message: string;
}

/**
 * Assignment Options
 */
export interface AssignmentOptions {
    strategy: 'skill_based' | 'round_robin' | 'least_busy' | 'priority_based';
    priorityLevel?: number;
}

// Zod schemas for validation

export const aiAgentConfigSchema = z.object({
    persona: z.string(),
    systemPrompt: z.string(),
    capabilities: z.array(z.string()),
    knowledgeBase: z.string().optional(),
    escalationRules: z.array(z.object({
        condition: z.object({
            type: z.enum(['keyword', 'intent', 'sentiment', 'duration', 'interaction_count']),
            value: z.union([z.string(), z.number()]),
            operator: z.enum(['contains', 'equals', 'greater_than', 'less_than']),
        }),
        action: z.object({
            type: z.enum(['route_to_queue', 'assign_to_agent', 'notify']),
            target: z.string(),
        }),
        priority: z.number(),
    })),
    maxInteractions: z.number().optional(),
});

export const humanAgentProfileSchema = z.object({
    userId: z.string().uuid(),
    specialization: z.array(z.string()),
    skills: z.array(z.string()),
    availability: z.object({
        timezone: z.string(),
        schedule: z.array(z.object({
            dayOfWeek: z.number().min(0).max(6),
            startTime: z.string(),
            endTime: z.string(),
        })),
        breaks: z.array(z.object({
            dayOfWeek: z.number().min(0).max(6),
            startTime: z.string(),
            endTime: z.string(),
            type: z.enum(['lunch', 'break']),
        })).optional(),
    }),
    maxConcurrentCalls: z.number().min(1),
    contactInfo: z.object({
        phone: z.string().optional(),
        email: z.string().email().optional(),
        sms: z.string().optional(),
    }),
    notificationPreferences: z.object({
        inApp: z.boolean(),
        sms: z.boolean(),
        email: z.boolean(),
    }),
});

export const callContextSchema = z.object({
    callId: z.string().uuid(),
    hospitalId: z.string().uuid(),
    phoneNumberId: z.string().uuid(),
    direction: z.enum(['inbound', 'outbound']),
    caller: z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
    }).optional(),
    transcript: z.array(z.string()),
    detectedIntent: z.string().optional(),
    extractedFields: z.record(z.unknown()),
    sentiment: z.number().min(-1).max(1).optional(),
    isEmergency: z.boolean(),
});
