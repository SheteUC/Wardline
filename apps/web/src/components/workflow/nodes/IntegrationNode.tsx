"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Plug, Database, Cloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface IntegrationNodeData extends Record<string, unknown> {
    label: string;
    preset?: string;
    integrationType?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    endpointUrl?: string;
    authType?: string;
    bodyTemplate?: string;
    timeoutSeconds?: number;
    responseMapping?: string;
    errorHandling?: 'continue' | 'escalate' | 'end';
    retryCount?: number;
}

type IntegrationNodeType = Node<IntegrationNodeData, 'integration'>;

const IntegrationNode = ({ data, selected }: NodeProps<IntegrationNodeType>) => {
    const getIcon = () => {
        switch (data.integrationType) {
            case 'ehr_lookup':
                return <Database className="w-4 h-4" />;
            case 'scheduling':
                return <Cloud className="w-4 h-4" />;
            default:
                return <Plug className="w-4 h-4" />;
        }
    };
    
    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-gradient-to-br from-teal-50 to-teal-100 min-w-[200px] ${
                selected ? 'border-teal-500 ring-2 ring-teal-300' : 'border-teal-300'
            }`}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-teal-500" />
            
            <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded bg-teal-500 text-white">
                    {getIcon()}
                </div>
                <div className="font-semibold text-sm text-teal-900">{data.label}</div>
            </div>
            
            <div className="text-xs text-teal-700 space-y-1">
                <div className="flex items-center gap-1 flex-wrap">
                    {data.integrationType && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {data.integrationType.replace('_', ' ')}
                        </Badge>
                    )}
                    {data.method && (
                        <Badge variant="outline" className="text-[10px] bg-white/50 font-mono">
                            {data.method}
                        </Badge>
                    )}
                    {data.retryCount !== undefined && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {data.retryCount} retries
                        </Badge>
                    )}
                </div>
                
                {data.endpointUrl && (
                    <div className="truncate text-[10px] opacity-75">
                        {data.endpointUrl}
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-teal-500" />
        </div>
    );
};

export default memo(IntegrationNode);
