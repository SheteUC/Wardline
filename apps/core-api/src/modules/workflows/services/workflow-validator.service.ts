import { Injectable } from '@nestjs/common';
import {
    WorkflowGraph,
    ValidationResult,
    ValidationError,
    ValidationWarning,
} from '@wardline/types';

@Injectable()
export class WorkflowValidatorService {
    // Logger for validation events
    // private readonly logger = new Logger(WorkflowValidatorService.name);

    // Medical keywords that MUST route to human clinical staff
    private readonly MEDICAL_KEYWORDS = [
        // Emergency keywords
        'chest pain',
        'heart attack',
        'stroke',
        "can't breathe",
        'difficulty breathing',
        'unconscious',
        'seizure',
        'bleeding',
        'overdose',

        // Clinical keywords
        'diagnosis',
        'test results',
        'medication side effects',
        'symptoms',
        'pain level',
        'treatment',
        'prescription',
        'medical advice',

        // Mental health
        'suicidal',
        'want to die',
        'harm myself',
        'self-harm',
    ];

    /**
     * Validate a workflow
     */
    validate(workflow: WorkflowGraph): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // 1. Validate graph structure
        const structureErrors = this.validateGraphStructure(workflow);
        errors.push(...structureErrors);

        // 2. Validate safety rules (medical keywords must route to clinical staff)
        const safetyErrors = this.validateSafetyRules(workflow);
        errors.push(...safetyErrors);

        // 3. Validate error handling (all paths must end somewhere)
        const errorHandlingErrors = this.validateErrorHandling(workflow);
        errors.push(...errorHandlingErrors);

        // 4. Validate node configurations
        const configErrors = this.validateNodeConfigurations(workflow);
        errors.push(...configErrors);

        // 5. Generate warnings for best practices
        const bestPracticeWarnings = this.generateWarnings(workflow);
        warnings.push(...bestPracticeWarnings);

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validate graph structure (no cycles, proper connections)
     */
    private validateGraphStructure(workflow: WorkflowGraph): ValidationError[] {
        const errors: ValidationError[] = [];

        // Check for orphaned nodes (nodes with no incoming or outgoing edges)
        const nodeIds = new Set(workflow.nodes.map(n => n.id));
        const connectedNodes = new Set<string>();

        for (const edge of workflow.edges) {
            connectedNodes.add(edge.fromNodeId);
            connectedNodes.add(edge.toNodeId);

            // Validate edge connections
            if (!nodeIds.has(edge.fromNodeId)) {
                errors.push({
                    type: 'invalid_edge',
                    message: `Edge ${edge.id} references non-existent node: ${edge.fromNodeId}`,
                });
            }
            if (!nodeIds.has(edge.toNodeId)) {
                errors.push({
                    type: 'invalid_edge',
                    message: `Edge ${edge.id} references non-existent node: ${edge.toNodeId}`,
                });
            }
        }

        // Check for orphaned nodes (except start and end)
        for (const node of workflow.nodes) {
            if (node.type !== 'start' && node.type !== 'end' && !connectedNodes.has(node.id)) {
                errors.push({
                    nodeId: node.id,
                    type: 'orphaned_node',
                    message: `Node ${node.id} is not connected to any other nodes`,
                });
            }
        }

        // Check for cycles (infinite loops)
        const cycles = this.detectCycles(workflow);
        if (cycles.length > 0) {
            errors.push({
                type: 'cycle_detected',
                message: `Workflow contains cycles that could cause infinite loops: ${cycles.join(', ')}`,
            });
        }

        // Validate start node exists
        const startNodes = workflow.nodes.filter(n => n.type === 'start');
        if (startNodes.length === 0) {
            errors.push({
                type: 'missing_start',
                message: 'Workflow must have a start node',
            });
        } else if (startNodes.length > 1) {
            errors.push({
                type: 'multiple_starts',
                message: 'Workflow can only have one start node',
            });
        }

        return errors;
    }

    /**
     * Validate safety rules - medical keywords must route to clinical staff
     */
    private validateSafetyRules(workflow: WorkflowGraph): ValidationError[] {
        const errors: ValidationError[] = [];

        // Find all safety-check nodes
        const safetyCheckNodes = workflow.nodes.filter(n => n.type === 'safety-check');

        // Find all AI agent nodes
        const aiAgentNodes = workflow.nodes.filter(n => n.type === 'ai-agent');

        // Check if any AI agent node has medical escalation rules
        for (const node of aiAgentNodes) {
            const config = node.config as any;
            const escalationRules = config?.escalationRules || [];

            const hasMedicalEscalation = escalationRules.some((rule: any) =>
                rule.condition.type === 'keyword' &&
                this.MEDICAL_KEYWORDS.some(keyword =>
                    String(rule.condition.value).toLowerCase().includes(keyword)
                )
            );

            if (hasMedicalEscalation) {
                // Check if the escalation routes to clinical queue
                const routesToClinical = escalationRules.some((rule: any) =>
                    rule.action.type === 'route_to_queue' &&
                    (String(rule.action.target).toLowerCase().includes('clinical') ||
                        String(rule.action.target).toLowerCase().includes('medical'))
                );

                if (!routesToClinical) {
                    errors.push({
                        nodeId: node.id,
                        type: 'safety_violation',
                        message: `AI agent node "${node.id}" has medical keyword escalation but does not route to clinical staff`,
                    });
                }
            }
        }

        // Check if safety-check nodes route to clinical queue
        for (const node of safetyCheckNodes) {
            // Find outgoing edges from this node
            const outgoingEdges = workflow.edges.filter(e => e.fromNodeId === node.id);

            if (outgoingEdges.length === 0) {
                errors.push({
                    nodeId: node.id,
                    type: 'safety_violation',
                    message: `Safety check node "${node.id}" has no outgoing connections`,
                });
                continue;
            }

            // Check if at least one path leads to human-agent-queue with clinical specialization
            const routesToClinical = this.pathRoutesToClinical(node.id, workflow);

            if (!routesToClinical) {
                errors.push({
                    nodeId: node.id,
                    type: 'safety_violation',
                    message: `Safety check node "${node.id}" does not have a path to clinical staff queue`,
                });
            }
        }

        return errors;
    }

    /**
     * Check if a path from a node leads to clinical staff
     */
    private pathRoutesToClinical(startNodeId: string, workflow: WorkflowGraph, visited = new Set<string>()): boolean {
        if (visited.has(startNodeId)) return false;
        visited.add(startNodeId);

        const node = workflow.nodes.find(n => n.id === startNodeId);
        if (!node) return false;

        // Check if this node is a human-agent-queue with clinical specialization
        if (node.type === 'human-agent-queue') {
            const config = node.config as any;
            const specialization = String(config?.specialization || '').toLowerCase();
            if (specialization.includes('clinical') || specialization.includes('medical')) {
                return true;
            }
        }

        // Check outgoing edges
        const outgoingEdges = workflow.edges.filter(e => e.fromNodeId === startNodeId);
        for (const edge of outgoingEdges) {
            if (this.pathRoutesToClinical(edge.toNodeId, workflow, visited)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validate error handling - all paths must end somewhere
     */
    private validateErrorHandling(workflow: WorkflowGraph): ValidationError[] {
        const errors: ValidationError[] = [];

        // Check that all non-end nodes have at least one outgoing edge
        for (const node of workflow.nodes) {
            if (node.type !== 'end') {
                const outgoingEdges = workflow.edges.filter(e => e.fromNodeId === node.id);

                if (outgoingEdges.length === 0) {
                    errors.push({
                        nodeId: node.id,
                        type: 'dead_end',
                        message: `Node "${node.id}" has no outgoing connections and is not an end node`,
                    });
                }
            }
        }

        // Check that all paths eventually reach an end node or human-agent-queue
        const startNode = workflow.nodes.find(n => n.type === 'start');
        if (startNode) {
            const reachableEndpoints = this.findReachableEndpoints(startNode.id, workflow);
            if (reachableEndpoints.length === 0) {
                errors.push({
                    type: 'no_endpoint',
                    message: 'Workflow has no reachable end nodes or human-agent-queue nodes',
                });
            }
        }

        return errors;
    }

    /**
     * Find all reachable endpoints from a node
     */
    private findReachableEndpoints(startNodeId: string, workflow: WorkflowGraph, visited = new Set<string>()): string[] {
        if (visited.has(startNodeId)) return [];
        visited.add(startNodeId);

        const node = workflow.nodes.find(n => n.id === startNodeId);
        if (!node) return [];

        // Check if this is an endpoint
        if (node.type === 'end' || node.type === 'human-agent-queue') {
            return [node.id];
        }

        // Recursively find endpoints in outgoing edges
        const endpoints: string[] = [];
        const outgoingEdges = workflow.edges.filter(e => e.fromNodeId === startNodeId);

        for (const edge of outgoingEdges) {
            const reachable = this.findReachableEndpoints(edge.toNodeId, workflow, visited);
            endpoints.push(...reachable);
        }

        return endpoints;
    }

    /**
     * Validate node configurations
     */
    private validateNodeConfigurations(workflow: WorkflowGraph): ValidationError[] {
        const errors: ValidationError[] = [];

        for (const node of workflow.nodes) {
            switch (node.type) {
                case 'ai-agent':
                    const aiConfig = node.config as any;
                    if (!aiConfig?.persona) {
                        errors.push({
                            nodeId: node.id,
                            type: 'invalid_config',
                            message: `AI agent node "${node.id}" must have a persona`,
                        });
                    }
                    if (!aiConfig?.systemPrompt) {
                        errors.push({
                            nodeId: node.id,
                            type: 'invalid_config',
                            message: `AI agent node "${node.id}" must have a system prompt`,
                        });
                    }
                    break;

                case 'human-agent-queue':
                    const queueConfig = node.config as any;
                    if (!queueConfig?.specialization) {
                        errors.push({
                            nodeId: node.id,
                            type: 'invalid_config',
                            message: `Human agent queue node "${node.id}" must have a specialization`,
                        });
                    }
                    break;

                case 'conditional':
                    const condConfig = node.config as any;
                    if (!condConfig?.condition) {
                        errors.push({
                            nodeId: node.id,
                            type: 'invalid_config',
                            message: `Conditional node "${node.id}" must have a condition`,
                        });
                    }
                    break;
            }
        }

        return errors;
    }

    /**
     * Generate warnings for best practices
     */
    private generateWarnings(workflow: WorkflowGraph): ValidationWarning[] {
        const warnings: ValidationWarning[] = [];

        // Warn if no safety check nodes exist
        const hasSafetyCheck = workflow.nodes.some(n => n.type === 'safety-check');
        if (!hasSafetyCheck) {
            warnings.push({
                type: 'missing_safety_check',
                message: 'Workflow does not have any safety check nodes. Consider adding medical keyword detection.',
            });
        }

        // Warn if no emergency screening
        const hasEmergencyScreen = workflow.nodes.some(n => n.type === 'emergency-screen');
        if (!hasEmergencyScreen) {
            warnings.push({
                type: 'missing_emergency_screen',
                message: 'Workflow does not have emergency screening. Consider adding one at the start.',
            });
        }

        return warnings;
    }

    /**
     * Detect cycles in the workflow graph
     */
    private detectCycles(workflow: WorkflowGraph): string[] {
        const cycles: string[] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const dfs = (nodeId: string, path: string[]): void => {
            if (recursionStack.has(nodeId)) {
                // Found a cycle
                const cycleStart = path.indexOf(nodeId);
                const cycle = path.slice(cycleStart).concat(nodeId).join(' -> ');
                cycles.push(cycle);
                return;
            }

            if (visited.has(nodeId)) return;

            visited.add(nodeId);
            recursionStack.add(nodeId);
            path.push(nodeId);

            const outgoingEdges = workflow.edges.filter(e => e.fromNodeId === nodeId);
            for (const edge of outgoingEdges) {
                dfs(edge.toNodeId, [...path]);
            }

            recursionStack.delete(nodeId);
        };

        for (const node of workflow.nodes) {
            if (!visited.has(node.id)) {
                dfs(node.id, []);
            }
        }

        return cycles;
    }
}
