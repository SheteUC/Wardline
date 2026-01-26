"use client";

import React from 'react';
import Link from 'next/link';
import { Calendar, Clock, MapPin, ChevronRight, Plus, User } from 'lucide-react';
import { format, addDays } from 'date-fns';

// Mock appointments data
const mockAppointments = [
    {
        id: 'apt-001',
        scheduledAt: addDays(new Date(), 3).toISOString(),
        duration: 30,
        providerName: 'Dr. Emily Chen',
        serviceType: 'Annual Physical',
        department: 'Primary Care',
        location: 'Main Campus - Building A',
        address: '123 Medical Center Dr, Suite 200',
        status: 'confirmed' as const,
    },
    {
        id: 'apt-002',
        scheduledAt: addDays(new Date(), 10).toISOString(),
        duration: 15,
        providerName: 'Dr. James Wilson',
        serviceType: 'Follow-up Visit',
        department: 'Cardiology',
        location: 'Heart Center',
        address: '456 Cardiac Way, Floor 3',
        status: 'scheduled' as const,
    },
    {
        id: 'apt-003',
        scheduledAt: addDays(new Date(), -5).toISOString(),
        duration: 45,
        providerName: 'Dr. Sarah Martinez',
        serviceType: 'Lab Results Review',
        department: 'Internal Medicine',
        location: 'Outpatient Center',
        status: 'completed' as const,
    },
];

export default function PatientAppointmentsPage() {
    const upcomingAppointments = mockAppointments.filter(
        apt => new Date(apt.scheduledAt) > new Date() && apt.status !== 'completed'
    );
    const pastAppointments = mockAppointments.filter(
        apt => new Date(apt.scheduledAt) <= new Date() || apt.status === 'completed'
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
                    <p className="text-muted-foreground text-sm">Manage your healthcare appointments</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">
                    <Plus className="w-4 h-4" />
                    Book New
                </button>
            </div>

            {/* Upcoming Appointments */}
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Upcoming</h2>
                {upcomingAppointments.length > 0 ? (
                    <div className="space-y-3">
                        {upcomingAppointments.map((apt) => (
                            <Link
                                key={apt.id}
                                href={`/patient/appointments/${apt.id}`}
                                className="block bg-white rounded-xl border border-border p-4 hover:border-emerald-300 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="bg-emerald-50 p-3 rounded-xl">
                                            <Calendar className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">{apt.serviceType}</h3>
                                            <p className="text-sm text-muted-foreground">{apt.providerName}</p>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    {format(new Date(apt.scheduledAt), 'EEE, MMM d')} at {format(new Date(apt.scheduledAt), 'h:mm a')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                                                <MapPin className="w-4 h-4" />
                                                {apt.location}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                                            apt.status === 'confirmed' 
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-amber-50 text-amber-700'
                                        }`}>
                                            {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                                        </span>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-border p-8 text-center">
                        <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-muted-foreground">No upcoming appointments</p>
                        <button className="mt-4 text-sm font-medium text-emerald-600 hover:text-emerald-700">
                            Schedule an appointment
                        </button>
                    </div>
                )}
            </div>

            {/* Past Appointments */}
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Past Appointments</h2>
                {pastAppointments.length > 0 ? (
                    <div className="space-y-3">
                        {pastAppointments.map((apt) => (
                            <div
                                key={apt.id}
                                className="bg-white rounded-xl border border-border p-4 opacity-75"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-muted p-3 rounded-xl">
                                            <User className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-foreground">{apt.serviceType}</h3>
                                            <p className="text-sm text-muted-foreground">
                                                {apt.providerName} • {format(new Date(apt.scheduledAt), 'MMM d, yyyy')}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                                        Completed
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-border p-8 text-center">
                        <p className="text-muted-foreground">No past appointments</p>
                    </div>
                )}
            </div>
        </div>
    );
}

