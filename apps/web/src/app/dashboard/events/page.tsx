"use client";

import React, { useState, useMemo } from 'react';
import {
    Calendar, Users, MapPin, Clock, Video, Plus,
    Search, TrendingUp, UserCheck, Target, ChevronRight,
    Loader2, CheckCircle, XCircle, AlertCircle, Megaphone
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useHospital } from '@/lib/hospital-context';
import { useApiClient } from '@/lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow, addDays } from 'date-fns';

interface MarketingEvent {
    id: string;
    hospitalId: string;
    title: string;
    description: string;
    eventType: 'SEMINAR' | 'LECTURE' | 'CLASS' | 'WORKSHOP' | 'HEALTH_FAIR' | 'SCREENING';
    specialty?: string;
    presenter?: string;
    location?: string;
    isVirtual: boolean;
    virtualLink?: string;
    scheduledAt: string;
    duration: number;
    capacity?: number;
    registrationDeadline?: string;
    status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    marketingChannel?: string;
    createdAt: string;
    _count?: { registrations: number };
}

interface EventRegistration {
    id: string;
    eventId: string;
    attendeeName: string;
    attendeePhone: string;
    attendeeEmail?: string;
    status: 'REGISTERED' | 'WAITLISTED' | 'CANCELLED' | 'NO_SHOW';
    attended?: boolean;
    becamePatient: boolean;
    registeredAt: string;
}

const EVENT_TYPE_CONFIG = {
    SEMINAR: { label: 'Seminar', color: 'bg-blue-100 text-blue-700' },
    LECTURE: { label: 'Lecture', color: 'bg-purple-100 text-purple-700' },
    CLASS: { label: 'Class', color: 'bg-emerald-100 text-emerald-700' },
    WORKSHOP: { label: 'Workshop', color: 'bg-amber-100 text-amber-700' },
    HEALTH_FAIR: { label: 'Health Fair', color: 'bg-pink-100 text-pink-700' },
    SCREENING: { label: 'Screening', color: 'bg-cyan-100 text-cyan-700' },
};

const STATUS_CONFIG = {
    UPCOMING: { label: 'Upcoming', variant: 'default' as const, icon: Calendar },
    IN_PROGRESS: { label: 'In Progress', variant: 'secondary' as const, icon: Clock },
    COMPLETED: { label: 'Completed', variant: 'outline' as const, icon: CheckCircle },
    CANCELLED: { label: 'Cancelled', variant: 'destructive' as const, icon: XCircle },
};

const SPECIALTIES = [
    'Cardiology', 'Orthopedics', 'Pediatrics', 'Women\'s Health',
    'Oncology', 'Neurology', 'Mental Health', 'Nutrition', 'General Health'
];

const MARKETING_CHANNELS = [
    'Newsletter', 'Social Media', 'Website', 'Radio', 'Print', 'Referral', 'Other'
];

export default function MarketingEventsPage() {
    const { hospitalId, isLoading: hospitalLoading } = useHospital();
    const api = useApiClient();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>('UPCOMING');
    const [showNewEventForm, setShowNewEventForm] = useState(false);
    const [showRegistrationForm, setShowRegistrationForm] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<MarketingEvent | null>(null);
    const [eventData, setEventData] = useState({
        title: '',
        description: '',
        eventType: 'SEMINAR' as const,
        specialty: '',
        presenter: '',
        location: '',
        isVirtual: false,
        virtualLink: '',
        scheduledAt: '',
        duration: 60,
        capacity: '',
        registrationDeadline: '',
        marketingChannel: ''
    });
    const [registrationData, setRegistrationData] = useState({
        attendeeName: '',
        attendeePhone: '',
        attendeeEmail: '',
        notes: ''
    });

    // Fetch events
    const { data: eventsData, isLoading: eventsLoading } = useQuery({
        queryKey: ['marketing-events', hospitalId, statusFilter],
        queryFn: () => api.get<{ data: MarketingEvent[]; total: number }>(
            `/marketing-events?hospitalId=${hospitalId}${statusFilter ? `&status=${statusFilter}` : ''}&limit=50`
        ),
        enabled: !!hospitalId,
    });

    // Fetch analytics
    const { data: analytics } = useQuery({
        queryKey: ['marketing-analytics', hospitalId],
        queryFn: () => api.get<any>(`/marketing-events/analytics?hospitalId=${hospitalId}`),
        enabled: !!hospitalId,
    });

    // Fetch registrations for selected event
    const { data: registrationsData } = useQuery({
        queryKey: ['event-registrations', selectedEvent?.id],
        queryFn: () => api.get<{ data: EventRegistration[]; total: number }>(
            `/marketing-events/${selectedEvent?.id}/registrations`
        ),
        enabled: !!selectedEvent?.id,
    });

    // Create event mutation
    const createEvent = useMutation({
        mutationFn: (data: typeof eventData) =>
            api.post('/marketing-events', {
                ...data,
                hospitalId,
                capacity: data.capacity ? parseInt(data.capacity) : undefined,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['marketing-events'] });
            queryClient.invalidateQueries({ queryKey: ['marketing-analytics'] });
            setShowNewEventForm(false);
            setEventData({
                title: '',
                description: '',
                eventType: 'SEMINAR',
                specialty: '',
                presenter: '',
                location: '',
                isVirtual: false,
                virtualLink: '',
                scheduledAt: '',
                duration: 60,
                capacity: '',
                registrationDeadline: '',
                marketingChannel: ''
            });
        },
    });

    // Register attendee mutation
    const registerAttendee = useMutation({
        mutationFn: ({ eventId, data }: { eventId: string; data: typeof registrationData }) =>
            api.post(`/marketing-events/${eventId}/register`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['marketing-events'] });
            queryClient.invalidateQueries({ queryKey: ['event-registrations'] });
            setShowRegistrationForm(null);
            setRegistrationData({ attendeeName: '', attendeePhone: '', attendeeEmail: '', notes: '' });
        },
    });

    const filteredEvents = useMemo(() => {
        if (!eventsData?.data) return [];
        return eventsData.data.filter(event => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return (
                event.title.toLowerCase().includes(query) ||
                event.specialty?.toLowerCase().includes(query) ||
                event.presenter?.toLowerCase().includes(query)
            );
        });
    }, [eventsData, searchQuery]);

    const upcomingEvents = useMemo(() => {
        return filteredEvents.filter(e => e.status === 'UPCOMING').slice(0, 5);
    }, [filteredEvents]);

    const isLoading = hospitalLoading || eventsLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Marketing Events</h1>
                    <p className="text-muted-foreground">
                        Manage seminars, lectures, and classes to attract new patients
                    </p>
                </div>
                <Button onClick={() => setShowNewEventForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Event
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-5">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Events</CardDescription>
                        <CardTitle className="text-2xl">{analytics?.totalEvents || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Registrations</CardDescription>
                        <CardTitle className="text-2xl">{analytics?.totalRegistrations || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardHeader className="pb-2">
                        <CardDescription>Attended</CardDescription>
                        <CardTitle className="text-2xl text-emerald-600">{analytics?.attendedCount || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-blue-200 bg-blue-50/50">
                    <CardHeader className="pb-2">
                        <CardDescription>New Patients</CardDescription>
                        <CardTitle className="text-2xl text-blue-600">{analytics?.convertedCount || 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Conversion Rate</CardDescription>
                        <CardTitle className="text-2xl">{(analytics?.conversionRate || 0).toFixed(1)}%</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* ROI Impact Card */}
            <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-transparent">
                <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100">
                            <Target className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium">Marketing ROI</p>
                            <p className="text-sm text-muted-foreground">
                                {analytics?.roi?.description || 'Track event attendance and patient conversions to measure marketing effectiveness.'}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-emerald-600">{analytics?.convertedCount || 0}</p>
                            <p className="text-sm text-muted-foreground">New Patients Acquired</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Search and Filter */}
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search events by title, specialty, or presenter..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={statusFilter === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatusFilter(null)}
                    >
                        All
                    </Button>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <Button
                            key={key}
                            variant={statusFilter === key ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusFilter(statusFilter === key ? null : key)}
                        >
                            {config.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Events Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredEvents.length === 0 ? (
                    <Card className="col-span-full">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No events found</p>
                            <Button variant="outline" className="mt-4" onClick={() => setShowNewEventForm(true)}>
                                Create First Event
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    filteredEvents.map(event => {
                        const typeConfig = EVENT_TYPE_CONFIG[event.eventType];
                        const statusConfig = STATUS_CONFIG[event.status];
                        const StatusIcon = statusConfig.icon;
                        const isUpcoming = event.status === 'UPCOMING';
                        const registrationCount = event._count?.registrations || 0;
                        const isFull = event.capacity && registrationCount >= event.capacity;

                        return (
                            <Card
                                key={event.id}
                                className="hover:border-primary transition-colors cursor-pointer"
                                onClick={() => setSelectedEvent(event)}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex gap-2">
                                                <Badge className={typeConfig.color}>
                                                    {typeConfig.label}
                                                </Badge>
                                                {event.isVirtual && (
                                                    <Badge variant="outline" className="text-xs">
                                                        <Video className="h-3 w-3 mr-1" /> Virtual
                                                    </Badge>
                                                )}
                                            </div>
                                            <CardTitle className="text-lg">{event.title}</CardTitle>
                                        </div>
                                        <Badge variant={statusConfig.variant}>
                                            <StatusIcon className="h-3 w-3 mr-1" />
                                            {statusConfig.label}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="h-4 w-4" />
                                            <span>{format(new Date(event.scheduledAt), 'MMM d, yyyy • h:mm a')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Clock className="h-4 w-4" />
                                            <span>{event.duration} minutes</span>
                                        </div>
                                        {(event.location || event.isVirtual) && (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                {event.isVirtual ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                                                <span>{event.isVirtual ? 'Virtual Event' : event.location}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            <span className={isFull ? 'text-amber-600' : ''}>
                                                {registrationCount}{event.capacity ? ` / ${event.capacity}` : ''} registered
                                            </span>
                                        </div>
                                        {isUpcoming && !isFull && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowRegistrationForm(event.id);
                                                }}
                                            >
                                                Register
                                            </Button>
                                        )}
                                        {isFull && (
                                            <Badge variant="secondary">Full</Badge>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* New Event Form Modal */}
            {showNewEventForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <CardTitle>Create Marketing Event</CardTitle>
                            <CardDescription>Schedule a new seminar, lecture, or class</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-sm font-medium">Event Title *</label>
                                    <Input
                                        value={eventData.title}
                                        onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
                                        placeholder="e.g., Heart Health Seminar"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-sm font-medium">Description *</label>
                                    <textarea
                                        className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                                        value={eventData.description}
                                        onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                                        placeholder="Event description..."
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Event Type *</label>
                                    <select
                                        className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={eventData.eventType}
                                        onChange={(e) => setEventData({ ...eventData, eventType: e.target.value as any })}
                                    >
                                        {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                                            <option key={key} value={key}>{config.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Specialty</label>
                                    <select
                                        className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={eventData.specialty}
                                        onChange={(e) => setEventData({ ...eventData, specialty: e.target.value })}
                                    >
                                        <option value="">Select specialty...</option>
                                        {SPECIALTIES.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Presenter</label>
                                    <Input
                                        value={eventData.presenter}
                                        onChange={(e) => setEventData({ ...eventData, presenter: e.target.value })}
                                        placeholder="Dr. Name"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Marketing Channel</label>
                                    <select
                                        className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={eventData.marketingChannel}
                                        onChange={(e) => setEventData({ ...eventData, marketingChannel: e.target.value })}
                                    >
                                        <option value="">Select channel...</option>
                                        {MARKETING_CHANNELS.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <input
                                            type="checkbox"
                                            id="isVirtual"
                                            checked={eventData.isVirtual}
                                            onChange={(e) => setEventData({ ...eventData, isVirtual: e.target.checked })}
                                            className="rounded border-input"
                                        />
                                        <label htmlFor="isVirtual" className="text-sm">This is a virtual event</label>
                                    </div>
                                    {eventData.isVirtual ? (
                                        <Input
                                            value={eventData.virtualLink}
                                            onChange={(e) => setEventData({ ...eventData, virtualLink: e.target.value })}
                                            placeholder="Virtual meeting link"
                                        />
                                    ) : (
                                        <Input
                                            value={eventData.location}
                                            onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
                                            placeholder="Event location"
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Date & Time *</label>
                                    <Input
                                        type="datetime-local"
                                        value={eventData.scheduledAt}
                                        onChange={(e) => setEventData({ ...eventData, scheduledAt: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Duration (minutes) *</label>
                                    <Input
                                        type="number"
                                        value={eventData.duration}
                                        onChange={(e) => setEventData({ ...eventData, duration: parseInt(e.target.value) || 60 })}
                                        min={15}
                                        step={15}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Capacity (optional)</label>
                                    <Input
                                        type="number"
                                        value={eventData.capacity}
                                        onChange={(e) => setEventData({ ...eventData, capacity: e.target.value })}
                                        placeholder="Max attendees"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Registration Deadline</label>
                                    <Input
                                        type="datetime-local"
                                        value={eventData.registrationDeadline}
                                        onChange={(e) => setEventData({ ...eventData, registrationDeadline: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" className="flex-1" onClick={() => setShowNewEventForm(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => createEvent.mutate(eventData)}
                                    disabled={!eventData.title || !eventData.description || !eventData.scheduledAt || createEvent.isPending}
                                >
                                    {createEvent.isPending ? 'Creating...' : 'Create Event'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Registration Form Modal */}
            {showRegistrationForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                            <CardTitle>Register Attendee</CardTitle>
                            <CardDescription>Add a new registration for this event</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Attendee Name *</label>
                                <Input
                                    value={registrationData.attendeeName}
                                    onChange={(e) => setRegistrationData({ ...registrationData, attendeeName: e.target.value })}
                                    placeholder="Full name"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Phone Number *</label>
                                <Input
                                    value={registrationData.attendeePhone}
                                    onChange={(e) => setRegistrationData({ ...registrationData, attendeePhone: e.target.value })}
                                    placeholder="555-123-4567"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Email (optional)</label>
                                <Input
                                    type="email"
                                    value={registrationData.attendeeEmail}
                                    onChange={(e) => setRegistrationData({ ...registrationData, attendeeEmail: e.target.value })}
                                    placeholder="email@example.com"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Notes</label>
                                <textarea
                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                                    value={registrationData.notes}
                                    onChange={(e) => setRegistrationData({ ...registrationData, notes: e.target.value })}
                                    placeholder="Additional notes..."
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" className="flex-1" onClick={() => setShowRegistrationForm(null)}>
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => registerAttendee.mutate({ eventId: showRegistrationForm, data: registrationData })}
                                    disabled={!registrationData.attendeeName || !registrationData.attendeePhone || registerAttendee.isPending}
                                >
                                    {registerAttendee.isPending ? 'Registering...' : 'Register'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Event Detail Modal */}
            {selectedEvent && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex gap-2 mb-2">
                                        <Badge className={EVENT_TYPE_CONFIG[selectedEvent.eventType].color}>
                                            {EVENT_TYPE_CONFIG[selectedEvent.eventType].label}
                                        </Badge>
                                        <Badge variant={STATUS_CONFIG[selectedEvent.status].variant}>
                                            {STATUS_CONFIG[selectedEvent.status].label}
                                        </Badge>
                                    </div>
                                    <CardTitle>{selectedEvent.title}</CardTitle>
                                    <CardDescription>{selectedEvent.description}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Date & Time</p>
                                    <p className="font-medium">{format(new Date(selectedEvent.scheduledAt), 'MMM d, yyyy • h:mm a')}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Duration</p>
                                    <p className="font-medium">{selectedEvent.duration} minutes</p>
                                </div>
                                {selectedEvent.presenter && (
                                    <div>
                                        <p className="text-muted-foreground">Presenter</p>
                                        <p className="font-medium">{selectedEvent.presenter}</p>
                                    </div>
                                )}
                                {selectedEvent.specialty && (
                                    <div>
                                        <p className="text-muted-foreground">Specialty</p>
                                        <p className="font-medium">{selectedEvent.specialty}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-muted-foreground">Location</p>
                                    <p className="font-medium">
                                        {selectedEvent.isVirtual ? 'Virtual Event' : selectedEvent.location || 'TBD'}
                                    </p>
                                </div>
                                {selectedEvent.marketingChannel && (
                                    <div>
                                        <p className="text-muted-foreground">Marketing Channel</p>
                                        <p className="font-medium">{selectedEvent.marketingChannel}</p>
                                    </div>
                                )}
                            </div>

                            {/* Registrations */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold">Registrations ({registrationsData?.data?.length || 0})</h4>
                                    {selectedEvent.status === 'UPCOMING' && (
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                setSelectedEvent(null);
                                                setShowRegistrationForm(selectedEvent.id);
                                            }}
                                        >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add
                                        </Button>
                                    )}
                                </div>
                                {!registrationsData?.data?.length ? (
                                    <div className="text-center py-6 text-muted-foreground border rounded-lg">
                                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p>No registrations yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {registrationsData.data.map((reg: EventRegistration) => (
                                            <div key={reg.id} className="flex items-center justify-between p-2 rounded border">
                                                <div>
                                                    <p className="font-medium">{reg.attendeeName}</p>
                                                    <p className="text-xs text-muted-foreground">{reg.attendeePhone}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {reg.becamePatient && (
                                                        <Badge variant="default" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                                            <UserCheck className="h-3 w-3 mr-1" />
                                                            Converted
                                                        </Badge>
                                                    )}
                                                    <Badge variant={reg.status === 'REGISTERED' ? 'outline' : 'secondary'}>
                                                        {reg.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" className="flex-1" onClick={() => setSelectedEvent(null)}>
                                    Close
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

