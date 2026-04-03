import type {
    AfterHoursPolicy,
    BusinessIntegration,
    BusinessSettings,
    DaytimeHandoffPolicy,
    EscalationConfig,
    KnowledgeFaqItem,
    KnowledgeConfig,
    KnowledgeRouteTarget,
    PracticeAction,
    ServicePolicy,
} from './api-types';
import { IntegrationCategory, IntegrationStatus } from '@wardline/types';

export const DEFAULT_ENABLED_ACTIONS: PracticeAction[] = [
    'appointment-request',
    'refill-request',
    'insurance-check',
    'billing-request',
];

export const DEFAULT_AFTER_HOURS_POLICY: AfterHoursPolicy = {
    mode: 'urgent_voicemail',
    greeting:
        'After hours, capture the request, acknowledge urgent needs, and promise staff follow-up on the next business day.',
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
    intakeNotes:
        'Answer acceptance and basic eligibility questions when supported by the connected payer workflow. Member ID and patient date of birth are required for eligibility checks, while benefits, claim status, and prior authorization requests may need staff follow-up.',
    fallbackSummary: 'If insurance automation is unavailable, create an insurance follow-up task for staff.',
};

export const DEFAULT_DAYTIME_HANDOFF_POLICY: DaytimeHandoffPolicy = {
    mode: 'hybrid_transfer',
    transferTargetLabel: 'front desk',
    transferPhone: '',
    ringTimeoutSeconds: 20,
    collectReasonFirst: true,
    fallbackSummary: 'If nobody is available to take the call live, create a same-day callback task for staff.',
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
        'We can capture refill requests for the practice. Please have the medication name, date of birth, pharmacy name, and pharmacy phone number ready.',
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

function normalizeCustomFaqs(value: unknown): KnowledgeFaqItem[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const allowedRoutes = new Set<KnowledgeRouteTarget>([
        'knowledge',
        'scheduling',
        'refill',
        'insurance',
        'billing',
        'handoff',
    ]);

    return value
        .filter((entry): entry is Record<string, unknown> => isObject(entry))
        .map((entry) => {
            const question = typeof entry.question === 'string' ? entry.question.trim() : '';
            const answer = typeof entry.answer === 'string' ? entry.answer.trim() : '';
            const routeTo =
                typeof entry.routeTo === 'string' && allowedRoutes.has(entry.routeTo as KnowledgeRouteTarget)
                    ? (entry.routeTo as KnowledgeRouteTarget)
                    : undefined;
            return question && answer ? { question, answer, ...(routeTo ? { routeTo } : {}) } : null;
        })
        .filter((entry): entry is KnowledgeFaqItem => entry !== null);
}

export function normalizeKnowledgeConfig(value: unknown): KnowledgeConfig {
    if (!isObject(value)) {
        return cloneKnowledgeConfig(DEFAULT_KNOWLEDGE_CONFIG);
    }

    const faqSummary =
        typeof value.faqSummary === 'string' && value.faqSummary.trim()
            ? value.faqSummary.trim()
            : DEFAULT_KNOWLEDGE_CONFIG.faqSummary;

    return {
        faqSummary,
        commonQuestions:
            normalizeStringList(value.commonQuestions).length > 0
                ? normalizeStringList(value.commonQuestions)
                : [...DEFAULT_KNOWLEDGE_CONFIG.commonQuestions],
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
        customFaqs: normalizeCustomFaqs(value.customFaqs),
    };
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

function normalizeDaytimeHandoffPolicy(value: unknown): DaytimeHandoffPolicy {
    if (!isObject(value)) {
        return { ...DEFAULT_DAYTIME_HANDOFF_POLICY };
    }

    const mode =
        value.mode === 'callback_only' ||
        value.mode === 'transfer_first' ||
        value.mode === 'hybrid_transfer'
            ? value.mode
            : DEFAULT_DAYTIME_HANDOFF_POLICY.mode;

    return {
        mode,
        transferTargetLabel:
            typeof value.transferTargetLabel === 'string' && value.transferTargetLabel.trim()
                ? value.transferTargetLabel.trim()
                : DEFAULT_DAYTIME_HANDOFF_POLICY.transferTargetLabel,
        transferPhone:
            typeof value.transferPhone === 'string' ? value.transferPhone.trim() : DEFAULT_DAYTIME_HANDOFF_POLICY.transferPhone,
        ringTimeoutSeconds:
            typeof value.ringTimeoutSeconds === 'number' && Number.isFinite(value.ringTimeoutSeconds)
                ? Math.max(10, Math.min(45, Math.round(value.ringTimeoutSeconds)))
                : DEFAULT_DAYTIME_HANDOFF_POLICY.ringTimeoutSeconds,
        collectReasonFirst:
            typeof value.collectReasonFirst === 'boolean'
                ? value.collectReasonFirst
                : DEFAULT_DAYTIME_HANDOFF_POLICY.collectReasonFirst,
        fallbackSummary:
            typeof value.fallbackSummary === 'string' && value.fallbackSummary.trim()
                ? value.fallbackSummary.trim()
                : DEFAULT_DAYTIME_HANDOFF_POLICY.fallbackSummary,
    };
}

export function normalizePracticeSetup(settings?: BusinessSettings['settings']) {
    const enabledActions = Array.isArray(settings?.enabledActions)
        ? Array.from(
              new Set(
                  settings.enabledActions.filter((entry): entry is PracticeAction =>
                      DEFAULT_ENABLED_ACTIONS.includes(entry),
                  ),
              ),
          )
        : DEFAULT_ENABLED_ACTIONS;

    const afterHoursPolicy = isObject(settings?.afterHoursPolicy)
        ? {
              mode:
                  settings.afterHoursPolicy.mode === 'voicemail' ||
                  settings.afterHoursPolicy.mode === 'next_business_day_callback' ||
                  settings.afterHoursPolicy.mode === 'urgent_voicemail'
                      ? settings.afterHoursPolicy.mode
                      : DEFAULT_AFTER_HOURS_POLICY.mode,
              greeting:
                  typeof settings.afterHoursPolicy.greeting === 'string' &&
                  settings.afterHoursPolicy.greeting.trim()
                      ? settings.afterHoursPolicy.greeting.trim()
                      : DEFAULT_AFTER_HOURS_POLICY.greeting,
              sendUrgentToVoicemail:
                  typeof settings.afterHoursPolicy.sendUrgentToVoicemail === 'boolean'
                      ? settings.afterHoursPolicy.sendUrgentToVoicemail
                      : DEFAULT_AFTER_HOURS_POLICY.sendUrgentToVoicemail,
          }
        : { ...DEFAULT_AFTER_HOURS_POLICY };

    const knowledgeConfig = normalizeKnowledgeConfig(settings?.knowledgeConfig);

    const escalationConfig = isObject(settings?.escalationConfig)
        ? {
              urgentCallbackWindowMinutes:
                  typeof settings.escalationConfig.urgentCallbackWindowMinutes === 'number' &&
                  settings.escalationConfig.urgentCallbackWindowMinutes > 0
                      ? Math.round(settings.escalationConfig.urgentCallbackWindowMinutes)
                      : DEFAULT_ESCALATION_CONFIG.urgentCallbackWindowMinutes,
              escalationMessage:
                  typeof settings.escalationConfig.escalationMessage === 'string' &&
                  settings.escalationConfig.escalationMessage.trim()
                      ? settings.escalationConfig.escalationMessage.trim()
                      : DEFAULT_ESCALATION_CONFIG.escalationMessage,
              notifyStaffImmediately:
                  typeof settings.escalationConfig.notifyStaffImmediately === 'boolean'
                      ? settings.escalationConfig.notifyStaffImmediately
                      : DEFAULT_ESCALATION_CONFIG.notifyStaffImmediately,
          }
        : { ...DEFAULT_ESCALATION_CONFIG };

    return {
        enabledActions,
        afterHoursPolicy,
        refillPolicy: normalizeServicePolicy(settings?.refillPolicy, DEFAULT_REFILL_POLICY),
        billingPolicy: normalizeServicePolicy(settings?.billingPolicy, DEFAULT_BILLING_POLICY),
        insurancePolicy: normalizeServicePolicy(settings?.insurancePolicy, DEFAULT_INSURANCE_POLICY),
        daytimeHandoffPolicy: normalizeDaytimeHandoffPolicy(settings?.daytimeHandoffPolicy),
        knowledgeConfig,
        escalationConfig,
    };
}

export function buildPracticeReadiness(options: {
    businessId: string | null;
    settings?: BusinessSettings['settings'];
    integrations: BusinessIntegration[];
}) {
    const { businessId, settings, integrations } = options;
    const normalized = normalizePracticeSetup(settings);
    const integrationStatus = new Map(integrations.map((integration) => [integration.category, integration.status]));
    const requiredIntegrationCategories = normalized.enabledActions
        .map((action): IntegrationCategory | null => {
            switch (action) {
                case 'appointment-request':
                    return IntegrationCategory.SCHEDULING;
                case 'refill-request':
                    return IntegrationCategory.EHR_REFILL;
                case 'insurance-check':
                    return IntegrationCategory.INSURANCE;
                case 'billing-request':
                    return IntegrationCategory.BILLING;
                default:
                    return null;
            }
        })
        .filter((category): category is IntegrationCategory => category !== null);

    return [
        {
            key: 'practice',
            label: 'Practice selected',
            complete: Boolean(businessId),
        },
        {
            key: 'hours',
            label: 'Hours configured',
            complete: Array.isArray(settings?.operatingHours) && settings.operatingHours.length === 7,
        },
        {
            key: 'integrations',
            label: 'Required integrations connected',
            complete:
                requiredIntegrationCategories.length === 0 ||
                requiredIntegrationCategories.every(
                    (category) => integrationStatus.get(category) === IntegrationStatus.CONNECTED,
                ),
        },
        {
            key: 'knowledge',
            label: 'FAQ and knowledge configured',
            complete:
                normalized.knowledgeConfig.faqSummary.trim().length > 0 &&
                normalized.knowledgeConfig.commonQuestions.length > 0,
        },
        {
            key: 'services',
            label: 'Live services enabled',
            complete: normalized.enabledActions.length > 0,
        },
        {
            key: 'policy',
            label: 'Call policy saved',
            complete:
                normalized.afterHoursPolicy.greeting.trim().length > 0 &&
                normalized.escalationConfig.escalationMessage.trim().length > 0 &&
                normalized.escalationConfig.urgentCallbackWindowMinutes > 0 &&
                (normalized.daytimeHandoffPolicy.mode === 'callback_only' ||
                    normalized.daytimeHandoffPolicy.transferPhone.trim().length > 0),
        },
    ];
}
