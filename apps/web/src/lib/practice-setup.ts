import type {
    AfterHoursPolicy,
    BusinessIntegration,
    BusinessSettings,
    EscalationConfig,
    KnowledgeConfig,
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
    intakeNotes: 'Collect medication name, pharmacy, and caller date of birth before submitting refill requests.',
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

    const knowledgeConfig = isObject(settings?.knowledgeConfig)
        ? {
              faqSummary:
                  typeof settings.knowledgeConfig.faqSummary === 'string' &&
                  settings.knowledgeConfig.faqSummary.trim()
                      ? settings.knowledgeConfig.faqSummary.trim()
                      : DEFAULT_KNOWLEDGE_CONFIG.faqSummary,
              commonQuestions:
                  normalizeStringList(settings.knowledgeConfig.commonQuestions).length > 0
                      ? normalizeStringList(settings.knowledgeConfig.commonQuestions)
                      : [...DEFAULT_KNOWLEDGE_CONFIG.commonQuestions],
          }
        : { ...DEFAULT_KNOWLEDGE_CONFIG };

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
                normalized.escalationConfig.urgentCallbackWindowMinutes > 0,
        },
    ];
}
