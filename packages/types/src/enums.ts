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

/**
 * Voice call states for the orchestrator state machine
 */
export enum VoiceState {
    INITIALIZING = 'INITIALIZING',
    GREETING = 'GREETING',
    EMERGENCY_SCREENING = 'EMERGENCY_SCREENING',
    TRIAGE = 'TRIAGE',
    BOOKING = 'BOOKING',
    ESCALATING = 'ESCALATING',
    ENDING = 'ENDING',
    COMPLETED = 'COMPLETED',
}

// ============================================================================
// Call Center Feature Enums
// ============================================================================

/**
 * Prescription refill status
 */
export enum RefillStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    COMPLETED = 'completed',
}

/**
 * Patient verification status
 */
export enum VerificationStatus {
    UNVERIFIED = 'unverified',
    VERIFIED = 'verified',
    FAILED = 'failed',
}

/**
 * Insurance eligibility status
 */
export enum EligibilityStatus {
    ELIGIBLE = 'eligible',
    NOT_ELIGIBLE = 'not_eligible',
    PENDING = 'pending',
    EXPIRED = 'expired',
}

/**
 * Insurance inquiry type
 */
export enum InsuranceInquiryType {
    ACCEPTANCE = 'acceptance',
    COVERAGE = 'coverage',
    ELIGIBILITY = 'eligibility',
}

/**
 * Marketing event type
 */
export enum EventType {
    SEMINAR = 'seminar',
    LECTURE = 'lecture',
    CLASS = 'class',
    WORKSHOP = 'workshop',
    HEALTH_FAIR = 'health_fair',
    SCREENING = 'screening',
}

/**
 * Marketing event status
 */
export enum EventStatus {
    UPCOMING = 'upcoming',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

/**
 * Event registration status
 */
export enum RegistrationStatus {
    REGISTERED = 'registered',
    WAITLISTED = 'waitlisted',
    CANCELLED = 'cancelled',
    NO_SHOW = 'no_show',
}

/**
 * Insurance plan type
 */
export enum InsurancePlanType {
    HMO = 'HMO',
    PPO = 'PPO',
    EPO = 'EPO',
    POS = 'POS',
    HDHP = 'HDHP',
    MEDICARE = 'Medicare',
    MEDICAID = 'Medicaid',
    OTHER = 'Other',
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
export const voiceStateSchema = z.nativeEnum(VoiceState);
// Call Center Feature Schemas
export const refillStatusSchema = z.nativeEnum(RefillStatus);
export const verificationStatusSchema = z.nativeEnum(VerificationStatus);
export const eligibilityStatusSchema = z.nativeEnum(EligibilityStatus);
export const insuranceInquiryTypeSchema = z.nativeEnum(InsuranceInquiryType);
export const eventTypeSchema = z.nativeEnum(EventType);
export const eventStatusSchema = z.nativeEnum(EventStatus);
export const registrationStatusSchema = z.nativeEnum(RegistrationStatus);
export const insurancePlanTypeSchema = z.nativeEnum(InsurancePlanType);
