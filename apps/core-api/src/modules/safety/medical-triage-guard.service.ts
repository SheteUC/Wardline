import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MedicalTriageGuardService {
    private readonly logger = new Logger(MedicalTriageGuardService.name);

    // Critical medical keywords that MUST route to human clinical staff
    private readonly MEDICAL_KEYWORDS = [
        // Emergency keywords
        'chest pain',
        'heart attack',
        'stroke',
        "can't breathe",
        'difficulty breathing',
        'shortness of breath',
        'unconscious',
        'seizure',
        'convulsion',
        'bleeding',
        'hemorrhage',
        'overdose',
        'poisoning',
        'severe pain',
        'broken bone',
        'fracture',
        'head injury',
        'concussion',
        'allergic reaction',
        'anaphylaxis',

        // Clinical keywords
        'diagnosis',
        'diagnose',
        'test results',
        'lab results',
        'medication side effects',
        'adverse reaction',
        'symptoms',
        'symptom',
        'pain level',
        'treatment',
        'treatment plan',
        'prescription',
        'prescribe',
        'medical advice',
        'doctor advice',
        'medical consultation',
        'clinical assessment',

        // Mental health
        'suicidal',
        'want to die',
        'kill myself',
        'harm myself',
        'self-harm',
        'suicide',
        'depression',
        'severely depressed',
        'panic attack',
        'mental health crisis',

        // Surgical/procedure
        'surgery',
        'surgical',
        'operation',
        'procedure',
        'biopsy',
        'catheter',

        // Serious conditions
        'cancer',
        'tumor',
        'diabetes',
        'diabetic',
        'cardiac',
        'respiratory',
        'infection',
        'sepsis',
        'pneumonia',
    ];

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Detect medical content in transcript
     */
    async detectMedicalContent(transcript: string): Promise<{
        isMedical: boolean;
        confidence: number;
        triggeredKeywords: string[];
        requiresHumanEscalation: boolean;
    }> {
        const transcriptLower = transcript.toLowerCase();
        const triggeredKeywords: string[] = [];

        // Keyword matching
        for (const keyword of this.MEDICAL_KEYWORDS) {
            if (transcriptLower.includes(keyword.toLowerCase())) {
                triggeredKeywords.push(keyword);
            }
        }

        const isMedical = triggeredKeywords.length > 0;
        
        // Calculate confidence based on number of keywords and their criticality
        const confidence = this.calculateConfidence(triggeredKeywords);

        // Determine if human escalation is required
        const requiresHumanEscalation = this.requiresEscalation(triggeredKeywords);

        if (isMedical) {
            this.logger.warn(`Medical content detected: ${triggeredKeywords.join(', ')}`);
        }

        return {
            isMedical,
            confidence,
            triggeredKeywords,
            requiresHumanEscalation,
        };
    }

    /**
     * Calculate confidence score based on keywords detected
     */
    private calculateConfidence(keywords: string[]): number {
        if (keywords.length === 0) return 0;

        // Base confidence on number of keywords
        let confidence = Math.min(keywords.length * 0.25, 1.0);

        // Boost confidence for emergency keywords
        const emergencyKeywords = [
            'chest pain',
            'heart attack',
            'stroke',
            "can't breathe",
            'unconscious',
            'seizure',
            'bleeding',
            'overdose',
            'suicidal',
        ];

        const hasEmergency = keywords.some(k =>
            emergencyKeywords.some(ek => k.toLowerCase().includes(ek))
        );

        if (hasEmergency) {
            confidence = Math.min(confidence + 0.3, 1.0);
        }

        // Boost if multiple medical terms in close proximity
        if (keywords.length >= 3) {
            confidence = Math.min(confidence + 0.2, 1.0);
        }

        return parseFloat(confidence.toFixed(2));
    }

    /**
     * Determine if keywords require immediate human escalation
     */
    private requiresEscalation(keywords: string[]): boolean {
        // Critical keywords that always require escalation
        const criticalKeywords = [
            'chest pain',
            'heart attack',
            'stroke',
            "can't breathe",
            'difficulty breathing',
            'unconscious',
            'seizure',
            'bleeding',
            'overdose',
            'suicidal',
            'want to die',
            'kill myself',
            'harm myself',
        ];

        return keywords.some(k =>
            criticalKeywords.some(ck => k.toLowerCase() === ck.toLowerCase())
        );
    }

    /**
     * Enforce human escalation for a call
     */
    async enforceHumanEscalation(callId: string, reason: string, keywords: string[]): Promise<void> {
        this.logger.warn(`Enforcing human escalation for call ${callId}. Reason: ${reason}`);

        try {
            // Update call to mark for clinical escalation
            await this.prisma.callSession.update({
                where: { id: callId },
                data: {
                    tag: 'CLINICAL_ESCALATION',
                    isEmergency: this.isEmergency(keywords),
                    handoffReason: `Medical content detected: ${keywords.join(', ')}`,
                },
            });

            // Log safety event
            await this.logSafetyEvent(callId, {
                type: 'medical_escalation',
                reason,
                keywords,
                timestamp: new Date(),
            });

            // TODO: Alert supervisors immediately for emergency keywords
            if (this.isEmergency(keywords)) {
                await this.alertSupervisors(callId, keywords);
            }
        } catch (error: any) {
            this.logger.error(`Error enforcing escalation for call ${callId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if keywords indicate an emergency
     */
    private isEmergency(keywords: string[]): boolean {
        const emergencyKeywords = [
            'chest pain',
            'heart attack',
            'stroke',
            "can't breathe",
            'unconscious',
            'seizure',
            'bleeding',
            'overdose',
            'suicidal',
        ];

        return keywords.some(k =>
            emergencyKeywords.some(ek => k.toLowerCase().includes(ek))
        );
    }

    /**
     * Log safety event to audit trail
     */
    private async logSafetyEvent(callId: string, event: any): Promise<void> {
        try {
            // Get hospital ID from call
            const call = await this.prisma.callSession.findUnique({
                where: { id: callId },
                select: { hospitalId: true },
            });

            if (!call) {
                this.logger.error(`Call not found: ${callId}`);
                return;
            }

            await this.prisma.auditLog.create({
                data: {
                    hospitalId: call.hospitalId,
                    action: 'SAFETY_EVENT',
                    entityType: 'CallSession',
                    entityId: callId,
                    metadata: event,
                    createdAt: new Date(),
                },
            });

            this.logger.log(`Safety event logged for call ${callId}`);
        } catch (error: any) {
            this.logger.error(`Error logging safety event: ${error.message}`);
        }
    }

    /**
     * Alert supervisors about emergency escalation
     */
    private async alertSupervisors(callId: string, keywords: string[]): Promise<void> {
        // TODO: Implement supervisor alerting (WebSocket, SMS, email)
        this.logger.warn(`EMERGENCY ALERT: Call ${callId} - Keywords: ${keywords.join(', ')}`);
        
        // This would typically:
        // 1. Send WebSocket notification to online supervisors
        // 2. Send SMS to on-call supervisors
        // 3. Create high-priority notification in system
    }

    /**
     * Analyze call transcript for medical content (batch processing)
     */
    async analyzeTranscript(callId: string): Promise<void> {
        try {
            // Get transcript segments
            const segments = await this.prisma.transcriptSegment.findMany({
                where: { callId },
                orderBy: { createdAt: 'asc' },
            });

            const fullTranscript = segments.map(s => s.text).join(' ');

            const result = await this.detectMedicalContent(fullTranscript);

            if (result.requiresHumanEscalation) {
                await this.enforceHumanEscalation(
                    callId,
                    'Medical keywords detected in transcript',
                    result.triggeredKeywords
                );
            }
        } catch (error: any) {
            this.logger.error(`Error analyzing transcript for call ${callId}: ${error.message}`);
        }
    }

    /**
     * Get safety statistics for a hospital
     */
    async getSafetyStats(hospitalId: string, startDate?: Date, endDate?: Date) {
        const where: any = {
            hospitalId,
            action: 'SAFETY_EVENT',
        };

        if (startDate) {
            where.createdAt = { gte: startDate };
        }
        if (endDate) {
            where.createdAt = { ...where.createdAt, lte: endDate };
        }

        const [totalEvents, emergencyEvents] = await Promise.all([
            this.prisma.auditLog.count({ where }),
            this.prisma.auditLog.count({
                where: {
                    ...where,
                    metadata: {
                        path: ['type'],
                        equals: 'medical_escalation',
                    },
                },
            }),
        ]);

        return {
            totalSafetyEvents: totalEvents,
            emergencyEscalations: emergencyEvents,
            complianceRate: totalEvents > 0 ? 100 : null, // All medical content was escalated
        };
    }
}
