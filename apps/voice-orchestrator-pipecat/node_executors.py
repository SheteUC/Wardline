"""
Node executor implementations for workflow execution.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

from loguru import logger

from workflow_models import (
    WorkflowNode,
    NodeExecutionResult,
    AIAgentConfig,
    HumanQueueConfig,
    ConditionalConfig,
    SafetyCheckConfig,
    IntegrationConfig,
    EndConfig,
)
from call_context import CallContext, CallState, IntentType


class NodeExecutor(ABC):
    """Base class for all node executors."""

    def __init__(self, node: WorkflowNode, context: CallContext):
        self.node = node
        self.context = context

    @abstractmethod
    async def execute(self) -> NodeExecutionResult:
        """Execute the node and return the result."""

    def evaluate_condition(self, condition: str) -> bool:
        """
        Evaluate a condition expression against the call context.

        Supports:
        - intent == "scheduling"
        - sentiment.frustration > 0.7
        - collected_fields.age > 65 and collected_fields.is_emergency
        - collected_fields.patient_name exists
        """
        try:
            normalized = condition.strip()

            if " and " in normalized:
                return all(self.evaluate_condition(part) for part in normalized.split(" and "))
            if " or " in normalized:
                return any(self.evaluate_condition(part) for part in normalized.split(" or "))

            if "exists" in normalized:
                field_name = normalized.split()[0].strip()
                return self._get_context_value(field_name) is not None

            if " " not in normalized and not any(op in normalized for op in [">=", "<=", "==", "!=", ">", "<"]):
                return bool(self._get_context_value(normalized))

            for op in [">=", "<=", "==", "!=", ">", "<"]:
                if op in normalized:
                    left, right = normalized.split(op, 1)
                    left_value = self._get_context_value(left.strip())
                    right_value = self._coerce_literal(right.strip().strip("\"'"))
                    return self._compare(left_value, right_value, op)

            return False
        except Exception as error:
            logger.error(f"Error evaluating condition '{condition}': {error}")
            return False

    def _compare(self, left: Any, right: Any, operator: str) -> bool:
        if operator == "==":
            return left == right
        if operator == "!=":
            return left != right
        if operator == ">":
            return float(left) > float(right)
        if operator == "<":
            return float(left) < float(right)
        if operator == ">=":
            return float(left) >= float(right)
        if operator == "<=":
            return float(left) <= float(right)
        return False

    def _coerce_literal(self, value: str) -> Any:
        lowered = value.lower()
        if lowered == "true":
            return True
        if lowered == "false":
            return False
        if value.replace(".", "", 1).replace("-", "", 1).isdigit():
            return float(value) if "." in value else int(value)
        return value

    def _get_context_value(self, path: str) -> Any:
        """Get a value from the call context using dot notation."""
        if path == "intent":
            detected_intent = getattr(self.context, "detected_intent", None)
            if isinstance(detected_intent, IntentType):
                return detected_intent.value
            return detected_intent

        if path == "value":
            return self.context.collected_fields.get("value", 0)

        if path.startswith("sentiment."):
            sentiment = getattr(self.context, "sentiment", None)
            attribute = path.split(".", 1)[1]
            candidate = getattr(sentiment, attribute, None)
            if isinstance(candidate, (int, float, bool, str)):
                return candidate

            aliases = {
                "frustration": "frustration_level",
                "urgency": "urgency_level",
            }
            alias_candidate = getattr(sentiment, aliases.get(attribute, ""), None)
            if isinstance(alias_candidate, (int, float, bool, str)):
                return alias_candidate

            return None

        parts = path.split(".")
        value: Any = self.context

        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
                continue

            if hasattr(value, part):
                value = getattr(value, part)
                if (
                    hasattr(value, "value")
                    and hasattr(value, "confirmed")
                    and hasattr(value, "updated_at")
                ):
                    value = getattr(value, "value")
                continue

            return None

        if (
            hasattr(value, "value")
            and hasattr(value, "confirmed")
            and hasattr(value, "updated_at")
        ):
            return getattr(value, "value")

        return value


class StartNodeExecutor(NodeExecutor):
    """Executor for START nodes."""

    async def execute(self) -> NodeExecutionResult:
        logger.info("Starting workflow execution")
        self.context.state = CallState.GREETING
        return NodeExecutionResult(
            success=True,
            messages=[self.node.get_config_value("greetingMessage", "")],
        )


class AIAgentNodeExecutor(NodeExecutor):
    """Executor for AI_AGENT nodes."""

    def __init__(self, node: WorkflowNode, context: CallContext):
        super().__init__(node, context)
        self.config = AIAgentConfig.from_dict(self.node.config)

    async def execute(self) -> NodeExecutionResult:
        logger.info(f"Executing AI Agent node: {self.node.id}")
        logger.debug(f"System prompt: {self.config.system_prompt[:100]}...")
        logger.debug(f"Enabled tools: {self.config.enabled_tools}")

        self.context.state = CallState.AGENT_HANDLING
        self.context.collect_field(
            f"_agent_config_{self.node.id}",
            {
                "system_prompt": self.config.system_prompt,
                "tools": self.config.enabled_tools,
                "temperature": self.config.temperature,
                "context_strategy": self.config.context_strategy,
            },
        )

        turn_limit = self.config.max_turns or 10
        turn_count = getattr(self.context, "turn_count", None)
        if turn_count is None:
            turn_count = len(getattr(self.context, "conversation_history", None) or [])

        if turn_count >= turn_limit:
            logger.warning(f"Max turns ({turn_limit}) reached for AI agent node")
            return NodeExecutionResult(
                success=True,
                should_escalate=True,
                escalation_reason="Maximum conversation turns reached",
                context_updates={"context_strategy": self.config.context_strategy},
            )

        return NodeExecutionResult(
            success=True,
            messages=[],
            context_updates={"context_strategy": self.config.context_strategy},
        )


class HumanQueueNodeExecutor(NodeExecutor):
    """Executor for HUMAN_QUEUE nodes."""

    def __init__(self, node: WorkflowNode, context: CallContext):
        super().__init__(node, context)
        self.config = HumanQueueConfig.from_dict(self.node.config)

    async def _create_escalation_request(self, context_package: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        from core_api_client import api_client

        return await api_client.create_escalation(context_package)

    async def execute(self) -> NodeExecutionResult:
        logger.info(f"Escalating to human queue: {self.config.queue_id}")
        logger.debug(f"Priority: {self.config.priority_level}, Skills: {self.config.required_skills}")

        self.context.state = CallState.ESCALATING

        context_package = {
            "callId": self.context.call_id,
            "businessId": self.context.business_id,
            "reason": self.context.escalation_reason or f"Escalation requested for queue {self.config.queue_id}",
            "specialization": self.config.queue_id,
            "callerPhone": self.context.caller_phone,
            "callerName": self.context.caller_name,
            "context_summary": self.context.get_conversation_text(),
            "transcript": self.context.get_conversation_text(),
            "collectedFields": {
                key: getattr(value, "value", value)
                for key, value in self.context.collected_fields.items()
                if not key.startswith("_")
            },
            "isUrgent": bool(getattr(self.context, "is_emergency", False) or self.config.priority_level >= 2),
            "requiredSkills": self.config.required_skills,
            "intent": self.context.detected_intent.value if self.context.detected_intent else None,
            "workflowPath": [],
            **self.config.context_package,
        }

        try:
            escalation = await self._create_escalation_request(context_package)
            if escalation:
                escalation_id = escalation.get("id") if isinstance(escalation, dict) else None
                logger.info(f"Escalation created: {escalation_id or 'mock-success'}")
                return NodeExecutionResult(
                    success=True,
                    should_escalate=True,
                    escalation_reason=f"Escalated to queue: {self.config.queue_id}",
                    context_updates={"escalation_id": escalation_id},
                )

            return NodeExecutionResult(
                success=False,
                error_message="Failed to escalate to human queue",
                should_end_call=True,
            )
        except Exception as error:
            logger.error(f"Error creating escalation: {error}")
            return NodeExecutionResult(
                success=False,
                error_message=f"Escalation error: {error}",
                should_end_call=True,
            )


class ConditionalNodeExecutor(NodeExecutor):
    """Executor for CONDITIONAL nodes."""

    async def execute(self) -> NodeExecutionResult:
        config = ConditionalConfig.from_dict(self.node.config)

        logger.info(f"Evaluating conditional node: {self.node.id}")
        logger.debug(f"Condition type: {config.condition_type}")

        condition_results: Dict[str, bool] = {}
        detected_intent = getattr(self.context, "detected_intent", None)
        if isinstance(detected_intent, IntentType):
            condition_results[detected_intent.value] = True

        for condition in config.conditions:
            expression = condition.get("expression", "")
            target_node = condition.get("targetNode")
            if not expression or not target_node:
                continue

            matched = self.evaluate_condition(expression)
            condition_results[expression] = matched
            logger.debug(f"Condition '{expression}' -> {matched}")

            if matched:
                logger.info(f"Condition matched: {expression} -> {target_node}")
                return NodeExecutionResult(
                    success=True,
                    next_node_id=target_node,
                    condition_results=condition_results,
                )

        if config.default_target:
            logger.info(f"Using default target: {config.default_target}")
            return NodeExecutionResult(
                success=True,
                next_node_id=config.default_target,
                condition_results=condition_results,
            )

        logger.warning("No conditional branch matched; allowing workflow to continue without a branch")
        return NodeExecutionResult(
            success=True,
            next_node_id=None,
            condition_results=condition_results,
        )


class SafetyCheckNodeExecutor(NodeExecutor):
    """Executor for SAFETY_CHECK nodes."""

    async def execute(self) -> NodeExecutionResult:
        config = SafetyCheckConfig.from_dict(self.node.config)

        logger.info(f"Performing safety check: {self.node.id}")
        logger.debug(f"Categories: {config.keyword_categories}")

        recent_text = (
            getattr(self.context, "last_user_input", None)
            or self.context.get_conversation_text(last_n=5)
            or ""
        ).lower()

        triggered_keywords = []
        safety_triggered = False

        if "emergency" in config.keyword_categories:
            for keyword in [
                "chest pain",
                "can't breathe",
                "difficulty breathing",
                "stroke",
                "heart attack",
                "bleeding",
                "unconscious",
                "not breathing",
                "severe pain",
            ]:
                if keyword in recent_text:
                    triggered_keywords.append(keyword)
                    safety_triggered = True

        if "mental_health" in config.keyword_categories:
            for keyword in ["suicide", "kill myself", "want to die", "end it all", "overdose", "self harm"]:
                if keyword in recent_text:
                    triggered_keywords.append(keyword)
                    safety_triggered = True

        if "clinical" in config.keyword_categories or "clinical_urgent" in config.keyword_categories:
            for keyword in [
                "infection",
                "fever",
                "surgery",
                "medication",
                "diagnosis",
                "symptoms",
                "pain level",
                "dizzy",
                "dizziness",
                "fainting",
            ]:
                if keyword in recent_text:
                    triggered_keywords.append(keyword)
                    safety_triggered = True

        if safety_triggered:
            logger.warning(f"Safety check triggered: {triggered_keywords}")

            if config.confirmation_required and config.confirmation_prompt:
                self.context.collect_field(f"_safety_confirmation_needed_{self.node.id}", True)
                return NodeExecutionResult(
                    success=True,
                    messages=[config.confirmation_prompt],
                    context_updates={
                        "confirmation_required": True,
                        "triggered_keywords": triggered_keywords,
                    },
                )

            if config.auto_escalate:
                self.context.is_emergency = True
                return NodeExecutionResult(
                    success=True,
                    should_escalate=True,
                    escalation_reason=f"Safety keywords detected: {', '.join(triggered_keywords)}",
                    context_updates={"triggered_keywords": triggered_keywords},
                )

        logger.info("Safety check passed")
        return NodeExecutionResult(success=True)


class IntegrationNodeExecutor(NodeExecutor):
    """Executor for INTEGRATION nodes."""

    async def execute(self) -> NodeExecutionResult:
        config = IntegrationConfig.from_dict(self.node.config)

        logger.info(f"Executing runtime action: {config.runtime_action}")

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

        except Exception as error:
            logger.error(f"Integration error: {error}")
            return NodeExecutionResult(
                success=False,
                error_message=f"Runtime action failed: {error}",
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
            payload.update(
                {
                    "serviceType": collected.get("service_type") or collected.get("serviceType") or "appointment",
                    "preferredDate": collected.get("preferred_date") or collected.get("preferredDate"),
                    "preferredTime": collected.get("preferred_time") or collected.get("preferredTime"),
                    "notes": collected.get("notes"),
                    "confirmed": True,
                }
            )
        elif runtime_action == "refill-request":
            payload.update(
                {
                    "medicationName": collected.get("medication_name") or collected.get("medicationName"),
                    "pharmacyName": collected.get("pharmacy_name") or collected.get("pharmacyName"),
                    "pharmacyPhone": collected.get("pharmacy_phone") or collected.get("pharmacyPhone"),
                    "callerDob": collected.get("caller_dob") or collected.get("callerDob"),
                    "prescriberName": collected.get("prescriber_name") or collected.get("prescriberName"),
                    "notes": collected.get("notes"),
                    "confirmed": True,
                }
            )
        elif runtime_action == "insurance-check":
            payload.update(
                {
                    "carrierName": collected.get("carrier_name") or collected.get("carrierName"),
                    "planName": collected.get("plan_name") or collected.get("planName"),
                    "inquiryType": collected.get("inquiry_type") or collected.get("inquiryType") or "acceptance",
                }
            )
        elif runtime_action == "billing-request":
            payload.update(
                {
                    "billingTopic": collected.get("billing_topic") or collected.get("billingTopic") or "billing support",
                    "accountReference": collected.get("account_reference") or collected.get("accountReference"),
                    "notes": collected.get("notes"),
                    "confirmed": True,
                }
            )

        return payload


class EndNodeExecutor(NodeExecutor):
    """Executor for END nodes."""

    async def execute(self) -> NodeExecutionResult:
        config = EndConfig.from_dict(self.node.config)

        logger.info(f"Ending call: {config.end_type}")
        self.context.state = CallState.ENDING

        messages = []
        context_updates: Dict[str, Any] = {}

        if config.closing_message:
            messages.append(config.closing_message)

        if config.end_type == "satisfaction_survey" and config.survey_questions:
            self.context.collect_field("_run_survey", config.survey_questions)
            context_updates["survey"] = config.survey_questions
            messages.append("Before you go, I'd like to ask you a few quick questions about your experience.")
        elif config.end_type == "voicemail":
            messages.append("Please leave a message after the tone, and we'll get back to you as soon as possible.")
        elif config.end_type == "callback_request":
            phone = self.context.caller_phone or "the number you're calling from"
            messages.append(f"We'll call you back at {phone} as soon as possible.")

        return NodeExecutionResult(
            success=True,
            should_end_call=True,
            messages=messages,
            context_updates=context_updates,
        )


def create_node_executor(node: WorkflowNode, context: CallContext) -> NodeExecutor:
    """Factory function to create the appropriate executor for a node type."""
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
        raise ValueError(f"Unsupported node type: {node.type}")

    return executor_class(node, context)
