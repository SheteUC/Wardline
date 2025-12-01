/**
 * Patient Dashboard Types
 * Types for the patient-facing dashboard data
 */

export interface PatientInfo {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
}

export interface InsurancePlanInfo {
    id: string;
    planName: string;
    payerName: string;
    planType: 'PPO' | 'HMO' | 'EPO' | 'POS' | 'Medicare' | 'Medicaid' | 'Other';
    memberId: string;
    groupNumber?: string;
    effectiveDate: string;
    terminationDate?: string;
    copay?: number;
    deductible?: number;
    deductibleMet?: number;
}

export interface PatientBill {
    id: string;
    description: string;
    serviceDate: string;
    amountDue: number;
    dueDate: string;
    status: 'pending' | 'overdue' | 'paid' | 'partial';
    providerName?: string;
}

export interface PatientAppointment {
    id: string;
    scheduledAt: string;
    duration: number; // minutes
    providerName: string;
    serviceType: string;
    department?: string;
    location?: string;
    address?: string;
    status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
    notes?: string;
}

export interface TestResult {
    id: string;
    testName: string;
    testDate: string;
    status: 'pending' | 'available' | 'reviewed';
    category: string;
    orderedBy?: string;
    summary?: string;
}

export interface PatientDashboardData {
    patient: PatientInfo;
    insurance?: InsurancePlanInfo;
    bills: PatientBill[];
    appointments: PatientAppointment[];
    testResults: TestResult[];
    nextAppointment?: PatientAppointment;
}

/**
 * System Admin Dashboard Types
 */

export interface SystemOverview {
    totalHospitals: number;
    activePhoneNumbers: number;
    publishedWorkflows: number;
    todayCallsTotal: number;
}

export interface WorkflowSummary {
    id: string;
    hospitalId: string;
    hospitalName: string;
    name: string;
    status: 'draft' | 'published' | 'archived';
    lastUpdated: string;
    activeVersion?: number;
}

export interface PhoneNumberRouting {
    id: string;
    phoneNumber: string;
    hospitalId: string;
    hospitalName: string;
    workflowId?: string;
    workflowName?: string;
    status: 'active' | 'inactive';
}

export interface IntegrationHealth {
    name: string;
    status: 'ok' | 'degraded' | 'error';
    lastCheck: string;
    message?: string;
}

export interface ConfigAuditEntry {
    id: string;
    timestamp: string;
    userId: string;
    userName: string;
    action: string;
    entityType: string;
    entityId?: string;
    hospitalId?: string;
    hospitalName?: string;
    details?: string;
}

/**
 * Call Center Admin Dashboard Types
 */

export interface LiveCallStatus {
    id: string;
    callerId: string;
    callerName?: string;
    intent?: string;
    sentimentTrend: 'positive' | 'neutral' | 'negative';
    sentimentScore?: number;
    state: 'with_ai' | 'queued' | 'with_agent';
    duration: number; // seconds
    agentId?: string;
    agentName?: string;
    startedAt: string;
}

export interface EscalatedCall {
    id: string;
    callerId: string;
    callerName?: string;
    escalationType: 'clinical' | 'emergency' | 'low_confidence' | 'negative_sentiment';
    summary: string;
    tag?: string;
    sentimentScore: number;
    sentimentLabel: 'positive' | 'neutral' | 'negative';
    queuedAt: string;
    assignedAgentId?: string;
    assignedAgentName?: string;
    status: 'pending' | 'assigned' | 'handled';
}

export interface CallSummaryEntry {
    id: string;
    timestamp: string;
    summary: string;
    intent?: string;
    tag?: string;
    sentimentScore: number;
    sentimentLabel: 'positive' | 'neutral' | 'negative';
    outcome: 'resolved' | 'escalated' | 'abandoned';
    duration: number;
}

export interface CallCenterMetrics {
    averageWaitTime: number; // seconds
    escalatedCallsLastHour: number;
    callsWaitingForHuman: number;
    totalCallsToday: number;
    resolvedCallsToday: number;
    abandonedCallsToday: number;
}

export interface CallVolumeDataPoint {
    time: string;
    calls: number;
    escalations: number;
}

export interface AgentInfo {
    id: string;
    name: string;
    status: 'available' | 'busy' | 'offline';
    currentCallId?: string;
}

