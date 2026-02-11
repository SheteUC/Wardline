"""
Medical Safety Guard - Real-time keyword monitoring as Pipecat frame processor
Monitors conversation for medical keywords and triggers appropriate actions
"""
import asyncio
from typing import Dict, List, Set, Optional
from dataclasses import dataclass, field
from loguru import logger

from pipecat.frames.frames import Frame, TranscriptionFrame, TextFrame, SystemFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from call_context import CallContext, CallState
from core_api_client import api_client


@dataclass
class KeywordMatch:
    """Information about a matched keyword"""
    keyword: str
    category: str
    severity: str  # emergency, high, medium, low
    context: str  # Text snippet where keyword was found
    timestamp: str
    action_taken: str


class MedicalSafetyGuard(FrameProcessor):
    """
    Real-time medical safety monitoring processor
    
    Monitors user utterances for medical keywords and takes appropriate actions:
    - Emergency keywords: Immediate escalation
    - Clinical keywords: Flag for review, inject AI prompt
    - Mental health keywords: Urgent escalation
    - Administrative keywords: Log only
    """
    
    # Medical keyword database (organized by category and severity)
    KEYWORDS = {
        "emergency": {
            "severity": "critical",
            "keywords": [
                # Cardiac
                "chest pain", "heart attack", "cardiac arrest", "heart stopped",
                
                # Respiratory
                "can't breathe", "difficulty breathing", "not breathing", "choking",
                "gasping for air", "short of breath severe",
                
                # Neurological
                "stroke", "seizure", "unconscious", "unresponsive", "passed out",
                "can't move", "slurred speech", "paralysis",
                
                # Trauma
                "severe bleeding", "profuse bleeding", "arterial bleeding",
                "major injury", "severe trauma", "broken bone protruding",
                
                # Allergic
                "anaphylaxis", "severe allergic reaction", "throat closing",
                "swelling rapidly",
                
                # Other critical
                "overdose", "poisoning", "severe burn", "loss of consciousness",
            ],
            "action": "immediate_escalation"
        },
        
        "mental_health": {
            "severity": "critical",
            "keywords": [
                "suicide", "suicidal", "kill myself", "end my life", "want to die",
                "not worth living", "better off dead", "self harm", "cutting myself",
                "overdose intentional", "end it all", "say goodbye",
            ],
            "action": "immediate_escalation"
        },
        
        "clinical_urgent": {
            "severity": "high",
            "keywords": [
                # Pain
                "severe pain", "pain level 10", "unbearable pain", "excruciating",
                
                # Symptoms
                "severe headache", "worst headache", "vision loss", "sudden weakness",
                "numbness", "tingling severe", "dizziness severe", "vomiting blood",
                "blood in stool", "blood in urine",
                
                # Pregnancy
                "pregnancy emergency", "miscarriage", "severe cramping pregnant",
                "bleeding pregnant",
                
                # Infection
                "high fever", "fever over 103", "fever with rash", "severe infection",
                "sepsis", "rapid heart rate",
            ],
            "action": "urgent_escalation"
        },
        
        "clinical_routine": {
            "severity": "medium",
            "keywords": [
                # General symptoms
                "fever", "cough", "sore throat", "headache", "nausea",
                "vomiting", "diarrhea", "constipation", "rash", "infection",
                
                # Chronic conditions
                "diabetes", "hypertension", "asthma", "copd", "arthritis",
                
                # Procedures
                "surgery", "procedure", "operation", "biopsy", "endoscopy",
                
                # Medications
                "medication", "prescription", "side effect", "drug interaction",
                
                # Pain
                "pain", "ache", "discomfort", "soreness",
            ],
            "action": "ai_prompt_injection"
        },
        
        "administrative": {
            "severity": "low",
            "keywords": [
                "appointment", "schedule", "reschedule", "cancel",
                "billing", "insurance", "payment", "cost", "charge",
                "medical records", "test results", "lab results",
                "referral", "authorization", "prior auth",
            ],
            "action": "log_only"
        }
    }
    
    def __init__(self, context: CallContext, llm_service=None):
        super().__init__()
        self.context = context
        self.llm = llm_service
        self.matches: List[KeywordMatch] = []
        self._last_alert_time = {}  # Prevent duplicate alerts
        self._alert_cooldown = 30  # seconds
    
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Process frames and check for safety keywords"""
        await super().process_frame(frame, direction)
        
        # Only monitor user transcriptions
        if isinstance(frame, TranscriptionFrame) and direction == FrameDirection.UPSTREAM:
            text = frame.text.strip()
            if text:
                await self._scan_text(text)
        
        await self.push_frame(frame, direction)
    
    async def _scan_text(self, text: str):
        """Scan text for medical keywords"""
        text_lower = text.lower()
        
        # Check each category
        for category, config in self.KEYWORDS.items():
            severity = config["severity"]
            keywords = config["keywords"]
            action = config["action"]
            
            # Check for keyword matches
            matched_keywords = [kw for kw in keywords if kw in text_lower]
            
            if matched_keywords:
                from datetime import datetime
                
                for keyword in matched_keywords:
                    # Check cooldown to prevent duplicate alerts
                    if self._should_alert(keyword):
                        match = KeywordMatch(
                            keyword=keyword,
                            category=category,
                            severity=severity,
                            context=text[:100],  # First 100 chars
                            timestamp=datetime.now().isoformat(),
                            action_taken=""
                        )
                        
                        # Take action based on severity
                        await self._handle_keyword_match(match, action)
                        
                        self.matches.append(match)
                        
                        # Update last alert time
                        self._last_alert_time[keyword] = datetime.now().timestamp()
    
    def _should_alert(self, keyword: str) -> bool:
        """Check if enough time has passed since last alert for this keyword"""
        from datetime import datetime
        
        if keyword not in self._last_alert_time:
            return True
        
        last_time = self._last_alert_time[keyword]
        current_time = datetime.now().timestamp()
        
        return (current_time - last_time) > self._alert_cooldown
    
    async def _handle_keyword_match(self, match: KeywordMatch, action: str):
        """Handle a keyword match based on action type"""
        logger.warning(
            f"🛡️ SAFETY ALERT: '{match.keyword}' detected "
            f"(category: {match.category}, severity: {match.severity})"
        )
        
        if action == "immediate_escalation":
            await self._immediate_escalation(match)
            match.action_taken = "immediate_escalation"
        
        elif action == "urgent_escalation":
            await self._urgent_escalation(match)
            match.action_taken = "urgent_escalation"
        
        elif action == "ai_prompt_injection":
            await self._inject_ai_prompt(match)
            match.action_taken = "ai_prompt_injection"
        
        elif action == "log_only":
            await self._log_keyword(match)
            match.action_taken = "log_only"
        
        # Send safety event to Core API
        await self._report_safety_event(match)
    
    async def _immediate_escalation(self, match: KeywordMatch):
        """
        Immediate escalation for emergency keywords
        Bypasses workflow and escalates directly
        """
        logger.critical(
            f"🚨 IMMEDIATE ESCALATION: {match.keyword} "
            f"(call: {self.context.call_sid})"
        )
        
        # Set emergency flags
        self.context.is_emergency = True
        self.context.state = CallState.ESCALATING
        self.context.escalation_reason = f"Emergency keyword detected: {match.keyword}"
        
        # This will trigger the workflow to escalate
        # The actual escalation happens in the flow manager
    
    async def _urgent_escalation(self, match: KeywordMatch):
        """
        Urgent escalation for high-priority clinical keywords
        Sets escalation flag but may allow AI to collect info first
        """
        logger.warning(
            f"⚠️ URGENT ESCALATION NEEDED: {match.keyword} "
            f"(call: {self.context.call_sid})"
        )
        
        self.context.sentiment.escalation_needed = True
        self.context.escalation_reason = f"Clinical keyword detected: {match.keyword}"
        
        # Inject prompt to AI to acknowledge and prepare for escalation
        if self.llm:
            prompt = (
                f"IMPORTANT: The caller mentioned '{match.keyword}' which requires clinical attention. "
                f"Acknowledge their concern empathetically and inform them you're connecting them with "
                f"a medical professional who can help."
            )
            # This would be injected into the LLM context in the pipeline
    
    async def _inject_ai_prompt(self, match: KeywordMatch):
        """
        Inject context into AI prompt for routine clinical keywords
        Helps AI respond appropriately without full escalation
        """
        logger.info(
            f"💉 AI PROMPT INJECTION: {match.keyword} "
            f"(call: {self.context.call_sid})"
        )
        
        prompts = {
            "clinical_routine": (
                f"CONTEXT: The caller mentioned '{match.keyword}'. "
                f"This is a clinical topic. Be supportive and help them schedule "
                f"an appointment or connect with appropriate department. "
                f"Do not provide medical advice."
            ),
        }
        
        prompt = prompts.get(match.category, "")
        
        # Store in context for pipeline to use
        if not hasattr(self.context, '_injected_prompts'):
            self.context._injected_prompts = []
        self.context._injected_prompts.append(prompt)
    
    async def _log_keyword(self, match: KeywordMatch):
        """Log administrative keywords for analytics"""
        logger.debug(
            f"📝 KEYWORD LOGGED: {match.keyword} "
            f"(category: {match.category})"
        )
        
        # Just log for now, can be used for analytics later
    
    async def _report_safety_event(self, match: KeywordMatch):
        """Report safety event to Core API for audit trail"""
        try:
            if not self.context.call_id:
                return
            
            event_data = {
                "call_id": self.context.call_id,
                "hospital_id": self.context.hospital_id,
                "keyword": match.keyword,
                "category": match.category,
                "severity": match.severity,
                "context": match.context,
                "action_taken": match.action_taken,
                "timestamp": match.timestamp,
                "is_emergency": self.context.is_emergency,
            }
            
            # Send to Core API
            # Note: This endpoint will be created in Phase 2
            await api_client.create_safety_event(event_data)
            
        except Exception as e:
            logger.error(f"Error reporting safety event: {e}")
    
    def get_safety_summary(self) -> Dict:
        """Get summary of safety events for this call"""
        return {
            "total_matches": len(self.matches),
            "by_category": self._count_by_category(),
            "by_severity": self._count_by_severity(),
            "critical_events": [
                {
                    "keyword": m.keyword,
                    "category": m.category,
                    "timestamp": m.timestamp,
                }
                for m in self.matches
                if m.severity == "critical"
            ],
            "is_emergency": self.context.is_emergency,
            "escalation_needed": self.context.sentiment.escalation_needed,
        }
    
    def _count_by_category(self) -> Dict[str, int]:
        """Count matches by category"""
        counts = {}
        for match in self.matches:
            counts[match.category] = counts.get(match.category, 0) + 1
        return counts
    
    def _count_by_severity(self) -> Dict[str, int]:
        """Count matches by severity"""
        counts = {}
        for match in self.matches:
            counts[match.severity] = counts.get(match.severity, 0) + 1
        return counts


class SafetyCheckpointProcessor(FrameProcessor):
    """
    Explicit safety checkpoint processor
    Used at specific points in workflow (safety-check nodes)
    """
    
    def __init__(self, context: CallContext, required_categories: List[str]):
        super().__init__()
        self.context = context
        self.required_categories = required_categories
        self.guard = MedicalSafetyGuard(context)
    
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        """Process frame and check required safety categories"""
        await super().process_frame(frame, direction)
        
        # Run safety check on recent conversation
        if isinstance(frame, SystemFrame) and frame.name == "safety_checkpoint":
            await self._run_safety_check()
        
        await self.push_frame(frame, direction)
    
    async def _run_safety_check(self):
        """Run explicit safety check"""
        logger.info(f"🛡️ Running safety checkpoint (categories: {self.required_categories})")
        
        # Get recent conversation
        recent_text = self.context.get_conversation_text(last_n=10)
        
        # Scan with guard
        await self.guard._scan_text(recent_text)
        
        # Check if any critical matches
        summary = self.guard.get_safety_summary()
        
        if summary["critical_events"]:
            logger.warning(
                f"🚨 Safety checkpoint failed: "
                f"{len(summary['critical_events'])} critical events"
            )
        else:
            logger.info("✅ Safety checkpoint passed")
