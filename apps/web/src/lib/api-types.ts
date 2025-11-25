import {
    CallStatus,
    CallDirection,
    RecordingConsent,
    UserRole,
    WorkflowStatus,
    WorkflowVersionStatus,
    SentimentLabel,
} from '@wardline/types';

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
    data: T;
    message?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}

/**
 * Call list item
 */
export interface CallListItem {
    id: string;
    hospitalId: string;
    twilioCallSid: string;
    direction: CallDirection;
    status: CallStatus;
    callerPhone: string;
    callerName?: string;
    duration: number;
    recordingConsent: RecordingConsent;
    wasEmergency: boolean;
    detectedIntent?: string;
    sentiment?: SentimentLabel;
    sentimentScore?: number;
    createdAt: string;
    updatedAt: string;
}

/**
 * Call detail
 */
export interface CallDetail extends CallListItem {
    recordingUrl?: string;
    transcriptUrl?: string;
    summary?: string;
    extractedFields?: Record<string, unknown>;
    handoffData?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    transcript?: TranscriptSegment[];
}

/**
 * Transcript segment
 */
export interface TranscriptSegment {
    id: string;
    speaker: 'caller' | 'agent' | 'system';
    text: string;
    timestamp: number;
    sentiment?: SentimentLabel;
    sentimentScore?: number;
}

/**
 * Call analytics data
 */
export interface CallAnalytics {
    totalCalls: number;
    completedCalls: number;
    abandonedCalls: number;
    averageDuration: number;
    averageHoldTime: number;
    abandonRate: number;
    emergencyFlags: number;
    activeEmergencies: number;
    callVolumeByHour: Array<{
        hour: string;
        calls: number;
        sentiment?: number;
    }>;
    intentBreakdown: Array<{
        intent: string;
        count: number;
        percentage: number;
    }>;
    sentimentTrend: Array<{
        date: string;
        positive: number;
        neutral: number;
        negative: number;
    }>;
}

/**
 * Workflow list item
 */
export interface WorkflowListItem {
    id: string;
    hospitalId: string;
    name: string;
    description?: string;
    status: WorkflowStatus;
    activeVersionId?: string;
    activeVersion?: {
        version: number;
        publishedAt?: string;
    };
    createdAt: string;
    updatedAt: string;
}

/**
 * Workflow detail
 */
export interface WorkflowDetail extends WorkflowListItem {
    versions: WorkflowVersionListItem[];
}

/**
 * Workflow version list item
 */
export interface WorkflowVersionListItem {
    id: string;
    workflowId: string;
    version: number;
    status: WorkflowVersionStatus;
    graphJson: unknown;
    createdBy: string;
    approvedBy?: string;
    publishedAt?: string;
    createdAt: string;
}

/**
 * Team member
 */
export interface TeamMember {
    id: string;
    clerkUserId: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    role: UserRole;
    hospitalId: string;
    isActive: boolean;
    lastSeenAt?: string;
    createdAt: string;
}

/**
 * Hospital settings
 */
export interface HospitalSettings {
    id: string;
    name: string;
    timezone: string;
    recordingDefault: 'on' | 'off' | 'ask';
    maxCallDuration: number;
    businessHours?: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
    }>;
    twilioPhoneNumbers?: string[];
    integrations?: {
        timetap?: {
            enabled: boolean;
            apiKey?: string;
        };
        ehr?: {
            enabled: boolean;
            provider?: string;
        };
    };
}

/**
 * Live call status
 */
export interface LiveCallStatus {
    callId: string;
    status: 'ongoing' | 'waiting' | 'completed';
    duration: number;
    currentState?: string;
    queuePosition?: number;
    agentId?: string;
}

/**
 * System health
 */
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
