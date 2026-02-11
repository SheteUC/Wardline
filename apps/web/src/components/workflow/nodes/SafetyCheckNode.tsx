"use client";

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Shield, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface SafetyCheckNodeData {
    label: string;
    keywordCategories?: string[];
    autoEscalate?: boolean;
    alertSeverity?: 'low' | 'medium' | 'high' | 'critical';
    confirmationRequired?: boolean;
}

type SafetyCheckNodeType = Node<SafetyCheckNodeData, 'safety-check'>;

const SafetyCheckNode = ({ data, selected }: NodeProps<SafetyCheckNodeType>) => {
    const categoryCount = data.keywordCategories?.length || 0;
    const isHighSeverity = data.alertSeverity === 'high' || data.alertSeverity === 'critical';
    
    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-lg border-2 ${
                isHighSeverity 
                    ? 'bg-gradient-to-br from-red-50 to-red-100' 
                    : 'bg-gradient-to-br from-orange-50 to-orange-100'
            } min-w-[200px] ${
                selected 
                    ? isHighSeverity 
                        ? 'border-red-500 ring-2 ring-red-300' 
                        : 'border-orange-500 ring-2 ring-orange-300'
                    : isHighSeverity
                        ? 'border-red-300'
                        : 'border-orange-300'
            }`}
        >
            <Handle type="target" position={Position.Top} className={`w-3 h-3 ${isHighSeverity ? '!bg-red-500' : '!bg-orange-500'}`} />
            
            <div className="flex items-center gap-2 mb-1">
                <div className={`p-1.5 rounded ${isHighSeverity ? 'bg-red-500' : 'bg-orange-500'} text-white`}>
                    {isHighSeverity ? <AlertTriangle className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                </div>
                <div className={`font-semibold text-sm ${isHighSeverity ? 'text-red-900' : 'text-orange-900'}`}>
                    {data.label}
                </div>
            </div>
            
            <div className={`text-xs ${isHighSeverity ? 'text-red-700' : 'text-orange-700'} space-y-1`}>
                <div className="flex items-center gap-1 flex-wrap">
                    {categoryCount > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {categoryCount} categories
                        </Badge>
                    )}
                    {data.autoEscalate && (
                        <Badge variant="destructive" className="text-[10px]">
                            Auto-escalate
                        </Badge>
                    )}
                    {data.alertSeverity && (
                        <Badge variant="outline" className="text-[10px] bg-white/50">
                            {data.alertSeverity}
                        </Badge>
                    )}
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className={`w-3 h-3 ${isHighSeverity ? '!bg-red-500' : '!bg-orange-500'}`} />
        </div>
    );
};

export default memo(SafetyCheckNode);
