"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Bot, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface AIAgentNodeData extends Record<string, unknown> {
    label: string;
    agentPresetId?: string;
    persona?: string;
    systemPrompt?: string;
    enabledTools?: string[];
    maxTurns?: number;
    contextStrategy?: 'reset' | 'reset_with_summary' | 'append';
    temperature?: number;
}

type AIAgentNodeType = Node<AIAgentNodeData, 'ai-agent'>;

const AIAgentNode = ({ data, selected }: NodeProps<AIAgentNodeType>) => {
    const toolCount = data.enabledTools?.length || 0;
    
    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-purple-50 to-purple-100 min-w-[200px] ${
                selected ? 'border-purple-500 ring-2 ring-purple-300' : 'border-purple-300'
            }`}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-purple-500" />
            
            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded bg-purple-500 text-white">
                    <Bot className="w-4 h-4" />
                </div>
                <div className="font-semibold text-sm text-purple-900">{data.label}</div>
            </div>
            
            <div className="text-xs text-purple-700 space-y-1">
                {data.systemPrompt && (
                    <div className="truncate">
                        {data.systemPrompt.substring(0, 40)}...
                    </div>
                )}
                
                <div className="flex items-center gap-1 flex-wrap">
                    {toolCount > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {toolCount} tools
                        </Badge>
                    )}
                    {data.maxTurns && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            max {data.maxTurns} turns
                        </Badge>
                    )}
                    {data.contextStrategy && data.contextStrategy !== 'append' && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {data.contextStrategy}
                        </Badge>
                    )}
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-purple-500" />
        </div>
    );
};

export default memo(AIAgentNode);
