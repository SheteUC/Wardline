"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Webhook } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface WebhookNodeData {
    label: string;
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
    bodyTemplate?: string;
}

type WebhookNodeType = Node<WebhookNodeData, 'webhook'>;

const WebhookNode = ({ data, selected }: NodeProps<WebhookNodeType>) => {
    const displayUrl = data.url
        ? data.url.replace(/^https?:\/\//, '').slice(0, 28) + (data.url.length > 35 ? '…' : '')
        : null;

    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-indigo-50 to-indigo-100 min-w-[200px] ${
                selected ? 'border-indigo-500 ring-2 ring-indigo-300' : 'border-indigo-300'
            }`}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-indigo-500" />

            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded bg-indigo-500 text-white">
                    <Webhook className="w-4 h-4" />
                </div>
                <div className="font-semibold text-sm text-indigo-900">{data.label}</div>
            </div>

            <div className="text-xs text-indigo-700 space-y-1">
                {data.method && (
                    <Badge variant="outline" className="text-[10px] bg-white/50">
                        {data.method}
                    </Badge>
                )}
                {displayUrl && (
                    <p className="text-[10px] font-mono opacity-70 mt-1 truncate">{displayUrl}</p>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-indigo-500" />
        </div>
    );
};

export default memo(WebhookNode);
