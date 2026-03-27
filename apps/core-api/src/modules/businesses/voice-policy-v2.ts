import { normalizePracticeSetup } from './practice-config';

type RuntimeActionName =
    | 'appointment-request'
    | 'refill-request'
    | 'insurance-check'
    | 'billing-request';

type SpecialistDomain =
    | 'safety'
    | 'knowledge'
    | 'scheduling'
    | 'refill'
    | 'insurance'
    | 'billing'
    | 'handoff';

export interface VoicePolicyV2 {
    version: 'v2';
    runtime: 'internal-multi-agent';
    speaker: 'supervisor';
    enabledDomains: SpecialistDomain[];
    connectedCategories: string[];
    writeActionsRequiringConfirmation: Array<
        Extract<RuntimeActionName, 'appointment-request' | 'refill-request' | 'billing-request'>
    >;
    afterHoursPolicy: {
        mode: 'urgent_voicemail' | 'voicemail' | 'next_business_day_callback';
        greeting: string;
        sendUrgentToVoicemail: boolean;
    };
    knowledgeConfig: {
        faqSummary: string;
        commonQuestions: string[];
    };
    servicePolicies: {
        scheduling: {
            enabled: boolean;
            runtimeAction: 'appointment-request';
            integrationCategory: 'SCHEDULING';
            liveEnabled: boolean;
            intakeNotes: string;
            fallbackSummary: string;
        };
        refill: {
            enabled: boolean;
            runtimeAction: 'refill-request';
            integrationCategory: 'EHR_REFILL';
            liveEnabled: boolean;
            intakeNotes: string;
            fallbackSummary: string;
        };
        insurance: {
            enabled: boolean;
            runtimeAction: 'insurance-check';
            integrationCategory: 'INSURANCE';
            liveEnabled: boolean;
            intakeNotes: string;
            fallbackSummary: string;
        };
        billing: {
            enabled: boolean;
            runtimeAction: 'billing-request';
            integrationCategory: 'BILLING';
            liveEnabled: boolean;
            intakeNotes: string;
            fallbackSummary: string;
        };
    };
    escalationConfig: {
        urgentCallbackWindowMinutes: number;
        escalationMessage: string;
        notifyStaffImmediately: boolean;
    };
    emergencyKeywords: string[];
    outOfScopeKeywords: string[];
    fallbackRuntimeAction: 'manual-follow-up';
    operatorSummaryEnabled: true;
}

export function buildVoicePolicyV2(input: {
    settings?: Record<string, unknown> | null;
    integrations?: Array<{ category: string; status: string }> | null;
}): VoicePolicyV2 {
    const practiceSetup = normalizePracticeSetup(input.settings ?? undefined);
    const connectedCategories = (input.integrations ?? [])
        .filter((integration) => integration.status === 'CONNECTED')
        .map((integration) => String(integration.category));

    const enabledDomains = new Set<SpecialistDomain>(['safety', 'knowledge', 'handoff']);
    if (practiceSetup.enabledActions.includes('appointment-request')) enabledDomains.add('scheduling');
    if (practiceSetup.enabledActions.includes('refill-request')) enabledDomains.add('refill');
    if (practiceSetup.enabledActions.includes('insurance-check')) enabledDomains.add('insurance');
    if (practiceSetup.enabledActions.includes('billing-request')) enabledDomains.add('billing');

    return {
        version: 'v2',
        runtime: 'internal-multi-agent',
        speaker: 'supervisor',
        enabledDomains: Array.from(enabledDomains),
        connectedCategories,
        writeActionsRequiringConfirmation: [
            'appointment-request',
            'refill-request',
            'billing-request',
        ],
        afterHoursPolicy: practiceSetup.afterHoursPolicy,
        knowledgeConfig: practiceSetup.knowledgeConfig,
        servicePolicies: {
            scheduling: {
                enabled: practiceSetup.enabledActions.includes('appointment-request'),
                runtimeAction: 'appointment-request',
                integrationCategory: 'SCHEDULING',
                liveEnabled: practiceSetup.enabledActions.includes('appointment-request'),
                intakeNotes:
                    'Collect the visit type, desired timing, and callback number before requesting an appointment.',
                fallbackSummary:
                    'If live scheduling is unavailable, create an appointment follow-up task for staff.',
            },
            refill: {
                enabled: practiceSetup.enabledActions.includes('refill-request'),
                runtimeAction: 'refill-request',
                integrationCategory: 'EHR_REFILL',
                liveEnabled: practiceSetup.refillPolicy.liveEnabled,
                intakeNotes: practiceSetup.refillPolicy.intakeNotes,
                fallbackSummary: practiceSetup.refillPolicy.fallbackSummary,
            },
            insurance: {
                enabled: practiceSetup.enabledActions.includes('insurance-check'),
                runtimeAction: 'insurance-check',
                integrationCategory: 'INSURANCE',
                liveEnabled: practiceSetup.insurancePolicy.liveEnabled,
                intakeNotes: practiceSetup.insurancePolicy.intakeNotes,
                fallbackSummary: practiceSetup.insurancePolicy.fallbackSummary,
            },
            billing: {
                enabled: practiceSetup.enabledActions.includes('billing-request'),
                runtimeAction: 'billing-request',
                integrationCategory: 'BILLING',
                liveEnabled: practiceSetup.billingPolicy.liveEnabled,
                intakeNotes: practiceSetup.billingPolicy.intakeNotes,
                fallbackSummary: practiceSetup.billingPolicy.fallbackSummary,
            },
        },
        escalationConfig: practiceSetup.escalationConfig,
        emergencyKeywords: Array.isArray(input.settings?.emergencyKeywords)
            ? input.settings?.emergencyKeywords.filter((entry): entry is string => typeof entry === 'string')
            : [],
        outOfScopeKeywords: Array.isArray(input.settings?.outOfScopeKeywords)
            ? input.settings?.outOfScopeKeywords.filter((entry): entry is string => typeof entry === 'string')
            : [],
        fallbackRuntimeAction: 'manual-follow-up',
        operatorSummaryEnabled: true,
    };
}
