"use client";

import React, { useState, useEffect } from 'react';
import {
    ChevronRight, User, AlertTriangle, Download, Activity, BrainCircuit, 
    Play, Loader2, Phone, Clock, TrendingUp, TrendingDown, Minus, Shield
} from 'lucide-react';
import { Card, Badge, Button } from "@/components/dashboard/shared";
import Link from 'next/link';
import { useApiClient } from '@/lib/api-client';
import { useHospital } from '@/lib/hospital-context';

interface TranscriptSegment {
    id: string;
    speaker: 'CALLER' | 'AGENT' | 'SYSTEM';
    text: string;
    startTimeMs: number;
    endTimeMs: number;
    confidence?: number;
}

interface SentimentSnapshot {
    id: string;
    offsetMs: number;
    score: number;
    label: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE';
}

interface CallDetail {
    id: string;
    twilioCallSid: string;
    direction: string;
    status: string;
    phoneNumber: {
        twilioPhoneNumber: string;
    };
    patient?: {
        id: string;
        name: string;
        externalId?: string;
    };
    intent?: {
        displayName: string;
    };
    isEmergency: boolean;
    startedAt: string;
    endedAt?: string;
    recordingUrl?: string;
    sentimentOverallScore?: number;
    aiConfidence?: number;
    handoffTarget?: string;
    handoffReason?: string;
    transcriptSegments: TranscriptSegment[];
    sentimentSnapshots: SentimentSnapshot[];
    handoffs: any[];
}

function formatDuration(startedAt: string, endedAt?: string): string {
    if (!endedAt) return '0:00';
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    const seconds = Math.floor((end - start) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getSentimentColor(sentiment?: SentimentSnapshot): string {
    if (!sentiment) return 'bg-gray-500';
    if (sentiment.label === 'POSITIVE') return 'bg-green-500';
    if (sentiment.label === 'NEGATIVE') return 'bg-red-500';
    return 'bg-gray-400';
}

function getSentimentIcon(sentiment?: SentimentSnapshot) {
    if (!sentiment) return Minus;
    if (sentiment.label === 'POSITIVE') return TrendingUp;
    if (sentiment.label === 'NEGATIVE') return TrendingDown;
    return Minus;
}

export default function CallDetailPage({ params }: { params: { id: string } }) {
    const { hospitalId } = useHospital();
    const apiClient = useApiClient();
    const [call, setCall] = useState<CallDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!hospitalId) return;

        const fetchCall = async () => {
            try {
                setLoading(true);
                const data = await apiClient.get<CallDetail>(`/hospitals/${hospitalId}/calls/${params.id}`);
                setCall(data);
            } catch (err) {
                console.error('Failed to fetch call:', err);
                setError('Failed to load call details.');
            } finally {
                setLoading(false);
            }
        };

        fetchCall();
    }, [params.id, hospitalId, apiClient]);

    // Helper to find sentiment for a given timestamp
    const getSentimentAtTime = (timeMs: number): SentimentSnapshot | undefined => {
        if (!call?.sentimentSnapshots || call.sentimentSnapshots.length === 0) return undefined;
        
        // Find the closest sentiment snapshot at or before this time
        const filtered = call.sentimentSnapshots.filter(s => s.offsetMs <= timeMs);
        return filtered.length > 0 ? filtered[filtered.length - 1] : call.sentimentSnapshots[0];
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !call) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
                    <p className="text-lg font-semibold">Error loading call</p>
                    <p className="text-sm text-muted-foreground">{error || 'Call not found'}</p>
                </div>
            </div>
        );
    }

    const duration = formatDuration(call.startedAt, call.endedAt);

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar: Metadata */}
            <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
                <Link href="/dashboard/calls">
                    <Button variant="secondary" icon={ChevronRight} className="rotate-180 mb-2">
                        Back to List
                    </Button>
                </Link>

                <Card className="bg-white">
                    <div className="flex items-center justify-between mb-6">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            <Phone className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold text-slate-900">{duration}</div>
                            <div className="text-sm text-slate-500">Duration</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-slate-500 uppercase">Caller</label>
                            <div className="font-medium text-slate-900">{call.patient?.name || 'Unknown'}</div>
                            <div className="text-sm text-slate-600">{call.phoneNumber.twilioPhoneNumber}</div>
                            {call.patient && (
                                <div className="text-xs text-muted-foreground mt-1">
                                    Patient ID: {call.patient.externalId || call.patient.id}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-500 uppercase">Intent Detected</label>
                            <div className="mt-1 flex flex-wrap gap-2">
                                <Badge 
                                    type={call.isEmergency ? "danger" : "primary"} 
                                    text={call.intent?.displayName || 'Unknown'} 
                                />
                                {call.isEmergency && (
                                    <Badge type="danger" text="Emergency" />
                                )}
                            </div>
                        </div>

                        {call.aiConfidence !== undefined && (
                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase">AI Confidence</label>
                                <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                                    <div 
                                        className="bg-emerald-500 h-2 rounded-full" 
                                        style={{ width: `${(call.aiConfidence * 100)}%` }}
                                    ></div>
                                </div>
                                <div className="text-xs text-right mt-1 text-slate-500">
                                    {(call.aiConfidence * 100).toFixed(0)}% Match
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-medium text-slate-500 uppercase">Call Status</label>
                            <div className="mt-1">
                                <Badge 
                                    type={call.status === 'COMPLETED' ? 'success' : call.status === 'ABANDONED' ? 'warning' : 'neutral'}
                                    text={call.status}
                                />
                            </div>
                        </div>

                        {call.sentimentOverallScore !== undefined && (
                            <div>
                                <label className="text-xs font-medium text-slate-500 uppercase">Overall Sentiment</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div 
                                            className={`h-2 rounded-full ${
                                                call.sentimentOverallScore >= 0.6 ? 'bg-green-500' :
                                                call.sentimentOverallScore >= 0.4 ? 'bg-gray-400' : 'bg-red-500'
                                            }`}
                                            style={{ width: `${(call.sentimentOverallScore * 100)}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-sm font-medium">
                                        {(call.sentimentOverallScore * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {call.handoffs && call.handoffs.length > 0 && (
                    <Card title="Escalations">
                        <div className="space-y-3">
                            {call.handoffs.map((handoff, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                                    <div>
                                        <div className="text-sm font-medium text-amber-800">
                                            {handoff.targetType || 'Human Agent'}
                                        </div>
                                        <div className="text-xs text-amber-600">
                                            {call.handoffReason || 'Escalated'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {call.patient && (
                    <Button variant="secondary" className="w-full">
                        View Patient Call History
                    </Button>
                )}

                <Button variant="secondary" className="w-full" icon={Download}>
                    Export Call Summary
                </Button>
            </div>

            {/* Center: Transcript */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-foreground" /> Call Transcript
                    </h3>
                    <div className="flex gap-2">
                        <Badge type="neutral" text={`ID: ${call.twilioCallSid?.substring(0, 8) || call.id.substring(0, 8)}`} />
                        {call.isEmergency && (
                            <Badge type="danger" text="Emergency Call" />
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                    {call.transcriptSegments && call.transcriptSegments.length > 0 ? (
                        call.transcriptSegments.map((segment, idx) => {
                            const sentiment = getSentimentAtTime(segment.startTimeMs);
                            const SentimentIcon = getSentimentIcon(sentiment);
                            
                            return (
                                <div 
                                    key={segment.id} 
                                    className={`flex gap-4 ${segment.speaker === 'AGENT' || segment.speaker === 'SYSTEM' ? '' : 'flex-row-reverse'}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 
                                        ${segment.speaker === 'AGENT' || segment.speaker === 'SYSTEM' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                                        {segment.speaker === 'AGENT' || segment.speaker === 'SYSTEM' ? (
                                            <BrainCircuit className="w-4 h-4" />
                                        ) : (
                                            <User className="w-4 h-4" />
                                        )}
                                    </div>
                                    <div className={`flex flex-col max-w-[70%] ${segment.speaker === 'CALLER' ? 'items-end' : 'items-start'}`}>
                                        <div className={`px-4 py-3 rounded-2xl text-sm shadow-sm border relative
                                            ${segment.speaker === 'AGENT' || segment.speaker === 'SYSTEM' 
                                                ? 'bg-white border-slate-100 text-slate-700 rounded-tl-none' 
                                                : 'bg-white border-slate-100 text-slate-800 rounded-tr-none'}
                                        `}>
                                            {/* Sentiment indicator */}
                                            {segment.speaker === 'CALLER' && sentiment && (
                                                <div className="absolute -left-2 top-3">
                                                    <div className={`w-3 h-3 rounded-full ${getSentimentColor(sentiment)} flex items-center justify-center`}>
                                                        <SentimentIcon className="w-2 h-2 text-white" />
                                                    </div>
                                                </div>
                                            )}
                                            {segment.text}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 px-1">
                                            <span className="text-xs text-slate-400">{formatTime(segment.startTimeMs)}</span>
                                            {segment.confidence !== undefined && segment.confidence < 0.8 && (
                                                <span className="text-xs text-amber-600">Low confidence</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            No transcript available for this call
                        </div>
                    )}
                </div>

                {call.recordingUrl && (
                    <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-foreground flex items-center justify-center text-background">
                            <Play className="w-4 h-4 ml-0.5" />
                        </div>
                        <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full w-0 bg-accent"></div>
                        </div>
                        <span className="text-xs font-mono text-slate-500">{duration}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
