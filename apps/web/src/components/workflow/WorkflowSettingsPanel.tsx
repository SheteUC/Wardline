"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Save, X, Calendar, DollarSign, Pill, Building2, Megaphone,
    Shield, Clock, TrendingUp
} from 'lucide-react';
import { useHospital } from '@/lib/hospital-context';

interface WorkflowSettingsPanelProps {
    onClose: () => void;
}

export function WorkflowSettingsPanel({ onClose }: WorkflowSettingsPanelProps) {
    const { hospitalId } = useHospital();
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Module toggles
    const [modules, setModules] = useState({
        billing: true,
        insurance: true,
        appointments: true,
        prescriptions: true,
        departments: true,
        events: false,
    });
    
    // Custom prompts
    const [customGreeting, setCustomGreeting] = useState('');
    const [customClosing, setCustomClosing] = useState('');
    
    // Escalation rules
    const [maxAIAttempts, setMaxAIAttempts] = useState(3);
    const [sentimentThreshold, setSentimentThreshold] = useState(0.3);
    const [autoEscalateMinutes, setAutoEscalateMinutes] = useState(5);
    
    // Tools
    const [tools, setTools] = useState({
        scheduling: { enabled: true },
        insurance: { enabled: true },
        departments: { enabled: true },
        prescriptions: { enabled: false },
        billing: { enabled: false },
    });
    
    const toggleModule = (module: keyof typeof modules) => {
        setModules(prev => ({ ...prev, [module]: !prev[module] }));
        setHasChanges(true);
    };
    
    const toggleTool = (tool: keyof typeof tools) => {
        setTools(prev => ({
            ...prev,
            [tool]: { ...prev[tool], enabled: !prev[tool].enabled }
        }));
        setHasChanges(true);
    };
    
    const handleSave = async () => {
        if (!hospitalId) return;
        
        try {
            setIsSaving(true);
            const response = await fetch(`/api/hospitals/${hospitalId}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabledModules: modules,
                    customGreeting,
                    customClosing,
                    escalationRules: {
                        maxAIAttempts,
                        sentimentThreshold,
                        autoEscalateAfterMinutes: autoEscalateMinutes,
                    },
                    tools,
                }),
            });
            
            if (response.ok) {
                setHasChanges(false);
                alert('Settings saved successfully!');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save settings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
                <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Workflow Settings</CardTitle>
                            <CardDescription>
                                Configure AI behavior, modules, and escalation rules
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleSave} disabled={!hasChanges || isSaving} size="sm">
                                <Save className="h-4 w-4 mr-2" />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button onClick={onClose} variant="ghost" size="icon">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    {hasChanges && (
                        <div className="mt-3 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                            You have unsaved changes. Click "Save Changes" to apply them.
                        </div>
                    )}
                </CardHeader>
                
                <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full px-6 py-4">
                        <Tabs defaultValue="modules" className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="modules">Modules</TabsTrigger>
                                <TabsTrigger value="prompts">Prompts</TabsTrigger>
                                <TabsTrigger value="escalation">Escalation</TabsTrigger>
                                <TabsTrigger value="tools">AI Tools</TabsTrigger>
                            </TabsList>
                            
                            {/* Modules Tab */}
                            <TabsContent value="modules" className="space-y-4 mt-4">
                                <div className="space-y-4">
                                    {/* Appointments */}
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded bg-blue-100">
                                                <Calendar className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <div className="font-semibold">Appointments</div>
                                                <p className="text-sm text-muted-foreground">
                                                    Schedule, reschedule, and cancel appointments
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={modules.appointments}
                                            onCheckedChange={() => toggleModule('appointments')}
                                        />
                                    </div>

                                    {/* Insurance */}
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded bg-purple-100">
                                                <Shield className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <div className="font-semibold">Insurance Verification</div>
                                                <p className="text-sm text-muted-foreground">
                                                    Check insurance eligibility and coverage
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={modules.insurance}
                                            onCheckedChange={() => toggleModule('insurance')}
                                        />
                                    </div>

                                    {/* Billing */}
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded bg-green-100">
                                                <DollarSign className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div>
                                                <div className="font-semibold">Billing & Payments</div>
                                                <p className="text-sm text-muted-foreground">
                                                    Answer billing questions and process payments
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={modules.billing}
                                            onCheckedChange={() => toggleModule('billing')}
                                        />
                                    </div>

                                    {/* Prescriptions */}
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded bg-orange-100">
                                                <Pill className="w-5 h-5 text-orange-600" />
                                            </div>
                                            <div>
                                                <div className="font-semibold">Prescription Refills</div>
                                                <p className="text-sm text-muted-foreground">
                                                    Process prescription refill requests
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={modules.prescriptions}
                                            onCheckedChange={() => toggleModule('prescriptions')}
                                        />
                                    </div>

                                    {/* Departments */}
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded bg-indigo-100">
                                                <Building2 className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <div>
                                                <div className="font-semibold">Department Routing</div>
                                                <p className="text-sm text-muted-foreground">
                                                    Route calls to appropriate departments
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={modules.departments}
                                            onCheckedChange={() => toggleModule('departments')}
                                        />
                                    </div>

                                    {/* Events */}
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded bg-pink-100">
                                                <Megaphone className="w-5 h-5 text-pink-600" />
                                            </div>
                                            <div>
                                                <div className="font-semibold">Events & Campaigns</div>
                                                <p className="text-sm text-muted-foreground">
                                                    Handle event registrations and campaigns
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={modules.events}
                                            onCheckedChange={() => toggleModule('events')}
                                        />
                                    </div>
                                </div>
                            </TabsContent>
                            
                            {/* Prompts Tab */}
                            <TabsContent value="prompts" className="space-y-4 mt-4">
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="greeting">Custom Greeting</Label>
                                        <Textarea
                                            id="greeting"
                                            value={customGreeting}
                                            onChange={(e) => {
                                                setCustomGreeting(e.target.value);
                                                setHasChanges(true);
                                            }}
                                            placeholder="Thank you for calling [Hospital Name]. I am [AI Name], your AI assistant..."
                                            className="mt-1 min-h-[100px]"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Use [Hospital Name] and [AI Name] as placeholders
                                        </p>
                                    </div>
                                    
                                    <div>
                                        <Label htmlFor="closing">Custom Closing</Label>
                                        <Textarea
                                            id="closing"
                                            value={customClosing}
                                            onChange={(e) => {
                                                setCustomClosing(e.target.value);
                                                setHasChanges(true);
                                            }}
                                            placeholder="Thank you for calling [Hospital Name]. Have a great day!"
                                            className="mt-1 min-h-[100px]"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Use [Hospital Name] as placeholder
                                        </p>
                                    </div>
                                </div>
                            </TabsContent>
                            
                            {/* Escalation Tab */}
                            <TabsContent value="escalation" className="space-y-4 mt-4">
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="max-attempts">Max AI Conversation Attempts</Label>
                                        <Input
                                            id="max-attempts"
                                            type="number"
                                            value={maxAIAttempts}
                                            onChange={(e) => {
                                                setMaxAIAttempts(parseInt(e.target.value) || 3);
                                                setHasChanges(true);
                                            }}
                                            min={1}
                                            max={10}
                                            className="mt-1"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Number of times AI will attempt to resolve before escalating
                                        </p>
                                    </div>
                                    
                                    <div>
                                        <Label htmlFor="sentiment">Sentiment Threshold (0-1)</Label>
                                        <Input
                                            id="sentiment"
                                            type="number"
                                            step="0.1"
                                            value={sentimentThreshold}
                                            onChange={(e) => {
                                                setSentimentThreshold(parseFloat(e.target.value) || 0.3);
                                                setHasChanges(true);
                                            }}
                                            min={0}
                                            max={1}
                                            className="mt-1"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Escalate when sentiment falls below this threshold
                                        </p>
                                    </div>
                                    
                                    <div>
                                        <Label htmlFor="auto-escalate">Auto-Escalate After (minutes)</Label>
                                        <Input
                                            id="auto-escalate"
                                            type="number"
                                            value={autoEscalateMinutes}
                                            onChange={(e) => {
                                                setAutoEscalateMinutes(parseInt(e.target.value) || 5);
                                                setHasChanges(true);
                                            }}
                                            min={1}
                                            max={30}
                                            className="mt-1"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Automatically escalate calls longer than this duration
                                        </p>
                                    </div>
                                </div>
                            </TabsContent>
                            
                            {/* Tools Tab */}
                            <TabsContent value="tools" className="space-y-4 mt-4">
                                <div className="space-y-4">
                                    {Object.entries(tools).map(([toolName, toolConfig]) => (
                                        <div key={toolName} className="flex items-center justify-between p-4 border rounded-lg">
                                            <div>
                                                <div className="font-semibold capitalize">{toolName}</div>
                                                <p className="text-sm text-muted-foreground">
                                                    Enable AI access to {toolName} tools
                                                </p>
                                            </div>
                                            <Switch
                                                checked={toolConfig.enabled}
                                                onCheckedChange={() => toggleTool(toolName as keyof typeof tools)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
