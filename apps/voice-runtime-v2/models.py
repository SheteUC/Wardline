"""
Typed models for Voice Runtime V2.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

DomainName = Literal[
    "safety",
    "knowledge",
    "scheduling",
    "refill",
    "insurance",
    "billing",
    "handoff",
]
KnowledgeTopic = Literal[
    "office_hours",
    "services",
    "after_hours",
    "appointment_policy",
    "refill_policy",
    "insurance_policy",
    "billing_policy",
    "recording_policy",
    "transcript_retention",
    "custom_faq",
]
InsuranceInquiryType = Literal[
    "acceptance",
    "eligibility",
    "coverage",
    "claim_status",
    "prior_auth_status",
]
CallLifecycleStatus = Literal[
    "INITIATED",
    "ONGOING",
    "COMPLETED",
    "ABANDONED",
    "FAILED",
]
SpecialistStatus = Literal[
    "answered",
    "needs_information",
    "ready_for_confirmation",
    "execute_now",
    "voicemail",
    "handoff",
    "clarify",
]
SupervisorMode = Literal["delegate", "clarify", "continue", "knowledge", "handoff"]
TurnStage = Literal["intake", "confirmation", "voicemail", "handoff", "closing", "completed"]
IntentKind = Literal["knowledge", "action", "handoff"]
IntentStatus = Literal["detected", "queued", "selected", "active", "paused", "resolved", "cancelled", "dropped"]


class AfterHoursPolicy(BaseModel):
    mode: Literal["urgent_voicemail", "voicemail", "next_business_day_callback"]
    greeting: str
    sendUrgentToVoicemail: bool


class DaytimeHandoffPolicy(BaseModel):
    mode: Literal["hybrid_transfer", "callback_only", "transfer_first"] = "hybrid_transfer"
    transferTargetLabel: str = "front desk"
    transferPhone: str = ""
    ringTimeoutSeconds: int = 20
    collectReasonFirst: bool = True
    fallbackSummary: str = ""


class KnowledgeFaqItem(BaseModel):
    question: str = ""
    answer: str = ""
    routeTo: Optional[Literal["knowledge", "scheduling", "refill", "insurance", "billing", "handoff"]] = None


class KnowledgeConfig(BaseModel):
    faqSummary: str = ""
    commonQuestions: List[str] = Field(default_factory=list)
    servicesSummary: str = ""
    appointmentSummary: str = ""
    refillSummary: str = ""
    insuranceSummary: str = ""
    billingSummary: str = ""
    customFaqs: List[KnowledgeFaqItem] = Field(default_factory=list)


class ServicePolicy(BaseModel):
    enabled: bool = False
    runtimeAction: str
    integrationCategory: str
    liveEnabled: bool = False
    intakeNotes: str = ""
    fallbackSummary: str = ""


class EscalationConfig(BaseModel):
    urgentCallbackWindowMinutes: int = 30
    escalationMessage: str = ""
    notifyStaffImmediately: bool = True


class DialoguePolicy(BaseModel):
    callerIntro: str = ""
    clarificationStyle: str = ""
    slotPrompts: Dict[str, str] = Field(default_factory=dict)
    confirmationTemplate: str = ""
    successTemplate: str = ""
    fallbackTemplate: str = ""
    closeTemplate: str = ""


class VoicePolicyV2(BaseModel):
    version: Literal["v2"] = "v2"
    runtime: Literal["internal-multi-agent"] = "internal-multi-agent"
    speaker: Literal["supervisor"] = "supervisor"
    enabledDomains: List[DomainName] = Field(default_factory=list)
    connectedCategories: List[str] = Field(default_factory=list)
    writeActionsRequiringConfirmation: List[str] = Field(default_factory=list)
    afterHoursPolicy: AfterHoursPolicy
    daytimeHandoffPolicy: DaytimeHandoffPolicy = Field(default_factory=DaytimeHandoffPolicy)
    knowledgeConfig: KnowledgeConfig
    servicePolicies: Dict[str, ServicePolicy]
    escalationConfig: EscalationConfig
    dialoguePolicies: Dict[str, DialoguePolicy] = Field(default_factory=dict)
    emergencyKeywords: List[str] = Field(default_factory=list)
    outOfScopeKeywords: List[str] = Field(default_factory=list)
    fallbackRuntimeAction: str = "manual-follow-up"
    operatorSummaryEnabled: bool = True


class BusinessProfile(BaseModel):
    id: str
    name: str
    slug: str
    timeZone: str
    status: str


class RuntimeSettings(BaseModel):
    operatingHours: List[Dict[str, Any]] = Field(default_factory=list)


class RuntimeConfigBootstrap(BaseModel):
    business: BusinessProfile
    settings: Dict[str, Any]
    voicePolicyV2: VoicePolicyV2
    connectedIntegrationCategories: List[str] = Field(default_factory=list)


class KnowledgeMatch(BaseModel):
    topic: KnowledgeTopic
    answer: str
    matchedKeywords: List[str] = Field(default_factory=list)
    source: str = ""
    routeToDomain: Optional[DomainName] = None


class FollowOnIntent(BaseModel):
    domain: DomainName
    text: str
    knowledgeTopic: Optional[KnowledgeTopic] = None
    reason: str


class SupervisorDecision(BaseModel):
    mode: SupervisorMode
    domain: DomainName
    confidence: float
    reason: str
    continuation: bool = False
    clarificationPrompt: Optional[str] = None
    knowledgeTopic: Optional[KnowledgeTopic] = None
    matchedKeywords: List[str] = Field(default_factory=list)
    followOnIntent: Optional[FollowOnIntent] = None
    fragmentText: Optional[str] = None
    detectedIntents: List["DetectedIntent"] = Field(default_factory=list)
    selectedIntentId: Optional[str] = None
    priorityRequired: bool = False


class OperatorSummary(BaseModel):
    headline: str
    nextStep: str
    specialist: DomainName
    callerRequest: str
    followUpRequired: bool = False
    handledLive: Optional[bool] = None
    fallbackReason: Optional[str] = None


class RuntimeActionOutcome(BaseModel):
    actionName: str
    handledLive: bool = False
    fallbackCreated: bool = False
    requiresStaffFollowUp: bool = False
    message: str
    followUpTaskId: Optional[str] = None
    fallbackReason: Optional[str] = None
    integration: Dict[str, Any] = Field(default_factory=dict)
    data: Dict[str, Any] = Field(default_factory=dict)
    latencyMs: Optional[float] = None


class SpecialistResult(BaseModel):
    domain: DomainName
    status: SpecialistStatus
    confidence: float
    nextPrompt: str
    extractedFields: Dict[str, Any] = Field(default_factory=dict)
    missingFields: List[str] = Field(default_factory=list)
    confirmationSummary: Optional[str] = None
    runtimeAction: Optional[str] = None
    runtimePayload: Dict[str, Any] = Field(default_factory=dict)
    fallbackRecommendation: Optional[str] = None
    operatorSummary: Optional[OperatorSummary] = None
    callerRequestSummary: Optional[str] = None
    requestHumanFollowUp: bool = False
    resolved: bool = False


class SessionEvent(BaseModel):
    type: str
    actionName: str
    domain: Optional[DomainName] = None
    status: Optional[SpecialistStatus] = None
    integrationCategory: Optional[str] = None
    integrationVendor: Optional[str] = None
    handledLive: bool = False
    followUpTaskId: Optional[str] = None
    fallbackReason: Optional[str] = None
    operatorSummary: Optional[str] = None
    callerName: Optional[str] = None
    callerPhone: Optional[str] = None
    requiresFollowUp: bool = False
    data: Dict[str, Any] = Field(default_factory=dict)
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PendingAction(BaseModel):
    actionName: str
    summary: str
    confirmationPrompt: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    domain: DomainName
    callerRequestSummary: str = ""
    fallbackRecommendation: Optional[str] = None
    confirmAttempts: int = 0
    requestedChanges: List[str] = Field(default_factory=list)
    slotState: Dict[str, Any] = Field(default_factory=dict)
    repairPrompt: Optional[str] = None


class DetectedIntent(BaseModel):
    intentId: str = Field(default_factory=lambda: str(uuid4()))
    domain: DomainName
    kind: IntentKind
    sourceText: str = ""
    summary: str = ""
    status: IntentStatus = "detected"
    detectedOrder: int = 0
    selectedOrder: Optional[int] = None
    knowledgeTopic: Optional[KnowledgeTopic] = None
    matchedKeywords: List[str] = Field(default_factory=list)
    slotState: Dict[str, Any] = Field(default_factory=dict)
    missingFields: List[str] = Field(default_factory=list)
    pendingAction: Optional[PendingAction] = None


class PriorityPromptState(BaseModel):
    active: bool = False
    promptType: Literal["initial", "switch", "resume", "knowledge"] = "initial"
    promptText: str = ""
    intentIds: List[str] = Field(default_factory=list)
    knowledgeReply: Optional[str] = None
    requestedAt: Optional[str] = None


class IntentQueueState(BaseModel):
    intents: List[DetectedIntent] = Field(default_factory=list)
    activeIntentId: Optional[str] = None
    nextDetectedOrder: int = 1
    nextSelectedOrder: int = 1


class SchedulingSlotState(BaseModel):
    requestType: Literal["schedule", "reschedule", "cancel"] = "schedule"
    visitType: Optional[str] = None
    preferredDate: Optional[str] = None
    preferredTime: Optional[str] = None
    notes: List[str] = Field(default_factory=list)


class RefillSlotState(BaseModel):
    medicationName: Optional[str] = None
    callerDob: Optional[str] = None
    pharmacyName: Optional[str] = None
    pharmacyPhone: Optional[str] = None
    prescriberName: Optional[str] = None
    notes: List[str] = Field(default_factory=list)


class BillingSlotState(BaseModel):
    billingTopic: Optional[str] = None
    accountReference: Optional[str] = None
    notes: List[str] = Field(default_factory=list)


class InsuranceSlotState(BaseModel):
    inquiryType: Optional[InsuranceInquiryType] = None
    carrierName: Optional[str] = None
    planName: Optional[str] = None
    memberId: Optional[str] = None
    groupNumber: Optional[str] = None
    patientName: Optional[str] = None
    patientDob: Optional[str] = None
    subscriberRelation: Optional[Literal["self", "spouse", "child", "other"]] = None
    serviceType: Optional[str] = None
    callbackPhone: Optional[str] = None
    notes: List[str] = Field(default_factory=list)


class HandoffSlotState(BaseModel):
    reasonSummary: Optional[str] = None
    callbackPhone: Optional[str] = None
    preferredCallbackWindow: Optional[str] = None
    reasonCategory: Optional[Literal["general", "appointments", "refill", "insurance", "billing", "clinical"]] = None
    transferConsent: Optional[bool] = None
    notes: List[str] = Field(default_factory=list)


class TransferAttemptState(BaseModel):
    active: bool = False
    intentId: Optional[str] = None
    transferTargetLabel: str = ""
    transferPhone: str = ""
    reasonSummary: str = ""
    reasonCategory: Optional[str] = None
    callbackPhone: Optional[str] = None
    preferredCallbackWindow: Optional[str] = None
    pendingIssues: List[str] = Field(default_factory=list)
    queueSnapshot: List[Dict[str, Any]] = Field(default_factory=list)
    escalationRecord: Dict[str, Any] = Field(default_factory=dict)
    requestedAt: Optional[str] = None


class FinalCloseState(BaseModel):
    active: bool = False
    playbackCompleted: bool = False
    finalMessageId: Optional[str] = None
    reason: Optional[str] = None
    passiveSince: Optional[str] = None


class VoicemailCaptureState(BaseModel):
    active: bool = False
    captured: bool = False
    captureCount: int = 0
    transcription: Optional[str] = None


class SessionMessage(BaseModel):
    messageId: str = Field(default_factory=lambda: str(uuid4()))
    role: Literal["caller", "assistant", "system"]
    text: str
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SessionTransportMetadata(BaseModel):
    runtime: Literal["voice-runtime-v2"] = "voice-runtime-v2"
    transport: Literal["livekit"] = "livekit"
    sessionId: str
    businessId: str
    roomName: str
    participantIdentity: str
    livekitUrl: str = ""
    livekitAccessToken: str = ""
    twilioCallSid: Optional[str] = None
    twilioMediaStreamUrl: str = ""
    twilioStreamSid: Optional[str] = None
    deepgramRequestId: Optional[str] = None
    providerSessionId: Optional[str] = None


class SessionState(BaseModel):
    sessionId: str
    callSid: str
    callId: Optional[str] = None
    businessId: str
    callerPhone: str
    calledPhone: str
    callerName: Optional[str] = None
    businessName: str
    runtimeConfig: RuntimeConfigBootstrap
    transport: SessionTransportMetadata
    intent: Optional[DomainName] = None
    activeDomain: Optional[DomainName] = None
    lifecycleStatus: CallLifecycleStatus = "INITIATED"
    stage: TurnStage = "intake"
    intentQueue: IntentQueueState = Field(default_factory=IntentQueueState)
    awaitingIntentPriority: bool = False
    priorityPromptState: PriorityPromptState = Field(default_factory=PriorityPromptState)
    pausedDomainState: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    slotState: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    slotRetryCounts: Dict[str, int] = Field(default_factory=dict)
    missingSlots: List[str] = Field(default_factory=list)
    pendingConfirmation: Optional[PendingAction] = None
    awaitingVoicemail: bool = False
    awaitingAnythingElse: bool = False
    isAfterHours: bool = False
    isEmergency: bool = False
    finalCloseState: FinalCloseState = Field(default_factory=FinalCloseState)
    voicemailCaptureState: VoicemailCaptureState = Field(default_factory=VoicemailCaptureState)
    transferAttempt: TransferAttemptState = Field(default_factory=TransferAttemptState)
    messages: List[SessionMessage] = Field(default_factory=list)
    events: List[SessionEvent] = Field(default_factory=list)
    completedDomains: List[DomainName] = Field(default_factory=list)
    lastDecision: Optional[SupervisorDecision] = None
    lastSpecialistResult: Optional[SpecialistResult] = None
    lastOperatorSummary: Optional[OperatorSummary] = None
    turns: int = 0
    transcriptCursorMs: int = 0
    runtimeFailureReason: Optional[str] = None


SupervisorDecision.model_rebuild()
DetectedIntent.model_rebuild()
IntentQueueState.model_rebuild()
SessionState.model_rebuild()
