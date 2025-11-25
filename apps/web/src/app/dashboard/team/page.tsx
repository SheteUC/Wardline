"use client";

import React, { useState } from 'react';
import {
    Search, Plus, MoreHorizontal, X
} from 'lucide-react';
import { Card, Button } from "@/components/dashboard/shared";
import { useTeamMembers, useInviteUser } from '@/lib/hooks/query-hooks';
import { useHospital } from '@/lib/hospital-context';
import { UserRole } from '@wardline/types';
import { formatDistanceToNow } from 'date-fns';

function getRoleBadgeStyles(role: UserRole): string {
    const styles: Record<UserRole, string> = {
        [UserRole.OWNER]: "bg-purple-100 text-purple-700 border-purple-200",
        [UserRole.ADMIN]: "bg-indigo-100 text-indigo-700 border-indigo-200",
        [UserRole.SUPERVISOR]: "bg-teal-100 text-teal-700 border-teal-200",
        [UserRole.AGENT]: "bg-blue-100 text-blue-700 border-blue-200",
        [UserRole.READONLY]: "bg-muted text-muted-foreground border-border",
    };
    return styles[role] || styles[UserRole.READONLY];
}

export default function TeamPage() {
    const { hospitalId, isLoading: hospitalLoading } = useHospital();
    const { data: teamMembers, isLoading, error } = useTeamMembers();
    const inviteUserMutation = useInviteUser();
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.AGENT);

    const filteredTeam = React.useMemo(() => {
        if (!teamMembers) return [];
        return teamMembers.filter(member =>
            member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [teamMembers, searchTerm]);

    const handleInvite = async () => {
        if (!inviteEmail) return;

        try {
            await inviteUserMutation.mutateAsync({
                email: inviteEmail,
                role: inviteRole,
            });
            setIsInviteOpen(false);
            setInviteEmail('');
            setInviteRole(UserRole.AGENT);
        } catch (error) {
            console.error('Failed to invite user:', error);
        }
    };

    const RoleBadge = ({ role }: { role: UserRole }) => {
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeStyles(role)}`}>
                {role}
            </span>
        );
    };

    const StatusIndicator = ({ isActive, lastSeenAt }: { isActive: boolean; lastSeenAt?: string }) => {
        const status = isActive ? 'Active' : 'Offline';
        const color = isActive ? 'bg-emerald-500' : 'bg-muted-foreground';

        return (
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${color}`}></div>
                <span className="text-sm text-muted-foreground">{status}</span>
            </div>
        );
    };

    if (hospitalLoading || !hospitalId) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-center h-96">
                    <div className="text-center text-muted-foreground">Loading team...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 relative">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        className="pl-9 pr-4 py-2 w-full text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="primary" icon={Plus} onClick={() => setIsInviteOpen(true)}>Invite User</Button>
            </div>

            {/* Team Table */}
            <Card className="overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center text-muted-foreground">Loading team members...</div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center text-red-600">Error loading team. Please try again.</div>
                    </div>
                ) : filteredTeam.length === 0 ? (
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center text-muted-foreground">No team members found</div>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">User</th>
                                        <th className="px-6 py-4 font-medium">Role</th>
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 font-medium">Last Active</th>
                                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {filteredTeam.map((member) => (
                                        <tr key={member.id} className="hover:bg-muted/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-muted border border-border text-foreground flex items-center justify-center font-bold text-xs">
                                                        {member.avatarUrl ? (
                                                            <img src={member.avatarUrl} alt={member.name || 'User'} className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            member.name?.charAt(0)?.toUpperCase() || member.email.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-foreground">{member.name || 'Unknown'}</div>
                                                        <div className="text-xs text-muted-foreground">{member.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <RoleBadge role={member.role} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusIndicator isActive={member.isActive} lastSeenAt={member.lastSeenAt} />
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {member.lastSeenAt
                                                    ? formatDistanceToNow(new Date(member.lastSeenAt), { addSuffix: true })
                                                    : 'Never'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-border bg-muted/30 text-xs text-muted-foreground flex justify-between items-center">
                            <span>Showing {filteredTeam.length} users</span>
                        </div>
                    </>
                )}
            </Card>

            {/* Invite Modal */}
            {isInviteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-slate-800">Invite Team Member</h3>
                            <button onClick={() => setIsInviteOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    placeholder="colleague@hospital.org"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="w-full p-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {[UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT, UserRole.READONLY].map((role) => (
                                        <label key={role} className="flex items-center p-3 border border-border rounded-lg cursor-pointer hover:border-accent hover:bg-accent/10 transition-all">
                                            <input
                                                type="radio"
                                                name="role"
                                                checked={inviteRole === role}
                                                onChange={() => setInviteRole(role)}
                                                className="text-foreground focus:ring-ring"
                                            />
                                            <span className="ml-3 text-sm font-medium text-slate-700 capitalize">{role}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <Button variant="ghost" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
                            <Button
                                variant="primary"
                                onClick={handleInvite}
                                disabled={!inviteEmail || inviteUserMutation.isPending}
                            >
                                {inviteUserMutation.isPending ? 'Sending...' : 'Send Invitation'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
