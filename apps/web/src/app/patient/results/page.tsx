"use client";

import React, { useState } from 'react';
import { FileText, AlertCircle, Clock, CheckCircle, ChevronRight, Phone } from 'lucide-react';
import { format } from 'date-fns';

// Mock test results data
const mockResults = [
    {
        id: 'test-001',
        testName: 'Complete Blood Count (CBC)',
        testDate: '2025-11-20',
        status: 'available' as const,
        category: 'Blood Work',
        orderedBy: 'Dr. Martinez',
        summary: 'Results within normal range. All blood cell counts are healthy.',
    },
    {
        id: 'test-002',
        testName: 'Lipid Panel',
        testDate: '2025-11-20',
        status: 'available' as const,
        category: 'Blood Work',
        orderedBy: 'Dr. Martinez',
        summary: 'Total cholesterol slightly elevated. LDL within acceptable range.',
    },
    {
        id: 'test-003',
        testName: 'Chest X-Ray',
        testDate: '2025-11-25',
        status: 'pending' as const,
        category: 'Imaging',
        orderedBy: 'Dr. Chen',
    },
    {
        id: 'test-004',
        testName: 'Hemoglobin A1C',
        testDate: '2025-11-18',
        status: 'available' as const,
        category: 'Blood Work',
        orderedBy: 'Dr. Martinez',
        summary: 'A1C level at 5.4%, indicating healthy blood sugar control.',
    },
    {
        id: 'test-005',
        testName: 'Urinalysis',
        testDate: '2025-11-15',
        status: 'reviewed' as const,
        category: 'Urine Test',
        orderedBy: 'Dr. Chen',
        summary: 'No abnormalities detected. All values within normal limits.',
    },
];

export default function PatientResultsPage() {
    const [selectedResult, setSelectedResult] = useState<typeof mockResults[0] | null>(null);
    
    const availableResults = mockResults.filter(r => r.status === 'available' || r.status === 'reviewed');
    const pendingResults = mockResults.filter(r => r.status === 'pending');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Test Results</h1>
                <p className="text-muted-foreground text-sm">View your lab and imaging results</p>
            </div>

            {/* Info Banner */}
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-cyan-800">About Your Results</p>
                    <p className="text-sm text-cyan-700 mt-1">
                        These results are for informational purposes only. Please consult your healthcare 
                        provider for interpretation and medical advice.
                    </p>
                </div>
            </div>

            {/* Pending Results */}
            {pendingResults.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-500" />
                        Pending Results
                    </h2>
                    <div className="space-y-3">
                        {pendingResults.map((result) => (
                            <div
                                key={result.id}
                                className="bg-white rounded-xl border border-amber-200 p-4"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-amber-50 p-3 rounded-xl">
                                            <Clock className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">{result.testName}</h3>
                                            <p className="text-sm text-muted-foreground">
                                                {result.category} • Ordered by {result.orderedBy}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Test date: {format(new Date(result.testDate), 'MMM d, yyyy')}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700">
                                        Pending
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Available Results */}
            <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-cyan-500" />
                    Available Results
                </h2>
                {availableResults.length > 0 ? (
                    <div className="space-y-3">
                        {availableResults.map((result) => (
                            <button
                                key={result.id}
                                onClick={() => setSelectedResult(result)}
                                className="w-full bg-white rounded-xl border border-border p-4 hover:border-cyan-300 transition-colors text-left"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-cyan-50 p-3 rounded-xl">
                                            <FileText className="w-5 h-5 text-cyan-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">{result.testName}</h3>
                                            <p className="text-sm text-muted-foreground">
                                                {result.category} • {format(new Date(result.testDate), 'MMM d, yyyy')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1.5 text-xs font-medium rounded-full ${
                                            result.status === 'reviewed'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-cyan-50 text-cyan-700'
                                        }`}>
                                            {result.status === 'reviewed' ? 'Reviewed' : 'View'}
                                        </span>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-border p-8 text-center">
                        <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-muted-foreground">No results available</p>
                    </div>
                )}
            </div>

            {/* Result Detail Modal */}
            {selectedResult && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
                    <div 
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setSelectedResult(null)}
                    />
                    <div className="relative w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl p-5 md:p-6 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">{selectedResult.testName}</h3>
                            <button
                                onClick={() => setSelectedResult(null)}
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-sm text-muted-foreground">Category</span>
                                <span className="text-sm font-medium">{selectedResult.category}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-sm text-muted-foreground">Test Date</span>
                                <span className="text-sm font-medium">
                                    {format(new Date(selectedResult.testDate), 'MMMM d, yyyy')}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-sm text-muted-foreground">Ordered By</span>
                                <span className="text-sm font-medium">{selectedResult.orderedBy}</span>
                            </div>
                            
                            {selectedResult.summary && (
                                <div className="py-2">
                                    <span className="text-sm text-muted-foreground block mb-2">Summary</span>
                                    <p className="text-sm bg-cyan-50 p-3 rounded-lg text-cyan-800">
                                        {selectedResult.summary}
                                    </p>
                                </div>
                            )}
                            
                            {/* Disclaimer */}
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-amber-800">Important Notice</p>
                                        <p className="text-xs text-amber-700 mt-1">
                                            This is information only. For interpretation of these results 
                                            and medical advice, please talk to your care team.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setSelectedResult(null)}
                                    className="flex-1 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    className="flex-1 py-2.5 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Phone className="w-4 h-4" />
                                    Contact Care Team
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

