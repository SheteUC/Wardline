"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface HumanDirectNodeData {
    label: string;
    agentId?: string;
    agentName?: string;
    fallbackQueueId?: string;
}

type HumanDirectNodeType = Node<HumanDirectNodeData, 'human-agent-direct'>;

const HumanDirectNode = ({ data, selected }: NodeProps<HumanDirectNodeType>) => {
    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-blue-50 to-blue-100 min-w-[200px] ${
                selected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-blue-300'
            }`}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-blue-500" />

            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded bg-blue-500 text-white">
                    <UserCheck className="w-4 h-4" />
                </div>
                <div className="font-semibold text-sm text-blue-900">{data.label}</div>
            </div>

            <div className="text-xs text-blue-700 space-y-1">
                {data.agentName ? (
                    <Badge variant="outline" className="text-[10px] bg-white/50">
                        → {data.agentName}
                    </Badge>
                ) : data.agentId ? (
                    <Badge variant="outline" className="text-[10px] bg-white/50">
                        Agent selected
                    </Badge>
                ) : (
                    <Badge variant="outline" className="text-[10px] bg-white/50 text-amber-600">
                        No agent set
                    </Badge>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-blue-500" />
        </div>
    );
};

export default memo(HumanDirectNode);
