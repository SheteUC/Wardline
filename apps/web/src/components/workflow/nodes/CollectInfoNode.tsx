"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface CollectInfoField {
    name: string;
    type: 'text' | 'phone' | 'date' | 'email' | 'number';
    required: boolean;
    prompt?: string;
}

export interface CollectInfoNodeData {
    label: string;
    fields?: CollectInfoField[];
}

type CollectInfoNodeType = Node<CollectInfoNodeData, 'collect-info'>;

const CollectInfoNode = ({ data, selected }: NodeProps<CollectInfoNodeType>) => {
    const fieldCount = data.fields?.length ?? 0;
    const requiredCount = data.fields?.filter((f) => f.required).length ?? 0;

    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-cyan-50 to-cyan-100 min-w-[200px] ${
                selected ? 'border-cyan-500 ring-2 ring-cyan-300' : 'border-cyan-300'
            }`}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-cyan-500" />

            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded bg-cyan-500 text-white">
                    <ClipboardList className="w-4 h-4" />
                </div>
                <div className="font-semibold text-sm text-cyan-900">{data.label}</div>
            </div>

            <div className="text-xs text-cyan-700 space-y-1">
                {fieldCount > 0 ? (
                    <div className="flex gap-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {fieldCount} field{fieldCount !== 1 ? 's' : ''}
                        </Badge>
                        {requiredCount > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-white/50 text-red-600">
                                {requiredCount} required
                            </Badge>
                        )}
                    </div>
                ) : (
                    <Badge variant="outline" className="text-[10px] bg-white/50 text-amber-600">
                        No fields configured
                    </Badge>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-cyan-500" />
        </div>
    );
};

export default memo(CollectInfoNode);
