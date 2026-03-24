'use client';

import { formatDistanceToNow } from 'date-fns';
import { PlugZap, RefreshCcw } from 'lucide-react';
import { Button, Card } from '@/components/dashboard/shared';
import { useIntegrations, useTestIntegration } from '@/lib/hooks/query-hooks';

export default function IntegrationFailuresPage() {
    const integrationsQuery = useIntegrations();
    const testIntegration = useTestIntegration();
    const integrations = (integrationsQuery.data ?? []).filter((integration) => integration.status !== 'CONNECTED');

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--background)] text-primary neo-inset">
                    <PlugZap className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-foreground">Integration Failures</h2>
                    <p className="text-sm text-muted-foreground">
                        Vendor connections that need attention before agents can complete actions during the call.
                    </p>
                </div>
            </div>

            <Card>
                {integrationsQuery.isLoading ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">Loading integrations...</div>
                ) : integrations.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        No integration failures detected.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {integrations.map((integration) => (
                            <div key={integration.id} className="flex items-center justify-between rounded-2xl bg-[var(--background)] p-4 neo-inset">
                                <div>
                                    <div className="text-sm font-medium text-foreground">{integration.category}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {integration.vendor || 'Vendor not configured'} • Status {integration.status}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {integration.lastHealthCheckAt
                                            ? `Last checked ${formatDistanceToNow(new Date(integration.lastHealthCheckAt), { addSuffix: true })}`
                                            : 'No health check recorded yet'}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    className="h-9 text-xs"
                                    onClick={() => testIntegration.mutate(integration.category)}
                                    disabled={testIntegration.isPending}
                                >
                                    <RefreshCcw className="mr-1 h-3 w-3" />
                                    Retry test
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
