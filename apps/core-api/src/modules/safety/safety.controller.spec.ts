import { SafetyController } from './safety.controller';
import { SafetyGuardService } from './safety-guard.service';

describe('SafetyController', () => {
    it('checkSafety delegates', async () => {
        const guard = { checkSafety: jest.fn().mockResolvedValue({ safe: true }) };
        const c = new SafetyController(guard as unknown as SafetyGuardService);
        await c.checkSafety({ text: 'hello', businessId: 'b1' });
        expect(guard.checkSafety).toHaveBeenCalledWith('hello', 'b1');
    });

    it('getBusinessKeywords returns merged shape', async () => {
        const guard = {
            getSystemEmergencyKeywords: jest.fn().mockReturnValue(['stroke']),
            getDefaultOutOfScopeKeywords: jest.fn().mockReturnValue(['legal']),
        };
        const c = new SafetyController(guard as unknown as SafetyGuardService);
        const res = await c.getBusinessKeywords('b1');
        expect(res.businessId).toBe('b1');
        expect(res.systemEmergency).toEqual(['stroke']);
    });
});
