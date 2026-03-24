"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Siren } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface EmergencyScreenNodeData extends Record<string, unknown> {
    label: string;
    keywords?: string[];
    autoEscalate?: boolean;
}

type EmergencyScreenNodeType = Node<EmergencyScreenNodeData, 'emergency-screen'>;

const EmergencyScreenNode = ({ data, selected }: NodeProps<EmergencyScreenNodeType>) => {
    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-red-50 to-red-100 min-w-[200px] ${
                selected ? 'border-red-500 ring-2 ring-red-300' : 'border-red-300'
            }`}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-red-500" />

            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded bg-red-500 text-white">
                    <Siren className="w-4 h-4" />
                </div>
                <div className="font-semibold text-sm text-red-900">{data.label}</div>
            </div>

            <div className="text-xs text-red-700 space-y-1">
                {data.keywords && data.keywords.length > 0 && (
                    <Badge variant="outline" className="text-[10px] bg-white/50">
                        {data.keywords.length} keyword{data.keywords.length !== 1 ? 's' : ''}
                    </Badge>
                )}
                {data.autoEscalate && (
                    <Badge variant="destructive" className="text-[10px] ml-1">
                        Auto-escalate
                    </Badge>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-red-500" />
        </div>
    );
};

export default memo(EmergencyScreenNode);
