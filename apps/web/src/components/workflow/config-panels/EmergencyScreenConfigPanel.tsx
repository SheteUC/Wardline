"use client";

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Siren } from 'lucide-react';
import { EmergencyScreenNodeData } from '../nodes/EmergencyScreenNode';

interface EmergencyScreenConfigPanelProps {
    data: EmergencyScreenNodeData;
    onChange: (data: Partial<EmergencyScreenNodeData>) => void;
}

const DEFAULT_KEYWORDS = [
    'chest pain', "can't breathe", 'difficulty breathing', 'stroke', 'heart attack',
    'unconscious', 'not breathing', 'overdose', 'suicide', 'kill myself',
    'severe bleeding', 'allergic reaction', 'anaphylaxis',
];

export function EmergencyScreenConfigPanel({ data, onChange }: EmergencyScreenConfigPanelProps) {
    const keywords = data.keywords ?? DEFAULT_KEYWORDS;
    const keywordsText = keywords.join('\n');

    const handleKeywordsChange = (text: string) => {
        const parsed = text
            .split('\n')
            .map((k) => k.trim())
            .filter(Boolean);
        onChange({ keywords: parsed });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-red-100">
                    <Siren className="w-4 h-4 text-red-600" />
                </div>
                <div>
                    <h3 className="font-semibold">Emergency Screen</h3>
                    <p className="text-xs text-muted-foreground">
                        Detect life-threatening keywords and escalate immediately
                    </p>
                </div>
            </div>

            <div>
                <Label htmlFor="es-label">Node Label</Label>
                <Input
                    id="es-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="Emergency Screening"
                    className="mt-1"
                />
            </div>

            <div>
                <Label>Emergency Keywords</Label>
                <p className="text-xs text-muted-foreground mb-1">One keyword or phrase per line</p>
                <Textarea
                    value={keywordsText}
                    onChange={(e) => handleKeywordsChange(e.target.value)}
                    rows={8}
                    className="text-sm font-mono"
                    placeholder={"chest pain\ncan't breathe\nstroke"}
                />
                <p className="text-xs text-muted-foreground mt-1">
                    {keywords.length} keyword{keywords.length !== 1 ? 's' : ''} configured
                </p>
            </div>

            <div className="flex items-center gap-2 p-3 border rounded-lg bg-red-50">
                <Checkbox
                    id="es-auto-escalate"
                    checked={data.autoEscalate !== false}
                    onCheckedChange={(checked) => onChange({ autoEscalate: !!checked })}
                />
                <div>
                    <label htmlFor="es-auto-escalate" className="text-sm font-medium cursor-pointer">
                        Auto-escalate on detection
                    </label>
                    <p className="text-xs text-muted-foreground">
                        Immediately route to emergency queue when a keyword is detected
                    </p>
                </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                <strong>Important:</strong> This node terminates the normal call flow when an
                emergency keyword is detected, triggering an immediate supervisor alert and
                escalation regardless of other workflow configuration.
            </div>
        </div>
    );
}
