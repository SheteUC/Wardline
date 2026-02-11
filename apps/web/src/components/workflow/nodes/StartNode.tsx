"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface StartNodeData {
    label: string;
    greetingMessage?: string;
}

type StartNodeType = Node<StartNodeData, 'start'>;

const StartNode = ({ data, selected }: NodeProps<StartNodeType>) => {
    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-blue-50 to-blue-100 min-w-[200px] ${
                selected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-blue-300'
            }`}
        >
            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded bg-blue-500 text-white">
                    <Play className="w-4 h-4" />
                </div>
                <div className="font-semibold text-sm text-blue-900">{data.label}</div>
            </div>
            
            <div className="text-xs text-blue-700 space-y-1">
                {data.greetingMessage && (
                    <div className="truncate">
                        {data.greetingMessage.substring(0, 40)}...
                    </div>
                )}
                
                <Badge variant="outline" className="text-[10px] bg-white/50">
                    Entry Point
                </Badge>
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-blue-500" />
        </div>
    );
};

export default memo(StartNode);
