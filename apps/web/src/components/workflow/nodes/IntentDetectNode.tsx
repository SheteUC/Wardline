"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface IntentDetectNodeData extends Record<string, unknown> {
    label: string;
    intents?: string[];
    confidenceThreshold?: number;
}

type IntentDetectNodeType = Node<IntentDetectNodeData, 'intent-detect'>;

const IntentDetectNode = ({ data, selected }: NodeProps<IntentDetectNodeType>) => {
    const intentCount = data.intents?.length || 0;
    
    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-indigo-50 to-indigo-100 min-w-[200px] ${
                selected ? 'border-indigo-500 ring-2 ring-indigo-300' : 'border-indigo-300'
            }`}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-indigo-500" />
            
            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded bg-indigo-500 text-white">
                    <Target className="w-4 h-4" />
                </div>
                <div className="font-semibold text-sm text-indigo-900">{data.label || 'Intent Detection'}</div>
            </div>
            
            <div className="text-xs text-indigo-700 space-y-1">
                <div className="flex items-center gap-1 flex-wrap">
                    {intentCount > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {intentCount} intent{intentCount !== 1 ? 's' : ''}
                        </Badge>
                    )}
                    {data.confidenceThreshold !== undefined && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {Math.round(data.confidenceThreshold * 100)}% threshold
                        </Badge>
                    )}
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-indigo-500" />
        </div>
    );
};

export default memo(IntentDetectNode);
