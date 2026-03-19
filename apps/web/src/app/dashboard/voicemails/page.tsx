'use client';

import React, { useState } from 'react';
import { Card, Button } from '@/components/dashboard/shared';
import { Voicemail, Play, CheckCircle, Phone, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const TAG_LABEL: Record<string, string> = {
    SCHEDULING: 'Scheduling',
    BILLING: 'Billing',
    FAQ: 'FAQ',
    HUMAN_TRANSFER: 'Human Transfer',
    VOICEMAIL: 'Voicemail',
};

const MOCK_VOICEMAILS = [
    {
        id: 'vm-1',
        callerPhone: '(555) 112-6634',
        callerName: 'Sophia Lin',
        context: 'Appointment Scheduling — caller wanted to schedule a cleaning next week.',
        recordingUrl: '#',
        transcription: "Hi, I was calling to schedule a dental cleaning. I'm available Tuesday or Thursday afternoon. Please call me back at 555-112-6634. Thank you.",
        isListened: false,
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        tag: 'SCHEDULING',
        durationSecs: 18,
    },
    {
        id: 'vm-2',
        callerPhone: '(555) 340-7798',
        context: 'Billing — caller had question about their invoice.',
        recordingUrl: '#',
        transcription: "This is regarding my recent bill. I got a statement but I think there may be an error. Please call back.",
        isListened: true,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        tag: 'BILLING',
        durationSecs: 22,
    },
];

export default function VoicemailsPage() {
    const [voicemails, setVoicemails] = useState(MOCK_VOICEMAILS);
    const [playing, setPlaying] = useState<string | null>(null);

    const unlistened = voicemails.filter(v => !v.isListened).length;

    const markListened = (id: string) => {
        setVoicemails(prev => prev.map(v => v.id === id ? { ...v, isListened: true } : v));
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <Voicemail className="h-5 w-5 text-red-600" />
                </div>
                <div>
                    <p className="text-muted-foreground text-sm">
                        {unlistened > 0
                            ? `${unlistened} unlistened voicemail${unlistened > 1 ? 's' : ''}`
                            : 'All voicemails listened to'}
                    </p>
                </div>
            </div>

            {voicemails.length === 0 ? (
                <Card>
                    <div className="text-center py-16">
                        <Voicemail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="font-semibold text-foreground mb-2">No voicemails</h3>
                        <p className="text-muted-foreground text-sm">
                            Voicemails are recorded when no human is available during a transfer.
                        </p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-3">
                    {voicemails.map(vm => (
                        <Card
                            key={vm.id}
                            className={`transition-all ${!vm.isListened ? 'border-red-200 bg-red-50/40' : ''}`}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                                    vm.isListened ? 'bg-muted' : 'bg-red-100'
                                }`}>
                                    <Voicemail className={`h-5 w-5 ${vm.isListened ? 'text-muted-foreground' : 'text-red-600'}`} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-foreground text-sm">
                                                    {vm.callerName ?? vm.callerPhone}
                                                </span>
                                                {!vm.isListened && (
                                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">New</span>
                                                )}
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground`}>
                                                    {TAG_LABEL[vm.tag] ?? vm.tag}
                                                </span>
                                            </div>
                                            {vm.callerName && (
                                                <p className="text-xs text-muted-foreground">{vm.callerPhone}</p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(vm.createdAt), { addSuffix: true })}
                                            </p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                                <Clock className="h-3 w-3" />
                                                {vm.durationSecs}s
                                            </p>
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted-foreground mb-2">{vm.context}</p>

                                    {vm.transcription && (
                                        <div className="bg-background border border-border rounded-lg p-3 mb-3">
                                            <p className="text-xs text-foreground italic">"{vm.transcription}"</p>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            className="h-8 text-xs"
                                            onClick={() => {
                                                setPlaying(playing === vm.id ? null : vm.id);
                                                markListened(vm.id);
                                            }}
                                        >
                                            <Play className="h-3 w-3 mr-1" />
                                            {playing === vm.id ? 'Playing...' : 'Play'}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="h-8 text-xs"
                                            onClick={() => window.open(`tel:${vm.callerPhone}`)}
                                        >
                                            <Phone className="h-3 w-3 mr-1" />
                                            Call Back
                                        </Button>
                                        {!vm.isListened && (
                                            <Button
                                                variant="ghost"
                                                className="h-8 text-xs"
                                                onClick={() => markListened(vm.id)}
                                            >
                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                Mark Listened
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
