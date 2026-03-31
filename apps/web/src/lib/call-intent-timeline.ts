import type { CallDetail } from './api-types';

const DOMAIN_LABELS: Record<string, string> = {
    scheduling: 'Scheduling',
    refill: 'Refill',
    insurance: 'Insurance',
    billing: 'Billing',
    handoff: 'Staff follow-up',
    knowledge: 'Knowledge',
};

const STATUS_LABELS: Record<string, string> = {
    detected: 'Detected',
    queued: 'Queued',
    active: 'Active',
    paused: 'Paused',
    resolved: 'Resolved',
    cancelled: 'Cancelled',
    dropped: 'Dropped',
};

const TRANSFER_STATUS_LABELS: Record<string, string> = {
    requested: 'Transfer requested',
    connected: 'Transfer connected',
    failed: 'Transfer failed',
    callback_requested: 'Callback requested',
};

export function labelIntentDomain(domain?: string) {
    if (!domain) {
        return 'Call issue';
    }
    return DOMAIN_LABELS[domain] ?? domain.replaceAll('_', ' ');
}

export function labelIntentStatus(status: string) {
    return STATUS_LABELS[status] ?? status.replaceAll('_', ' ');
}

export function labelTransferStatus(status?: string) {
    if (!status) {
        return undefined;
    }
    return TRANSFER_STATUS_LABELS[status] ?? status.replaceAll('_', ' ');
}

export function getIntentTimelineCardState(call: Pick<CallDetail, 'intentTimeline'>) {
    const items = (call.intentTimeline ?? []).map((intent) => ({
        ...intent,
        domainLabel: labelIntentDomain(intent.domain),
        statusLabel: labelIntentStatus(intent.status),
        transferStatusLabel: labelTransferStatus(intent.transferStatus),
    }));

    return {
        show: items.length > 0,
        items,
    };
}
