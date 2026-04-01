import { WorkflowValidatorService } from './workflow-validator.service';

describe('WorkflowValidatorService', () => {
    let service: WorkflowValidatorService;

    beforeEach(() => {
        service = new WorkflowValidatorService();
    });

    function buildWorkflow(escalationValue: string, target = 'clinical_queue') {
        return {
            nodes: [
                { id: 'start', type: 'start', config: {} },
                {
                    id: 'agent-1',
                    type: 'ai-agent',
                    config: {
                        persona: 'Receptionist',
                        systemPrompt: 'Route sensitive clinical concerns to staff.',
                        escalationRules: [
                            {
                                condition: { type: 'keyword', value: escalationValue },
                                action: { type: 'route_to_queue', target },
                            },
                        ],
                    },
                },
                { id: 'queue-1', type: 'human-agent-queue', config: { specialization: 'clinical' } },
                { id: 'end', type: 'end', config: {} },
            ],
            edges: [
                { id: 'e1', fromNodeId: 'start', toNodeId: 'agent-1' },
                { id: 'e2', fromNodeId: 'agent-1', toNodeId: 'queue-1' },
                { id: 'e3', fromNodeId: 'queue-1', toNodeId: 'end' },
            ],
        } as any;
    }

    it('does not treat bare prescription language as a safety keyword', () => {
        const workflow = buildWorkflow('prescription refill', 'front_desk');

        const result = service.validate(workflow);

        expect(result.errors).toEqual([]);
    });

    it('still flags clinically sensitive result questions that do not route to clinical staff', () => {
        const workflow = buildWorkflow('lab results', 'front_desk');

        const result = service.validate(workflow);

        expect(result.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'safety_violation',
                    message: expect.stringContaining('does not route to clinical staff'),
                }),
            ]),
        );
    });
});
