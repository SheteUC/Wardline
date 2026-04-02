import { CallsProgressController } from './calls-progress.controller';

describe('CallsProgressController', () => {
    it('updateProgress returns acknowledgement', async () => {
        const c = new CallsProgressController();
        const res = await c.updateProgress('call-1', { current_state: 'ACTIVE' });
        expect(res.callId).toBe('call-1');
        expect(res.updated).toBe(true);
        expect(res.timestamp).toBeDefined();
    });
});
