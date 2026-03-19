"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Route } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface RouteNodeData {
    label: string;
    routingRules?: Array<{ condition: string; target: string }>;
    fallbackTarget?: string;
}

type RouteNodeType = Node<RouteNodeData, 'route'>;

const RouteNode = ({ data, selected }: NodeProps<RouteNodeType>) => {
    const ruleCount = data.routingRules?.length || 0;
    
    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-yellow-50 to-yellow-100 min-w-[200px] ${
                selected ? 'border-yellow-500 ring-2 ring-yellow-300' : 'border-yellow-300'
            }`}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-yellow-500" />
            
            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded bg-yellow-500 text-white">
                    <Route className="w-4 h-4" />
                </div>
                <div className="font-semibold text-sm text-yellow-900">{data.label || 'Route'}</div>
            </div>
            
            <div className="text-xs text-yellow-700 space-y-1">
                <div className="flex items-center gap-1 flex-wrap">
                    {ruleCount > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {ruleCount} rule{ruleCount !== 1 ? 's' : ''}
                        </Badge>
                    )}
                    {data.fallbackTarget && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            fallback set
                        </Badge>
                    )}
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-yellow-500" />
            <Handle type="source" position={Position.Right} id="alt" className="w-3 h-3 !bg-yellow-500" />
        </div>
    );
};

export default memo(RouteNode);
