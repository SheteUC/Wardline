"""
Workflow models and types for dynamic workflow execution
"""
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Literal
from enum import Enum


class NodeType(Enum):
    """Supported workflow node types"""
    START = "start"
    AI_AGENT = "ai-agent"
    HUMAN_QUEUE = "human-agent-queue"
    CONDITIONAL = "conditional"
    SAFETY_CHECK = "safety-check"
    INTEGRATION = "integration"
    END = "end"
    # Legacy types for backwards compatibility
    EMERGENCY_SCREEN = "emergency-screen"
    INTENT_DETECT = "intent-detect"
    QUESTION = "question"
    ROUTE = "route"
    WEBHOOK = "webhook"


class ContextStrategy(Enum):
    """How to handle conversation context when transitioning between nodes"""
    RESET = "reset"  # Clear context, fresh start
    RESET_WITH_SUMMARY = "reset_with_summary"  # Clear context but include summary
    APPEND = "append"  # Keep all previous context


@dataclass
class WorkflowNode:
    """A node in the workflow graph"""
    id: str
    type: str  # NodeType value
    config: Dict[str, Any] = field(default_factory=dict)
    position: Optional[Dict[str, float]] = None
    
    def get_config_value(self, key: str, default: Any = None) -> Any:
        """Get a configuration value with fallback"""
        return self.config.get(key, default)


@dataclass
class WorkflowEdge:
    """An edge connecting two nodes"""
    id: str
    fromNodeId: str
    toNodeId: str
    condition: Optional[str] = None  # Expression to evaluate for conditional routing
    priority: int = 0  # For ordering when multiple edges match


@dataclass
class WorkflowGraph:
    """Complete workflow graph structure"""
    nodes: List[WorkflowNode]
    edges: List[WorkflowEdge]
    
    def get_node(self, node_id: str) -> Optional[WorkflowNode]:
        """Get a node by ID"""
        return next((node for node in self.nodes if node.id == node_id), None)
    
    def get_start_node(self) -> Optional[WorkflowNode]:
        """Get the start node"""
        return next((node for node in self.nodes if node.type == NodeType.START.value), None)
    
    def get_outgoing_edges(self, node_id: str) -> List[WorkflowEdge]:
        """Get all edges leaving a node"""
        edges = [edge for edge in self.edges if edge.fromNodeId == node_id]
        # Sort by priority (higher priority first)
        return sorted(edges, key=lambda e: e.priority, reverse=True)
    
    def get_incoming_edges(self, node_id: str) -> List[WorkflowEdge]:
        """Get all edges entering a node"""
        return [edge for edge in self.edges if edge.toNodeId == node_id]


@dataclass
class NodeExecutionResult:
    """Result of executing a workflow node"""
    success: bool
    next_node_id: Optional[str] = None
    error_message: Optional[str] = None
    should_end_call: bool = False
    should_escalate: bool = False
    escalation_reason: Optional[str] = None
    context_updates: Dict[str, Any] = field(default_factory=dict)
    
    # For AI agent nodes - messages to send to user
    messages: List[str] = field(default_factory=list)
    
    # For conditional nodes - evaluation results
    condition_results: Dict[str, bool] = field(default_factory=dict)


@dataclass
class AIAgentConfig:
    """Configuration for AI Agent nodes"""
    system_prompt: str
    enabled_tools: List[str] = field(default_factory=list)
    max_turns: Optional[int] = None
    context_strategy: str = "append"  # reset, reset_with_summary, append
    temperature: float = 0.7
    timeout_seconds: Optional[int] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AIAgentConfig":
        """Create from node config dictionary"""
        return cls(
            system_prompt=data.get("systemPrompt", ""),
            enabled_tools=data.get("enabledTools", []),
            max_turns=data.get("maxTurns"),
            context_strategy=data.get("contextStrategy", "append"),
            temperature=data.get("temperature", 0.7),
            timeout_seconds=data.get("timeoutSeconds"),
        )


@dataclass
class HumanQueueConfig:
    """Configuration for Human Queue nodes"""
    queue_id: str
    priority_level: int = 0
    timeout_seconds: Optional[int] = None
    timeout_action: str = "voicemail"  # voicemail, callback, end
    required_skills: List[str] = field(default_factory=list)
    context_package: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "HumanQueueConfig":
        """Create from node config dictionary"""
        return cls(
            queue_id=data.get("queueId", ""),
            priority_level=data.get("priorityLevel", 0),
            timeout_seconds=data.get("timeoutSeconds"),
            timeout_action=data.get("timeoutAction", "voicemail"),
            required_skills=data.get("requiredSkills", []),
            context_package=data.get("contextPackage", {}),
        )


@dataclass
class ConditionalConfig:
    """Configuration for Conditional nodes"""
    condition_type: str  # intent, sentiment, data_verification, custom_expression
    conditions: List[Dict[str, Any]] = field(default_factory=list)
    default_target: Optional[str] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConditionalConfig":
        """Create from node config dictionary"""
        return cls(
            condition_type=data.get("conditionType", "intent"),
            conditions=data.get("conditions", []),
            default_target=data.get("defaultTarget"),
        )


@dataclass
class SafetyCheckConfig:
    """Configuration for Safety Check nodes"""
    keyword_categories: List[str] = field(default_factory=list)  # emergency, clinical, mental_health
    auto_escalate: bool = True
    alert_severity: str = "high"  # low, medium, high, critical
    confirmation_required: bool = False
    confirmation_prompt: Optional[str] = None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SafetyCheckConfig":
        """Create from node config dictionary"""
        return cls(
            keyword_categories=data.get("keywordCategories", []),
            auto_escalate=data.get("autoEscalate", True),
            alert_severity=data.get("alertSeverity", "high"),
            confirmation_required=data.get("confirmationRequired", False),
            confirmation_prompt=data.get("confirmationPrompt"),
        )


@dataclass
class IntegrationConfig:
    """Configuration for Integration nodes"""
    runtime_action: str = "manual-follow-up"
    integration_category: str = "MANUAL"
    requires_confirmation: bool = False
    fallback_behavior: str = "create_follow_up"
    prompt: Optional[str] = None
    legacy_source: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "IntegrationConfig":
        """Create from node config dictionary"""
        return cls(
            runtime_action=data.get("runtimeAction", "manual-follow-up"),
            integration_category=data.get("integrationCategory", "MANUAL"),
            requires_confirmation=data.get("requiresConfirmation", False),
            fallback_behavior=data.get("fallbackBehavior", "create_follow_up"),
            prompt=data.get("prompt"),
            legacy_source=data.get("__legacySource", {}),
        )


@dataclass
class EndConfig:
    """Configuration for End nodes"""
    end_type: str = "hangup"  # hangup, voicemail, callback_request, satisfaction_survey
    closing_message: Optional[str] = None
    survey_questions: List[Dict[str, Any]] = field(default_factory=list)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EndConfig":
        """Create from node config dictionary"""
        return cls(
            end_type=data.get("endType", "hangup"),
            closing_message=data.get("closingMessage"),
            survey_questions=data.get("surveyQuestions", []),
        )


@dataclass
class WorkflowExecutionState:
    """Runtime state for workflow execution"""
    workflow_id: str
    current_node_id: str
    execution_path: List[str] = field(default_factory=list)  # Track nodes visited
    node_data: Dict[str, Any] = field(default_factory=dict)  # Data collected at each node
    turn_count: int = 0
    started_at: Optional[str] = None
    escalated: bool = False
    escalation_reason: Optional[str] = None
    
    def add_node_to_path(self, node_id: str):
        """Add a node to the execution path"""
        self.execution_path.append(node_id)
    
    def has_visited_node(self, node_id: str) -> bool:
        """Check if a node has been visited (loop detection)"""
        return node_id in self.execution_path
    
    def get_loop_count(self, node_id: str) -> int:
        """Count how many times a node has been visited"""
        return self.execution_path.count(node_id)
    
    def set_node_data(self, node_id: str, key: str, value: Any):
        """Store data for a specific node"""
        if node_id not in self.node_data:
            self.node_data[node_id] = {}
        self.node_data[node_id][key] = value
    
    def get_node_data(self, node_id: str, key: str, default: Any = None) -> Any:
        """Get data for a specific node"""
        return self.node_data.get(node_id, {}).get(key, default)
