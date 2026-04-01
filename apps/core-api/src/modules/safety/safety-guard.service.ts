import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@wardline/utils';
import {
    buildRuntimeSafetyPolicy,
    getDefaultOutOfScopeKeywords,
    getSystemEmergencyKeywords,
    type RuntimeSafetyPolicy,
    type SafetyCategory,
    type SafetySeverity,
} from './safety-policy';

export interface SafetyCheckResult {
    isEmergency: boolean;
    isOutOfScope: boolean;
    confidence: number;
    triggeredKeywords: string[];
    recommendedAction: 'continue' | 'deflect' | 'emergency_escalate' | 'human_transfer';
    deflectionMessage?: string;
}

interface SafetyMatch {
    category: SafetyCategory;
    severity: SafetySeverity;
    matchedPatterns: string[];
}

function matchPatterns(text: string, patterns: string[]): string[] {
    return patterns.filter((pattern) => {
        try {
            return new RegExp(pattern, 'i').test(text);
        } catch {
            return false;
        }
    });
}

@Injectable()
export class SafetyGuardService {
    private readonly logger = new Logger(SafetyGuardService.name);

    constructor(private readonly prisma: PrismaService) {}

    async checkSafety(
        text: string,
        businessId: string,
    ): Promise<SafetyCheckResult> {
        const normalized = text.toLowerCase();
        const [customOutOfScope, customEmergency] = await this.getBusinessKeywords(businessId);
        const policy = buildRuntimeSafetyPolicy({
            emergencyKeywords: customEmergency,
            outOfScopeKeywords: customOutOfScope,
        });
        const match = this.assessSafety(normalized, policy);

        if (!match) {
            return {
                isEmergency: false,
                isOutOfScope: false,
                confidence: 1.0,
                triggeredKeywords: [],
                recommendedAction: 'continue',
            };
        }

        if (match.severity === 'emergency') {
            this.logger.warn('Emergency safety language detected', {
                businessId,
                category: match.category,
                matchedPatterns: match.matchedPatterns,
            });
            return {
                isEmergency: true,
                isOutOfScope: false,
                confidence: 0.95,
                triggeredKeywords: match.matchedPatterns,
                recommendedAction: 'emergency_escalate',
            };
        }

        if (match.severity === 'urgent_handoff') {
            return {
                isEmergency: false,
                isOutOfScope: false,
                confidence: 0.88,
                triggeredKeywords: match.matchedPatterns,
                recommendedAction: 'human_transfer',
                deflectionMessage:
                    "I can't interpret symptoms, test results, or medication safety questions, but I can connect you with the practice or take an urgent message for clinical follow-up.",
            };
        }

        return {
            isEmergency: false,
            isOutOfScope: true,
            confidence: 0.8,
            triggeredKeywords: match.matchedPatterns,
            recommendedAction: 'human_transfer',
            deflectionMessage:
                "I'm not able to help with that, but I can connect you with a staff member who can. Would you like me to transfer you?",
        };
    }

    quickEmergencyCheck(text: string): { isEmergency: boolean; triggeredKeywords: string[] } {
        const normalized = text.toLowerCase();
        const triggered = buildRuntimeSafetyPolicy()
            .emergencyGroups.flatMap((group) => group.patterns)
            .filter((pattern) => {
                try {
                    return new RegExp(pattern, 'i').test(normalized);
                } catch {
                    return false;
                }
            });
        return { isEmergency: triggered.length > 0, triggeredKeywords: triggered };
    }

    private assessSafety(text: string, policy: RuntimeSafetyPolicy): SafetyMatch | null {
        for (const group of policy.emergencyGroups) {
            const matchedPatterns = matchPatterns(text, group.patterns);
            if (!matchedPatterns.length) {
                continue;
            }
            if (
                group.category === 'medical_emergency'
                && matchPatterns(text, policy.historicalGuardPatterns).length > 0
                && matchPatterns(text, policy.acuteAmplifierPatterns).length === 0
            ) {
                continue;
            }
            return {
                category: group.category,
                severity: 'emergency',
                matchedPatterns,
            };
        }

        for (const group of policy.urgentClinicalGroups) {
            const matchedPatterns = matchPatterns(text, group.patterns);
            if (matchedPatterns.length) {
                return {
                    category: group.category,
                    severity: 'urgent_handoff',
                    matchedPatterns,
                };
            }
        }

        const outOfScopePatterns = matchPatterns(text, policy.nonClinicalOutOfScopePatterns);
        if (outOfScopePatterns.length) {
            return {
                category: 'nonclinical_out_of_scope',
                severity: 'deflect',
                matchedPatterns: outOfScopePatterns,
            };
        }

        return null;
    }

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

    getSystemEmergencyKeywords(): string[] {
        return getSystemEmergencyKeywords();
    }

    getDefaultOutOfScopeKeywords(): string[] {
        return getDefaultOutOfScopeKeywords();
    }
}
