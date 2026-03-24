"use client";

import React, { useState } from 'react';
import {
    Search, Plus, MoreHorizontal, X
} from 'lucide-react';
import { Card, Button, neoFieldClass } from "@/components/dashboard/shared";
import { useTeamMembers, useInviteUser } from '@/lib/hooks/query-hooks';
import { useBusiness } from '@/lib/business-context';
import { UserRole } from '@wardline/types';
import { formatDistanceToNow } from 'date-fns';

function getRoleBadgeStyles(role: UserRole): string {
    const styles: Record<UserRole, string> = {
        [UserRole.OWNER]: "bg-violet-500/12 text-violet-900",
        [UserRole.ADMIN]: "bg-indigo-500/12 text-indigo-900",
        [UserRole.SUPERVISOR]: "bg-teal-500/12 text-teal-900",
        [UserRole.AGENT]: "bg-sky-500/12 text-sky-900",
        [UserRole.READONLY]: "bg-muted/80 text-muted-foreground",
    };
    return styles[role] || styles[UserRole.READONLY];
}

export default function TeamPage() {
    const { businessId, isLoading: businessLoading } = useBusiness();
    const { data: teamMembers, isLoading, error } = useTeamMembers();
    const inviteUserMutation = useInviteUser();
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.AGENT);
    const [inviteError, setInviteError] = useState<string | null>(null);

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
            setInviteError(null);
            await inviteUserMutation.mutateAsync({
                email: inviteEmail,
                role: inviteRole,
            });
            setIsInviteOpen(false);
            setInviteEmail('');
            setInviteRole(UserRole.AGENT);
        } catch (error) {
            console.error('Failed to invite user:', error);
            setInviteError('Invites are not wired to the Business API yet. Add teammates from Clerk/admin tooling for now.');
        }
    };

    const RoleBadge = ({ role }: { role: UserRole }) => {
        return (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeStyles(role)}`}>
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

    if (businessLoading || !businessId) {
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
                <div className="relative max-w-md flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        placeholder="Search by name or email…"
                        className={`${neoFieldClass} pl-9`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="primary" icon={Plus} onClick={() => setIsInviteOpen(true)}>Invite User</Button>
            </div>

            {/* Team Table */}
            <Card className="overflow-hidden p-0">
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
                                <thead className="border-b border-border/40 bg-[var(--background)] text-xs uppercase text-muted-foreground neo-inset">
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
                                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--background)] text-xs font-bold text-foreground neo-inset">
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
                                                <StatusIndicator isActive={member.isActive ?? true} lastSeenAt={member.lastSeenAt} />
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {member.lastSeenAt
                                                    ? formatDistanceToNow(new Date(member.lastSeenAt), { addSuffix: true })
                                                    : 'Never'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    type="button"
                                                    className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-[var(--background)] hover:text-foreground neo-inset"
                                                >
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-3xl bg-[var(--background)] p-6 neo-raised">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-foreground">Invite team member</h3>
                            <button
                                type="button"
                                onClick={() => setIsInviteOpen(false)}
                                className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-[var(--background)] hover:text-foreground neo-inset"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-foreground">Email address</label>
                                <input
                                    type="email"
                                    placeholder="colleague@practice.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className={neoFieldClass}
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-foreground">Role</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {[UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT, UserRole.READONLY].map((role) => (
                                        <label
                                            key={role}
                                            className={`flex cursor-pointer items-center rounded-2xl p-3 transition-all ${
                                                inviteRole === role
                                                    ? 'bg-[var(--background)] neo-raised ring-2 ring-primary/35'
                                                    : 'bg-[var(--background)] neo-inset hover:opacity-95'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="role"
                                                checked={inviteRole === role}
                                                onChange={() => setInviteRole(role)}
                                                className="text-primary focus:ring-primary"
                                            />
                                            <span className="ml-3 text-sm font-medium capitalize text-foreground">{role}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {inviteError && (
                            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                {inviteError}
                            </div>
                        )}

                        <div className="mt-8 flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
                            <Button
                                variant="filled"
                                onClick={handleInvite}
                                disabled={!inviteEmail || inviteUserMutation.isPending}
                            >
                                {inviteUserMutation.isPending ? 'Sending...' : 'Send invitation'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
