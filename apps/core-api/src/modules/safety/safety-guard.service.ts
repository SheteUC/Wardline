import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@wardline/utils';

export interface SafetyCheckResult {
    isEmergency: boolean;
    isOutOfScope: boolean;
    confidence: number;
    triggeredKeywords: string[];
    recommendedAction: 'continue' | 'deflect' | 'emergency_escalate' | 'human_transfer';
    deflectionMessage?: string;
}

/**
 * Always-on emergency keywords — cannot be disabled by any business owner.
 * These trigger immediate 911 advisory and call emergency escalation.
 */
const SYSTEM_EMERGENCY_KEYWORDS = [
    // Life-threatening emergencies
    'chest pain', 'heart attack', 'cardiac arrest', 'stroke',
    "can't breathe", 'difficulty breathing', 'shortness of breath', 'not breathing',
    'unconscious', 'unresponsive', 'passed out',
    'seizure', 'convulsion',
    'severe bleeding', 'hemorrhage', 'blood everywhere',
    'overdose', 'poisoning', 'swallowed', 'ingested',
    'broken bone', 'fracture', 'bone sticking out',
    'head injury', 'head trauma', 'concussion', 'hit my head',
    'allergic reaction', 'anaphylaxis', 'throat closing',
    // Mental health emergencies
    'suicidal', 'want to die', 'kill myself', 'harm myself', 'self-harm',
    'suicide', 'mental health crisis',
    // Generic emergency signals
    'call 911', 'send an ambulance', 'emergency',
];

/**
 * Out-of-scope keywords for a clinical/dental clinic context.
 * Triggers deflection ("I can't help with that") + optional human transfer.
 * Business owners can extend this list via BusinessSettings.outOfScopeKeywords.
 */
const DEFAULT_OUT_OF_SCOPE_KEYWORDS = [
    // Clinical advice (outside receptionist scope)
    'diagnosis', 'diagnose', 'what do i have',
    'test results', 'lab results', 'blood test results',
    'medication side effects', 'drug interaction', 'adverse reaction',
    'is this normal', 'should i be worried',
    'medical advice', 'doctor advice', 'medical consultation',
    'clinical assessment', 'treatment plan',
    'dosage', 'how much should i take',
    'is it safe to take',
    // Legal / beyond scope
    'malpractice', 'sue', 'lawsuit',
];

@Injectable()
export class SafetyGuardService {
    private readonly logger = new Logger(SafetyGuardService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Check a transcript excerpt or utterance against safety rules.
     * Always runs — cannot be bypassed by workflow configuration.
     */
    async checkSafety(
        text: string,
        businessId: string,
    ): Promise<SafetyCheckResult> {
        const normalized = text.toLowerCase();
        const triggeredKeywords: string[] = [];

        // 1. Check emergency keywords first (highest priority)
        for (const kw of SYSTEM_EMERGENCY_KEYWORDS) {
            if (normalized.includes(kw)) {
                triggeredKeywords.push(kw);
            }
        }

        if (triggeredKeywords.length > 0) {
            this.logger.warn('Emergency keywords detected', { businessId, keywords: triggeredKeywords });
            return {
                isEmergency: true,
                isOutOfScope: false,
                confidence: 0.95,
                triggeredKeywords,
                recommendedAction: 'emergency_escalate',
            };
        }

        // 2. Load business-specific keyword overrides
        const [customOutOfScope, customEmergency] = await this.getBusinessKeywords(businessId);

        // 3. Check custom emergency keywords (business-defined additions)
        for (const kw of customEmergency) {
            if (normalized.includes(kw.toLowerCase())) {
                triggeredKeywords.push(kw);
            }
        }

        if (triggeredKeywords.length > 0) {
            return {
                isEmergency: true,
                isOutOfScope: false,
                confidence: 0.9,
                triggeredKeywords,
                recommendedAction: 'emergency_escalate',
            };
        }

        // 4. Check out-of-scope keywords
        const allOutOfScope = [...DEFAULT_OUT_OF_SCOPE_KEYWORDS, ...customOutOfScope];
        for (const kw of allOutOfScope) {
            if (normalized.includes(kw.toLowerCase())) {
                triggeredKeywords.push(kw);
            }
        }

        if (triggeredKeywords.length > 0) {
            return {
                isEmergency: false,
                isOutOfScope: true,
                confidence: 0.8,
                triggeredKeywords,
                recommendedAction: 'human_transfer',
                deflectionMessage:
                    "I'm not able to help with that, but I can connect you with a staff member who can. " +
                    'Would you like me to transfer you?',
            };
        }

        return {
            isEmergency: false,
            isOutOfScope: false,
            confidence: 1.0,
            triggeredKeywords: [],
            recommendedAction: 'continue',
        };
    }

    /**
     * Quick synchronous emergency check — for the voice orchestrator hot path.
     * Does NOT hit the database. Only checks system-level emergency keywords.
     */
    quickEmergencyCheck(text: string): { isEmergency: boolean; triggeredKeywords: string[] } {
        const normalized = text.toLowerCase();
        const triggered = SYSTEM_EMERGENCY_KEYWORDS.filter(kw => normalized.includes(kw));
        return { isEmergency: triggered.length > 0, triggeredKeywords: triggered };
    }

    /**
     * Returns [outOfScopeKeywords, emergencyKeywords] for a business.
     */
    private async getBusinessKeywords(businessId: string): Promise<[string[], string[]]> {
        try {
            const settings = await this.prisma.businessSettings.findUnique({
                where: { businessId },
                select: { outOfScopeKeywords: true, emergencyKeywords: true },
            });
            return [settings?.outOfScopeKeywords ?? [], settings?.emergencyKeywords ?? []];
        } catch {
            return [[], []];
        }
    }

    /**
     * Get the system-level emergency keyword list (read-only, for display in UI).
     */
    getSystemEmergencyKeywords(): string[] {
        return SYSTEM_EMERGENCY_KEYWORDS;
    }

    /**
     * Get default out-of-scope keywords (can be extended per business).
     */
    getDefaultOutOfScopeKeywords(): string[] {
        return DEFAULT_OUT_OF_SCOPE_KEYWORDS;
    }
}
