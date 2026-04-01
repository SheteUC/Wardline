export type SafetyCategory =
    | 'medical_emergency'
    | 'mental_health_emergency'
    | 'violence_abuse_emergency'
    | 'clinical_results_or_diagnosis'
    | 'medication_safety'
    | 'symptom_interpretation'
    | 'nonclinical_out_of_scope';

export type SafetySeverity = 'emergency' | 'urgent_handoff' | 'deflect';

export interface SafetyRuleGroup {
    category: SafetyCategory;
    severity: SafetySeverity;
    patterns: string[];
    displayKeywords: string[];
    workflowKeywords: string[];
}

export interface RuntimeSafetyPolicy {
    emergencyGroups: Array<{
        category: Extract<SafetyCategory, 'medical_emergency' | 'mental_health_emergency' | 'violence_abuse_emergency'>;
        patterns: string[];
    }>;
    urgentClinicalGroups: Array<{
        category: Extract<SafetyCategory, 'clinical_results_or_diagnosis' | 'medication_safety' | 'symptom_interpretation'>;
        patterns: string[];
    }>;
    nonClinicalOutOfScopePatterns: string[];
    historicalGuardPatterns: string[];
    acuteAmplifierPatterns: string[];
}

function phraseToRegex(phrase: string): string {
    const escaped = phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return String.raw`\b${escaped.replace(/\s+/g, String.raw`\s+`)}\b`;
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export const HISTORICAL_GUARD_PATTERNS = unique([
    phraseToRegex('history of'),
    phraseToRegex('last year'),
    phraseToRegex('years ago'),
    phraseToRegex('months ago'),
    phraseToRegex('follow-up after'),
    phraseToRegex('recovering from'),
    phraseToRegex('family history of'),
    phraseToRegex('records for'),
    phraseToRegex('paperwork for'),
]);

export const ACUTE_AMPLIFIER_PATTERNS = unique([
    phraseToRegex('right now'),
    phraseToRegex('currently'),
    phraseToRegex('sudden'),
    phraseToRegex('severe'),
    phraseToRegex('help'),
    phraseToRegex('right away'),
    phraseToRegex('immediately'),
    phraseToRegex('ambulance'),
    phraseToRegex('call 911'),
]);

export const DEFAULT_NONCLINICAL_OUT_OF_SCOPE_KEYWORDS = unique([
    'legal advice',
    'malpractice',
    'sue',
    'lawsuit',
]);

const SYSTEM_SAFETY_RULE_GROUPS: SafetyRuleGroup[] = [
    {
        category: 'medical_emergency',
        severity: 'emergency',
        patterns: unique([
            String.raw`\b(?:chest\s+pain|heart\s+attack|cardiac\s+arrest|stroke)\b`,
            String.raw`\b(?:can(?:not|'?t)\s+breathe|can(?:not|'?t)\s+catch\s+my\s+breath|trouble\s+breathing|difficulty\s+breathing|shortness\s+of\s+breath|not\s+breathing)\b`,
            String.raw`\b(?:unconscious|unresponsive|passed\s+out|fainted)\b`,
            String.raw`\b(?:seizure|convulsion)\b`,
            String.raw`\b(?:severe\s+bleeding|hemorrhage|blood\s+everywhere)\b`,
            String.raw`\b(?:overdose|overdosed|poisoning|swallowed\s+pills|ingested\s+something)\b`,
            String.raw`\b(?:allergic\s+reaction|anaphylaxis|throat\s+closing)\b`,
            String.raw`\b(?:broken\s+bone|bone\s+sticking\s+out)\b`,
            String.raw`\b(?:head\s+injury|head\s+trauma|hit\s+my\s+head\s+badly)\b`,
        ]),
        displayKeywords: unique([
            'chest pain',
            'heart attack',
            'cardiac arrest',
            'stroke',
            "can't breathe",
            'shortness of breath',
            'not breathing',
            'unconscious',
            'passed out',
            'seizure',
            'severe bleeding',
            'overdose',
            'allergic reaction',
            'anaphylaxis',
            'broken bone',
            'head injury',
        ]),
        workflowKeywords: unique([
            'chest pain',
            'heart attack',
            'cardiac arrest',
            'stroke',
            "can't breathe",
            'difficulty breathing',
            'shortness of breath',
            'not breathing',
            'unconscious',
            'passed out',
            'seizure',
            'severe bleeding',
            'overdose',
            'allergic reaction',
            'throat closing',
            'broken bone',
            'head injury',
        ]),
    },
    {
        category: 'mental_health_emergency',
        severity: 'emergency',
        patterns: unique([
            String.raw`\b(?:suicidal|suicide|want\s+to\s+die|kill\s+myself|hurt\s+myself|harm\s+myself|self[\s-]?harm|mental\s+health\s+crisis)\b`,
        ]),
        displayKeywords: unique([
            'suicidal',
            'suicide',
            'want to die',
            'kill myself',
            'harm myself',
            'self-harm',
            'mental health crisis',
        ]),
        workflowKeywords: unique([
            'suicidal',
            'suicide',
            'want to die',
            'kill myself',
            'harm myself',
            'self-harm',
            'mental health crisis',
        ]),
    },
    {
        category: 'violence_abuse_emergency',
        severity: 'emergency',
        patterns: unique([
            String.raw`\b(?:domestic\s+violence|being\s+abused|abuse|unsafe\s+at\s+home|not\s+safe\s+at\s+home|someone\s+is\s+hurting\s+me|assaulted|attacked|sexual\s+assault|raped|child\s+abuse)\b`,
        ]),
        displayKeywords: unique([
            'domestic violence',
            'abuse',
            'unsafe at home',
            'not safe at home',
            'someone is hurting me',
            'assaulted',
            'sexual assault',
            'child abuse',
        ]),
        workflowKeywords: unique([
            'domestic violence',
            'being abused',
            'abuse',
            'unsafe at home',
            'not safe at home',
            'someone is hurting me',
            'assaulted',
            'attacked',
            'sexual assault',
            'raped',
            'child abuse',
        ]),
    },
    {
        category: 'clinical_results_or_diagnosis',
        severity: 'urgent_handoff',
        patterns: unique([
            String.raw`\b(?:diagnosis|diagnose|what\s+do\s+i\s+have|what\s+do\s+these\s+results\s+mean|test\s+results|lab\s+results|blood\s+work\s+results|blood\s+test\s+results|is\s+this\s+normal|should\s+i\s+be\s+worried|treatment\s+plan)\b`,
        ]),
        displayKeywords: unique([
            'diagnosis',
            'diagnose',
            'what do I have',
            'what do these results mean',
            'test results',
            'lab results',
            'is this normal',
            'should I be worried',
            'treatment plan',
        ]),
        workflowKeywords: unique([
            'diagnosis',
            'diagnose',
            'what do i have',
            'what do these results mean',
            'test results',
            'lab results',
            'blood work results',
            'is this normal',
            'should i be worried',
            'treatment plan',
        ]),
    },
    {
        category: 'medication_safety',
        severity: 'urgent_handoff',
        patterns: unique([
            String.raw`\b(?:side\s+effects|adverse\s+reaction|drug\s+interaction|is\s+it\s+safe\s+to\s+take|dosage|dose|how\s+much\s+should\s+i\s+take)\b`,
            String.raw`\bcan\s+i\s+take\b.+\bwith\b.+`,
        ]),
        displayKeywords: unique([
            'side effects',
            'adverse reaction',
            'drug interaction',
            'can I take X with Y',
            'is it safe to take',
            'dosage',
            'how much should I take',
        ]),
        workflowKeywords: unique([
            'side effects',
            'adverse reaction',
            'drug interaction',
            'is it safe to take',
            'dosage',
            'dose',
            'how much should i take',
            'can i take',
        ]),
    },
    {
        category: 'symptom_interpretation',
        severity: 'urgent_handoff',
        patterns: unique([
            String.raw`\b(?:what\s+should\s+i\s+do\s+about\s+these\s+symptoms|symptom\s+question|pain\s+level|is\s+this\s+symptom\s+serious|what\s+should\s+i\s+take\s+for\s+this)\b`,
        ]),
        displayKeywords: unique([
            'what should I do about these symptoms',
            'symptom question',
            'pain level',
            'is this symptom serious',
            'what should I take for this',
        ]),
        workflowKeywords: unique([
            'what should i do about these symptoms',
            'symptom question',
            'pain level',
            'is this symptom serious',
            'what should i take for this',
        ]),
    },
];

export const SYSTEM_EMERGENCY_KEYWORDS = unique(
    SYSTEM_SAFETY_RULE_GROUPS.filter((group) => group.severity === 'emergency').flatMap((group) => group.displayKeywords),
);

export const DEFAULT_NONCLINICAL_OUT_OF_SCOPE_PATTERNS = unique(
    DEFAULT_NONCLINICAL_OUT_OF_SCOPE_KEYWORDS.map((keyword) => phraseToRegex(keyword)),
);

export const WORKFLOW_CLINICAL_SAFETY_KEYWORDS = unique(
    SYSTEM_SAFETY_RULE_GROUPS
        .filter((group) => group.category !== 'nonclinical_out_of_scope')
        .flatMap((group) => group.workflowKeywords),
);

export function buildRuntimeSafetyPolicy(options?: {
    emergencyKeywords?: string[];
    outOfScopeKeywords?: string[];
}): RuntimeSafetyPolicy {
    const customEmergencyPatterns = unique((options?.emergencyKeywords ?? []).map((keyword) => phraseToRegex(keyword)));
    const customOutOfScopePatterns = unique((options?.outOfScopeKeywords ?? []).map((keyword) => phraseToRegex(keyword)));

    return {
        emergencyGroups: SYSTEM_SAFETY_RULE_GROUPS
            .filter((group): group is SafetyRuleGroup & {
                category: Extract<SafetyCategory, 'medical_emergency' | 'mental_health_emergency' | 'violence_abuse_emergency'>;
            } => group.severity === 'emergency')
            .map((group) => ({
                category: group.category,
                patterns:
                    group.category === 'medical_emergency'
                        ? unique([...group.patterns, ...customEmergencyPatterns])
                        : [...group.patterns],
            })),
        urgentClinicalGroups: SYSTEM_SAFETY_RULE_GROUPS
            .filter((group): group is SafetyRuleGroup & {
                category: Extract<SafetyCategory, 'clinical_results_or_diagnosis' | 'medication_safety' | 'symptom_interpretation'>;
            } => group.severity === 'urgent_handoff')
            .map((group) => ({
                category: group.category,
                patterns: [...group.patterns],
            })),
        nonClinicalOutOfScopePatterns: unique([
            ...DEFAULT_NONCLINICAL_OUT_OF_SCOPE_PATTERNS,
            ...customOutOfScopePatterns,
        ]),
        historicalGuardPatterns: [...HISTORICAL_GUARD_PATTERNS],
        acuteAmplifierPatterns: [...ACUTE_AMPLIFIER_PATTERNS],
    };
}

export function getSystemEmergencyKeywords(): string[] {
    return [...SYSTEM_EMERGENCY_KEYWORDS];
}

export function getDefaultOutOfScopeKeywords(): string[] {
    return [...DEFAULT_NONCLINICAL_OUT_OF_SCOPE_KEYWORDS];
}
