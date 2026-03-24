"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Headphones,
    PhoneIncoming,
    PhoneOff,
    PhoneMissed,
    User,
    Clock,
    AlertTriangle,
    CheckCircle,
    Wifi,
    WifiOff,
    Send,
    RefreshCw,
} from 'lucide-react';
import {
    useAgentWebSocket,
    type AssignmentEvent,
    type TranscriptEvent,
    type EmergencyAlertEvent,
    type AgentStatus,
} from '@/lib/hooks/use-agent-websocket';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: AgentStatus) {
    switch (status) {
        case 'ONLINE': return 'bg-green-500';
        case 'BUSY': return 'bg-yellow-500';
        case 'BREAK': return 'bg-orange-400';
        case 'AWAY': return 'bg-muted-foreground';
        default: return 'bg-muted-foreground/70';
    }
}

function assignmentStatusBadge(status: string) {
    switch (status) {
        case 'ASSIGNED': return <Badge variant="default" className="text-[11px]">Incoming</Badge>;
        case 'ACCEPTED': return <Badge variant="default" className="bg-emerald-600 text-[11px] hover:bg-emerald-600">Active</Badge>;
        case 'COMPLETED': return <Badge variant="outline" className="text-[11px]">Done</Badge>;
        case 'ABANDONED': return <Badge variant="destructive" className="text-[11px]">Abandoned</Badge>;
        default: return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
    }
}

interface TranscriptLine {
    speaker: 'AI' | 'CALLER';
    text: string;
    timestamp: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AgentConsolePage() {
    const { user, isLoaded } = useUser();
    const agentId = (user?.publicMetadata?.agentId as string) || '';
    const userId = user?.id || '';

    // Guard: show setup instructions if agentId is not set
    if (isLoaded && !agentId) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center max-w-md space-y-3 p-6 border rounded-xl bg-muted/30">
                    <div className="w-14 h-14 mx-auto rounded-full bg-orange-100 flex items-center justify-center">
                        <AlertTriangle className="w-7 h-7 text-orange-500" />
                    </div>
                    <h2 className="text-lg font-semibold">Agent Profile Not Linked</h2>
                    <p className="text-sm text-muted-foreground">
                        Your account is not yet linked to an agent profile. Contact your
                        administrator to set up your agent account before using the Agent Console.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Administrators: create an agent record and link it to this Clerk user ID:{' '}
                        <code className="rounded-md bg-[var(--background)] px-1.5 py-0.5 font-mono text-foreground neo-inset">{userId || 'unknown'}</code>
                    </p>
                </div>
            </div>
        );
    }

    // Agent status
    const [agentStatus, setAgentStatusLocal] = useState<AgentStatus>('ONLINE');

    // Pending assignments (incoming)
    const [pendingAssignments, setPendingAssignments] = useState<AssignmentEvent[]>([]);

    // Active call (accepted assignment)
    const [activeAssignment, setActiveAssignment] = useState<AssignmentEvent | null>(null);

    // Live transcript for active call
    const [transcript, setTranscript] = useState<TranscriptLine[]>([]);

    // Emergency alerts
    const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlertEvent[]>([]);

    // Recent completed calls
    const [completedCalls, setCompletedCalls] = useState<AssignmentEvent[]>([]);

    const transcriptEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    // Assignment handlers
    const handleAssignmentNew = useCallback((assignment: AssignmentEvent) => {
        setPendingAssignments((prev) => {
            if (prev.some((a) => a.id === assignment.id)) return prev;
            return [assignment, ...prev];
        });
    }, []);

    const handleAssignmentStatusChanged = useCallback((assignment: AssignmentEvent) => {
        if (assignment.status === 'ACCEPTED') {
            setActiveAssignment(assignment);
            setPendingAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
            setTranscript([]);
        } else if (['COMPLETED', 'ABANDONED'].includes(assignment.status)) {
            if (activeAssignment?.id === assignment.id) {
                setCompletedCalls((prev) => [assignment, ...prev].slice(0, 20));
                setActiveAssignment(null);
                setTranscript([]);
            }
        }
    }, [activeAssignment]);

    const handleTranscriptUpdate = useCallback((update: TranscriptEvent) => {
        if (activeAssignment?.callId === update.callId) {
            setTranscript((prev) => {
                const newLines = update.segments.filter(
                    (seg) => !prev.some((l) => l.timestamp === seg.timestamp && l.text === seg.text),
                );
                return [...prev, ...newLines];
            });
        }
    }, [activeAssignment]);

    const handleEmergencyAlert = useCallback((alert: EmergencyAlertEvent) => {
        setEmergencyAlerts((prev) => [alert, ...prev].slice(0, 5));
    }, []);

    const { connected, setStatus, acceptAssignment, rejectAssignment, completeAssignment } =
        useAgentWebSocket({
            agentId,
            userId,
            onAssignmentNew: handleAssignmentNew,
            onAssignmentStatusChanged: handleAssignmentStatusChanged,
            onTranscriptUpdate: handleTranscriptUpdate,
            onEmergencyAlert: handleEmergencyAlert,
        });

    const handleStatusChange = (value: string) => {
        const s = value as AgentStatus;
        setAgentStatusLocal(s);
        setStatus(s);
    };

    const handleAccept = (assignmentId: string) => {
        acceptAssignment(assignmentId);
    };

    const handleReject = (assignmentId: string) => {
        rejectAssignment(assignmentId);
        setPendingAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    };

    const handleComplete = () => {
        if (!activeAssignment) return;
        completeAssignment(activeAssignment.id);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-[var(--background)] p-2.5 neo-inset">
                        <Headphones className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Agent Console</h1>
                        <p className="text-sm text-muted-foreground">Manage incoming calls and assignments</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Connection indicator */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {connected ? (
                            <><Wifi className="h-3.5 w-3.5 text-emerald-600" /> Connected</>
                        ) : (
                            <><WifiOff className="h-3.5 w-3.5 text-destructive" /> Disconnected</>
                        )}
                    </div>

                    {/* Status selector */}
                    <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${statusColor(agentStatus)}`} />
                        <Select value={agentStatus} onValueChange={handleStatusChange}>
                            <SelectTrigger className="w-32 h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ONLINE">Online</SelectItem>
                                <SelectItem value="BUSY">Busy</SelectItem>
                                <SelectItem value="BREAK">On Break</SelectItem>
                                <SelectItem value="AWAY">Away</SelectItem>
                                <SelectItem value="OFFLINE">Offline</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Emergency Alerts Banner */}
            {emergencyAlerts.length > 0 && (
                <div className="rounded-2xl border-0 bg-red-500/12 p-4 neo-inset ring-2 ring-red-500/25">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-red-950">Emergency alert</p>
                            <p className="mt-0.5 text-xs text-red-900">{emergencyAlerts[0].message}</p>
                            <p className="mt-0.5 text-xs text-red-800">
                                Keywords: {emergencyAlerts[0].keywords.join(', ')}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 h-7"
                            onClick={() => setEmergencyAlerts((prev) => prev.slice(1))}
                        >
                            Dismiss
                        </Button>
                    </div>
                </div>
            )}

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Pending Queue */}
                <Card className="lg:col-span-1 border-0 shadow-none">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <PhoneIncoming className="w-4 h-4" />
                                Incoming Queue
                            </CardTitle>
                            {pendingAssignments.length > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                    {pendingAssignments.length}
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-80">
                            {pendingAssignments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-center">
                                    <CheckCircle className="w-8 h-8 text-muted-foreground/40 mb-2" />
                                    <p className="text-sm text-muted-foreground">No pending calls</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        New assignments will appear here
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3 pr-2">
                                    {pendingAssignments.map((assignment) => (
                                        <div
                                            key={assignment.id}
                                            className="space-y-2 rounded-2xl bg-[var(--background)] p-3 neo-inset"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium truncate">
                                                        {assignment.call?.callerPhone || 'Unknown Caller'}
                                                    </p>
                                                    {assignment.call?.detectedIntent && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {assignment.call.detectedIntent}
                                                        </p>
                                                    )}
                                                </div>
                                                {assignment.call?.isEmergency && (
                                                    <Badge variant="destructive" className="text-[10px] shrink-0">
                                                        EMERGENCY
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="filled"
                                                    className="h-7 flex-1 text-xs"
                                                    onClick={() => handleAccept(assignment.id)}
                                                    disabled={!!activeAssignment}
                                                >
                                                    Accept
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs"
                                                    onClick={() => handleReject(assignment.id)}
                                                >
                                                    Reject
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Center/Right: Active Call */}
                <Card className="lg:col-span-2 border-0 shadow-none">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Headphones className="w-4 h-4" />
                                Active Call
                            </CardTitle>
                            {activeAssignment && (
                                <div className="flex items-center gap-2">
                                    {assignmentStatusBadge(activeAssignment.status)}
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-7 text-xs gap-1"
                                        onClick={handleComplete}
                                    >
                                        <PhoneOff className="w-3.5 h-3.5" />
                                        End Call
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {activeAssignment ? (
                            <div className="space-y-4">
                                {/* Caller Info */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl bg-[var(--background)] p-3 neo-inset">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                            <User className="w-3 h-3" /> Caller
                                        </div>
                                        <p className="text-sm font-medium">
                                            {activeAssignment.call?.callerPhone || 'Unknown'}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-[var(--background)] p-3 neo-inset">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                            <Clock className="w-3 h-3" /> Intent
                                        </div>
                                        <p className="text-sm font-medium">
                                            {activeAssignment.call?.detectedIntent || '—'}
                                        </p>
                                    </div>
                                </div>

                                <Separator />

                                {/* Live Transcript */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Live Transcript
                                        </p>
                                        <div className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                                            Live
                                        </div>
                                    </div>
                                    <ScrollArea className="h-52 rounded-2xl bg-[var(--background)] p-3 neo-inset">
                                        {transcript.length === 0 ? (
                                            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                                                Waiting for conversation...
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {transcript.map((line, i) => (
                                                    <div
                                                        key={i}
                                                        className={`flex gap-2 ${line.speaker === 'CALLER' ? 'justify-start' : 'justify-end'}`}
                                                    >
                                                        <div
                                                            className={cn(
                                                                'max-w-[80%] rounded-2xl px-3 py-1.5 text-sm neo-raised-sm',
                                                                line.speaker === 'CALLER'
                                                                    ? 'bg-[var(--background)] text-foreground'
                                                                    : 'bg-primary/12 text-foreground',
                                                            )}
                                                        >
                                                            <span className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                                                                {line.speaker === 'CALLER' ? 'Caller' : 'AI'}
                                                            </span>
                                                            {line.text}
                                                        </div>
                                                    </div>
                                                ))}
                                                <div ref={transcriptEndRef} />
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-center">
                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--background)] neo-inset">
                                    <PhoneMissed className="h-8 w-8 text-muted-foreground/40" />
                                </div>
                                <p className="text-sm font-medium text-muted-foreground">No active call</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Accept an assignment from the queue to start
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Recent Completed Calls */}
            {completedCalls.length > 0 && (
                <Card className="border-0 shadow-none">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <RefreshCw className="w-4 h-4" />
                            Recent Completed Calls
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {completedCalls.map((call) => (
                                <div
                                    key={call.id}
                                    className="flex items-center justify-between rounded-2xl bg-[var(--background)] px-3 py-2 text-sm neo-inset"
                                >
                                    <div className="flex items-center gap-3">
                                        <User className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-medium">
                                            {call.call?.callerPhone || call.callId}
                                        </span>
                                        {call.call?.detectedIntent && (
                                            <span className="text-xs text-muted-foreground">
                                                {call.call.detectedIntent}
                                            </span>
                                        )}
                                    </div>
                                    {assignmentStatusBadge(call.status)}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
