"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Play, StopCircle, Send, Bot, User, AlertTriangle,
    CheckCircle, ArrowRight, Clock, Loader2
} from 'lucide-react';

interface SimulationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    nodeId?: string;
}

interface ExecutionStep {
    nodeId: string;
    nodeType: string;
    nodeLabel: string;
    timestamp: string;
    duration: number;
    status: 'success' | 'error' | 'escalated';
    data?: any;
}

interface WorkflowSimulatorProps {
    workflowId: string;
    nodes: any[];
    edges: any[];
}

export function WorkflowSimulator({ workflowId, nodes, edges }: WorkflowSimulatorProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [messages, setMessages] = useState<SimulationMessage[]>([]);
    const [executionPath, setExecutionPath] = useState<ExecutionStep[]>([]);
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
    const [userInput, setUserInput] = useState('');
    const [testScenario, setTestScenario] = useState('custom');
    
    const startSimulation = async () => {
        setIsRunning(true);
        setMessages([]);
        setExecutionPath([]);
        setCurrentNodeId(null);
        
        try {
            // Call simulation API
            const response = await fetch(`/api/workflows/${workflowId}/simulate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scenario: testScenario,
                    userInputs: messages.filter(m => m.role === 'user').map(m => m.content),
                }),
            });
            
            const result = await response.json();
            
            // Process simulation results
            if (result.executionPath) {
                const steps: ExecutionStep[] = result.executionPath.map((nodeId: string, index: number) => {
                    const node = nodes.find(n => n.id === nodeId);
                    return {
                        nodeId,
                        nodeType: node?.type || 'unknown',
                        nodeLabel: node?.data?.label || nodeId,
                        timestamp: new Date().toISOString(),
                        duration: 100 + Math.random() * 400, // Mock duration
                        status: 'success' as const,
                        data: result.nodeResults?.[nodeId],
                    };
                });
                
                setExecutionPath(steps);
                
                // Set current node to last in path
                if (steps.length > 0) {
                    setCurrentNodeId(steps[steps.length - 1].nodeId);
                }
            }
            
            // Add system message
            setMessages(prev => [...prev, {
                role: 'system',
                content: `Simulation completed: ${result.executionPath?.length || 0} nodes executed`,
                timestamp: new Date().toISOString(),
            }]);
            
        } catch (error) {
            console.error('Simulation error:', error);
            setMessages(prev => [...prev, {
                role: 'system',
                content: 'Simulation failed: ' + (error as Error).message,
                timestamp: new Date().toISOString(),
            }]);
        } finally {
            setIsRunning(false);
        }
    };
    
    const stopSimulation = () => {
        setIsRunning(false);
        setMessages(prev => [...prev, {
            role: 'system',
            content: 'Simulation stopped by user',
            timestamp: new Date().toISOString(),
        }]);
    };
    
    const sendMessage = () => {
        if (!userInput.trim()) return;
        
        // Add user message
        setMessages(prev => [...prev, {
            role: 'user',
            content: userInput,
            timestamp: new Date().toISOString(),
        }]);
        
        // Simulate AI response (in production, this would call the API)
        setTimeout(() => {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'This is a simulated response. In production, the workflow engine would execute and respond here.',
                timestamp: new Date().toISOString(),
            }]);
        }, 500);
        
        setUserInput('');
    };
    
    const loadTestScenario = (scenario: string) => {
        setTestScenario(scenario);
        setMessages([]);
        setExecutionPath([]);
        
        const scenarios: Record<string, SimulationMessage[]> = {
            'scheduling': [
                { role: 'user', content: 'I need to schedule an appointment', timestamp: new Date().toISOString() },
                { role: 'assistant', content: 'I can help you with that. What type of appointment do you need?', timestamp: new Date().toISOString() },
                { role: 'user', content: 'I need to see a cardiologist', timestamp: new Date().toISOString() },
            ],
            'emergency': [
                { role: 'user', content: 'I have severe chest pain', timestamp: new Date().toISOString() },
                { role: 'assistant', content: 'I understand this is urgent. Let me connect you with emergency services immediately.', timestamp: new Date().toISOString() },
            ],
            'billing': [
                { role: 'user', content: 'I have a question about my bill', timestamp: new Date().toISOString() },
                { role: 'assistant', content: 'I can help with billing questions. Can you provide your account number?', timestamp: new Date().toISOString() },
            ],
        };
        
        if (scenarios[scenario]) {
            setMessages(scenarios[scenario]);
        }
    };
    
    return (
        <Card className="h-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Workflow Simulator</CardTitle>
                        <CardDescription>Test workflow with conversation inputs</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        {!isRunning ? (
                            <Button size="sm" onClick={startSimulation}>
                                <Play className="w-4 h-4 mr-2" />
                                Run
                            </Button>
                        ) : (
                            <Button size="sm" variant="destructive" onClick={stopSimulation}>
                                <StopCircle className="w-4 h-4 mr-2" />
                                Stop
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="conversation" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="conversation">Conversation</TabsTrigger>
                        <TabsTrigger value="execution">Execution</TabsTrigger>
                        <TabsTrigger value="state">State</TabsTrigger>
                    </TabsList>
                    
                    {/* Conversation Tab */}
                    <TabsContent value="conversation" className="space-y-3">
                        {/* Test Scenario Selector */}
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant={testScenario === 'custom' ? 'default' : 'outline'}
                                onClick={() => loadTestScenario('custom')}
                            >
                                Custom
                            </Button>
                            <Button
                                size="sm"
                                variant={testScenario === 'scheduling' ? 'default' : 'outline'}
                                onClick={() => loadTestScenario('scheduling')}
                            >
                                Scheduling
                            </Button>
                            <Button
                                size="sm"
                                variant={testScenario === 'emergency' ? 'default' : 'outline'}
                                onClick={() => loadTestScenario('emergency')}
                            >
                                Emergency
                            </Button>
                            <Button
                                size="sm"
                                variant={testScenario === 'billing' ? 'default' : 'outline'}
                                onClick={() => loadTestScenario('billing')}
                            >
                                Billing
                            </Button>
                        </div>
                        
                        {/* Message History */}
                        <ScrollArea className="h-[400px] border rounded-lg p-4">
                            {messages.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-sm text-muted-foreground">
                                        No messages yet. Start the simulation or type a message below.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {messages.map((msg, index) => (
                                        <div
                                            key={index}
                                            className={`flex gap-2 ${
                                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                                            }`}
                                        >
                                            {msg.role === 'assistant' && (
                                                <div className="p-2 rounded-full bg-purple-100">
                                                    <Bot className="w-4 h-4 text-purple-600" />
                                                </div>
                                            )}
                                            <div
                                                className={`max-w-[80%] rounded-lg p-3 ${
                                                    msg.role === 'user'
                                                        ? 'bg-primary text-primary-foreground'
                                                        : msg.role === 'system'
                                                        ? 'bg-muted text-muted-foreground italic'
                                                        : 'bg-secondary'
                                                }`}
                                            >
                                                <p className="text-sm">{msg.content}</p>
                                                <p className="text-[10px] opacity-70 mt-1">
                                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                                </p>
                                            </div>
                                            {msg.role === 'user' && (
                                                <div className="p-2 rounded-full bg-blue-100">
                                                    <User className="w-4 h-4 text-blue-600" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                        
                        {/* Input */}
                        <div className="flex gap-2">
                            <Input
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                placeholder="Type a test message..."
                                disabled={isRunning}
                            />
                            <Button size="icon" onClick={sendMessage} disabled={isRunning || !userInput.trim()}>
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </TabsContent>
                    
                    {/* Execution Path Tab */}
                    <TabsContent value="execution" className="space-y-3">
                        <ScrollArea className="h-[460px]">
                            {executionPath.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-sm text-muted-foreground">
                                        Run a simulation to see the execution path
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {executionPath.map((step, index) => (
                                        <div key={index} className="border rounded-lg p-3">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                                        step.status === 'success' ? 'bg-green-100 text-green-700' :
                                                        step.status === 'escalated' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-sm">{step.nodeLabel}</div>
                                                        <div className="text-xs text-muted-foreground">{step.nodeType}</div>
                                                    </div>
                                                </div>
                                                <Badge
                                                    variant={
                                                        step.status === 'success' ? 'outline' :
                                                        step.status === 'escalated' ? 'default' :
                                                        'destructive'
                                                    }
                                                    className="text-[10px]"
                                                >
                                                    {step.status}
                                                </Badge>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{step.duration}ms</span>
                                                </div>
                                                <div>{new Date(step.timestamp).toLocaleTimeString()}</div>
                                            </div>
                                            
                                            {step.data && Object.keys(step.data).length > 0 && (
                                                <div className="mt-2 pt-2 border-t">
                                                    <pre className="text-[10px] font-mono bg-muted p-2 rounded overflow-x-auto">
                                                        {JSON.stringify(step.data, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                            
                                            {index < executionPath.length - 1 && (
                                                <div className="flex justify-center mt-2">
                                                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                    
                    {/* State Inspector Tab */}
                    <TabsContent value="state" className="space-y-3">
                        <ScrollArea className="h-[460px]">
                            {currentNodeId ? (
                                <div className="space-y-4">
                                    {/* Current Node */}
                                    <div className="border rounded-lg p-4 bg-primary/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge>Current Node</Badge>
                                            <span className="font-semibold text-sm">{currentNodeId}</span>
                                        </div>
                                        <pre className="text-xs font-mono bg-background p-3 rounded overflow-x-auto">
                                            {JSON.stringify(
                                                nodes.find(n => n.id === currentNodeId)?.data || {},
                                                null,
                                                2
                                            )}
                                        </pre>
                                    </div>
                                    
                                    {/* Execution Stats */}
                                    <div>
                                        <h4 className="font-semibold text-sm mb-2">Execution Statistics</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="border rounded p-2">
                                                <div className="text-xs text-muted-foreground">Total Nodes</div>
                                                <div className="text-lg font-bold">{executionPath.length}</div>
                                            </div>
                                            <div className="border rounded p-2">
                                                <div className="text-xs text-muted-foreground">Duration</div>
                                                <div className="text-lg font-bold">
                                                    {executionPath.reduce((sum, step) => sum + step.duration, 0)}ms
                                                </div>
                                            </div>
                                            <div className="border rounded p-2">
                                                <div className="text-xs text-muted-foreground">Success Rate</div>
                                                <div className="text-lg font-bold text-green-600">
                                                    {executionPath.length > 0
                                                        ? Math.round((executionPath.filter(s => s.status === 'success').length / executionPath.length) * 100)
                                                        : 0}%
                                                </div>
                                            </div>
                                            <div className="border rounded p-2">
                                                <div className="text-xs text-muted-foreground">Escalations</div>
                                                <div className="text-lg font-bold text-blue-600">
                                                    {executionPath.filter(s => s.status === 'escalated').length}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Collected Fields */}
                                    <div>
                                        <h4 className="font-semibold text-sm mb-2">Collected Fields</h4>
                                        <div className="border rounded-lg p-3 bg-muted/30">
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Patient Name:</span>
                                                    <span className="font-medium">John Doe</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Phone:</span>
                                                    <span className="font-medium">+1 555-1234</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Intent:</span>
                                                    <Badge variant="outline" className="text-[10px]">scheduling</Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-sm text-muted-foreground">
                                        Run a simulation to inspect state
                                    </p>
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
