"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Users, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface HumanQueueNodeData extends Record<string, unknown> {
    label: string;
    queueId?: string;
    priorityLevel?: number;
    timeoutSeconds?: number;
    requiredSkills?: string[];
}

type HumanQueueNodeType = Node<HumanQueueNodeData, 'human-agent-queue'>;

const HumanQueueNode = ({ data, selected }: NodeProps<HumanQueueNodeType>) => {
    const skillCount = data.requiredSkills?.length || 0;
    
    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-blue-50 to-blue-100 min-w-[200px] ${
                selected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-blue-300'
            }`}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-blue-500" />
            
            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded bg-blue-500 text-white">
                    <Users className="w-4 h-4" />
                </div>
                <div className="font-semibold text-sm text-blue-900">{data.label}</div>
            </div>
            
            <div className="text-xs text-blue-700 space-y-1">
                {data.queueId && (
                    <div className="truncate">Queue: {data.queueId}</div>
                )}
                
                <div className="flex items-center gap-1 flex-wrap">
                    {data.priorityLevel !== undefined && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            Priority: {data.priorityLevel}
                        </Badge>
                    )}
                    {skillCount > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {skillCount} skills required
                        </Badge>
                    )}
                    {data.timeoutSeconds && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {data.timeoutSeconds}s timeout
                        </Badge>
                    )}
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-blue-500" />
        </div>
    );
};

export default memo(HumanQueueNode);
