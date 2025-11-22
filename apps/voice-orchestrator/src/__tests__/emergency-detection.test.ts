import { EmergencyDetectionService } from '../services/emergency-detection.service';

describe('EmergencyDetectionService', () => {
    let service: EmergencyDetectionService;

    beforeEach(() => {
        service = new EmergencyDetectionService();
    });

    describe('Critical Emergency Keywords', () => {
        it('should detect "chest pain" as critical emergency', async () => {
            const result = await service.analyze('I have severe chest pain');

            expect(result.isEmergency).toBe(true);
            expect(result.confidence).toBeGreaterThanOrEqual(0.9);
            expect(result.triggeredKeywords).toContain('chest pain');
        });

        it('should detect "can\'t breathe" as critical emergency', async () => {
            const result = await service.analyze('I can\'t breathe properly');

            expect(result.isEmergency).toBe(true);
            expect(result.confidence).toBeGreaterThanOrEqual(0.9);
            expect(result.triggeredKeywords).toContain('can\'t breathe');
        });

        it('should detect "unconscious" as critical emergency', async () => {
            const result = await service.analyze('Someone is unconscious');

            expect(result.isEmergency).toBe(true);
            expect(result.confidence).toBeGreaterThanOrEqual(0.9);
            expect(result.triggeredKeywords).toContain('unconscious');
        });

        it('should detect "severe bleeding" as critical emergency', async () => {
            const result = await service.analyze('There is severe bleeding');

            expect(result.isEmergency).toBe(true);
            expect(result.confidence).toBeGreaterThanOrEqual(0.9);
            expect(result.triggeredKeywords).toContain('severe bleeding');
        });
    });

    describe('Urgent Keywords', () => {
        it('should detect accident as urgent', async () => {
            const result = await service.analyze('I was in an accident');

            expect(result.isEmergency).toBe(true);
            expect(result.confidence).toBeGreaterThanOrEqual(0.6);
            expect(result.triggeredKeywords).toContain('accident');
        });

        it('should detect high fever as urgent', async () => {
            const result = await service.analyze('I have a high fever');

            expect(result.isEmergency).toBe(true);
            expect(result.confidence).toBeGreaterThanOrEqual(0.6);
            expect(result.triggeredKeywords).toContain('high fever');
        });
    });

    describe('Emergency Phrases', () => {
        it('should detect "need ambulance" phrase', async () => {
            const result = await service.analyze('I need an ambulance right now');

            expect(result.isEmergency).toBe(true);
            expect(result.confidence).toBeGreaterThan(0.6);
        });

        it('should detect "call 911" phrase', async () => {
            const result = await service.analyze('Should I call 911?');

            expect(result.isEmergency).toBe(true);
            expect(result.confidence).toBeGreaterThan(0.6);
        });

        it('should detect "emergency" keyword', async () => {
            const result = await service.analyze('This is an emergency');

            expect(result.isEmergency).toBe(true);
            expect(result.confidence).toBeGreaterThan(0.6);
        });
    });

    describe('Non-Emergency Cases', () => {
        it('should not detect emergency for appointment scheduling', async () => {
            const result = await service.analyze('I need to schedule an appointment');

            expect(result.isEmergency).toBe(false);
            expect(result.confidence).toBeLessThan(0.6);
            expect(result.triggeredKeywords).toHaveLength(0);
        });

        it('should not detect emergency for billing inquiry', async () => {
            const result = await service.analyze('I have a question about my bill');

            expect(result.isEmergency).toBe(false);
            expect(result.confidence).toBeLessThan(0.6);
            expect(result.triggeredKeywords).toHaveLength(0);
        });

        it('should not detect emergency for general inquiry', async () => {
            const result = await service.analyze('What are your office hours?');

            expect(result.isEmergency).toBe(false);
            expect(result.confidence).toBeLessThan(0.6);
            expect(result.triggeredKeywords).toHaveLength(0);
        });
    });

    describe('Case Insensitivity', () => {
        it('should detect emergency keywords regardless of case', async () => {
            const result = await service.analyze('I HAVE CHEST PAIN');

            expect(result.isEmergency).toBe(true);
            expect(result.confidence).toBeGreaterThanOrEqual(0.9);
        });
    });

    describe('False Positives', () => {
        it('should not confuse "chest" in non-emergency context', async () => {
            const result = await service.analyze('I need my chest X-ray results');

            // This might still trigger if "chest" alone is flagged
            // This test ensures we don't have too sensitive matching
            if (result.isEmergency) {
                expect(result.confidence).toBeLessThan(0.9);
            }
        });
    });
});
