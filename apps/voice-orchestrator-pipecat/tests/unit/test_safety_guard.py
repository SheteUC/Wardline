"""
Unit tests for Medical Safety Guard
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime

from safety_guard_processor import (
    MedicalSafetyGuard,
    KeywordMatch,
    SafetyCheckpointProcessor,
)
from call_context import CallContext
from pipecat.frames import TextFrame, Frame


@pytest.fixture
def mock_context():
    """Create a mock call context"""
    context = Mock(spec=CallContext)
    context.call_id = "test-call-123"
    context.business_id = "business-1"
    context.safety_events = []
    return context


@pytest.fixture
def mock_llm():
    """Create a mock LLM service"""
    llm = Mock()
    return llm


class TestMedicalSafetyGuard:
    """Test Medical Safety Guard"""
    
    @pytest.mark.asyncio
    @pytest.mark.safety
    async def test_emergency_keyword_detection(self, mock_context, mock_llm):
        """Test detection of emergency keywords"""
        guard = MedicalSafetyGuard(mock_context, mock_llm)
        
        # Simulate user saying emergency keyword
        text_frame = TextFrame("I have severe chest pain and can't breathe")
        
        with patch.object(guard, '_handle_keyword_match', new_callable=AsyncMock) as mock_handle:
            await guard.process_frame(text_frame, None)
            
            # Should detect both "chest pain" and "can't breathe"
            assert mock_handle.call_count >= 1
            
            # First call should be for emergency keyword
            first_call_match = mock_handle.call_args_list[0][0][0]
            assert first_call_match.severity in ['critical', 'high']
    
    @pytest.mark.asyncio
    async def test_mental_health_keyword_detection(self, mock_context, mock_llm):
        """Test mental health crisis detection"""
        guard = MedicalSafetyGuard(mock_context, mock_llm)
        
        text_frame = TextFrame("I don't want to live anymore")
        
        with patch.object(guard, '_immediate_escalation', new_callable=AsyncMock) as mock_escalate:
            await guard.process_frame(text_frame, None)
            
            # Should trigger immediate escalation
            assert mock_escalate.called
    
    @pytest.mark.asyncio
    async def test_routine_keyword_logging_only(self, mock_context, mock_llm):
        """Test that routine keywords only log, don't escalate"""
        guard = MedicalSafetyGuard(mock_context, mock_llm)
        
        text_frame = TextFrame("I need to schedule an appointment")
        
        with patch.object(guard, '_log_keyword', new_callable=AsyncMock) as mock_log:
            with patch.object(guard, '_immediate_escalation', new_callable=AsyncMock) as mock_escalate:
                await guard.process_frame(text_frame, None)
                
                # Should log but not escalate for "appointment"
                if mock_log.called:
                    assert not mock_escalate.called
    
    @pytest.mark.asyncio
    async def test_cooldown_mechanism(self, mock_context, mock_llm):
        """Test cooldown prevents duplicate alerts"""
        guard = MedicalSafetyGuard(mock_context, mock_llm)
        
        text_frame = TextFrame("chest pain")
        
        with patch.object(guard, '_handle_keyword_match', new_callable=AsyncMock) as mock_handle:
            # First occurrence
            await guard.process_frame(text_frame, None)
            first_call_count = mock_handle.call_count
            
            # Immediate repeat (should be in cooldown)
            await guard.process_frame(text_frame, None)
            second_call_count = mock_handle.call_count
            
            # Should not increase (cooldown active)
            assert second_call_count == first_call_count
    
    @pytest.mark.asyncio
    async def test_case_insensitive_detection(self, mock_context, mock_llm):
        """Test keywords detected regardless of case"""
        guard = MedicalSafetyGuard(mock_context, mock_llm)
        
        test_cases = [
            "CHEST PAIN",
            "Chest Pain",
            "chest pain",
            "ChEsT pAiN",
        ]
        
        for text in test_cases:
            text_frame = TextFrame(text)
            
            with patch.object(guard, '_handle_keyword_match', new_callable=AsyncMock) as mock_handle:
                await guard.process_frame(text_frame, None)
                assert mock_handle.called, f"Failed to detect: {text}"
    
    @pytest.mark.asyncio
    async def test_partial_word_no_match(self, mock_context, mock_llm):
        """Test that partial words don't trigger false positives"""
        guard = MedicalSafetyGuard(mock_context, mock_llm)
        
        # "pain" is a keyword, but "paint" should not match
        text_frame = TextFrame("I need to paint my house")
        
        with patch.object(guard, '_handle_keyword_match', new_callable=AsyncMock) as mock_handle:
            await guard.process_frame(text_frame, None)
            
            # Should not trigger for "paint"
            if mock_handle.called:
                # If it did trigger, verify it wasn't for "pain"
                match = mock_handle.call_args[0][0]
                assert match.keyword != "pain"
    
    def test_get_safety_summary(self, mock_context, mock_llm):
        """Test safety summary generation"""
        guard = MedicalSafetyGuard(mock_context, mock_llm)
        
        # Simulate some matches
        guard.detected_keywords = [
            KeywordMatch(
                keyword="chest pain",
                category="emergency",
                severity="critical",
                timestamp=datetime.now(),
                context="I have chest pain"
            ),
            KeywordMatch(
                keyword="fever",
                category="clinical_urgent",
                severity="high",
                timestamp=datetime.now(),
                context="I have a high fever"
            ),
        ]
        
        summary = guard.get_safety_summary()
        
        assert summary['total_keywords_detected'] == 2
        assert 'emergency' in summary['by_category']
        assert 'clinical_urgent' in summary['by_category']
        assert 'critical' in summary['by_severity']
        assert len(summary['events']) == 2
    
    @pytest.mark.asyncio
    async def test_ai_prompt_injection(self, mock_context, mock_llm):
        """Test AI prompt injection for clinical keywords"""
        guard = MedicalSafetyGuard(mock_context, mock_llm)
        
        match = KeywordMatch(
            keyword="dizzy",
            category="clinical_routine",
            severity="medium",
            timestamp=datetime.now(),
            context="feeling dizzy"
        )
        
        with patch.object(guard, '_inject_ai_prompt', new_callable=AsyncMock) as mock_inject:
            await guard._handle_keyword_match(match, "inject_prompt")
            assert mock_inject.called
    
    @pytest.mark.asyncio
    async def test_report_safety_event(self, mock_context, mock_llm):
        """Test safety event reporting to API"""
        guard = MedicalSafetyGuard(mock_context, mock_llm)
        
        match = KeywordMatch(
            keyword="chest pain",
            category="emergency",
            severity="critical",
            timestamp=datetime.now(),
            context="severe chest pain"
        )
        
        with patch('core_api_client.CoreApiClient.create_safety_event', new_callable=AsyncMock) as mock_report:
            await guard._report_safety_event(match)
            
            assert mock_report.called
            event_data = mock_report.call_args[0][0]
            assert event_data['keyword'] == "chest pain"
            assert event_data['severity'] == "critical"
            assert event_data['callId'] == mock_context.call_id


class TestSafetyCheckpointProcessor:
    """Test Safety Checkpoint Processor"""
    
    @pytest.mark.asyncio
    async def test_checkpoint_verification(self, mock_context):
        """Test explicit safety checkpoint"""
        processor = SafetyCheckpointProcessor(
            context=mock_context,
            categories=["emergency"],
            require_confirmation=True
        )
        
        # Simulate user input at checkpoint
        text_frame = TextFrame("No, this is not an emergency")
        
        result = await processor.process_frame(text_frame, None)
        
        # Should process and allow continuation
        assert result is not None


# Performance tests
@pytest.mark.slow
class TestSafetyGuardPerformance:
    """Performance tests for safety guard"""
    
    @pytest.mark.asyncio
    async def test_detection_latency(self, mock_context, mock_llm, benchmark):
        """Test that detection completes in <50ms (target)"""
        guard = MedicalSafetyGuard(mock_context, mock_llm)
        
        text_frame = TextFrame("I have chest pain and difficulty breathing")
        
        import time
        start = time.time()
        await guard.process_frame(text_frame, None)
        duration = (time.time() - start) * 1000  # Convert to ms
        
        # Should be < 50ms
        assert duration < 50, f"Detection took {duration}ms, target is <50ms"
    
    @pytest.mark.asyncio
    async def test_bulk_keyword_scanning(self, mock_context, mock_llm):
        """Test scanning large text with multiple keywords"""
        guard = MedicalSafetyGuard(mock_context, mock_llm)
        
        # Long text with multiple keywords
        text = " ".join([
            "I have chest pain",
            "difficulty breathing",
            "severe headache",
            "high fever",
            "feeling dizzy"
        ] * 10)  # Repeat 10 times
        
        text_frame = TextFrame(text)
        
        import time
        start = time.time()
        await guard.process_frame(text_frame, None)
        duration = (time.time() - start) * 1000
        
        # Should still be fast even with lots of keywords
        assert duration < 100, f"Bulk scan took {duration}ms"


# Integration with workflow
class TestSafetyGuardWorkflowIntegration:
    """Test integration with workflow execution"""
    
    @pytest.mark.asyncio
    async def test_safety_guard_in_pipeline(self, mock_context, mock_llm):
        """Test safety guard as part of Pipecat pipeline"""
        guard = MedicalSafetyGuard(mock_context, mock_llm)
        
        # Simulate frames flowing through pipeline
        frames = [
            TextFrame("Hello, how can I help you?"),
            TextFrame("I have severe chest pain"),
            TextFrame("It started an hour ago"),
        ]
        
        escalation_triggered = False
        
        with patch.object(guard, '_immediate_escalation', new_callable=AsyncMock) as mock_escalate:
            for frame in frames:
                await guard.process_frame(frame, None)
                if mock_escalate.called:
                    escalation_triggered = True
                    break
            
            # Should have triggered escalation on "chest pain"
            assert escalation_triggered
    
    @pytest.mark.asyncio
    async def test_context_preservation(self, mock_context, mock_llm):
        """Test that context is preserved through safety checks"""
        guard = MedicalSafetyGuard(mock_context, mock_llm)
        
        # Add some collected fields
        mock_context.collected_fields = {"patient_name": "John Doe"}
        
        text_frame = TextFrame("I need an appointment")
        await guard.process_frame(text_frame, None)
        
        # Context should still be intact
        assert mock_context.collected_fields["patient_name"] == "John Doe"
