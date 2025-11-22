import { z } from 'zod';

/**
 * User role in a hospital organization
 */
export enum UserRole {
    OWNER = 'owner',
    ADMIN = 'admin',
    SUPERVISOR = 'supervisor',
    AGENT = 'agent',
    READONLY = 'readonly',
}

/**
 * Call direction
 */
export enum CallDirection {
    INBOUND = 'inbound',
    OUTBOUND = 'outbound',
}

/**
 * Call status
 */
export enum CallStatus {
    INITIATED = 'initiated',
    ONGOING = 'ongoing',
    COMPLETED = 'completed',
    ABANDONED = 'abandoned',
    FAILED = 'failed',
}

/**
 * Recording consent type
 */
export enum RecordingConsent {
    IMPLICIT = 'implicit',
    EXPLICIT = 'explicit',
    DECLINED = 'declined',
}

/**
 * Call disposition tags
 */
export enum CallTag {
    SCHEDULING = 'Scheduling',
    BILLING_INSURANCE = 'Billing/Insurance',
    RECORDS_FORMS = 'Records/Forms',
    REFILL_PRIOR_AUTH = 'Refill/Prior-Auth',
    CLINICAL_ESCALATION = 'Clinical Escalation',
}

/**
 * Hospital status
 */
export enum HospitalStatus {
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
}

/**
 * Recording default setting
 */
export enum RecordingDefault {
    ON = 'on',
    OFF = 'off',
    ASK = 'ask',
}

/**
 * Workflow status
 */
export enum WorkflowStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
}

/**
 * Workflow version status
 */
export enum WorkflowVersionStatus {
    DRAFT = 'draft',
    PENDING_APPROVAL = 'pending_approval',
    APPROVED = 'approved',
    PUBLISHED = 'published',
}

/**
 * Call speaker type
 */
export enum Speaker {
    CALLER = 'caller',
    AGENT = 'agent',
    SYSTEM = 'system',
}

/**
 * Sentiment label
 */
export enum SentimentLabel {
    NEGATIVE = 'negative',
    NEUTRAL = 'neutral',
    POSITIVE = 'positive',
}

/**
 * Workflow node types
 */
export enum WorkflowNodeType {
    START = 'start',
    EMERGENCY_SCREEN = 'emergency-screen',
    INTENT_DETECT = 'intent-detect',
    QUESTION = 'question',
    ROUTE = 'route',
    WEBHOOK = 'webhook',
    END = 'end',
}

// Schema exports
export const userRoleSchema = z.nativeEnum(UserRole);
export const callDirectionSchema = z.nativeEnum(CallDirection);
export const callStatusSchema = z.nativeEnum(CallStatus);
export const recordingConsentSchema = z.nativeEnum(RecordingConsent);
export const callTagSchema = z.nativeEnum(CallTag);
export const hospitalStatusSchema = z.nativeEnum(HospitalStatus);
export const recordingDefaultSchema = z.nativeEnum(RecordingDefault);
export const workflowStatusSchema = z.nativeEnum(WorkflowStatus);
export const workflowVersionStatusSchema = z.nativeEnum(WorkflowVersionStatus);
export const speakerSchema = z.nativeEnum(Speaker);
export const sentimentLabelSchema = z.nativeEnum(SentimentLabel);
export const workflowNodeTypeSchema = z.nativeEnum(WorkflowNodeType);
