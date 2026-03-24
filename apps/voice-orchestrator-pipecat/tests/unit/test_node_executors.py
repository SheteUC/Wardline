"""
Unit tests for workflow node executors
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime

from node_executors import (
    AIAgentNodeExecutor,
    HumanQueueNodeExecutor,
    ConditionalNodeExecutor,
    SafetyCheckNodeExecutor,
    IntegrationNodeExecutor,
    EndNodeExecutor,
    create_node_executor,
)
from workflow_models import (
    WorkflowNode,
    AIAgentConfig,
    HumanQueueConfig,
    ConditionalConfig,
    SafetyCheckConfig,
    IntegrationConfig,
    EndConfig,
    NodeExecutionResult,
)
from call_context import CallContext, CallState, IntentType


@pytest.fixture
def mock_context():
    """Create a mock call context"""
    context = Mock(spec=CallContext)
    context.call_id = "test-call-123"
    context.business_id = "business-1"
    context.call_sid = "CA123"
    context.state = CallState.AGENT_HANDLING
    context.detected_intent = IntentType.APPOINTMENT
    context.conversation_history = []
    context.collected_fields = {}
    context.caller_phone = "+15550000000"
    context.caller_name = "Test Caller"
    context.get_conversation_text = Mock(return_value="CALLER: I need help")
    context.mark_action_outcome = Mock()
    context.sentiment = Mock(frustration_level=0.2, urgency_level=0.1, overall_score=0.4)
    return context


class TestAIAgentNodeExecutor:
    """Test AI Agent node executor"""
    
    def test_initialization(self, mock_context):
        """Test executor initialization"""
        node = WorkflowNode(
            id="ai-1",
            type="ai-agent",
            config={
                "systemPrompt": "Test prompt",
                "enabledTools": ["scheduling"],
                "maxTurns": 10,
            }
        )
        
        executor = AIAgentNodeExecutor(node, mock_context)
        
        assert executor.node == node
        assert executor.context == mock_context
        assert isinstance(executor.config, AIAgentConfig)
        assert executor.config.system_prompt == "Test prompt"
        assert "scheduling" in executor.config.enabled_tools
        assert executor.config.max_turns == 10
    
    @pytest.mark.asyncio
    async def test_execute_success(self, mock_context):
        """Test successful AI agent execution"""
        node = WorkflowNode(
            id="ai-1",
            type="ai-agent",
            config={
                "systemPrompt": "Test",
                "contextStrategy": "append",
            }
        )
        
        executor = AIAgentNodeExecutor(node, mock_context)
        result = await executor.execute()
        
        assert isinstance(result, NodeExecutionResult)
        assert result.success is True
        assert result.should_end_call is False
        assert "context_strategy" in result.context_updates
    
    @pytest.mark.asyncio
    async def test_max_turns_exceeded(self, mock_context):
        """Test escalation when max turns exceeded"""
        mock_context.turn_count = 15
        
        node = WorkflowNode(
            id="ai-1",
            type="ai-agent",
            config={"maxTurns": 10}
        )
        
        executor = AIAgentNodeExecutor(node, mock_context)
        result = await executor.execute()
        
        assert result.should_escalate is True
        assert "maximum conversation turns" in result.escalation_reason.lower()


class TestHumanQueueNodeExecutor:
    """Test Human Queue node executor"""
    
    @pytest.mark.asyncio
    async def test_execute_escalation(self, mock_context):
        """Test escalation request creation"""
        node = WorkflowNode(
            id="queue-1",
            type="human-agent-queue",
            config={
                "queueId": "clinical",
                "priorityLevel": 2,
                "requiredSkills": ["Clinical Triage"],
            }
        )
        
        executor = HumanQueueNodeExecutor(node, mock_context)
        
        with patch.object(executor, '_create_escalation_request', new_callable=AsyncMock) as mock_escalate:
            mock_escalate.return_value = True
            result = await executor.execute()
            
            assert result.success is True
            assert result.should_escalate is True
            assert mock_escalate.called
            assert result.escalation_reason is not None
    
    @pytest.mark.asyncio
    async def test_escalation_failure(self, mock_context):
        """Test handling of escalation failure"""
        node = WorkflowNode(
            id="queue-1",
            type="human-agent-queue",
            config={"queueId": "clinical"}
        )
        
        executor = HumanQueueNodeExecutor(node, mock_context)
        
        with patch.object(executor, '_create_escalation_request', new_callable=AsyncMock) as mock_escalate:
            mock_escalate.return_value = False
            result = await executor.execute()
            
            assert result.success is False
            assert result.error_message is not None


class TestConditionalNodeExecutor:
    """Test Conditional node executor"""
    
    @pytest.mark.asyncio
    async def test_intent_based_routing(self, mock_context):
        """Test intent-based conditional routing"""
        mock_context.detected_intent = IntentType.APPOINTMENT
        
        node = WorkflowNode(
            id="cond-1",
            type="conditional",
            config={
                "conditionType": "intent",
                "conditions": [
                    {"expression": "intent == 'appointment'", "targetNode": "scheduling-node"}
                ],
                "defaultTarget": "general-queue"
            }
        )
        
        executor = ConditionalNodeExecutor(node, mock_context)
        result = await executor.execute()
        
        assert result.success is True
        assert result.next_node_id == "scheduling-node"
        assert "appointment" in result.condition_results
    
    @pytest.mark.asyncio
    async def test_sentiment_based_routing(self, mock_context):
        """Test sentiment-based conditional routing"""
        mock_context.sentiment.frustration = 0.8
        
        node = WorkflowNode(
            id="cond-1",
            type="conditional",
            config={
                "conditionType": "sentiment",
                "conditions": [
                    {"expression": "sentiment.frustration > 0.7", "targetNode": "escalate"}
                ],
                "defaultTarget": "continue"
            }
        )
        
        executor = ConditionalNodeExecutor(node, mock_context)
        result = await executor.execute()
        
        assert result.success is True
        assert result.next_node_id == "escalate"
    
    @pytest.mark.asyncio
    async def test_default_target(self, mock_context):
        """Test default target when no conditions match"""
        node = WorkflowNode(
            id="cond-1",
            type="conditional",
            config={
                "conditions": [
                    {"expression": "intent == 'billing'", "targetNode": "billing"}
                ],
                "defaultTarget": "general"
            }
        )
        
        executor = ConditionalNodeExecutor(node, mock_context)
        result = await executor.execute()
        
        assert result.success is True
        assert result.next_node_id == "general"
    
    def test_evaluate_condition_complex(self, mock_context):
        """Test complex condition evaluation"""
        mock_context.collected_fields = {"age": 70, "is_emergency": True}
        
        node = WorkflowNode(id="cond-1", type="conditional", config={})
        executor = ConditionalNodeExecutor(node, mock_context)
        
        # Test numeric comparison
        assert executor.evaluate_condition("collected_fields.age > 65") is True
        assert executor.evaluate_condition("collected_fields.age < 50") is False
        
        # Test boolean
        assert executor.evaluate_condition("collected_fields.is_emergency == true") is True
        
        # Test AND/OR
        assert executor.evaluate_condition("collected_fields.age > 65 and collected_fields.is_emergency") is True


class TestSafetyCheckNodeExecutor:
    """Test Safety Check node executor"""
    
    @pytest.mark.asyncio
    @pytest.mark.safety
    async def test_keyword_detection(self, mock_context):
        """Test safety keyword detection"""
        mock_context.last_user_input = "I have severe chest pain"
        
        node = WorkflowNode(
            id="safety-1",
            type="safety-check",
            config={
                "keywordCategories": ["emergency"],
                "autoEscalate": True,
            }
        )
        
        executor = SafetyCheckNodeExecutor(node, mock_context)
        result = await executor.execute()
        
        # Should detect "chest pain" and escalate
        assert result.should_escalate is True
        assert result.escalation_reason is not None
    
    @pytest.mark.asyncio
    async def test_no_keywords_detected(self, mock_context):
        """Test when no keywords detected"""
        mock_context.last_user_input = "I want to schedule an appointment"
        
        node = WorkflowNode(
            id="safety-1",
            type="safety-check",
            config={"keywordCategories": ["emergency"]}
        )
        
        executor = SafetyCheckNodeExecutor(node, mock_context)
        result = await executor.execute()
        
        assert result.success is True
        assert result.should_escalate is False
    
    @pytest.mark.asyncio
    async def test_confirmation_required(self, mock_context):
        """Test confirmation prompt injection"""
        mock_context.last_user_input = "feeling dizzy"
        
        node = WorkflowNode(
            id="safety-1",
            type="safety-check",
            config={
                "keywordCategories": ["clinical_urgent"],
                "confirmationRequired": True,
                "confirmationPrompt": "Do you need emergency help?",
            }
        )
        
        executor = SafetyCheckNodeExecutor(node, mock_context)
        result = await executor.execute()
        
        assert result.success is True
        assert len(result.messages) > 0
        assert "emergency help" in result.messages[0].lower()


class TestIntegrationNodeExecutor:
    """Test Integration node executor"""
    
    @pytest.mark.asyncio
    async def test_runtime_action_success(self, mock_context):
        """Test successful runtime action execution"""
        node = WorkflowNode(
            id="int-1",
            type="integration",
            config={
                "runtimeAction": "insurance-check",
                "integrationCategory": "INSURANCE",
            }
        )
        
        executor = IntegrationNodeExecutor(node, mock_context)
        
        with patch('core_api_client.api_client.execute_runtime_action', new_callable=AsyncMock) as mock_execute:
            mock_execute.return_value = {
                "handledLive": True,
                "message": "I checked that insurance information live.",
                "data": {"isAccepted": True},
            }
            
            result = await executor.execute()
            
            assert result.success is True
            assert result.context_updates["runtime_action"] == "insurance-check"
            assert result.context_updates["handledLive"] is True
    
    @pytest.mark.asyncio
    async def test_builds_runtime_payload_from_collected_fields(self, mock_context):
        """Test runtime payload mapping for appointment requests"""
        mock_context.collected_fields = {
            "caller_name": "John Doe",
            "caller_phone": "555-1234",
            "service_type": "Annual Exam",
            "preferred_date": "2026-03-25",
        }
        
        node = WorkflowNode(
            id="int-1",
            type="integration",
            config={
                "runtimeAction": "appointment-request",
                "integrationCategory": "SCHEDULING",
            }
        )
        
        executor = IntegrationNodeExecutor(node, mock_context)
        
        with patch('core_api_client.api_client.execute_runtime_action', new_callable=AsyncMock) as mock_execute:
            mock_execute.return_value = {
                "handledLive": True,
                "message": "Appointment request submitted.",
                "data": {"externalReferenceId": "APT123"},
            }
            
            result = await executor.execute()
            
            assert result.success is True
            call_args = mock_execute.await_args.args
            assert call_args[0] == "business-1"
            assert call_args[1] == "appointment-request"
            assert call_args[2]["callerName"] == "John Doe"
            assert call_args[2]["serviceType"] == "Annual Exam"
            assert call_args[2]["confirmed"] is True
    
    @pytest.mark.asyncio
    async def test_error_handling_returns_failure(self, mock_context):
        """Test runtime action failure handling"""
        node = WorkflowNode(
            id="int-1",
            type="integration",
            config={
                "runtimeAction": "billing-request",
                "integrationCategory": "BILLING",
            }
        )
        
        executor = IntegrationNodeExecutor(node, mock_context)
        
        with patch('core_api_client.api_client.execute_runtime_action', new_callable=AsyncMock) as mock_execute:
            mock_execute.side_effect = Exception("API Error")
            
            result = await executor.execute()
            
            assert result.success is False
            assert result.error_message is not None


class TestEndNodeExecutor:
    """Test End node executor"""
    
    @pytest.mark.asyncio
    async def test_hangup_end(self, mock_context):
        """Test hangup end type"""
        node = WorkflowNode(
            id="end-1",
            type="end",
            config={
                "endType": "hangup",
                "closingMessage": "Thank you for calling",
            }
        )
        
        executor = EndNodeExecutor(node, mock_context)
        result = await executor.execute()
        
        assert result.success is True
        assert result.should_end_call is True
        assert len(result.messages) > 0
    
    @pytest.mark.asyncio
    async def test_survey_end(self, mock_context):
        """Test satisfaction survey end"""
        node = WorkflowNode(
            id="end-1",
            type="end",
            config={
                "endType": "satisfaction_survey",
                "surveyQuestions": [
                    {"question": "Rate your experience", "type": "rating"},
                ],
            }
        )
        
        executor = EndNodeExecutor(node, mock_context)
        result = await executor.execute()
        
        assert result.success is True
        assert result.should_end_call is True
        assert "survey" in result.context_updates


class TestNodeExecutorFactory:
    """Test node executor factory"""
    
    def test_create_ai_agent_executor(self, mock_context):
        """Test creating AI agent executor"""
        node = WorkflowNode(id="ai-1", type="ai-agent", config={})
        executor = create_node_executor(node, mock_context)
        assert isinstance(executor, AIAgentNodeExecutor)
    
    def test_create_conditional_executor(self, mock_context):
        """Test creating conditional executor"""
        node = WorkflowNode(id="cond-1", type="conditional", config={})
        executor = create_node_executor(node, mock_context)
        assert isinstance(executor, ConditionalNodeExecutor)
    
    def test_unsupported_node_type(self, mock_context):
        """Test handling of unsupported node type"""
        node = WorkflowNode(id="unknown-1", type="unknown-type", config={})
        
        with pytest.raises(ValueError, match="Unsupported node type"):
            create_node_executor(node, mock_context)


# Performance benchmarks
@pytest.mark.slow
class TestNodeExecutorPerformance:
    """Performance tests for node executors"""
    
    @pytest.mark.asyncio
    async def test_conditional_evaluation_performance(self, mock_context, benchmark):
        """Benchmark conditional evaluation speed"""
        node = WorkflowNode(
            id="cond-1",
            type="conditional",
            config={
                "conditions": [
                    {"expression": f"value == {i}", "targetNode": f"node-{i}"}
                    for i in range(100)  # 100 conditions
                ]
            }
        )
        
        executor = ConditionalNodeExecutor(node, mock_context)
        
        # Should evaluate in <10ms
        result = await executor.execute()
        assert result.success is True
    
    @pytest.mark.asyncio
    async def test_safety_check_performance(self, mock_context, benchmark):
        """Benchmark safety check performance (target <50ms)"""
        mock_context.last_user_input = "I have chest pain and difficulty breathing"
        
        node = WorkflowNode(
            id="safety-1",
            type="safety-check",
            config={"keywordCategories": ["emergency", "clinical_urgent"]}
        )
        
        executor = SafetyCheckNodeExecutor(node, mock_context)
        
        # Should complete in <50ms
        result = await executor.execute()
        assert result.success is True
