"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface VoicePromptNodeData {
    label: string;
    message?: string;
}

type VoicePromptNodeType = Node<VoicePromptNodeData, 'voice-prompt'>;

const VoicePromptNode = ({ data, selected }: NodeProps<VoicePromptNodeType>) => {
    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-green-50 to-green-100 min-w-[200px] ${
                selected ? 'border-green-500 ring-2 ring-green-300' : 'border-green-300'
            }`}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-green-500" />
            
            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded bg-green-500 text-white">
                    <MessageSquare className="w-4 h-4" />
                </div>
                <div className="font-semibold text-sm text-green-900">{data.label || 'Voice Prompt'}</div>
            </div>
            
            <div className="text-xs text-green-700 space-y-1">
                {data.message && (
                    <div className="truncate">
                        {data.message.substring(0, 40)}...
                    </div>
                )}
                
                <Badge variant="outline" className="text-[10px] bg-white/50">
                    Legacy
                </Badge>
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-green-500" />
        </div>
    );
};

export default memo(VoicePromptNode);
