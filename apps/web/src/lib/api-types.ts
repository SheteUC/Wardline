import {
    CallStatus,
    CallDirection,
    RecordingConsent,
    UserRole,
    IntegrationCategory,
    IntegrationStatus,
} from '@wardline/types';

export interface ApiResponse<T> {
    data: T;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}

export interface TranscriptSegment {
    id: string;
    speaker: 'CALLER' | 'AGENT' | 'SYSTEM';
    text: string;
    startTimeMs: number;
    endTimeMs: number;
    confidence?: number;
    createdAt?: string;
}

export interface OperatingHoursSlot {
    dayOfWeek: number;
    isClosed: boolean;
    startTime: string | null;
    endTime: string | null;
}

export type PracticeAction =
    | 'appointment-request'
    | 'refill-request'
    | 'insurance-check'
    | 'billing-request';

export interface AfterHoursPolicy {
    mode: 'urgent_voicemail' | 'voicemail' | 'next_business_day_callback';
    greeting: string;
    sendUrgentToVoicemail: boolean;
}

export interface ServicePolicy {
    liveEnabled: boolean;
    intakeNotes: string;
    fallbackSummary: string;
}

export interface KnowledgeConfig {
    faqSummary: string;
    commonQuestions: string[];
}

export interface EscalationConfig {
    urgentCallbackWindowMinutes: number;
    escalationMessage: string;
    notifyStaffImmediately: boolean;
}

export interface FollowUpTask {
    id: string;
    businessId: string;
    callId?: string;
    voicemailId?: string;
    type:
        | 'URGENT_CALLBACK'
        | 'VOICEMAIL_REVIEW'
        | 'MANUAL_REVIEW'
        | 'APPOINTMENT_REQUEST'
        | 'REFILL_REQUEST'
        | 'INSURANCE_CHECK'
        | 'BILLING_REQUEST';
    status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    title: string;
    summary: string;
    callerName?: string;
    callerPhone?: string;
    urgencyKeywords: string[];
    metadata?: Record<string, unknown>;
    dueAt?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
    call?: {
        id: string;
        tag?: string;
        startedAt?: string;
        isEmergency?: boolean;
    };
    voicemail?: {
        id: string;
        isListened: boolean;
        createdAt: string;
        recordingUrl?: string;
    };
}

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
    updatedAt?: string;
    call?: {
        tag?: string;
        startedAt?: string;
        isEmergency?: boolean;
    };
    followUpTask?: Pick<FollowUpTask, 'id' | 'type' | 'priority' | 'status' | 'metadata'>;
}

export interface CallListItem {
    id: string;
    businessId: string;
    twilioCallSid: string;
    direction: CallDirection;
    status: CallStatus;
    recordingConsent?: RecordingConsent;
    tag?: string;
    callerPhone: string;
    callerName?: string;
    lineLabel?: string;
    isEmergency: boolean;
    turnCount: number;
    hasVoicemail: boolean;
    voicemailListened: boolean;
    followUpTaskCount?: number;
    duration: number;
    sentimentScore?: number;
    startedAt: string;
    endedAt?: string;
}

export interface CallDetail {
    id: string;
    businessId: string;
    twilioCallSid: string;
    direction: CallDirection;
    status: CallStatus;
    tag?: string;
    isEmergency: boolean;
    turnCount: number;
    startedAt: string;
    endedAt?: string;
    recordingUrl?: string;
    sentimentScore?: number;
    phoneNumber: {
        id: string;
        twilioPhoneNumber: string;
        label: string;
    };
    caller?: {
        id: string;
        name?: string;
        phone?: string;
    };
    transcriptSegments: TranscriptSegment[];
    handoffs: Array<{
        id: string;
        payload: Record<string, unknown>;
        createdAt: string;
    }>;
    voicemails: VoicemailRecord[];
    appointments?: Array<{
        id: string;
        callerName?: string;
        scheduledAt?: string;
        status?: string;
    }>;
    prescriptionRefills?: Array<{
        id: string;
        medicationName?: string;
        status?: string;
    }>;
    insuranceInquiries?: Array<{
        id: string;
        inquiryType?: string;
        resolved?: boolean;
    }>;
    followUpTasks: FollowUpTask[];
    runtimeActionEvents: Array<{
        type: 'runtime_action_outcome';
        actionName: string;
        domain?: string;
        integrationCategory?: string;
        integrationVendor?: string;
        handledLive: boolean;
        followUpTaskId?: string;
        fallbackReason?: string;
        operatorSummary?: string;
        callerName?: string;
        callerPhone?: string;
        data?: Record<string, unknown>;
        latencyMs?: number;
        createdAt: string;
    }>;
    operatorSummary?: {
        resolution: string;
        label: string;
        nextStep: string;
        fallbackReason?: string;
        actionName?: string;
        followUpTaskId?: string;
        handledLive?: boolean;
    };
}

export interface CallAnalytics {
    totalCalls: number;
    completedCalls: number;
    abandonedCalls: number;
    emergencyCalls: number;
    voicemailCount: number;
    avgDurationSeconds: number;
    callsByTag: Record<string, number>;
}

export interface TeamMember {
    id: string;
    businessId: string;
    clerkUserId: string;
    email: string;
    name?: string;
    fullName?: string;
    avatarUrl?: string;
    role: UserRole;
    isActive?: boolean;
    lastSeenAt?: string;
    createdAt: string;
}

export interface BusinessSettings {
    id: string;
    name: string;
    slug: string;
    timeZone?: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    settings?: {
        recordingDefault: string;
        transcriptRetentionDays: number;
        operatingHours?: OperatingHoursSlot[];
        enabledActions: PracticeAction[];
        afterHoursPolicy: AfterHoursPolicy;
        refillPolicy: ServicePolicy;
        billingPolicy: ServicePolicy;
        insurancePolicy: ServicePolicy;
        knowledgeConfig: KnowledgeConfig;
        escalationConfig: EscalationConfig;
        outOfScopeKeywords: string[];
        emergencyKeywords: string[];
    };
    phoneNumbers?: Array<{
        id: string;
        twilioPhoneNumber: string;
        label: string;
    }>;
    _count?: {
        users: number;
        phoneNumbers: number;
        callSessions: number;
    };
}

export interface BusinessIntegration {
    id: string;
    businessId: string;
    category: IntegrationCategory;
    vendor: string;
    status: IntegrationStatus;
    credentialsRef?: string;
    settings?: Record<string, unknown>;
    capabilities?: Record<string, unknown>;
    lastHealthCheckAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface IntegrationHealthCheckResult {
    ok: boolean;
    message: string;
    integration: BusinessIntegration;
    latencyMs?: number;
}

export interface BusinessRuntimeConfig {
    business: {
        id: string;
        name: string;
        slug: string;
        timeZone: string;
        status: string;
    };
    settings: NonNullable<BusinessSettings['settings']>;
    phoneNumbers: Array<{
        id: string;
        label: string;
        twilioPhoneNumber: string;
    }>;
    integrations: Array<Pick<BusinessIntegration, 'id' | 'category' | 'vendor' | 'status' | 'capabilities' | 'lastHealthCheckAt'>>;
    connectedIntegrationCategories: string[];
    voicePolicyV2: {
        version: 'v2';
        runtime: 'internal-multi-agent';
        speaker: 'supervisor';
        enabledDomains: Array<'safety' | 'knowledge' | 'scheduling' | 'refill' | 'insurance' | 'billing' | 'handoff'>;
        connectedCategories: string[];
        writeActionsRequiringConfirmation: Array<'appointment-request' | 'refill-request' | 'billing-request'>;
        afterHoursPolicy: AfterHoursPolicy;
        knowledgeConfig: KnowledgeConfig;
        servicePolicies: {
            scheduling: ServicePolicy & {
                enabled: boolean;
                runtimeAction: 'appointment-request';
                integrationCategory: 'SCHEDULING';
            };
            refill: ServicePolicy & {
                enabled: boolean;
                runtimeAction: 'refill-request';
                integrationCategory: 'EHR_REFILL';
            };
            insurance: ServicePolicy & {
                enabled: boolean;
                runtimeAction: 'insurance-check';
                integrationCategory: 'INSURANCE';
            };
            billing: ServicePolicy & {
                enabled: boolean;
                runtimeAction: 'billing-request';
                integrationCategory: 'BILLING';
            };
        };
        escalationConfig: EscalationConfig;
        emergencyKeywords: string[];
        outOfScopeKeywords: string[];
        fallbackRuntimeAction: 'manual-follow-up';
        operatorSummaryEnabled: true;
    };
    activeWorkflow?: {
        id: string;
        name: string;
        description?: string;
        version?: number;
        graphJson?: unknown;
    } | null;
}

export interface SystemHealth {
    status: 'healthy' | 'degraded' | 'down';
    services: {
        telephony: boolean;
        ai: boolean;
        database: boolean;
    };
    agentsOnline: number;
    queueLength: number;
    estimatedWaitTime: number;
}
