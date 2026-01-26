"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook that debounces a value - delays updating until after delay ms have passed
 * since the last change. Perfect for search inputs.
 * 
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Hook that returns a debounced callback function.
 * The callback will only be called after the specified delay has passed
 * without any new calls.
 * 
 * @param callback - The callback to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced callback
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
    callback: T,
    delay: number = 300
): T {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const debouncedCallback = useCallback(
        (...args: Parameters<T>) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                callback(...args);
            }, delay);
        },
        [callback, delay]
    ) as T;

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return debouncedCallback;
}

/**
 * Hook for optimistic search that shows results immediately while debouncing API calls.
 * Returns both the immediate value (for display) and the debounced value (for queries).
 * 
 * @param initialValue - Initial search value
 * @param delay - Debounce delay in ms
 */
export function useOptimisticSearch(initialValue: string = '', delay: number = 300) {
    const [value, setValue] = useState(initialValue);
    const debouncedValue = useDebounce(value, delay);
    const isTyping = value !== debouncedValue;

    return {
        value,
        setValue,
        debouncedValue,
        isTyping,
    };
}

