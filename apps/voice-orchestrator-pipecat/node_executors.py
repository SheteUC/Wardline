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
        
        self.context.state = CallState.AGENT_HANDLING
        
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
            "callId": self.context.call_id,
            "businessId": self.context.business_id,
            "reason": self.context.escalation_reason or f"Escalation requested for queue {config.queue_id}",
            "specialization": config.queue_id,
            "callerPhone": self.context.caller_phone,
            "callerName": self.context.caller_name,
            "context_summary": self.context.get_conversation_text(),
            "transcript": self.context.get_conversation_text(),
            "collectedFields": {k: v.value for k, v in self.context.collected_fields.items() if not k.startswith("_")},
            "isUrgent": self.context.is_emergency or config.priority_level >= 2,
            "requiredSkills": config.required_skills,
            "intent": self.context.detected_intent.value if self.context.detected_intent else None,
            "workflowPath": [],
            **config.context_package,
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
        """Execute a Business-native runtime action"""
        config = IntegrationConfig.from_dict(self.node.config)
        
        logger.info(f"🔌 Executing runtime action: {config.runtime_action}")

        try:
            from core_api_client import api_client

            payload = self._build_runtime_payload(config.runtime_action)
            result = await api_client.execute_runtime_action(
                self.context.business_id,
                config.runtime_action,
                payload,
            )

            if not result:
                raise ValueError("Runtime action returned no result")

            self.context.mark_action_outcome(result)
            return NodeExecutionResult(
                success=True,
                messages=[result.get("message", "The request has been captured.")],
                context_updates={
                    "runtime_action": config.runtime_action,
                    "handledLive": result.get("handledLive", False),
                    "followUpTaskId": result.get("followUpTaskId"),
                    "result": result.get("data", {}),
                },
            )
        
        except Exception as e:
            logger.error(f"Integration error: {e}")
            return NodeExecutionResult(
                success=False,
                error_message=f"Runtime action failed: {str(e)}"
            )

    def _build_runtime_payload(self, runtime_action: str) -> Dict[str, Any]:
        collected = {
            key: getattr(value, "value", value)
            for key, value in self.context.collected_fields.items()
            if not key.startswith("_")
        }

        payload: Dict[str, Any] = {
            "callId": self.context.call_id or None,
            "callerName": collected.get("caller_name") or self.context.caller_name,
            "callerPhone": collected.get("caller_phone") or self.context.caller_phone,
        }

        if runtime_action == "appointment-request":
            payload.update({
                "serviceType": collected.get("service_type") or collected.get("serviceType") or "appointment",
                "preferredDate": collected.get("preferred_date") or collected.get("preferredDate"),
                "preferredTime": collected.get("preferred_time") or collected.get("preferredTime"),
                "notes": collected.get("notes"),
                "confirmed": True,
            })
        elif runtime_action == "refill-request":
            payload.update({
                "medicationName": collected.get("medication_name") or collected.get("medicationName"),
                "pharmacyName": collected.get("pharmacy_name") or collected.get("pharmacyName"),
                "pharmacyPhone": collected.get("pharmacy_phone") or collected.get("pharmacyPhone"),
                "callerDob": collected.get("caller_dob") or collected.get("callerDob"),
                "prescriberName": collected.get("prescriber_name") or collected.get("prescriberName"),
                "notes": collected.get("notes"),
                "confirmed": True,
            })
        elif runtime_action == "insurance-check":
            payload.update({
                "carrierName": collected.get("carrier_name") or collected.get("carrierName"),
                "planName": collected.get("plan_name") or collected.get("planName"),
                "inquiryType": collected.get("inquiry_type") or collected.get("inquiryType") or "acceptance",
            })
        elif runtime_action == "billing-request":
            payload.update({
                "billingTopic": collected.get("billing_topic") or collected.get("billingTopic") or "billing support",
                "accountReference": collected.get("account_reference") or collected.get("accountReference"),
                "notes": collected.get("notes"),
                "confirmed": True,
            })

        return payload


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
