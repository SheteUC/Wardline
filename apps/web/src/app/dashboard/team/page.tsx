"use client";

import Image from 'next/image';
import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Plus, Search, X } from 'lucide-react';
import { RoleGuard } from '@/components/role-guard';
import { Button, Card, neoFieldClass } from "@/components/dashboard/shared";
import { useBusiness } from '@/lib/business-context';
import { useInviteUser, useTeamMembers } from '@/lib/hooks/query-hooks';
import { formatUserRoleLabel, UserRole } from '@wardline/types';

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
        if (!teamMembers) {
            return [];
        }

        return teamMembers.filter((member) =>
            member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.email.toLowerCase().includes(searchTerm.toLowerCase()),
        );
    }, [teamMembers, searchTerm]);

    const handleInvite = async () => {
        if (!inviteEmail) {
            return;
        }

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

    const RoleBadge = ({ role }: { role: UserRole }) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeStyles(role)}`}>
            {formatUserRoleLabel(role)}
        </span>
    );

    const StatusIndicator = ({ isActive }: { isActive: boolean }) => {
        const status = isActive ? 'Active' : 'Offline';
        const color = isActive ? 'bg-emerald-500' : 'bg-muted-foreground';

        return (
            <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${color}`} />
                <span className="text-sm text-muted-foreground">{status}</span>
            </div>
        );
    };

    return (
        <RoleGuard allowedRoles={[UserRole.OWNER, UserRole.ADMIN]}>
            <div className="relative space-y-6">
                {businessLoading || !businessId ? (
                    <div className="flex h-96 items-center justify-center">
                        <div className="text-center text-muted-foreground">Loading team...</div>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                            <div className="relative max-w-md flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="search"
                                    placeholder="Search by name or email..."
                                    className={`${neoFieldClass} pl-9`}
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                />
                            </div>
                            <Button variant="primary" icon={Plus} onClick={() => setIsInviteOpen(true)}>
                                Invite User
                            </Button>
                        </div>

                        <Card className="overflow-hidden p-0">
                            {isLoading ? (
                                <div className="flex h-96 items-center justify-center">
                                    <div className="text-center text-muted-foreground">Loading team members...</div>
                                </div>
                            ) : error ? (
                                <div className="flex h-96 items-center justify-center">
                                    <div className="text-center text-red-600">Error loading team. Please try again.</div>
                                </div>
                            ) : filteredTeam.length === 0 ? (
                                <div className="flex h-96 items-center justify-center">
                                    <div className="text-center text-muted-foreground">No team members found</div>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="border-b border-border/40 bg-[var(--background)] text-xs uppercase text-muted-foreground neo-inset">
                                                <tr>
                                                    <th className="px-6 py-4 font-medium">User</th>
                                                    <th className="px-6 py-4 font-medium">Role</th>
                                                    <th className="px-6 py-4 font-medium">Status</th>
                                                    <th className="px-6 py-4 font-medium">Last Active</th>
                                                    <th className="px-6 py-4 text-right font-medium">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/50">
                                                {filteredTeam.map((member) => (
                                                    <tr key={member.id} className="transition-colors hover:bg-muted/50">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--background)] text-xs font-bold text-foreground neo-inset">
                                                                    {member.avatarUrl ? (
                                                                        <Image
                                                                            src={member.avatarUrl}
                                                                            alt={member.name || 'User'}
                                                                            loader={({ src }) => src}
                                                                            unoptimized
                                                                            width={36}
                                                                            height={36}
                                                                            sizes="36px"
                                                                            className="h-full w-full rounded-full object-cover"
                                                                        />
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
                                                            <StatusIndicator isActive={member.isActive ?? true} />
                                                        </td>
                                                        <td className="px-6 py-4 text-muted-foreground">
                                                            {member.lastSeenAt
                                                                ? formatDistanceToNow(new Date(member.lastSeenAt), { addSuffix: true })
                                                                : 'Never'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button
                                                                type="button"
                                                                aria-label={`Open actions for ${member.name || member.email}`}
                                                                className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-[var(--background)] hover:text-foreground neo-inset"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                                        <span>Showing {filteredTeam.length} users</span>
                                    </div>
                                </>
                            )}
                        </Card>
                    </>
                )}

                {isInviteOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-md rounded-3xl bg-[var(--background)] p-6 neo-raised">
                            <div className="mb-6 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-foreground">Invite team member</h3>
                                <button
                                    type="button"
                                    onClick={() => setIsInviteOpen(false)}
                                    aria-label="Close invite dialog"
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
                                        onChange={(event) => setInviteEmail(event.target.value)}
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
                                                <span className="ml-3 text-sm font-medium text-foreground">{formatUserRoleLabel(role)}</span>
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
        </RoleGuard>
    );
}
