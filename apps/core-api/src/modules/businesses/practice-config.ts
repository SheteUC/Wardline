export const PRACTICE_ACTIONS = [
    'appointment-request',
    'refill-request',
    'insurance-check',
    'billing-request',
] as const;

export type PracticeAction = (typeof PRACTICE_ACTIONS)[number];

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

export const KNOWLEDGE_ROUTE_TARGETS = [
    'knowledge',
    'scheduling',
    'refill',
    'insurance',
    'billing',
    'handoff',
] as const;

export type KnowledgeRouteTarget = (typeof KNOWLEDGE_ROUTE_TARGETS)[number];

export interface KnowledgeFaqItem {
    question: string;
    answer: string;
    routeTo?: KnowledgeRouteTarget;
}

export interface KnowledgeConfig {
    faqSummary: string;
    commonQuestions: string[];
    servicesSummary: string;
    appointmentSummary: string;
    refillSummary: string;
    insuranceSummary: string;
    billingSummary: string;
    customFaqs: KnowledgeFaqItem[];
}

export interface EscalationConfig {
    urgentCallbackWindowMinutes: number;
    escalationMessage: string;
    notifyStaffImmediately: boolean;
}

export interface NormalizedPracticeSetup {
    enabledActions: PracticeAction[];
    afterHoursPolicy: AfterHoursPolicy;
    refillPolicy: ServicePolicy;
    billingPolicy: ServicePolicy;
    insurancePolicy: ServicePolicy;
    knowledgeConfig: KnowledgeConfig;
    escalationConfig: EscalationConfig;
}

export const DEFAULT_AFTER_HOURS_POLICY: AfterHoursPolicy = {
    mode: 'urgent_voicemail',
    greeting:
        'The office is currently closed, but I can take a message for the staff and they will follow up on the next business day.',
    sendUrgentToVoicemail: true,
};

export const DEFAULT_REFILL_POLICY: ServicePolicy = {
    liveEnabled: true,
    intakeNotes:
        'Collect medication name, caller date of birth, pharmacy name, and pharmacy phone before submitting refill requests.',
    fallbackSummary: 'If refill automation is unavailable, create a refill follow-up task for staff.',
};

export const DEFAULT_BILLING_POLICY: ServicePolicy = {
    liveEnabled: true,
    intakeNotes: 'Capture the billing topic and account reference before creating a billing follow-up.',
    fallbackSummary: 'If billing automation is unavailable, create a billing follow-up task for staff.',
};

export const DEFAULT_INSURANCE_POLICY: ServicePolicy = {
    liveEnabled: true,
    intakeNotes: 'Answer acceptance and basic eligibility questions when supported by the connected payer workflow.',
    fallbackSummary: 'If insurance automation is unavailable, create an insurance follow-up task for staff.',
};

export const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeConfig = {
    faqSummary:
        'Family medicine practice that handles routine appointments, prescription refill requests, billing questions, and insurance acceptance checks.',
    commonQuestions: [
        'Office hours',
        'Prescription refill requests',
        'Insurance acceptance',
        'Billing support',
    ],
    servicesSummary:
        'Family medicine practice that handles routine appointments, prescription refill requests, billing questions, and insurance acceptance checks.',
    appointmentSummary:
        'We can help capture routine appointments, follow-ups, physicals, and new patient scheduling requests for the practice.',
    refillSummary:
        'We can capture prescription refill requests for the practice. Please have the medication name, date of birth, pharmacy name, and pharmacy phone number ready.',
    insuranceSummary:
        'We can answer basic insurance acceptance questions. Plan-specific coverage or copay questions may still need staff follow-up.',
    billingSummary:
        'We can capture billing questions about balances, statements, and payment issues for the practice staff to review.',
    customFaqs: [],
};

export const DEFAULT_ESCALATION_CONFIG: EscalationConfig = {
    urgentCallbackWindowMinutes: 30,
    escalationMessage:
        'Escalate emergencies immediately. Capture urgent after-hours messages and create priority staff follow-ups.',
    notifyStaffImmediately: true,
};

const PRACTICE_ACTION_SET = new Set<string>(PRACTICE_ACTIONS);

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function cloneKnowledgeConfig(config: KnowledgeConfig): KnowledgeConfig {
    return {
        ...config,
        commonQuestions: [...config.commonQuestions],
        customFaqs: config.customFaqs.map((item) => ({ ...item })),
    };
}

function normalizeKnowledgeFaqItems(value: unknown): KnowledgeFaqItem[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const routeTargets = new Set<string>(KNOWLEDGE_ROUTE_TARGETS);
    return value
        .filter((entry): entry is Record<string, unknown> => isObject(entry))
        .map((entry) => {
            const question = typeof entry.question === 'string' ? entry.question.trim() : '';
            const answer = typeof entry.answer === 'string' ? entry.answer.trim() : '';
            const routeTo =
                typeof entry.routeTo === 'string' && routeTargets.has(entry.routeTo)
                    ? (entry.routeTo as KnowledgeRouteTarget)
                    : undefined;
            return question && answer ? { question, answer, ...(routeTo ? { routeTo } : {}) } : null;
        })
        .filter((entry): entry is KnowledgeFaqItem => entry !== null);
}

function normalizeServicePolicy(value: unknown, fallback: ServicePolicy): ServicePolicy {
    if (!isObject(value)) {
        return { ...fallback };
    }

    return {
        liveEnabled: value.liveEnabled === false ? false : fallback.liveEnabled,
        intakeNotes:
            typeof value.intakeNotes === 'string' && value.intakeNotes.trim()
                ? value.intakeNotes.trim()
                : fallback.intakeNotes,
        fallbackSummary:
            typeof value.fallbackSummary === 'string' && value.fallbackSummary.trim()
                ? value.fallbackSummary.trim()
                : fallback.fallbackSummary,
    };
}

export function normalizeEnabledActions(value: unknown): PracticeAction[] {
    const list = Array.isArray(value) ? value : PRACTICE_ACTIONS;
    const normalized = list.filter(
        (entry): entry is PracticeAction => typeof entry === 'string' && PRACTICE_ACTION_SET.has(entry),
    );

    return normalized.length > 0 ? Array.from(new Set(normalized)) : [...PRACTICE_ACTIONS];
}

export function normalizeAfterHoursPolicy(value: unknown): AfterHoursPolicy {
    if (!isObject(value)) {
        return { ...DEFAULT_AFTER_HOURS_POLICY };
    }

    const mode =
        value.mode === 'voicemail' ||
        value.mode === 'next_business_day_callback' ||
        value.mode === 'urgent_voicemail'
            ? value.mode
            : DEFAULT_AFTER_HOURS_POLICY.mode;

    return {
        mode,
        greeting:
            typeof value.greeting === 'string' && value.greeting.trim()
                ? value.greeting.trim()
                : DEFAULT_AFTER_HOURS_POLICY.greeting,
        sendUrgentToVoicemail:
            typeof value.sendUrgentToVoicemail === 'boolean'
                ? value.sendUrgentToVoicemail
                : DEFAULT_AFTER_HOURS_POLICY.sendUrgentToVoicemail,
    };
}

export function normalizeKnowledgeConfig(value: unknown): KnowledgeConfig {
    if (!isObject(value)) {
        return cloneKnowledgeConfig(DEFAULT_KNOWLEDGE_CONFIG);
    }

    const faqSummary =
        typeof value.faqSummary === 'string' && value.faqSummary.trim()
            ? value.faqSummary.trim()
            : DEFAULT_KNOWLEDGE_CONFIG.faqSummary;
    const commonQuestions = normalizeStringList(value.commonQuestions).length
        ? normalizeStringList(value.commonQuestions)
        : [...DEFAULT_KNOWLEDGE_CONFIG.commonQuestions];

    return {
        faqSummary,
        commonQuestions,
        servicesSummary:
            typeof value.servicesSummary === 'string' && value.servicesSummary.trim()
                ? value.servicesSummary.trim()
                : faqSummary || DEFAULT_KNOWLEDGE_CONFIG.servicesSummary,
        appointmentSummary:
            typeof value.appointmentSummary === 'string' && value.appointmentSummary.trim()
                ? value.appointmentSummary.trim()
                : DEFAULT_KNOWLEDGE_CONFIG.appointmentSummary,
        refillSummary:
            typeof value.refillSummary === 'string' && value.refillSummary.trim()
                ? value.refillSummary.trim()
                : DEFAULT_KNOWLEDGE_CONFIG.refillSummary,
        insuranceSummary:
            typeof value.insuranceSummary === 'string' && value.insuranceSummary.trim()
                ? value.insuranceSummary.trim()
                : DEFAULT_KNOWLEDGE_CONFIG.insuranceSummary,
        billingSummary:
            typeof value.billingSummary === 'string' && value.billingSummary.trim()
                ? value.billingSummary.trim()
                : DEFAULT_KNOWLEDGE_CONFIG.billingSummary,
        customFaqs: normalizeKnowledgeFaqItems(value.customFaqs),
    };
}

export function normalizeEscalationConfig(value: unknown): EscalationConfig {
    if (!isObject(value)) {
        return { ...DEFAULT_ESCALATION_CONFIG };
    }

    return {
        urgentCallbackWindowMinutes:
            typeof value.urgentCallbackWindowMinutes === 'number' && value.urgentCallbackWindowMinutes > 0
                ? Math.round(value.urgentCallbackWindowMinutes)
                : DEFAULT_ESCALATION_CONFIG.urgentCallbackWindowMinutes,
        escalationMessage:
            typeof value.escalationMessage === 'string' && value.escalationMessage.trim()
                ? value.escalationMessage.trim()
                : DEFAULT_ESCALATION_CONFIG.escalationMessage,
        notifyStaffImmediately:
            typeof value.notifyStaffImmediately === 'boolean'
                ? value.notifyStaffImmediately
                : DEFAULT_ESCALATION_CONFIG.notifyStaffImmediately,
    };
}

export function normalizePracticeSetup(settings?: {
    enabledActions?: unknown;
    afterHoursPolicy?: unknown;
    refillPolicy?: unknown;
    billingPolicy?: unknown;
    insurancePolicy?: unknown;
    knowledgeConfig?: unknown;
    escalationConfig?: unknown;
}): NormalizedPracticeSetup {
    return {
        enabledActions: normalizeEnabledActions(settings?.enabledActions),
        afterHoursPolicy: normalizeAfterHoursPolicy(settings?.afterHoursPolicy),
        refillPolicy: normalizeServicePolicy(settings?.refillPolicy, DEFAULT_REFILL_POLICY),
        billingPolicy: normalizeServicePolicy(settings?.billingPolicy, DEFAULT_BILLING_POLICY),
        insurancePolicy: normalizeServicePolicy(settings?.insurancePolicy, DEFAULT_INSURANCE_POLICY),
        knowledgeConfig: normalizeKnowledgeConfig(settings?.knowledgeConfig),
        escalationConfig: normalizeEscalationConfig(settings?.escalationConfig),
    };
}
