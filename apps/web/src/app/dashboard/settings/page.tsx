"use client";

import React from 'react';
import { Card, Button } from "@/components/dashboard/shared";

export default function GeneralSettingsPage() {
    return (
        <div className="max-w-4xl mx-auto pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">General Settings</h1>
                <p className="text-muted-foreground">Manage your profile and organization details.</p>
            </div>

            <div className="space-y-6">
                {/* Profile Card */}
                <Card title="Profile Information">
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        <div className="flex-shrink-0">
                            <div className="w-20 h-20 rounded-full bg-slate-200 border-4 border-white shadow-sm overflow-hidden flex items-center justify-center text-xl font-bold text-slate-500">
                                JD
                            </div>
                            <button className="mt-2 text-xs font-medium text-teal-600 hover:text-teal-700 w-full text-center">Change Avatar</button>
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Full Name</label>
                                <input type="text" defaultValue="Jane Doe" className="w-full p-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring focus:outline-none bg-muted/50 focus:bg-card transition-colors" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Email Address</label>
                                <input type="email" defaultValue="jane.doe@stmarys.org" className="w-full p-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring focus:outline-none bg-muted/50 focus:bg-card transition-colors" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Role</label>
                                <input type="text" defaultValue="Operations Director" disabled className="w-full p-2.5 border border-border rounded-lg text-sm text-muted-foreground bg-muted cursor-not-allowed" />
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Organization Card */}
                <Card title="Organization Details">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Hospital Name</label>
                                <input type="text" defaultValue="St. Mary's General Hospital" className="w-full p-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Timezone</label>
                                <select className="w-full p-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring focus:outline-none bg-card">
                                    <option>Eastern Time (US & Canada)</option>
                                    <option>Pacific Time (US & Canada)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-border flex justify-end gap-3">
                        <Button variant="ghost">Cancel</Button>
                        <Button variant="primary">Save Changes</Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
