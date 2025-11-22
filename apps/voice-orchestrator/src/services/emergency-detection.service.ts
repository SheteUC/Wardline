import { EmergencyDetectionResult } from '@wardline/types';

/**
 * Emergency keywords configuration
 */
export const EMERGENCY_KEYWORDS = {
    // Critical - High priority emergency indicators
    critical: [
        'chest pain',
        'heart attack',
        'can\'t breathe',
        'cannot breathe',
        'difficulty breathing',
        'unconscious',
        'unresponsive',
        'severe bleeding',
        'bleeding heavily',
        'stroke',
        'seizure',
        'overdose',
        'suicide',
        'kill myself',
        'choking',
        'severe burn',
    ],

    // Urgent - Medium priority indicators
    urgent: [
        'accident',
        'injury',
        'fell down',
        'broken bone',
        'head injury',
        'allergic reaction',
        'high fever',
        'severe pain',
        'vomiting blood',
        'loss of consciousness',
    ],
};

/**
 * Emergency detection service
 */
export class EmergencyDetectionService {
    /**
     * Analyze text for emergency indicators
     */
    public async analyze(text: string): Promise<EmergencyDetectionResult> {
        const lowerText = text.toLowerCase();
        const triggeredKeywords: string[] = [];
        let confidence = 0;

        // Check critical keywords
        for (const keyword of EMERGENCY_KEYWORDS.critical) {
            if (lowerText.includes(keyword.toLowerCase())) {
                triggeredKeywords.push(keyword);
                confidence = Math.max(confidence, 0.9);
            }
        }

        // Check urgent keywords
        for (const keyword of EMERGENCY_KEYWORDS.urgent) {
            if (lowerText.includes(keyword.toLowerCase())) {
                triggeredKeywords.push(keyword);
                confidence = Math.max(confidence, 0.6);
            }
        }

        // Additional pattern matching
        if (this.containsEmergencyPhrases(lowerText)) {
            confidence = Math.max(confidence, 0.8);
            triggeredKeywords.push('emergency phrase pattern');
        }

        const isEmergency = confidence >= 0.6;

        console.log(`🚨 Emergency analysis: isEmergency=${isEmergency}, confidence=${confidence}, keywords=${triggeredKeywords.join(', ')}`);

        return {
            isEmergency,
            confidence,
            triggeredKeywords,
        };
    }

    /**
     * Check for emergency phrase patterns
     */
    private containsEmergencyPhrases(text: string): boolean {
        const emergencyPhrases = [
            /need\s+(an\s+)?ambulance/i,
            /call\s+911/i,
            /help\s+me/i,
            /emergency/i,
            /dying/i,
            /life\s+threatening/i,
        ];

        return emergencyPhrases.some(pattern => pattern.test(text));
    }
}
