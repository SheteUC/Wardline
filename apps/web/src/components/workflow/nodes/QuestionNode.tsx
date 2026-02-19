"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface QuestionNodeData {
    label: string;
    questionText?: string;
    fieldName?: string;
    validationType?: 'none' | 'required' | 'phone' | 'date' | 'email';
}

type QuestionNodeType = Node<QuestionNodeData, 'question'>;

const QuestionNode = ({ data, selected }: NodeProps<QuestionNodeType>) => {
    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-green-50 to-green-100 min-w-[200px] ${
                selected ? 'border-green-500 ring-2 ring-green-300' : 'border-green-300'
            }`}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-green-500" />

            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded bg-green-500 text-white">
                    <HelpCircle className="w-4 h-4" />
                </div>
                <div className="font-semibold text-sm text-green-900">{data.label}</div>
            </div>

            <div className="text-xs text-green-700 space-y-1">
                {data.questionText && (
                    <p className="truncate max-w-[160px] opacity-80 italic">&ldquo;{data.questionText}&rdquo;</p>
                )}
                <div className="flex gap-1 flex-wrap">
                    {data.fieldName && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            → {data.fieldName}
                        </Badge>
                    )}
                    {data.validationType && data.validationType !== 'none' && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {data.validationType}
                        </Badge>
                    )}
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-green-500" />
        </div>
    );
};

export default memo(QuestionNode);
