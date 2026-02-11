"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { PhoneOff, MessageSquare, PhoneCall, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface EndNodeData {
    label: string;
    endType?: 'hangup' | 'voicemail' | 'callback_request' | 'satisfaction_survey';
    closingMessage?: string;
    surveyQuestions?: Array<{
        question: string;
        type: string;
    }>;
}

type EndNodeType = Node<EndNodeData, 'end'>;

const EndNode = ({ data, selected }: NodeProps<EndNodeType>) => {
    const getIcon = () => {
        switch (data.endType) {
            case 'voicemail':
                return <MessageSquare className="w-4 h-4" />;
            case 'callback_request':
                return <PhoneCall className="w-4 h-4" />;
            case 'satisfaction_survey':
                return <Star className="w-4 h-4" />;
            default:
                return <PhoneOff className="w-4 h-4" />;
        }
    };
    
    const surveyCount = data.surveyQuestions?.length || 0;
    
    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-gray-100 to-gray-200 min-w-[200px] ${
                selected ? 'border-gray-500 ring-2 ring-gray-400' : 'border-gray-400'
            }`}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-gray-600" />
            
            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded bg-gray-600 text-white">
                    {getIcon()}
                </div>
                <div className="font-semibold text-sm text-gray-900">{data.label}</div>
            </div>
            
            <div className="text-xs text-gray-700 space-y-1">
                <div className="flex items-center gap-1 flex-wrap">
                    {data.endType && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {data.endType.replace('_', ' ')}
                        </Badge>
                    )}
                    {surveyCount > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {surveyCount} questions
                        </Badge>
                    )}
                </div>
                
                {data.closingMessage && (
                    <div className="truncate text-[10px] opacity-75">
                        {data.closingMessage.substring(0, 30)}...
                    </div>
                )}
            </div>
        </div>
    );
};

export default memo(EndNode);
