"use client";

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IntegrationNodeData } from '../nodes/IntegrationNode';
import { Plug, Code, Calendar, Shield, Pill, FileText, Settings2 } from 'lucide-react';

// Sub-workflow templates for common integrations
const SUB_WORKFLOW_TEMPLATES = {
    appointment_scheduling: {
        name: 'Appointment Scheduling',
        icon: Calendar,
        presets: [
            {
                id: 'epic',
                name: 'Epic MyChart',
                description: 'Integration with Epic scheduling system',
                config: {
                    endpointUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Appointment',
                    method: 'POST',
                    authType: 'oauth2',
                    requiredFields: ['patient_id', 'provider_id', 'date_time', 'appointment_type'],
                }
            },
            {
                id: 'cerner',
                name: 'Cerner Scheduling',
                description: 'Integration with Cerner scheduling system',
                config: {
                    endpointUrl: 'https://fhir.cerner.com/r4/Appointment',
                    method: 'POST',
                    authType: 'oauth2',
                    requiredFields: ['patient_id', 'practitioner_id', 'start_time', 'end_time'],
                }
            },
            {
                id: 'custom',
                name: 'Custom Scheduling System',
                description: 'Custom appointment scheduling API',
                config: {
                    endpointUrl: '',
                    method: 'POST',
                    authType: 'api_key',
                    requiredFields: [],
                }
            }
        ]
    },
    insurance_verification: {
        name: 'Insurance Verification',
        icon: Shield,
        presets: [
            {
                id: 'availity',
                name: 'Availity Eligibility',
                description: 'Real-time eligibility verification via Availity',
                config: {
                    endpointUrl: 'https://api.availity.com/v1/coverages',
                    method: 'POST',
                    authType: 'oauth2',
                    requiredFields: ['member_id', 'provider_npi', 'date_of_service'],
                }
            },
            {
                id: 'change_healthcare',
                name: 'Change Healthcare',
                description: 'Insurance verification through Change Healthcare',
                config: {
                    endpointUrl: 'https://api.changehealthcare.com/eligibility/v2',
                    method: 'POST',
                    authType: 'api_key',
                    requiredFields: ['subscriber_id', 'provider_id', 'service_date'],
                }
            },
            {
                id: 'custom',
                name: 'Custom Insurance API',
                description: 'Custom insurance verification API',
                config: {
                    endpointUrl: '',
                    method: 'POST',
                    authType: 'api_key',
                    requiredFields: [],
                }
            }
        ]
    },
    prescription_refill: {
        name: 'Prescription Refills',
        icon: Pill,
        presets: [
            {
                id: 'surescripts',
                name: 'Surescripts',
                description: 'E-prescription network for refills',
                config: {
                    endpointUrl: 'https://api.surescripts.com/refill-request',
                    method: 'POST',
                    authType: 'certificate',
                    requiredFields: ['patient_id', 'prescription_id', 'pharmacy_ncpdp'],
                }
            },
            {
                id: 'custom',
                name: 'Custom Pharmacy System',
                description: 'Custom pharmacy integration',
                config: {
                    endpointUrl: '',
                    method: 'POST',
                    authType: 'api_key',
                    requiredFields: [],
                }
            }
        ]
    },
    lab_results: {
        name: 'Lab Results',
        icon: FileText,
        presets: [
            {
                id: 'hl7',
                name: 'HL7 FHIR',
                description: 'Standard HL7 FHIR lab results endpoint',
                config: {
                    endpointUrl: 'https://fhir.example.com/DiagnosticReport',
                    method: 'GET',
                    authType: 'oauth2',
                    requiredFields: ['patient_id'],
                }
            },
            {
                id: 'custom',
                name: 'Custom Lab System',
                description: 'Custom lab results integration',
                config: {
                    endpointUrl: '',
                    method: 'GET',
                    authType: 'api_key',
                    requiredFields: [],
                }
            }
        ]
    }
};

interface IntegrationConfigPanelProps {
    data: IntegrationNodeData;
    onChange: (data: Partial<IntegrationNodeData>) => void;
}

export function IntegrationConfigPanel({ data, onChange }: IntegrationConfigPanelProps) {
    const [selectedTemplate, setSelectedTemplate] = useState<string>(data.integrationType || 'external_api');
    const [selectedPreset, setSelectedPreset] = useState<string>(data.preset || 'custom');
    const [activeTab, setActiveTab] = useState<string>('basic');

    const handleTemplateChange = (templateType: string) => {
        setSelectedTemplate(templateType);
        onChange({ integrationType: templateType, preset: 'custom' });
        setSelectedPreset('custom');
    };

    const handlePresetChange = (presetId: string) => {
        setSelectedPreset(presetId);
        
        if (templateType && SUB_WORKFLOW_TEMPLATES[templateType as keyof typeof SUB_WORKFLOW_TEMPLATES]) {
            const template = SUB_WORKFLOW_TEMPLATES[templateType as keyof typeof SUB_WORKFLOW_TEMPLATES];
            const preset = template.presets.find(p => p.id === presetId);
            
            if (preset) {
                onChange({
                    preset: presetId,
                    endpointUrl: preset.config.endpointUrl,
                    method: preset.config.method as any,
                    authType: preset.config.authType,
                    requiredFields: preset.config.requiredFields,
                });
            }
        }
    };

    const templateType = selectedTemplate;
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-teal-100">
                    <Plug className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                    <h3 className="font-semibold">Integration & Sub-Workflows</h3>
                    <p className="text-xs text-muted-foreground">Configure integration or select sub-workflow template</p>
                </div>
            </div>

            {/* Label */}
            <div>
                <Label htmlFor="int-label">Node Label</Label>
                <Input
                    id="int-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="e.g., Appointment Booking"
                    className="mt-1"
                />
            </div>

            {/* Sub-Workflow Template Selection */}
            <div>
                <Label htmlFor="int-type">Sub-Workflow Type</Label>
                <Select
                    value={selectedTemplate}
                    onValueChange={handleTemplateChange}
                >
                    <SelectTrigger id="int-type" className="mt-1">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="appointment_scheduling">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Appointment Scheduling
                            </div>
                        </SelectItem>
                        <SelectItem value="insurance_verification">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                Insurance Verification
                            </div>
                        </SelectItem>
                        <SelectItem value="prescription_refill">
                            <div className="flex items-center gap-2">
                                <Pill className="w-4 h-4" />
                                Prescription Refills
                            </div>
                        </SelectItem>
                        <SelectItem value="lab_results">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Lab Results
                            </div>
                        </SelectItem>
                        <SelectItem value="external_api">
                            <div className="flex items-center gap-2">
                                <Code className="w-4 h-4" />
                                Custom External API
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Preset Selection (for sub-workflows) */}
            {templateType && templateType !== 'external_api' && SUB_WORKFLOW_TEMPLATES[templateType as keyof typeof SUB_WORKFLOW_TEMPLATES] && (
                <div>
                    <Label>System Preset</Label>
                    <div className="mt-2 space-y-2">
                        {SUB_WORKFLOW_TEMPLATES[templateType as keyof typeof SUB_WORKFLOW_TEMPLATES].presets.map((preset) => (
                            <button
                                key={preset.id}
                                onClick={() => handlePresetChange(preset.id)}
                                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                                    selectedPreset === preset.id
                                        ? 'border-teal-500 bg-teal-50'
                                        : 'border-border bg-card hover:border-teal-300'
                                }`}
                            >
                                <div className="font-medium text-sm">{preset.name}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{preset.description}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">Basic</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">

                    {/* HTTP Method */}
                    <div>
                        <Label htmlFor="int-method">HTTP Method</Label>
                        <Select
                            value={data.method || 'GET'}
                            onValueChange={(value: any) => onChange({ method: value })}
                        >
                            <SelectTrigger id="int-method" className="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="GET">GET - Retrieve data</SelectItem>
                                <SelectItem value="POST">POST - Create/Submit data</SelectItem>
                                <SelectItem value="PUT">PUT - Update data</SelectItem>
                                <SelectItem value="DELETE">DELETE - Remove data</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Endpoint URL */}
                    <div>
                        <Label htmlFor="int-url">Endpoint URL</Label>
                        <Input
                            id="int-url"
                            value={data.endpointUrl || ''}
                            onChange={(e) => onChange({ endpointUrl: e.target.value })}
                            placeholder="https://api.example.com/endpoint"
                            className="mt-1 font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Use {'{{'}{'}}'} for template variables: {'{{patient_name}}, {{phone}}'}
                        </p>
                    </div>

                    {/* Authentication Type */}
                    <div>
                        <Label htmlFor="int-auth">Authentication</Label>
                        <Select
                            value={data.authType || 'api_key'}
                            onValueChange={(value: any) => onChange({ authType: value })}
                        >
                            <SelectTrigger id="int-auth" className="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="api_key">API Key</SelectItem>
                                <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                                <SelectItem value="basic">Basic Auth</SelectItem>
                                <SelectItem value="certificate">Certificate</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Request Body Template (for POST/PUT) */}
                    {(data.method === 'POST' || data.method === 'PUT') && (
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <Label htmlFor="int-body">Request Body (JSON)</Label>
                                <Badge variant="outline" className="text-[10px]">
                                    <Code className="w-3 h-3 mr-1" />
                                    JSON
                                </Badge>
                            </div>
                            <Textarea
                                id="int-body"
                                value={data.bodyTemplate || ''}
                                onChange={(e) => onChange({ bodyTemplate: e.target.value })}
                                placeholder={'{\n  "patientName": "{{patient_name}}",\n  "phone": "{{phone}}"\n}'}
                                className="mt-1 font-mono text-xs min-h-[100px]"
                            />
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4 mt-4">

                    {/* Retry Configuration */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="int-retry">Retry Count</Label>
                            <Input
                                id="int-retry"
                                type="number"
                                value={data.retryCount || 3}
                                onChange={(e) => onChange({ retryCount: parseInt(e.target.value) || 3 })}
                                min={0}
                                max={5}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="int-timeout">Timeout (seconds)</Label>
                            <Input
                                id="int-timeout"
                                type="number"
                                value={data.timeoutSeconds || 10}
                                onChange={(e) => onChange({ timeoutSeconds: parseInt(e.target.value) || 10 })}
                                min={1}
                                max={60}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {/* Error Handling */}
                    <div>
                        <Label htmlFor="int-error">Error Handling</Label>
                        <Select
                            value={data.errorHandling || 'continue'}
                            onValueChange={(value: any) => onChange({ errorHandling: value })}
                        >
                            <SelectTrigger id="int-error" className="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="continue">
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium">Continue</span>
                                        <span className="text-xs text-muted-foreground">Proceed to next node despite error</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="escalate">
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium">Escalate</span>
                                        <span className="text-xs text-muted-foreground">Escalate to human agent on error</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="end">
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium">End Call</span>
                                        <span className="text-xs text-muted-foreground">Terminate workflow on error</span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Response Mapping */}
                    <div>
                        <Label>Response Mapping</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                            Map response fields to workflow variables
                        </p>
                        <Textarea
                            value={data.responseMapping ? JSON.stringify(data.responseMapping, null, 2) : ''}
                            onChange={(e) => {
                                try {
                                    const mapping = JSON.parse(e.target.value);
                                    onChange({ responseMapping: mapping });
                                } catch {
                                    // Invalid JSON, don't update
                                }
                            }}
                            placeholder={'{\n  "data.patientId": "patient_id",\n  "data.eligibility": "is_eligible"\n}'}
                            className="font-mono text-xs min-h-[80px]"
                        />
                    </div>
                </TabsContent>
            </Tabs>

            {/* Info */}
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                <p className="text-xs text-teal-800">
                    <strong>Sub-Workflow Configuration:</strong>
                </p>
                <p className="text-xs text-teal-700 mt-1">
                    Select a sub-workflow template for common integrations like appointment scheduling or insurance verification. 
                    Each template provides pre-configured settings for popular systems that you can customize for your hospital.
                </p>
            </div>
        </div>
    );
}
