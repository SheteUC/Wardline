import { z } from 'zod';
import { workflowNodeTypeSchema } from './enums';

/**
 * Workflow node configuration
 */
export interface WorkflowNode {
    id: string;
    type: 'start' | 'emergency-screen' | 'intent-detect' | 'question' | 'route' | 'webhook' | 'end';
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
