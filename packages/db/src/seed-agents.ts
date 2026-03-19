import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

/**
 * Catalog definitions for the 5 starter agents.
 * These are seeded as active agents for any business that onboards.
 * Each entry maps to an AgentCatalogId and carries default node graphs
 * and tool config schemas.
 */
export const AGENT_CATALOG = [
    {
        catalogId: 'scheduling',
        name: 'Appointment Scheduling',
        description:
            'Books, reschedules, and cancels appointments. Checks provider availability and confirms bookings with a reference number.',
        scopeBoundary:
            'Does not ask about or respond to symptoms, reasons for visit beyond service type, or clinical questions.',
        icon: 'Calendar',
        color: 'green',
        tags: ['Appointments', 'Calendar', 'Scheduling'],
        defaultNodeGraph: {
            nodes: [
                { id: 'greeting', type: 'greeting', config: { script: "Thank you for calling. I can help you schedule, reschedule, or cancel an appointment. What would you like to do?" }, position: { x: 100, y: 100 } },
                { id: 'intent', type: 'intent-detect', config: { intents: ['new_appointment', 'reschedule', 'cancel_appointment'] }, position: { x: 100, y: 220 } },
                { id: 'collect', type: 'collect-info', config: { fields: [{ key: 'callerName', label: 'Full Name', type: 'text', required: true }, { key: 'dob', label: 'Date of Birth', type: 'date', required: true }, { key: 'phone', label: 'Callback Number', type: 'phone', required: true }, { key: 'serviceType', label: 'Type of Visit', type: 'select', required: true, options: ['New Patient', 'Follow-up', 'Cleaning', 'Consultation', 'Other'] }, { key: 'providerPreference', label: 'Preferred Provider', type: 'text', required: false }], retryAttempts: 2 }, position: { x: 100, y: 340 } },
                { id: 'availability', type: 'availability-check', config: { offerSlots: 3 }, position: { x: 100, y: 460 } },
                { id: 'confirm', type: 'confirmation', config: { script: "I'll confirm your appointment for {scheduledAt} with {providerName}. Your confirmation number is {confirmationId}." }, position: { x: 100, y: 580 } },
                { id: 'continuation', type: 'continuation-check', config: { promptScript: "Is there anything else I can help you with today?", maxTurns: 5 }, position: { x: 100, y: 700 } },
                { id: 'transfer', type: 'human-transfer', config: { transferPhone: '', contextSummary: true, noAnswerBehavior: 'voicemail' }, position: { x: 300, y: 580 } },
                { id: 'voicemail', type: 'voicemail', config: { promptScript: "We're sorry no one is available right now. Please leave your name, number, and a brief message and we'll call you back." }, position: { x: 300, y: 700 } },
                { id: 'end', type: 'end-call', config: { script: "Thank you for calling. Have a great day!" }, position: { x: 100, y: 820 } },
            ],
            edges: [
                { id: 'e1', fromNodeId: 'greeting', toNodeId: 'intent' },
                { id: 'e2', fromNodeId: 'intent', toNodeId: 'collect' },
                { id: 'e3', fromNodeId: 'collect', toNodeId: 'availability' },
                { id: 'e4', fromNodeId: 'availability', toNodeId: 'confirm' },
                { id: 'e5', fromNodeId: 'confirm', toNodeId: 'continuation' },
                { id: 'e6', fromNodeId: 'continuation', toNodeId: 'end', condition: 'done' },
                { id: 'e7', fromNodeId: 'continuation', toNodeId: 'intent', condition: 'more' },
                { id: 'e8', fromNodeId: 'intent', toNodeId: 'transfer', condition: 'out_of_scope' },
                { id: 'e9', fromNodeId: 'transfer', toNodeId: 'voicemail', condition: 'no_answer' },
                { id: 'e10', fromNodeId: 'voicemail', toNodeId: 'end' },
            ],
        },
        toolConfigSchema: [
            { key: 'provider', label: 'Scheduling Provider', type: 'select', required: true, options: ['TimeTap', 'NexHealth', 'Google Calendar', 'Manual'], helpText: 'Which scheduling system do you use?' },
            { key: 'apiKey', label: 'API Key', type: 'password', required: true, helpText: 'Your scheduling provider API key' },
            { key: 'locationId', label: 'Location ID', type: 'text', required: false, helpText: 'If your provider uses location-based scheduling' },
            { key: 'reminderEnabled', label: 'Send Reminders', type: 'boolean', required: false, helpText: 'Offer SMS reminders after booking' },
        ],
    },
    {
        catalogId: 'billing',
        name: 'Billing & Payments',
        description:
            'Answers balance questions and takes payments. Can look up account balances and process card payments via secure IVR.',
        scopeBoundary:
            'Does not negotiate payment plans, handle disputes, or process refunds. Those calls go to a human staff member.',
        icon: 'CreditCard',
        color: 'blue',
        tags: ['Billing', 'Payments', 'Balance'],
        defaultNodeGraph: {
            nodes: [
                { id: 'greeting', type: 'greeting', config: { script: "Thank you for calling. I can help with your billing or payment questions." }, position: { x: 100, y: 100 } },
                { id: 'intent', type: 'intent-detect', config: { intents: ['balance_inquiry', 'make_payment', 'statement_request'] }, position: { x: 100, y: 220 } },
                { id: 'verify', type: 'collect-info', config: { fields: [{ key: 'callerName', label: 'Full Name', type: 'text', required: true }, { key: 'dob', label: 'Date of Birth', type: 'date', required: true }, { key: 'accountLastFour', label: 'Last 4 of Account / SSN', type: 'text', required: true }], retryAttempts: 2 }, position: { x: 100, y: 340 } },
                { id: 'action', type: 'action', config: { tool: 'billing_lookup', outputKey: 'balance' }, position: { x: 100, y: 460 } },
                { id: 'confirm', type: 'confirmation', config: { script: "Your current balance is ${balance}. Would you like to make a payment?" }, position: { x: 100, y: 580 } },
                { id: 'continuation', type: 'continuation-check', config: { promptScript: "Is there anything else I can help you with today?", maxTurns: 5 }, position: { x: 100, y: 700 } },
                { id: 'transfer', type: 'human-transfer', config: { transferPhone: '', contextSummary: true, noAnswerBehavior: 'voicemail' }, position: { x: 300, y: 460 } },
                { id: 'voicemail', type: 'voicemail', config: { promptScript: "No one is available right now. Please leave your name and number and we'll return your call." }, position: { x: 300, y: 580 } },
                { id: 'end', type: 'end-call', config: { script: "Thank you for calling. Have a great day!" }, position: { x: 100, y: 820 } },
            ],
            edges: [
                { id: 'e1', fromNodeId: 'greeting', toNodeId: 'intent' },
                { id: 'e2', fromNodeId: 'intent', toNodeId: 'verify' },
                { id: 'e3', fromNodeId: 'intent', toNodeId: 'transfer', condition: 'dispute_or_plan' },
                { id: 'e4', fromNodeId: 'verify', toNodeId: 'action' },
                { id: 'e5', fromNodeId: 'action', toNodeId: 'confirm' },
                { id: 'e6', fromNodeId: 'confirm', toNodeId: 'continuation' },
                { id: 'e7', fromNodeId: 'continuation', toNodeId: 'end', condition: 'done' },
                { id: 'e8', fromNodeId: 'continuation', toNodeId: 'intent', condition: 'more' },
                { id: 'e9', fromNodeId: 'transfer', toNodeId: 'voicemail', condition: 'no_answer' },
                { id: 'e10', fromNodeId: 'voicemail', toNodeId: 'end' },
            ],
        },
        toolConfigSchema: [
            { key: 'practiceManagementSystem', label: 'Practice Management System', type: 'select', required: true, options: ['Dentrix', 'Eaglesoft', 'Open Dental', 'Kareo', 'AdvancedMD', 'Other'], helpText: 'Your billing / practice management software' },
            { key: 'apiEndpoint', label: 'API Endpoint', type: 'url', required: true },
            { key: 'apiKey', label: 'API Key', type: 'password', required: true },
            { key: 'paymentEnabled', label: 'Enable Phone Payments', type: 'boolean', required: false, helpText: 'Allow callers to pay by card over the phone (PCI-compliant IVR)' },
        ],
    },
    {
        catalogId: 'insurance',
        name: 'Insurance Verification',
        description:
            'Tells callers whether the clinic accepts their insurance and provides basic coverage information. Can check claim and prior auth status.',
        scopeBoundary:
            'Does not handle claim denials, appeals, or billing disputes. Cannot interpret whether a specific procedure is covered.',
        icon: 'Shield',
        color: 'purple',
        tags: ['Insurance', 'Coverage', 'Eligibility'],
        defaultNodeGraph: {
            nodes: [
                { id: 'greeting', type: 'greeting', config: { script: "Thank you for calling. I can help with insurance coverage and eligibility questions." }, position: { x: 100, y: 100 } },
                { id: 'intent', type: 'intent-detect', config: { intents: ['acceptance_check', 'coverage_check', 'claim_status', 'prior_auth_status'] }, position: { x: 100, y: 220 } },
                { id: 'collect', type: 'collect-info', config: { fields: [{ key: 'callerName', label: 'Full Name', type: 'text', required: true }, { key: 'dob', label: 'Date of Birth', type: 'date', required: true }, { key: 'insuranceCarrier', label: 'Insurance Company', type: 'text', required: true }, { key: 'memberNumber', label: 'Member ID Number', type: 'text', required: true }], retryAttempts: 2 }, position: { x: 100, y: 340 } },
                { id: 'action', type: 'action', config: { tool: 'insurance_lookup', outputKey: 'coverageResult' }, position: { x: 100, y: 460 } },
                { id: 'confirm', type: 'confirmation', config: { script: "Based on our records, {insuranceCarrier} {isAccepted}. {coverageSummary}" }, position: { x: 100, y: 580 } },
                { id: 'continuation', type: 'continuation-check', config: { promptScript: "Is there anything else I can help you with today?", maxTurns: 5 }, position: { x: 100, y: 700 } },
                { id: 'transfer', type: 'human-transfer', config: { transferPhone: '', contextSummary: true, noAnswerBehavior: 'voicemail' }, position: { x: 300, y: 460 } },
                { id: 'voicemail', type: 'voicemail', config: { promptScript: "No one is available right now. Please leave your name and number and we'll return your call." }, position: { x: 300, y: 580 } },
                { id: 'end', type: 'end-call', config: { script: "Thank you for calling. Have a great day!" }, position: { x: 100, y: 820 } },
            ],
            edges: [
                { id: 'e1', fromNodeId: 'greeting', toNodeId: 'intent' },
                { id: 'e2', fromNodeId: 'intent', toNodeId: 'collect' },
                { id: 'e3', fromNodeId: 'intent', toNodeId: 'transfer', condition: 'denial_or_appeal' },
                { id: 'e4', fromNodeId: 'collect', toNodeId: 'action' },
                { id: 'e5', fromNodeId: 'action', toNodeId: 'confirm' },
                { id: 'e6', fromNodeId: 'confirm', toNodeId: 'continuation' },
                { id: 'e7', fromNodeId: 'continuation', toNodeId: 'end', condition: 'done' },
                { id: 'e8', fromNodeId: 'continuation', toNodeId: 'intent', condition: 'more' },
                { id: 'e9', fromNodeId: 'transfer', toNodeId: 'voicemail', condition: 'no_answer' },
                { id: 'e10', fromNodeId: 'voicemail', toNodeId: 'end' },
            ],
        },
        toolConfigSchema: [
            { key: 'verificationApi', label: 'Eligibility Verification Service', type: 'select', required: false, options: ['Availity', 'Change Healthcare', 'Waystar', 'None (manual lookup)'], helpText: 'Real-time eligibility API. Leave blank to use your accepted plans list only.' },
            { key: 'apiKey', label: 'API Key', type: 'password', required: false },
            { key: 'npi', label: 'Practice NPI Number', type: 'text', required: false, helpText: 'Used for eligibility queries' },
        ],
    },
    {
        catalogId: 'faq',
        name: 'General FAQ & Info',
        description:
            'Answers anything a caller might ask before becoming a patient — hours, location, services, providers, new patient process, prep instructions, and more.',
        scopeBoundary:
            'Does not answer symptom questions, clinical advice, or anything that requires interpreting medical information.',
        icon: 'HelpCircle',
        color: 'amber',
        tags: ['FAQ', 'Information', 'Hours', 'Location'],
        defaultNodeGraph: {
            nodes: [
                { id: 'greeting', type: 'greeting', config: { script: "Thank you for calling. I can answer questions about our clinic — hours, location, services, and more." }, position: { x: 100, y: 100 } },
                { id: 'intent', type: 'intent-detect', config: { intents: ['hours', 'location', 'services', 'providers', 'new_patient', 'forms', 'prep_instructions', 'parking', 'general_faq'] }, position: { x: 100, y: 220 } },
                { id: 'kb', type: 'knowledge-base', config: { knowledgeBaseId: '', maxResults: 1, fallbackMessage: "I'm sorry, I don't have that information. Would you like me to connect you with a staff member?" }, position: { x: 100, y: 340 } },
                { id: 'continuation', type: 'continuation-check', config: { promptScript: "Is there anything else I can help you with today?", maxTurns: 5 }, position: { x: 100, y: 460 } },
                { id: 'transfer', type: 'human-transfer', config: { transferPhone: '', contextSummary: true, noAnswerBehavior: 'voicemail' }, position: { x: 300, y: 340 } },
                { id: 'voicemail', type: 'voicemail', config: { promptScript: "No one is available right now. Please leave your name and number and we'll return your call." }, position: { x: 300, y: 460 } },
                { id: 'end', type: 'end-call', config: { script: "Thank you for calling. Have a great day!" }, position: { x: 100, y: 580 } },
            ],
            edges: [
                { id: 'e1', fromNodeId: 'greeting', toNodeId: 'intent' },
                { id: 'e2', fromNodeId: 'intent', toNodeId: 'kb' },
                { id: 'e3', fromNodeId: 'intent', toNodeId: 'transfer', condition: 'out_of_scope' },
                { id: 'e4', fromNodeId: 'kb', toNodeId: 'continuation' },
                { id: 'e5', fromNodeId: 'kb', toNodeId: 'transfer', condition: 'no_answer_found' },
                { id: 'e6', fromNodeId: 'continuation', toNodeId: 'end', condition: 'done' },
                { id: 'e7', fromNodeId: 'continuation', toNodeId: 'intent', condition: 'more' },
                { id: 'e8', fromNodeId: 'transfer', toNodeId: 'voicemail', condition: 'no_answer' },
                { id: 'e9', fromNodeId: 'voicemail', toNodeId: 'end' },
            ],
        },
        toolConfigSchema: [
            { key: 'knowledgeBaseProvider', label: 'Knowledge Base', type: 'select', required: true, options: ['Wardline Built-in', 'Notion', 'Google Docs', 'Custom URL'], helpText: 'Where your FAQ content lives' },
            { key: 'knowledgeBaseUrl', label: 'Knowledge Base URL / ID', type: 'url', required: false, helpText: 'Required if using Notion, Google Docs, or Custom URL' },
            { key: 'apiKey', label: 'API Key', type: 'password', required: false },
        ],
    },
    {
        catalogId: 'prescription-refill',
        name: 'Prescription Refill Request',
        description:
            'Logs refill requests and routes them to the prescribing provider. Can also check status of a previously submitted refill.',
        scopeBoundary:
            'Does not approve, deny, or advise on prescriptions. New prescriptions (never filled before) always go to a human. Never comments on dosage, side effects, or drug interactions.',
        icon: 'Pill',
        color: 'rose',
        tags: ['Prescription', 'Refill', 'Medication'],
        defaultNodeGraph: {
            nodes: [
                { id: 'greeting', type: 'greeting', config: { script: "Thank you for calling. I can log a prescription refill request or check on an existing refill." }, position: { x: 100, y: 100 } },
                { id: 'intent', type: 'intent-detect', config: { intents: ['refill_request', 'refill_status'] }, position: { x: 100, y: 220 } },
                { id: 'new_rx_check', type: 'route', config: { routes: [{ condition: 'is_new_prescription', targetNodeId: 'transfer', label: 'New Prescription' }, { condition: 'is_refill', targetNodeId: 'collect', label: 'Refill' }], defaultTargetNodeId: 'collect' }, position: { x: 100, y: 300 } },
                { id: 'collect', type: 'collect-info', config: { fields: [{ key: 'callerName', label: 'Full Name', type: 'text', required: true }, { key: 'dob', label: 'Date of Birth', type: 'date', required: true }, { key: 'medicationName', label: 'Medication Name', type: 'text', required: true }, { key: 'prescriberName', label: 'Prescribing Doctor', type: 'text', required: true }, { key: 'pharmacyName', label: 'Pharmacy Name', type: 'text', required: false }, { key: 'pharmacyPhone', label: 'Pharmacy Phone', type: 'phone', required: false }], retryAttempts: 2 }, position: { x: 100, y: 420 } },
                { id: 'action', type: 'action', config: { tool: 'refill_request_submit', outputKey: 'refillId' }, position: { x: 100, y: 540 } },
                { id: 'confirm', type: 'confirmation', config: { script: "I've logged your refill request for {medicationName}. Your request ID is {refillId}. The provider will review and contact your pharmacy within 1-2 business days." }, position: { x: 100, y: 660 } },
                { id: 'continuation', type: 'continuation-check', config: { promptScript: "Is there anything else I can help you with today?", maxTurns: 5 }, position: { x: 100, y: 780 } },
                { id: 'transfer', type: 'human-transfer', config: { transferPhone: '', contextSummary: true, noAnswerBehavior: 'voicemail' }, position: { x: 350, y: 420 } },
                { id: 'voicemail', type: 'voicemail', config: { promptScript: "No one is available right now. Please leave your name, number, and the medication you need and we'll call you back." }, position: { x: 350, y: 540 } },
                { id: 'end', type: 'end-call', config: { script: "Thank you for calling. Have a great day!" }, position: { x: 100, y: 900 } },
            ],
            edges: [
                { id: 'e1', fromNodeId: 'greeting', toNodeId: 'intent' },
                { id: 'e2', fromNodeId: 'intent', toNodeId: 'new_rx_check' },
                { id: 'e3', fromNodeId: 'new_rx_check', toNodeId: 'transfer', condition: 'is_new_prescription' },
                { id: 'e4', fromNodeId: 'new_rx_check', toNodeId: 'collect', condition: 'is_refill' },
                { id: 'e5', fromNodeId: 'collect', toNodeId: 'action' },
                { id: 'e6', fromNodeId: 'action', toNodeId: 'confirm' },
                { id: 'e7', fromNodeId: 'confirm', toNodeId: 'continuation' },
                { id: 'e8', fromNodeId: 'continuation', toNodeId: 'end', condition: 'done' },
                { id: 'e9', fromNodeId: 'continuation', toNodeId: 'intent', condition: 'more' },
                { id: 'e10', fromNodeId: 'transfer', toNodeId: 'voicemail', condition: 'no_answer' },
                { id: 'e11', fromNodeId: 'voicemail', toNodeId: 'end' },
            ],
        },
        toolConfigSchema: [
            { key: 'ehrSystem', label: 'EHR / Practice System', type: 'select', required: true, options: ['Epic', 'Cerner', 'Athenahealth', 'Dentrix', 'Eaglesoft', 'Custom Webhook', 'Email Notification Only'], helpText: 'How to route the refill request to clinical staff' },
            { key: 'apiEndpoint', label: 'API / Webhook Endpoint', type: 'url', required: false },
            { key: 'apiKey', label: 'API Key / Token', type: 'password', required: false },
            { key: 'notifyEmail', label: 'Notification Email', type: 'text', required: false, helpText: 'Fallback email for refill requests if no API is configured' },
        ],
    },
];

/**
 * Seed the 5 starter agents for a given business.
 * Call this during new-business onboarding.
 */
export async function seedAgentsForBusiness(businessId: string): Promise<void> {
    for (const catalog of AGENT_CATALOG) {
        const existing = await prisma.agent.findFirst({
            where: { businessId, catalogId: catalog.catalogId },
        });

        if (!existing) {
            await prisma.agent.create({
                data: {
                    businessId,
                    catalogId: catalog.catalogId,
                    name: catalog.name,
                    description: catalog.description,
                    status: 'ACTIVE',
                    nodeGraph: catalog.defaultNodeGraph as any,
                    toolConfig: {},
                    agentConfig: {
                        scopeBoundary: catalog.scopeBoundary,
                        icon: catalog.icon,
                        color: catalog.color,
                        tags: catalog.tags,
                        toolConfigSchema: catalog.toolConfigSchema,
                    },
                },
            });
        }
    }
}

/**
 * Standalone seed script — seeds agents for the first business found,
 * or all businesses if run without arguments.
 */
async function main() {
    console.log('Seeding clinic starter agents...');

    const businesses = await prisma.business.findMany({ select: { id: true, name: true } });

    if (businesses.length === 0) {
        console.log('No businesses found. Create a business first.');
        return;
    }

    for (const business of businesses) {
        console.log(`  Seeding agents for: ${business.name}`);
        await seedAgentsForBusiness(business.id);
    }

    console.log(`Done. Seeded ${AGENT_CATALOG.length} agents per business.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
