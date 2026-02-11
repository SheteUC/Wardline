"""
Node executor implementations for workflow execution
"""
import asyncio
import json
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
from loguru import logger

from workflow_models import (
    WorkflowNode, NodeExecutionResult, AIAgentConfig, HumanQueueConfig,
    ConditionalConfig, SafetyCheckConfig, IntegrationConfig, EndConfig
)
from call_context import CallContext, CallState, IntentType


class NodeExecutor(ABC):
    """Base class for all node executors"""
    
    def __init__(self, node: WorkflowNode, context: CallContext):
        self.node = node
        self.context = context
    
    @abstractmethod
    async def execute(self) -> NodeExecutionResult:
        """Execute the node and return the result"""
        pass
    
    def evaluate_condition(self, condition: str) -> bool:
        """
        Evaluate a condition expression against the call context
        
        Supports expressions like:
        - intent == "scheduling"
        - sentiment.frustration > 0.7
        - is_emergency == true
        - collected_fields.patient_name exists
        """
        try:
            # Simple expression evaluator
            # In production, use a proper expression parser or safe eval
            
            # Handle 'exists' check
            if "exists" in condition:
                field_name = condition.split()[0].strip()
                return field_name in self.context.collected_fields
            
            # Handle comparison operators
            for op in ["==", "!=", ">", "<", ">=", "<="]:
                if op in condition:
                    left, right = condition.split(op)
                    left, right = left.strip(), right.strip().strip('"\'')
                    
                    # Get left value from context
                    left_value = self._get_context_value(left)
                    
                    # Convert right to appropriate type
                    if right.lower() == "true":
                        right = True
                    elif right.lower() == "false":
                        right = False
                    elif right.replace(".", "").replace("-", "").isdigit():
                        right = float(right) if "." in right else int(right)
                    
                    # Evaluate
                    if op == "==":
                        return left_value == right
                    elif op == "!=":
                        return left_value != right
                    elif op == ">":
                        return float(left_value) > float(right)
                    elif op == "<":
                        return float(left_value) < float(right)
                    elif op == ">=":
                        return float(left_value) >= float(right)
                    elif op == "<=":
                        return float(left_value) <= float(right)
            
            return False
        except Exception as e:
            logger.error(f"Error evaluating condition '{condition}': {e}")
            return False
    
    def _get_context_value(self, path: str) -> Any:
        """Get a value from the call context using dot notation"""
        parts = path.split(".")
        value = self.context
        
        for part in parts:
            if hasattr(value, part):
                value = getattr(value, part)
            elif isinstance(value, dict):
                value = value.get(part)
            else:
                return None
        
        return value


class StartNodeExecutor(NodeExecutor):
    """Executor for START nodes"""
    
    async def execute(self) -> NodeExecutionResult:
        """Start node just initializes and moves to next"""
        logger.info("🚀 Starting workflow execution")
        self.context.state = CallState.GREETING
        
        return NodeExecutionResult(
            success=True,
            messages=[self.node.get_config_value("greetingMessage", "")]
        )


class AIAgentNodeExecutor(NodeExecutor):
    """Executor for AI_AGENT nodes"""
    
    async def execute(self) -> NodeExecutionResult:
        """Execute AI agent conversation"""
        config = AIAgentConfig.from_dict(self.node.config)
        
        logger.info(f"🤖 Executing AI Agent node: {self.node.id}")
        logger.debug(f"System prompt: {config.system_prompt[:100]}...")
        logger.debug(f"Enabled tools: {config.enabled_tools}")
        
        self.context.state = CallState.PROCESSING
        
        # Note: Actual LLM execution happens in the Pipecat pipeline
        # This executor just configures the agent and manages state
        
        # Store configuration in context for pipeline to use
        self.context.collect_field(f"_agent_config_{self.node.id}", {
            "system_prompt": config.system_prompt,
            "tools": config.enabled_tools,
            "temperature": config.temperature,
            "context_strategy": config.context_strategy,
        })
        
        # Check if max turns reached
        turn_limit = config.max_turns or 10
        if self.context.conversation_history:
            turn_count = len(self.context.conversation_history)
            if turn_count >= turn_limit:
                logger.warning(f"Max turns ({turn_limit}) reached for AI agent node")
                return NodeExecutionResult(
                    success=True,
                    should_escalate=True,
                    escalation_reason="Maximum conversation turns reached"
                )
        
        return NodeExecutionResult(
            success=True,
            messages=[]  # Messages generated by LLM in pipeline
        )


class HumanQueueNodeExecutor(NodeExecutor):
    """Executor for HUMAN_QUEUE nodes"""
    
    async def execute(self) -> NodeExecutionResult:
        """Escalate to human queue"""
        config = HumanQueueConfig.from_dict(self.node.config)
        
        logger.info(f"👥 Escalating to human queue: {config.queue_id}")
        logger.debug(f"Priority: {config.priority_level}, Skills: {config.required_skills}")
        
        self.context.state = CallState.ESCALATING
        
        # Build escalation context package
        from core_api_client import api_client
        
        context_package = {
            "call_id": self.context.call_id,
            "hospital_id": self.context.hospital_id,
            "queue_id": config.queue_id,
            "priority": config.priority_level,
            "required_skills": config.required_skills,
            "caller_phone": self.context.caller_phone,
            "caller_name": self.context.caller_name,
            "intent": self.context.detected_intent.value if self.context.detected_intent else None,
            "is_emergency": self.context.is_emergency,
            "transcript": self.context.get_conversation_text(),
            "collected_fields": {k: v.value for k, v in self.context.collected_fields.items() if not k.startswith("_")},
            "sentiment": {
                "frustration": self.context.sentiment.frustration_level,
                "urgency": self.context.sentiment.urgency_level,
                "overall_score": self.context.sentiment.overall_score,
            },
            "escalation_reason": self.context.escalation_reason,
            "workflow_path": [],  # Will be populated by FlowManager
            **config.context_package
        }
        
        # Send escalation request to Core API
        try:
            # Note: This endpoint will be created in Phase 2
            escalation = await api_client.create_escalation(context_package)
            
            if escalation:
                logger.info(f"✅ Escalation created: {escalation.get('id')}")
                return NodeExecutionResult(
                    success=True,
                    should_escalate=True,
                    escalation_reason=f"Escalated to queue: {config.queue_id}",
                    context_updates={"escalation_id": escalation.get('id')}
                )
            else:
                logger.error("Failed to create escalation")
                return NodeExecutionResult(
                    success=False,
                    error_message="Failed to escalate to human queue",
                    should_end_call=True
                )
        except Exception as e:
            logger.error(f"Error creating escalation: {e}")
            return NodeExecutionResult(
                success=False,
                error_message=f"Escalation error: {str(e)}",
                should_end_call=True
            )


class ConditionalNodeExecutor(NodeExecutor):
    """Executor for CONDITIONAL nodes"""
    
    async def execute(self) -> NodeExecutionResult:
        """Evaluate conditions and route to appropriate branch"""
        config = ConditionalConfig.from_dict(self.node.config)
        
        logger.info(f"🔀 Evaluating conditional node: {self.node.id}")
        logger.debug(f"Condition type: {config.condition_type}")
        
        condition_results = {}
        
        # Evaluate each condition
        for condition in config.conditions:
            condition_expr = condition.get("expression", "")
            target_node = condition.get("targetNode")
            
            if not condition_expr or not target_node:
                continue
            
            result = self.evaluate_condition(condition_expr)
            condition_results[condition_expr] = result
            
            logger.debug(f"Condition '{condition_expr}' -> {result}")
            
            # If condition matches, return this target
            if result:
                logger.info(f"✅ Condition matched: {condition_expr} -> {target_node}")
                return NodeExecutionResult(
                    success=True,
                    next_node_id=target_node,
                    condition_results=condition_results
                )
        
        # No conditions matched, use default target
        if config.default_target:
            logger.info(f"ℹ️ Using default target: {config.default_target}")
            return NodeExecutionResult(
                success=True,
                next_node_id=config.default_target,
                condition_results=condition_results
            )
        
        # No default target, this is an error
        logger.error("No conditions matched and no default target specified")
        return NodeExecutionResult(
            success=False,
            error_message="No valid routing path found in conditional node",
            condition_results=condition_results
        )


class SafetyCheckNodeExecutor(NodeExecutor):
    """Executor for SAFETY_CHECK nodes"""
    
    async def execute(self) -> NodeExecutionResult:
        """Perform safety checks on conversation"""
        config = SafetyCheckConfig.from_dict(self.node.config)
        
        logger.info(f"🛡️ Performing safety check: {self.node.id}")
        logger.debug(f"Categories: {config.keyword_categories}")
        
        # Get recent conversation
        recent_text = self.context.get_conversation_text(last_n=5).lower()
        
        # Check for safety keywords (this will be enhanced with the processor)
        safety_triggered = False
        triggered_keywords = []
        
        # Emergency keywords
        if "emergency" in config.keyword_categories:
            emergency_keywords = [
                "chest pain", "can't breathe", "difficulty breathing",
                "stroke", "heart attack", "bleeding", "unconscious",
                "not breathing", "severe pain"
            ]
            for keyword in emergency_keywords:
                if keyword in recent_text:
                    safety_triggered = True
                    triggered_keywords.append(keyword)
        
        # Mental health keywords
        if "mental_health" in config.keyword_categories:
            mental_health_keywords = [
                "suicide", "kill myself", "want to die", "end it all",
                "overdose", "self harm"
            ]
            for keyword in mental_health_keywords:
                if keyword in recent_text:
                    safety_triggered = True
                    triggered_keywords.append(keyword)
        
        # Clinical keywords
        if "clinical" in config.keyword_categories:
            clinical_keywords = [
                "infection", "fever", "surgery", "medication",
                "diagnosis", "symptoms", "pain level"
            ]
            for keyword in clinical_keywords:
                if keyword in recent_text:
                    # Clinical keywords are informational, not emergency
                    triggered_keywords.append(keyword)
        
        if safety_triggered:
            logger.warning(f"🚨 Safety check triggered! Keywords: {triggered_keywords}")
            
            # If confirmation required, ask user
            if config.confirmation_required and config.confirmation_prompt:
                # Store that we need confirmation
                self.context.collect_field(f"_safety_confirmation_needed_{self.node.id}", True)
                return NodeExecutionResult(
                    success=True,
                    messages=[config.confirmation_prompt]
                )
            
            # Auto-escalate if configured
            if config.auto_escalate:
                self.context.is_emergency = True
                return NodeExecutionResult(
                    success=True,
                    should_escalate=True,
                    escalation_reason=f"Safety keywords detected: {', '.join(triggered_keywords)}"
                )
        
        logger.info("✅ Safety check passed")
        return NodeExecutionResult(success=True)


class IntegrationNodeExecutor(NodeExecutor):
    """Executor for INTEGRATION nodes"""
    
    async def execute(self) -> NodeExecutionResult:
        """Execute external integration call"""
        config = IntegrationConfig.from_dict(self.node.config)
        
        logger.info(f"🔌 Executing integration: {config.integration_type}")
        
        # Import here to avoid circular dependency
        import httpx
        
        try:
            # Build request
            url = config.endpoint_url
            if not url:
                raise ValueError("No endpoint URL configured")
            
            # Replace template variables in URL and body
            url = self._replace_template_vars(url)
            
            body = None
            if config.body_template:
                body_str = self._replace_template_vars(config.body_template)
                try:
                    body = json.loads(body_str)
                except json.JSONDecodeError:
                    body = body_str
            
            # Execute request with retries
            async with httpx.AsyncClient(timeout=config.timeout_seconds) as client:
                for attempt in range(config.retry_count):
                    try:
                        logger.debug(f"Integration request attempt {attempt + 1}/{config.retry_count}")
                        
                        if config.method == "GET":
                            response = await client.get(url, headers=config.headers)
                        elif config.method == "POST":
                            response = await client.post(url, json=body, headers=config.headers)
                        elif config.method == "PUT":
                            response = await client.put(url, json=body, headers=config.headers)
                        elif config.method == "DELETE":
                            response = await client.delete(url, headers=config.headers)
                        else:
                            raise ValueError(f"Unsupported HTTP method: {config.method}")
                        
                        response.raise_for_status()
                        
                        # Parse response
                        try:
                            response_data = response.json()
                        except:
                            response_data = {"text": response.text}
                        
                        # Apply response mapping
                        mapped_data = {}
                        for source_key, target_key in config.response_mapping.items():
                            if source_key in response_data:
                                mapped_data[target_key] = response_data[source_key]
                        
                        # Store response data in context
                        for key, value in mapped_data.items():
                            self.context.collect_field(key, value, confirmed=True)
                        
                        logger.info(f"✅ Integration successful: {config.integration_type}")
                        return NodeExecutionResult(
                            success=True,
                            context_updates=mapped_data
                        )
                    
                    except httpx.HTTPError as e:
                        logger.warning(f"Integration attempt {attempt + 1} failed: {e}")
                        if attempt == config.retry_count - 1:
                            raise
                        await asyncio.sleep(1 * (attempt + 1))  # Exponential backoff
        
        except Exception as e:
            logger.error(f"Integration error: {e}")
            
            # Handle error based on configuration
            if config.error_handling == "escalate":
                return NodeExecutionResult(
                    success=False,
                    should_escalate=True,
                    escalation_reason=f"Integration failed: {str(e)}"
                )
            elif config.error_handling == "end":
                return NodeExecutionResult(
                    success=False,
                    should_end_call=True,
                    error_message=f"Integration failed: {str(e)}"
                )
            else:  # continue
                logger.info("Continuing despite integration error")
                return NodeExecutionResult(
                    success=True,
                    context_updates={"integration_error": str(e)}
                )
    
    def _replace_template_vars(self, template: str) -> str:
        """Replace template variables like {{field_name}} with actual values"""
        import re
        
        def replacer(match):
            var_name = match.group(1)
            
            # Check collected fields
            if var_name in self.context.collected_fields:
                return str(self.context.collected_fields[var_name].value)
            
            # Check context attributes
            value = self._get_context_value(var_name)
            if value is not None:
                return str(value)
            
            return match.group(0)  # Return original if not found
        
        return re.sub(r'\{\{([^}]+)\}\}', replacer, template)


class EndNodeExecutor(NodeExecutor):
    """Executor for END nodes"""
    
    async def execute(self) -> NodeExecutionResult:
        """End the call"""
        config = EndConfig.from_dict(self.node.config)
        
        logger.info(f"🏁 Ending call: {config.end_type}")
        
        self.context.state = CallState.ENDING
        
        messages = []
        
        # Add closing message if configured
        if config.closing_message:
            messages.append(config.closing_message)
        
        # Handle satisfaction survey
        if config.end_type == "satisfaction_survey" and config.survey_questions:
            # Store that we need to run survey
            self.context.collect_field("_run_survey", config.survey_questions)
            messages.append("Before you go, I'd like to ask you a few quick questions about your experience.")
        
        # Handle voicemail
        elif config.end_type == "voicemail":
            messages.append("Please leave a message after the tone, and we'll get back to you as soon as possible.")
        
        # Handle callback request
        elif config.end_type == "callback_request":
            phone = self.context.caller_phone or "the number you're calling from"
            messages.append(f"We'll call you back at {phone} as soon as possible.")
        
        return NodeExecutionResult(
            success=True,
            should_end_call=True,
            messages=messages
        )


# Factory function to create executors
def create_node_executor(node: WorkflowNode, context: CallContext) -> NodeExecutor:
    """Factory function to create the appropriate executor for a node type"""
    executors = {
        "start": StartNodeExecutor,
        "ai-agent": AIAgentNodeExecutor,
        "human-agent-queue": HumanQueueNodeExecutor,
        "conditional": ConditionalNodeExecutor,
        "safety-check": SafetyCheckNodeExecutor,
        "integration": IntegrationNodeExecutor,
        "end": EndNodeExecutor,
    }
    
    executor_class = executors.get(node.type)
    if not executor_class:
        raise ValueError(f"Unknown node type: {node.type}")
    
    return executor_class(node, context)
