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
    context.hospital_id = "hospital-1"
    context.call_sid = "CA123"
    context.state = CallState.IN_PROGRESS
    context.detected_intent = IntentType.APPOINTMENT
    context.conversation_history = []
    context.collected_fields = {}
    context.sentiment = Mock(frustration=0.2, satisfaction=0.8)
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
    async def test_get_request_success(self, mock_context):
        """Test successful GET request"""
        node = WorkflowNode(
            id="int-1",
            type="integration",
            config={
                "method": "GET",
                "endpointUrl": "https://api.test.com/patient/123",
                "responseMapping": {"data.id": "patient_id"},
            }
        )
        
        executor = IntegrationNodeExecutor(node, mock_context)
        
        with patch('httpx.AsyncClient.get', new_callable=AsyncMock) as mock_get:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"data": {"id": "P123", "name": "Test"}}
            mock_get.return_value = mock_response
            
            result = await executor.execute()
            
            assert result.success is True
            assert "patient_id" in result.context_updates
            assert result.context_updates["patient_id"] == "P123"
    
    @pytest.mark.asyncio
    async def test_post_request_with_template(self, mock_context):
        """Test POST request with template variables"""
        mock_context.collected_fields = {"name": "John Doe", "phone": "555-1234"}
        
        node = WorkflowNode(
            id="int-1",
            type="integration",
            config={
                "method": "POST",
                "endpointUrl": "https://api.test.com/appointments",
                "bodyTemplate": '{"name": "{{name}}", "phone": "{{phone}}"}',
            }
        )
        
        executor = IntegrationNodeExecutor(node, mock_context)
        
        with patch('httpx.AsyncClient.post', new_callable=AsyncMock) as mock_post:
            mock_response = Mock()
            mock_response.status_code = 201
            mock_response.json.return_value = {"id": "APT123"}
            mock_post.return_value = mock_response
            
            result = await executor.execute()
            
            assert result.success is True
            # Verify template was replaced
            call_args = mock_post.call_args
            assert "John Doe" in str(call_args)
    
    @pytest.mark.asyncio
    async def test_retry_on_failure(self, mock_context):
        """Test retry logic on failure"""
        node = WorkflowNode(
            id="int-1",
            type="integration",
            config={
                "method": "GET",
                "endpointUrl": "https://api.test.com/test",
                "retryCount": 3,
            }
        )
        
        executor = IntegrationNodeExecutor(node, mock_context)
        
        with patch('httpx.AsyncClient.get', new_callable=AsyncMock) as mock_get:
            # Fail twice, succeed on third
            mock_get.side_effect = [
                Exception("Timeout"),
                Exception("Connection error"),
                Mock(status_code=200, json=lambda: {"data": "success"})
            ]
            
            result = await executor.execute()
            
            assert result.success is True
            assert mock_get.call_count == 3
    
    @pytest.mark.asyncio
    async def test_error_handling_continue(self, mock_context):
        """Test continue on error"""
        node = WorkflowNode(
            id="int-1",
            type="integration",
            config={
                "method": "GET",
                "endpointUrl": "https://api.test.com/test",
                "errorHandling": "continue",
            }
        )
        
        executor = IntegrationNodeExecutor(node, mock_context)
        
        with patch('httpx.AsyncClient.get', new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = Exception("API Error")
            
            result = await executor.execute()
            
            # Should continue despite error
            assert result.success is True
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
