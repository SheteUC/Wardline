"use client";

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { EndNodeData } from '../nodes/EndNode';
import { PhoneOff, Plus, Trash2 } from 'lucide-react';

interface EndNodeConfigPanelProps {
    data: EndNodeData;
    onChange: (data: Partial<EndNodeData>) => void;
}

export function EndNodeConfigPanel({ data, onChange }: EndNodeConfigPanelProps) {
    const questions = data.surveyQuestions || [];
    
    const addQuestion = () => {
        onChange({
            surveyQuestions: [
                ...questions,
                { question: '', type: 'rating' }
            ]
        });
    };
    
    const updateQuestion = (index: number, updates: Partial<typeof questions[0]>) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], ...updates };
        onChange({ surveyQuestions: newQuestions });
    };
    
    const removeQuestion = (index: number) => {
        onChange({ surveyQuestions: questions.filter((_, i) => i !== index) });
    };
    
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b">
                <div className="p-2 rounded bg-gray-200">
                    <PhoneOff className="w-4 h-4 text-gray-700" />
                </div>
                <div>
                    <h3 className="font-semibold">End Node Configuration</h3>
                    <p className="text-xs text-muted-foreground">Configure call termination</p>
                </div>
            </div>

            {/* Label */}
            <div>
                <Label htmlFor="end-label">Node Label</Label>
                <Input
                    id="end-label"
                    value={data.label}
                    onChange={(e) => onChange({ label: e.target.value })}
                    placeholder="e.g., Call Complete"
                    className="mt-1"
                />
            </div>

            {/* End Type */}
            <div>
                <Label htmlFor="end-type">End Type</Label>
                <Select
                    value={data.endType || 'hangup'}
                    onValueChange={(value: any) => onChange({ endType: value })}
                >
                    <SelectTrigger id="end-type" className="mt-1">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="hangup">
                            <div className="flex flex-col items-start">
                                <span className="font-medium">Hangup</span>
                                <span className="text-xs text-muted-foreground">Standard call termination</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="voicemail">
                            <div className="flex flex-col items-start">
                                <span className="font-medium">Voicemail</span>
                                <span className="text-xs text-muted-foreground">Leave message after tone</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="callback_request">
                            <div className="flex flex-col items-start">
                                <span className="font-medium">Callback Request</span>
                                <span className="text-xs text-muted-foreground">Schedule callback</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="satisfaction_survey">
                            <div className="flex flex-col items-start">
                                <span className="font-medium">Satisfaction Survey</span>
                                <span className="text-xs text-muted-foreground">Ask feedback questions</span>
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Closing Message */}
            <div>
                <Label htmlFor="end-message">Closing Message</Label>
                <Textarea
                    id="end-message"
                    value={data.closingMessage || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ closingMessage: e.target.value })}
                    placeholder="Thank you for calling. Have a great day!"
                    className="mt-1"
                    rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                    Message to play before ending call
                </p>
            </div>

            {/* Survey Questions (if survey type) */}
            {data.endType === 'satisfaction_survey' && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label>Survey Questions</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addQuestion}>
                            <Plus className="w-3 h-3 mr-1" />
                            Add Question
                        </Button>
                    </div>
                    
                    {questions.length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed rounded-lg">
                            <p className="text-sm text-muted-foreground">
                                No survey questions. Add questions to collect feedback.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {questions.map((question, index) => (
                                <div key={index} className="p-3 border rounded-lg space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Question {index + 1}</span>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => removeQuestion(index)}
                                        >
                                            <Trash2 className="w-3 h-3 text-destructive" />
                                        </Button>
                                    </div>
                                    
                                    <Input
                                        value={question.question}
                                        onChange={(e) => updateQuestion(index, { question: e.target.value })}
                                        placeholder="How would you rate your experience today?"
                                        className="text-sm"
                                    />
                                    
                                    <Select
                                        value={question.type}
                                        onValueChange={(value: string) => updateQuestion(index, { type: value })}
                                    >
                                        <SelectTrigger className="text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="rating">Rating (1-5)</SelectItem>
                                            <SelectItem value="yesno">Yes/No</SelectItem>
                                            <SelectItem value="text">Text Response</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Info based on type */}
            {data.endType === 'voicemail' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-800">
                        <strong>Voicemail Flow:</strong> Plays closing message, then beep tone. 
                        Records message and creates ticket for follow-up.
                    </p>
                </div>
            )}
            
            {data.endType === 'callback_request' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-800">
                        <strong>Callback Request:</strong> Confirms phone number, preferred callback time, 
                        and creates callback ticket in queue.
                    </p>
                </div>
            )}
        </div>
    );
}
