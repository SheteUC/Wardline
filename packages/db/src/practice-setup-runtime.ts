export type PracticeSetupRuntimeAction =
    | 'appointment-request'
    | 'refill-request'
    | 'insurance-check'
    | 'billing-request';

export type AfterHoursMode = 'urgent_voicemail' | 'voicemail' | 'next_business_day_callback';

export interface PracticeSetupServicePolicy {
    liveEnabled: boolean;
    intakeNotes: string;
    fallbackSummary: string;
}

export interface PracticeSetupRuntimeConfig {
    businessId: string;
    businessName: string;
    timeZone: string;
    enabledActions: PracticeSetupRuntimeAction[];
    afterHoursPolicy: {
        mode: AfterHoursMode;
        greeting: string;
        sendUrgentToVoicemail: boolean;
    };
    refillPolicy: PracticeSetupServicePolicy;
    billingPolicy: PracticeSetupServicePolicy;
    insurancePolicy: PracticeSetupServicePolicy;
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
    escalationConfig: {
        urgentCallbackWindowMinutes: number;
        escalationMessage: string;
        notifyStaffImmediately: boolean;
    };
    emergencyKeywords?: string[];
    outOfScopeKeywords?: string[];
    connectedCategories?: string[];
}

export const GENERATED_PRACTICE_WORKFLOW_NAME = 'Practice Setup Runtime';
export const GENERATED_PRACTICE_WORKFLOW_DESCRIPTION =
    'Generated from practice setup for internal runtime use. Practices do not edit this artifact directly.';

function buildRuntimeActionNode(options: {
    id: string;
    label: string;
    runtimeAction: string;
    integrationCategory: string;
    enabled: boolean;
    policyPrompt: string;
    requiresConfirmation: boolean;
}) {
    return {
        id: options.id,
        type: 'integration',
        position: getPracticeActionNodePosition(options.id),
        config: {
            label: options.label,
            mode: 'runtime_action',
            runtimeAction: options.enabled ? options.runtimeAction : 'manual-follow-up',
            integrationCategory: options.enabled ? options.integrationCategory : 'MANUAL',
            requiresConfirmation: options.enabled ? options.requiresConfirmation : false,
            fallbackBehavior: 'create_follow_up',
            prompt: options.policyPrompt,
        },
    };
}

function getPracticeActionNodePosition(nodeId: string) {
    const positions: Record<string, { x: number; y: number }> = {
        'appointment-request': { x: 1100, y: -220 },
        'refill-request': { x: 1100, y: -70 },
        'insurance-check': { x: 1100, y: 120 },
        'billing-request': { x: 1100, y: 280 },
    };

    return positions[nodeId] ?? { x: 1100, y: 0 };
}

function buildPracticeSystemPrompt(options: PracticeSetupRuntimeConfig) {
    const connectedCategories = new Set(options.connectedCategories ?? []);
    const enabledServices = [
        options.enabledActions.includes('appointment-request') ? 'appointments' : null,
        options.enabledActions.includes('refill-request') ? 'prescription refills' : null,
        options.enabledActions.includes('insurance-check') ? 'insurance checks' : null,
        options.enabledActions.includes('billing-request') ? 'billing support' : null,
    ].filter(Boolean);

    return [
        `You are Wardline, the AI receptionist for ${options.businessName}.`,
        'Act like a calm family medicine front desk teammate.',
        `Business timezone: ${options.timeZone}.`,
        `Enabled services: ${enabledServices.join(', ') || 'general intake only'}.`,
        `After-hours policy: ${options.afterHoursPolicy.greeting}`,
        `FAQ summary: ${options.knowledgeConfig.faqSummary}`,
        `Common questions: ${options.knowledgeConfig.commonQuestions.join(', ')}.`,
        `Services summary: ${options.knowledgeConfig.servicesSummary}`,
        `Appointment help summary: ${options.knowledgeConfig.appointmentSummary}`,
        `Refill help summary: ${options.knowledgeConfig.refillSummary}`,
        `Insurance help summary: ${options.knowledgeConfig.insuranceSummary}`,
        `Billing help summary: ${options.knowledgeConfig.billingSummary}`,
        options.knowledgeConfig.customFaqs.length
            ? `Custom FAQs: ${options.knowledgeConfig.customFaqs
                  .map((item) =>
                      `Q: ${item.question} A: ${item.answer}${item.routeTo ? ` Route after answer: ${item.routeTo}.` : ''}`,
                  )
                  .join(' ')}`
            : '',
        `Escalation guidance: ${options.escalationConfig.escalationMessage}`,
        `Connected live integrations: ${Array.from(connectedCategories).join(', ') || 'none'}.`,
        'Never provide diagnosis or clinical advice.',
        'Always escalate emergencies immediately.',
        'Require confirmation before scheduling, refill, or billing write actions.',
        options.emergencyKeywords?.length
            ? `Additional emergency keywords: ${options.emergencyKeywords.join(', ')}.`
            : '',
        options.outOfScopeKeywords?.length
            ? `Out-of-scope topics to deflect safely: ${options.outOfScopeKeywords.join(', ')}.`
            : '',
    ]
        .filter(Boolean)
        .join('\n');
}

export function buildPracticeSetupRuntimeGraph(options: PracticeSetupRuntimeConfig) {
    const connectedCategories = new Set(options.connectedCategories ?? []);
    const actionNodes = {
        appointment: buildRuntimeActionNode({
            id: 'appointment-request',
            label: 'Appointment Request',
            runtimeAction: 'appointment-request',
            integrationCategory: 'SCHEDULING',
            enabled: options.enabledActions.includes('appointment-request'),
            policyPrompt:
                'Handle routine appointment requests and create a follow-up when live scheduling is unavailable.',
            requiresConfirmation: true,
        }),
        refill: buildRuntimeActionNode({
            id: 'refill-request',
            label: 'Prescription Refill',
            runtimeAction: 'refill-request',
            integrationCategory: 'EHR_REFILL',
            enabled: options.enabledActions.includes('refill-request') && options.refillPolicy.liveEnabled,
            policyPrompt: options.refillPolicy.intakeNotes,
            requiresConfirmation: true,
        }),
        insurance: buildRuntimeActionNode({
            id: 'insurance-check',
            label: 'Insurance Check',
            runtimeAction: 'insurance-check',
            integrationCategory: 'INSURANCE',
            enabled: options.enabledActions.includes('insurance-check') && options.insurancePolicy.liveEnabled,
            policyPrompt: options.insurancePolicy.intakeNotes,
            requiresConfirmation: false,
        }),
        billing: buildRuntimeActionNode({
            id: 'billing-request',
            label: 'Billing Support',
            runtimeAction: 'billing-request',
            integrationCategory: 'BILLING',
            enabled: options.enabledActions.includes('billing-request') && options.billingPolicy.liveEnabled,
            policyPrompt: options.billingPolicy.intakeNotes,
            requiresConfirmation: true,
        }),
    };

    const afterHoursEndType =
        options.afterHoursPolicy.mode === 'next_business_day_callback' ? 'callback_request' : 'voicemail';
    const enabledTools = ['knowledge'];

    if (options.enabledActions.includes('appointment-request')) enabledTools.push('scheduling');
    if (options.enabledActions.includes('refill-request')) enabledTools.push('refills');
    if (options.enabledActions.includes('insurance-check')) enabledTools.push('insurance');
    if (options.enabledActions.includes('billing-request')) enabledTools.push('billing');

    return {
        nodes: [
            {
                id: 'start',
                type: 'start',
                position: { x: 0, y: 0 },
                config: {
                    greetingMessage: `Thank you for calling ${options.businessName}. How can I help you today?`,
                },
            },
            {
                id: 'safety-check',
                type: 'safety-check',
                position: { x: 220, y: 0 },
                config: {
                    keywordCategories: ['emergency', 'clinical_urgent'],
                    autoEscalate: true,
                    alertSeverity: 'critical',
                },
            },
            {
                id: 'after-hours-guard',
                type: 'conditional',
                position: { x: 440, y: 0 },
                config: {
                    conditionType: 'custom_expression',
                    conditions: [
                        {
                            expression: 'is_after_hours',
                            targetNode: 'after-hours-resolution',
                        },
                    ],
                    defaultTarget: 'practice-ai',
                },
            },
            {
                id: 'after-hours-resolution',
                type: 'end',
                position: { x: 660, y: -120 },
                config: {
                    endType: afterHoursEndType,
                    closingMessage: options.afterHoursPolicy.greeting,
                },
            },
            {
                id: 'practice-ai',
                type: 'ai-agent',
                position: { x: 660, y: 0 },
                config: {
                    systemPrompt: buildPracticeSystemPrompt(options),
                    enabledTools,
                    maxTurns: 10,
                    contextStrategy: 'append',
                    temperature: 0.3,
                },
            },
            {
                id: 'intent-router',
                type: 'conditional',
                position: { x: 880, y: 0 },
                config: {
                    conditionType: 'intent',
                    conditions: [
                        {
                            expression: 'intent == "appointment" or intent == "scheduling"',
                            targetNode: actionNodes.appointment.id,
                        },
                        {
                            expression: 'intent == "prescription_refill"',
                            targetNode: actionNodes.refill.id,
                        },
                        {
                            expression: 'intent == "insurance"',
                            targetNode: actionNodes.insurance.id,
                        },
                        {
                            expression: 'intent == "billing"',
                            targetNode: actionNodes.billing.id,
                        },
                        {
                            expression: 'intent == "human_transfer"',
                            targetNode: 'manual-follow-up',
                        },
                    ],
                    defaultTarget: 'complete-call',
                },
            },
            actionNodes.appointment,
            actionNodes.refill,
            actionNodes.insurance,
            actionNodes.billing,
            {
                id: 'manual-follow-up',
                type: 'integration',
                position: { x: 1100, y: 440 },
                config: {
                    label: 'Manual Follow-up',
                    mode: 'runtime_action',
                    runtimeAction: 'manual-follow-up',
                    integrationCategory: 'MANUAL',
                    requiresConfirmation: false,
                    fallbackBehavior: 'create_follow_up',
                    prompt: 'Capture the request and create a staff follow-up with the caller context.',
                },
            },
            {
                id: 'complete-call',
                type: 'end',
                position: { x: 1320, y: 0 },
                config: {
                    endType: 'hangup',
                    closingMessage:
                        'Thanks for calling. We have your request and our team will follow up if anything else is needed.',
                },
            },
        ],
        edges: [
            { id: 'edge-start-safety', fromNodeId: 'start', toNodeId: 'safety-check' },
            { id: 'edge-safety-hours', fromNodeId: 'safety-check', toNodeId: 'after-hours-guard' },
            {
                id: 'edge-hours-after',
                fromNodeId: 'after-hours-guard',
                toNodeId: 'after-hours-resolution',
                condition: 'is_after_hours',
            },
            { id: 'edge-hours-open', fromNodeId: 'after-hours-guard', toNodeId: 'practice-ai' },
            { id: 'edge-ai-intent', fromNodeId: 'practice-ai', toNodeId: 'intent-router' },
            {
                id: 'edge-intent-appointment',
                fromNodeId: 'intent-router',
                toNodeId: actionNodes.appointment.id,
                condition: 'intent == "appointment" or intent == "scheduling"',
            },
            {
                id: 'edge-intent-refill',
                fromNodeId: 'intent-router',
                toNodeId: actionNodes.refill.id,
                condition: 'intent == "prescription_refill"',
            },
            {
                id: 'edge-intent-insurance',
                fromNodeId: 'intent-router',
                toNodeId: actionNodes.insurance.id,
                condition: 'intent == "insurance"',
            },
            {
                id: 'edge-intent-billing',
                fromNodeId: 'intent-router',
                toNodeId: actionNodes.billing.id,
                condition: 'intent == "billing"',
            },
            {
                id: 'edge-intent-manual',
                fromNodeId: 'intent-router',
                toNodeId: 'manual-follow-up',
                condition: 'intent == "human_transfer"',
            },
            { id: 'edge-intent-default', fromNodeId: 'intent-router', toNodeId: 'complete-call' },
            { id: 'edge-appointment-end', fromNodeId: actionNodes.appointment.id, toNodeId: 'complete-call' },
            { id: 'edge-refill-end', fromNodeId: actionNodes.refill.id, toNodeId: 'complete-call' },
            { id: 'edge-insurance-end', fromNodeId: actionNodes.insurance.id, toNodeId: 'complete-call' },
            { id: 'edge-billing-end', fromNodeId: actionNodes.billing.id, toNodeId: 'complete-call' },
            { id: 'edge-manual-end', fromNodeId: 'manual-follow-up', toNodeId: 'complete-call' },
        ],
        __practiceSetup: {
            source: 'practice_setup',
            businessId: options.businessId,
            generatedAt: new Date().toISOString(),
            connectedCategories: Array.from(connectedCategories),
            enabledActions: options.enabledActions,
        },
    };
}
