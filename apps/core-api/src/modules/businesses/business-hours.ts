export interface OperatingHoursSlot {
    dayOfWeek: number;
    isClosed: boolean;
    startTime: string | null;
    endTime: string | null;
}

const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const;

export const DEFAULT_OPERATING_HOURS: OperatingHoursSlot[] = [
    { dayOfWeek: 0, isClosed: true, startTime: null, endTime: null },
    { dayOfWeek: 1, isClosed: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 2, isClosed: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 3, isClosed: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 4, isClosed: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 5, isClosed: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 6, isClosed: true, startTime: null, endTime: null },
];

function isValidTime(value: unknown): value is string {
    return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

function normalizeEntry(value: unknown, fallbackDay: number): OperatingHoursSlot {
    if (!value || typeof value !== 'object') {
        return DEFAULT_OPERATING_HOURS[fallbackDay];
    }

    const entry = value as Partial<OperatingHoursSlot>;
    const dayOfWeek =
        typeof entry.dayOfWeek === 'number' && entry.dayOfWeek >= 0 && entry.dayOfWeek <= 6
            ? entry.dayOfWeek
            : fallbackDay;

    const isClosed = entry.isClosed === true || !isValidTime(entry.startTime) || !isValidTime(entry.endTime);

    return {
        dayOfWeek,
        isClosed,
        startTime: isClosed ? null : entry.startTime,
        endTime: isClosed ? null : entry.endTime,
    };
}

export function normalizeOperatingHours(value: unknown): OperatingHoursSlot[] {
    const entries = Array.isArray(value) ? value : [];
    const byDay = new Map<number, OperatingHoursSlot>();

    for (const entry of entries) {
        const normalized = normalizeEntry(entry, DEFAULT_OPERATING_HOURS[0].dayOfWeek);
        byDay.set(normalized.dayOfWeek, normalized);
    }

    return DAYS_OF_WEEK.map((day) => {
        if (byDay.has(day)) {
            return normalizeEntry(byDay.get(day), day);
        }
        return { ...DEFAULT_OPERATING_HOURS[day] };
    });
}
