"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface ConditionalNodeData {
    label: string;
    conditionType?: 'intent' | 'sentiment' | 'data_verification' | 'custom_expression';
    conditions?: Array<{
        expression: string;
        targetNode: string;
    }>;
    defaultTarget?: string;
}

type ConditionalNodeType = Node<ConditionalNodeData, 'conditional'>;

const ConditionalNode = ({ data, selected }: NodeProps<ConditionalNodeType>) => {
    const conditionCount = data.conditions?.length || 0;
    
    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-amber-50 to-amber-100 min-w-[200px] ${
                selected ? 'border-amber-500 ring-2 ring-amber-300' : 'border-amber-300'
            }`}
            style={{ clipPath: 'polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%)' }}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-amber-500" />
            
            <div className="flex items-center gap-2 mb-1 justify-center">
                <div className="p-1.5 rounded bg-amber-500 text-white">
                    <GitBranch className="w-4 h-4" />
                </div>
                <div className="font-semibold text-sm text-amber-900">{data.label}</div>
            </div>
            
            <div className="text-xs text-amber-700 space-y-1 text-center">
                <Badge variant="outline" className="text-[10px] bg-white/50">
                    {data.conditionType || 'custom'}
                </Badge>
                
                {conditionCount > 0 && (
                    <div className="text-[10px]">
                        {conditionCount} condition{conditionCount !== 1 ? 's' : ''}
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} id="default" className="w-3 h-3 !bg-amber-500" />
            <Handle type="source" position={Position.Right} id="true" className="w-3 h-3 !bg-green-500" />
            <Handle type="source" position={Position.Left} id="false" className="w-3 h-3 !bg-red-500" />
        </div>
    );
};

export default memo(ConditionalNode);
