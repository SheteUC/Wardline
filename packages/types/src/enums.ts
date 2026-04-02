import { z } from 'zod';

/**
 * User role in a business organization
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
 * Call disposition tags — maps to the 5 starter agents
 */
export enum CallTag {
    SCHEDULING = 'Scheduling',
    BILLING = 'Billing',
    INSURANCE = 'Insurance',
    FAQ = 'FAQ',
    PRESCRIPTION_REFILL = 'Prescription Refill',
    HUMAN_TRANSFER = 'Human Transfer',
    EMERGENCY = 'Emergency',
    VOICEMAIL = 'Voicemail',
}

/**
 * Business (tenant) status
 */
export enum BusinessStatus {
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
 * Workflow node types — 13-node palette for the visual call flow editor
 */
export enum WorkflowNodeType {
    START = 'start',
    END = 'end',
    QUESTION = 'question',
    VOICE_PROMPT = 'voice-prompt',
    WEBHOOK = 'webhook',
    AI_AGENT = 'ai-agent',
    HUMAN_AGENT_QUEUE = 'human-agent-queue',
    HUMAN_AGENT_DIRECT = 'human-agent-direct',
    CONDITIONAL = 'conditional',
    SAFETY_CHECK = 'safety-check',
    EMERGENCY_SCREEN = 'emergency-screen',
    // Entry / Exit
    GREETING = 'greeting',
    END_CALL = 'end-call',
    // Core routing
    INTENT_DETECT = 'intent-detect',
    ROUTE = 'route',
    CONTINUATION_CHECK = 'continuation-check',
    // Data collection
    COLLECT_INFO = 'collect-info',
    CONFIRMATION = 'confirmation',
    // Knowledge & actions
    KNOWLEDGE_BASE = 'knowledge-base',
    AVAILABILITY_CHECK = 'availability-check',
    ACTION = 'action',
    // Escalation paths
    HUMAN_TRANSFER = 'human-transfer',
    VOICEMAIL = 'voicemail',
    EMERGENCY_ESCALATE = 'emergency-escalate',
}

export enum AgentType {
    AI = 'AI',
    HUMAN = 'HUMAN',
}

/**
 * Voice call states for the in-call session state machine
 */
export enum VoiceState {
    INITIALIZING = 'INITIALIZING',
    GREETING = 'GREETING',
    INTENT_DETECTION = 'INTENT_DETECTION',
    AGENT_HANDLING = 'AGENT_HANDLING',
    CONTINUATION_CHECK = 'CONTINUATION_CHECK',
    ESCALATING = 'ESCALATING',
    VOICEMAIL = 'VOICEMAIL',
    ENDING = 'ENDING',
    COMPLETED = 'COMPLETED',
}

// ============================================================================
// Prescription & Insurance Enums (kept — used by Agents 3 & 5)
// ============================================================================

export enum RefillStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    COMPLETED = 'completed',
}

export enum VerificationStatus {
    UNVERIFIED = 'unverified',
    VERIFIED = 'verified',
    FAILED = 'failed',
}

export enum EligibilityStatus {
    ELIGIBLE = 'eligible',
    NOT_ELIGIBLE = 'not_eligible',
    PENDING = 'pending',
    EXPIRED = 'expired',
}

export enum InsuranceInquiryType {
    ACCEPTANCE = 'acceptance',
    COVERAGE = 'coverage',
    ELIGIBILITY = 'eligibility',
    CLAIM_STATUS = 'claim_status',
    PRIOR_AUTH_STATUS = 'prior_auth_status',
}

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

// ============================================================================
// Agent Catalog Enums
// ============================================================================

/**
 * The 5 starter agents available in the catalog
 */
export enum AgentCatalogId {
    SCHEDULING = 'scheduling',
    BILLING = 'billing',
    INSURANCE = 'insurance',
    FAQ = 'faq',
    PRESCRIPTION_REFILL = 'prescription-refill',
}

/**
 * Agent deployment status (catalog item can be deployed or not)
 */
export enum AgentStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    PAUSED = 'PAUSED',
}

/**
 * Tool connection status
 */
export enum ToolStatus {
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    ERROR = 'error',
}

export enum AgentSessionStatus {
    OFFLINE = 'OFFLINE',
    AVAILABLE = 'AVAILABLE',
    BUSY = 'BUSY',
    AWAY = 'AWAY',
}

export enum CallAssignmentStatus {
    PENDING = 'PENDING',
    OFFERED = 'OFFERED',
    ACCEPTED = 'ACCEPTED',
    COMPLETED = 'COMPLETED',
    ABANDONED = 'ABANDONED',
    EXPIRED = 'EXPIRED',
}

export enum IntegrationCategory {
    SCHEDULING = 'SCHEDULING',
    EHR_REFILL = 'EHR_REFILL',
    BILLING = 'BILLING',
    INSURANCE = 'INSURANCE',
    KNOWLEDGE = 'KNOWLEDGE',
}

export enum IntegrationStatus {
    DISCONNECTED = 'DISCONNECTED',
    CONNECTED = 'CONNECTED',
    ERROR = 'ERROR',
}

// ============================================================================
// Zod Schema Exports
// ============================================================================

export const userRoleSchema = z.nativeEnum(UserRole);
export const callDirectionSchema = z.nativeEnum(CallDirection);
export const callStatusSchema = z.nativeEnum(CallStatus);
export const recordingConsentSchema = z.nativeEnum(RecordingConsent);
export const callTagSchema = z.nativeEnum(CallTag);
export const businessStatusSchema = z.nativeEnum(BusinessStatus);
export const recordingDefaultSchema = z.nativeEnum(RecordingDefault);
export const workflowStatusSchema = z.nativeEnum(WorkflowStatus);
export const workflowVersionStatusSchema = z.nativeEnum(WorkflowVersionStatus);
export const speakerSchema = z.nativeEnum(Speaker);
export const sentimentLabelSchema = z.nativeEnum(SentimentLabel);
export const workflowNodeTypeSchema = z.nativeEnum(WorkflowNodeType);
export const voiceStateSchema = z.nativeEnum(VoiceState);
export const refillStatusSchema = z.nativeEnum(RefillStatus);
export const verificationStatusSchema = z.nativeEnum(VerificationStatus);
export const eligibilityStatusSchema = z.nativeEnum(EligibilityStatus);
export const insuranceInquiryTypeSchema = z.nativeEnum(InsuranceInquiryType);
export const insurancePlanTypeSchema = z.nativeEnum(InsurancePlanType);
export const agentCatalogIdSchema = z.nativeEnum(AgentCatalogId);
export const agentStatusSchema = z.nativeEnum(AgentStatus);
export const toolStatusSchema = z.nativeEnum(ToolStatus);
export const agentTypeSchema = z.nativeEnum(AgentType);
export const agentSessionStatusSchema = z.nativeEnum(AgentSessionStatus);
export const callAssignmentStatusSchema = z.nativeEnum(CallAssignmentStatus);
export const integrationCategorySchema = z.nativeEnum(IntegrationCategory);
export const integrationStatusSchema = z.nativeEnum(IntegrationStatus);
