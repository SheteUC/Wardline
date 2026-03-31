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
    daytimeHandoffPolicy: {
        mode: 'hybrid_transfer' | 'callback_only' | 'transfer_first';
        transferTargetLabel: string;
        transferPhone: string;
        ringTimeoutSeconds: number;
        collectReasonFirst: boolean;
        fallbackSummary: string;
    };
    knowledgeConfig: {
        faqSummary: string;
        commonQuestions: string[];
        servicesSummary: string;
        appointmentSummary: string;
        refillSummary: string;
        insuranceSummary: string;
        billingSummary: string;
        customFaqs: Array<{
            question: string;
            answer: string;
            routeTo?: 'knowledge' | 'scheduling' | 'refill' | 'insurance' | 'billing' | 'handoff';
        }>;
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
    dialoguePolicies: Record<
        SpecialistDomain,
        {
            callerIntro: string;
            clarificationStyle: string;
            slotPrompts: Record<string, string>;
            confirmationTemplate: string;
            successTemplate: string;
            fallbackTemplate: string;
            closeTemplate: string;
        }
    >;
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
    const connectedCategorySet = new Set(connectedCategories);

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
        daytimeHandoffPolicy: practiceSetup.daytimeHandoffPolicy,
        knowledgeConfig: practiceSetup.knowledgeConfig,
        servicePolicies: {
            scheduling: {
                enabled: practiceSetup.enabledActions.includes('appointment-request'),
                runtimeAction: 'appointment-request',
                integrationCategory: 'SCHEDULING',
                liveEnabled:
                    practiceSetup.enabledActions.includes('appointment-request') &&
                    connectedCategorySet.has('SCHEDULING'),
                intakeNotes:
                    'Collect the visit type, desired timing, and callback number before requesting an appointment.',
                fallbackSummary:
                    'If live scheduling is unavailable, create an appointment follow-up task for staff.',
            },
            refill: {
                enabled: practiceSetup.enabledActions.includes('refill-request'),
                runtimeAction: 'refill-request',
                integrationCategory: 'EHR_REFILL',
                liveEnabled:
                    practiceSetup.refillPolicy.liveEnabled &&
                    connectedCategorySet.has('EHR_REFILL'),
                intakeNotes: practiceSetup.refillPolicy.intakeNotes,
                fallbackSummary: practiceSetup.refillPolicy.fallbackSummary,
            },
            insurance: {
                enabled: practiceSetup.enabledActions.includes('insurance-check'),
                runtimeAction: 'insurance-check',
                integrationCategory: 'INSURANCE',
                liveEnabled:
                    practiceSetup.insurancePolicy.liveEnabled &&
                    connectedCategorySet.has('INSURANCE'),
                intakeNotes: practiceSetup.insurancePolicy.intakeNotes,
                fallbackSummary: practiceSetup.insurancePolicy.fallbackSummary,
            },
            billing: {
                enabled: practiceSetup.enabledActions.includes('billing-request'),
                runtimeAction: 'billing-request',
                integrationCategory: 'BILLING',
                liveEnabled:
                    practiceSetup.billingPolicy.liveEnabled &&
                    connectedCategorySet.has('BILLING'),
                intakeNotes: practiceSetup.billingPolicy.intakeNotes,
                fallbackSummary: practiceSetup.billingPolicy.fallbackSummary,
            },
        },
        escalationConfig: practiceSetup.escalationConfig,
        dialoguePolicies: {
            safety: {
                callerIntro: 'I can help make sure urgent medical concerns get to the right place quickly.',
                clarificationStyle: 'direct',
                slotPrompts: {},
                confirmationTemplate: '',
                successTemplate: '',
                fallbackTemplate: '',
                closeTemplate: 'Thanks for calling the practice. Take care.',
            },
            knowledge: {
                callerIntro: 'I can answer common practice questions and help route requests.',
                clarificationStyle: 'friendly',
                slotPrompts: {},
                confirmationTemplate: '',
                successTemplate: '',
                fallbackTemplate: '',
                closeTemplate: 'Thanks for calling. Have a good day.',
            },
            scheduling: {
                callerIntro: 'I can help with scheduling requests.',
                clarificationStyle: 'friendly',
                slotPrompts: {
                    visitType: 'What kind of appointment do you need, like a physical, follow-up, or consultation?',
                    preferredDate: 'What day would you like that?',
                    preferredTime: 'What time works best for you?',
                },
                confirmationTemplate:
                    'I have a request for {visitPhrase}{datePhrase}{timePhrase}. Should I send that to the practice?',
                successTemplate: 'Okay, I sent that appointment request to the practice.',
                fallbackTemplate:
                    'Okay, I could not send that live, but I passed the appointment request to the practice.',
                closeTemplate: 'Thanks for calling the practice. Take care.',
            },
            refill: {
                callerIntro: 'I can help with prescription refill requests.',
                clarificationStyle: 'friendly',
                slotPrompts: {
                    medicationName: 'Which medication would you like refilled?',
                    callerDob: 'What is the caller\'s date of birth?',
                    pharmacyName: 'Which pharmacy should I include?',
                    pharmacyPhone: 'What is the pharmacy phone number?',
                },
                confirmationTemplate:
                    'I have a refill request for {medicationName}, date of birth {callerDob}, pharmacy {pharmacyName}, phone {pharmacyPhone}. Should I send that to the practice?',
                successTemplate: 'Okay, I sent that refill request to the practice.',
                fallbackTemplate:
                    'Okay, I could not send that live, but I passed the refill request to the staff.',
                closeTemplate: 'Thanks for calling the practice. Take care.',
            },
            insurance: {
                callerIntro: 'I can help with basic insurance questions.',
                clarificationStyle: 'friendly',
                slotPrompts: {
                    inquiryType: 'Are you asking whether the practice accepts the plan, or whether coverage looks active for a patient?',
                    carrierName: 'Which insurance carrier would you like me to check?',
                    planName: 'Do you know the plan name, like PPO or HMO?',
                    memberId: 'What is the member ID on the insurance card?',
                    groupNumber: 'Do you know the group number?',
                    patientName: "What is the patient's full name?",
                    patientDob: "What is the patient's date of birth?",
                    subscriberRelation: 'Is the patient the subscriber, or are they covered through someone else?',
                    serviceType: 'What type of visit or service is this for?',
                    callbackPhone: 'What callback number should the staff use if they need to follow up?',
                },
                confirmationTemplate: '',
                successTemplate: 'Okay, I checked that for you.',
                fallbackTemplate:
                    'Okay, I could not check that live, but I passed the insurance question to the staff.',
                closeTemplate: 'Thanks for calling the practice. Take care.',
            },
            billing: {
                callerIntro: 'I can help with billing questions.',
                clarificationStyle: 'friendly',
                slotPrompts: {
                    billingTopic: 'What billing issue are you calling about?',
                    accountReference: 'What account or statement reference should I include?',
                },
                confirmationTemplate:
                    'I have a billing request about {billingTopic} for account {accountReference}. Should I send that to the practice?',
                successTemplate: 'Okay, I sent that billing request to the practice.',
                fallbackTemplate:
                    'Okay, I could not send that live, but I passed the billing request to the staff.',
                closeTemplate: 'Thanks for calling the practice. Take care.',
            },
            handoff: {
                callerIntro: 'I can take a message for the staff when needed.',
                clarificationStyle: 'friendly',
                slotPrompts: {
                    voicemail: 'Please say the message you would like me to pass along.',
                    reasonSummary: 'What should I tell the staff this is about?',
                    callbackPhone: 'What callback number should the staff use?',
                    preferredCallbackWindow: 'Is there a preferred time for the staff to call you back?',
                    transferConsent:
                        'I can try to connect you to the practice now. If no one answers, I can create a callback request. Would you like me to try the live transfer?',
                },
                confirmationTemplate: '',
                successTemplate: 'Okay, I passed that request to the staff.',
                fallbackTemplate: 'Okay, I can take a message for the staff to review.',
                closeTemplate: 'Thanks for calling the practice. Take care.',
            },
        },
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
