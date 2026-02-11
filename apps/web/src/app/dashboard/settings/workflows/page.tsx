"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    Save, Bot, Shield, Zap, Clock, TrendingUp,
    Calendar, DollarSign, Pill, Building2, Megaphone
} from 'lucide-react';
import { useHospital } from '@/lib/hospital-context';

export default function WorkflowSettingsPage() {
    const { hospitalId } = useHospital();
    const [hasChanges, setHasChanges] = useState(false);
    
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
        try {
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
                // Show success message
            }
        } catch (error) {
            console.error('Save error:', error);
        }
    };
    
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Workflow Configuration</h1>
                    <p className="text-muted-foreground">
                        Configure AI behavior, modules, and escalation rules
                    </p>
                </div>
                <Button onClick={handleSave} disabled={!hasChanges}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                </Button>
            </div>
            
            {hasChanges && (
                <Card className="border-amber-300 bg-amber-50">
                    <CardContent className="py-3">
                        <p className="text-sm text-amber-800">
                            You have unsaved changes. Click "Save Changes" to apply them.
                        </p>
                    </CardContent>
                </Card>
            )}
            
            <Tabs defaultValue="modules" className="w-full">
                <TabsList>
                    <TabsTrigger value="modules">Enabled Modules</TabsTrigger>
                    <TabsTrigger value="prompts">Custom Prompts</TabsTrigger>
                    <TabsTrigger value="escalation">Escalation Rules</TabsTrigger>
                    <TabsTrigger value="tools">AI Tools</TabsTrigger>
                </TabsList>
                
                {/* Modules Tab */}
                <TabsContent value="modules" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Enabled Modules</CardTitle>
                            <CardDescription>
                                Control which features are available for this hospital
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                                            Check plan acceptance and eligibility
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
                                        <div className="font-semibold">Billing Inquiries</div>
                                        <p className="text-sm text-muted-foreground">
                                            Answer billing and payment questions
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
                                            Handle medication refill requests
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
                                    <div className="p-2 rounded bg-teal-100">
                                        <Building2 className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">Department Directory</div>
                                        <p className="text-sm text-muted-foreground">
                                            Provide department information and routing
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
                                        <div className="font-semibold">Marketing Events</div>
                                        <p className="text-sm text-muted-foreground">
                                            Event information and registration
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={modules.events}
                                    onCheckedChange={() => toggleModule('events')}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                {/* Custom Prompts Tab */}
                <TabsContent value="prompts" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Custom Prompts</CardTitle>
                            <CardDescription>
                                Customize AI greetings and closing messages
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="custom-greeting">Custom Greeting</Label>
                                <Textarea
                                    id="custom-greeting"
                                    value={customGreeting}
                                    onChange={(e) => {
                                        setCustomGreeting(e.target.value);
                                        setHasChanges(true);
                                    }}
                                    placeholder="Thank you for calling [Hospital Name]. My name is [AI Name], how can I help you today?"
                                    className="mt-2 min-h-[100px]"
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                    Leave blank to use default greeting
                                </p>
                            </div>
                            
                            <Separator />
                            
                            <div>
                                <Label htmlFor="custom-closing">Custom Closing</Label>
                                <Textarea
                                    id="custom-closing"
                                    value={customClosing}
                                    onChange={(e) => {
                                        setCustomClosing(e.target.value);
                                        setHasChanges(true);
                                    }}
                                    placeholder="Thank you for calling [Hospital Name]. Have a great day!"
                                    className="mt-2 min-h-[100px]"
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                    Leave blank to use default closing
                                </p>
                            </div>
                            
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-xs text-blue-800">
                                    <strong>Template Variables:</strong> Use [Hospital Name] and [AI Name] 
                                    which will be automatically replaced with actual values.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                {/* Escalation Rules Tab */}
                <TabsContent value="escalation" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Escalation Rules</CardTitle>
                            <CardDescription>
                                Configure when AI should escalate to human agents
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <Label htmlFor="max-attempts">Maximum AI Attempts</Label>
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
                                    className="mt-2"
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                    Number of times AI can attempt to handle a request before escalating (default: 3)
                                </p>
                            </div>
                            
                            <Separator />
                            
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label>Sentiment Threshold: {sentimentThreshold.toFixed(1)}</Label>
                                    <Badge variant="outline">
                                        {sentimentThreshold < 0.3 ? 'Sensitive' : 
                                         sentimentThreshold > 0.5 ? 'Tolerant' : 'Balanced'}
                                    </Badge>
                                </div>
                                <input
                                    type="range"
                                    value={sentimentThreshold}
                                    onChange={(e) => {
                                        setSentimentThreshold(parseFloat(e.target.value));
                                        setHasChanges(true);
                                    }}
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                    <span>Escalate quickly (0.0)</span>
                                    <span>More patient (1.0)</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Escalate when caller sentiment score falls below this threshold
                                </p>
                            </div>
                            
                            <Separator />
                            
                            <div>
                                <Label htmlFor="auto-escalate-time">Auto-Escalate After (minutes)</Label>
                                <Input
                                    id="auto-escalate-time"
                                    type="number"
                                    value={autoEscalateMinutes}
                                    onChange={(e) => {
                                        setAutoEscalateMinutes(parseInt(e.target.value) || 5);
                                        setHasChanges(true);
                                    }}
                                    min={1}
                                    max={30}
                                    className="mt-2"
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                    Automatically escalate calls that exceed this duration (default: 5 minutes)
                                </p>
                            </div>
                            
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <TrendingUp className="w-5 h-5 text-amber-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-amber-900">Escalation Best Practices</p>
                                        <ul className="text-xs text-amber-800 mt-2 space-y-1 ml-4 list-disc">
                                            <li>Lower thresholds = more escalations = better patient experience but higher cost</li>
                                            <li>Higher thresholds = fewer escalations = lower cost but potential frustration</li>
                                            <li>Recommended starting point: 3 attempts, 0.3 sentiment, 5 minutes</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                {/* Tools Tab */}
                <TabsContent value="tools" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>AI Tools Configuration</CardTitle>
                            <CardDescription>
                                Enable or disable specific tools the AI can use
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <div className="font-semibold flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-blue-600" />
                                        Appointment Scheduling
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Book, cancel, and reschedule appointments
                                    </p>
                                </div>
                                <Switch
                                    checked={tools.scheduling.enabled}
                                    onCheckedChange={() => toggleTool('scheduling')}
                                />
                            </div>
                            
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <div className="font-semibold flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-purple-600" />
                                        Insurance Verification
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Verify insurance plans and eligibility
                                    </p>
                                </div>
                                <Switch
                                    checked={tools.insurance.enabled}
                                    onCheckedChange={() => toggleTool('insurance')}
                                />
                            </div>
                            
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <div className="font-semibold flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-teal-600" />
                                        Department Lookup
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Find department information and contact details
                                    </p>
                                </div>
                                <Switch
                                    checked={tools.departments.enabled}
                                    onCheckedChange={() => toggleTool('departments')}
                                />
                            </div>
                            
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <div className="font-semibold flex items-center gap-2">
                                        <Pill className="w-4 h-4 text-orange-600" />
                                        Prescription Refills
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Handle medication refill requests
                                    </p>
                                </div>
                                <Switch
                                    checked={tools.prescriptions.enabled}
                                    onCheckedChange={() => toggleTool('prescriptions')}
                                />
                            </div>
                            
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <div className="font-semibold flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-green-600" />
                                        Billing Tool
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Access billing information and statements
                                    </p>
                                </div>
                                <Switch
                                    checked={tools.billing.enabled}
                                    onCheckedChange={() => toggleTool('billing')}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
