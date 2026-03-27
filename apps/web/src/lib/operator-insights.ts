export function humanizeFallbackReason(reason?: string | null) {
    if (!reason) {
        return null;
    }

    if (reason.startsWith('http_')) {
        return `the integration returned ${reason.slice(5)}`;
    }

    const mapped: Record<string, string> = {
        timeout: 'the connector timed out',
        missing_credentials: 'the integration is missing credentials',
        unsupported_capability: 'the configured integration does not support that request live',
        unsupported_vendor: 'the current vendor is not supported for live execution',
        request_error: 'the integration request failed',
        live_execution_unavailable: 'live execution was unavailable',
        manual_follow_up: 'staff follow-up was selected',
    };

    return mapped[reason] ?? reason.replaceAll('_', ' ');
}

export function labelRuntimeAction(actionName?: string | null) {
    if (!actionName) {
        return null;
    }

    const mapped: Record<string, string> = {
        'appointment-request': 'Appointment request',
        'refill-request': 'Refill request',
        'insurance-check': 'Insurance check',
        'billing-request': 'Billing request',
        'manual-follow-up': 'Manual follow-up',
    };

    return mapped[actionName] ?? actionName.replaceAll('-', ' ');
}
