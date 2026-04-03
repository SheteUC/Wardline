import { BadRequestException } from '@nestjs/common';
import { WorkflowSimulationBodyPipe } from './workflow-simulation-body.pipe';

describe('WorkflowSimulationBodyPipe', () => {
    const pipe = new WorkflowSimulationBodyPipe();

    it('wraps a plain object body into the DTO inputs field', () => {
        expect(pipe.transform({ callerName: 'Jordan Rivera' })).toEqual({
            inputs: { callerName: 'Jordan Rivera' },
        });
    });

    it('rejects array bodies', () => {
        expect(() => pipe.transform([])).toThrow(BadRequestException);
    });

    it('rejects null bodies', () => {
        expect(() => pipe.transform(null)).toThrow(BadRequestException);
    });
});
