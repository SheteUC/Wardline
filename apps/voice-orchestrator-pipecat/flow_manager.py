"""
Wardline Flow Manager - Dynamic workflow execution engine
Loads and executes workflow JSON configurations from Core API
"""
import asyncio
import inspect
from typing import Optional, Dict, Any, List
from datetime import datetime
from loguru import logger

from workflow_models import (
    WorkflowGraph, WorkflowNode, WorkflowEdge, NodeExecutionResult,
    WorkflowExecutionState, NodeType
)
from node_executors import create_node_executor
from call_context import CallContext, CallState
from core_api_client import api_client
from langsmith_tracer import workflow_tracer


class WardlineFlowManager:
    """
    Main workflow orchestrator that manages dynamic workflow execution
    """
    
    def __init__(self, context: CallContext):
        self.context = context
        self.workflow_graph: Optional[WorkflowGraph] = None
        self.execution_state: Optional[WorkflowExecutionState] = None
        self._cache_ttl = 300  # 5 minutes cache for workflows
        self._workflow_cache: Dict[str, tuple[WorkflowGraph, float]] = {}

    async def _maybe_await(self, value):
        if inspect.isawaitable(value):
            return await value
        return value

    def _result_flag(self, result: Any, primary_key: str, legacy_key: Optional[str] = None) -> bool:
        explicit_fields = getattr(result, "__dict__", {})
        if primary_key in explicit_fields:
            return bool(explicit_fields[primary_key])
        if legacy_key and legacy_key in explicit_fields:
            return bool(explicit_fields[legacy_key])

        primary_value = getattr(result, primary_key, None)
        if isinstance(primary_value, bool):
            return primary_value

        if legacy_key:
            legacy_value = getattr(result, legacy_key, None)
            if isinstance(legacy_value, bool):
                return legacy_value

        return False

    def _result_text(self, result: Any, key: str) -> Optional[str]:
        explicit_fields = getattr(result, "__dict__", {})
        if key in explicit_fields:
            value = explicit_fields[key]
            return value if isinstance(value, str) and value else None

        value = getattr(result, key, None)
        return value if isinstance(value, str) and value else None

    def _mark_execution_complete(self, outcome: str):
        if self.execution_state:
            self.execution_state.mark_complete()

        workflow_tracer.end_trace(
            outcome,
            {
                "workflow_id": self.context.workflow.get("id", "default") if self.context.workflow else "default",
                "business_id": self.context.business_id,
                "call_id": self.context.call_id,
                "call_sid": self.context.call_sid,
            },
        )
    
    async def load_workflow(self, business_id: str, phone_number_id: Optional[str] = None) -> bool:
        """
        Load workflow configuration from Core API
        
        Args:
            business_id: Business identifier
            phone_number_id: Optional phone number ID to get specific workflow
            
        Returns:
            True if workflow loaded successfully
        """
        try:
            logger.info(f"📥 Loading workflow for business: {business_id}")
            
            # Check cache first
            cache_key = f"{business_id}:{phone_number_id or 'default'}"
            if cache_key in self._workflow_cache:
                cached_workflow, cached_time = self._workflow_cache[cache_key]
                age = datetime.now().timestamp() - cached_time
                
                if age < self._cache_ttl:
                    logger.info(f"Using cached workflow (age: {age:.0f}s)")
                    self.workflow_graph = cached_workflow
                    return True
            
            # Fetch from API
            # Note: This endpoint will be created in Phase 2
            workflow_data = await api_client.get_active_workflow(business_id, phone_number_id)
            
            if not workflow_data:
                logger.warning(f"No active workflow found for business {business_id}")
                # Fall back to default workflow
                return await self._load_default_workflow()
            
            # Parse workflow JSON
            graph_json = workflow_data.get("graphJson", {})
            if not graph_json:
                logger.error("Workflow has no graph JSON")
                return False
            
            # Convert to WorkflowGraph
            nodes = []
            for node_data in graph_json.get("nodes", []):
                node = WorkflowNode(
                    id=node_data.get("id"),
                    type=node_data.get("type"),
                    config=node_data.get("config", {}),
                    position=node_data.get("position")
                )
                nodes.append(node)
            
            edges = []
            for edge_data in graph_json.get("edges", []):
                edge = WorkflowEdge(
                    id=edge_data.get("id"),
                    fromNodeId=edge_data.get("fromNodeId") or edge_data.get("source"),
                    toNodeId=edge_data.get("toNodeId") or edge_data.get("target"),
                    condition=edge_data.get("condition"),
                    priority=edge_data.get("priority", 0)
                )
                edges.append(edge)
            
            self.workflow_graph = WorkflowGraph(nodes=nodes, edges=edges)
            
            # Cache the workflow
            self._workflow_cache[cache_key] = (self.workflow_graph, datetime.now().timestamp())
            
            # Store workflow metadata in context
            self.context.workflow = {
                "id": workflow_data.get("id"),
                "name": workflow_data.get("name"),
                "version": workflow_data.get("version"),
                "business_id": business_id,
            }
            
            logger.info(f"✅ Workflow loaded: {len(nodes)} nodes, {len(edges)} edges")
            logger.debug(f"Workflow: {workflow_data.get('name')} (v{workflow_data.get('version', 1)})")
            
            return True
            
        except Exception as e:
            logger.error(f"Error loading workflow: {e}", exc_info=True)
            return await self._load_default_workflow()
    
    async def _load_default_workflow(self) -> bool:
        """Load a default fallback workflow"""
        logger.info("Loading default fallback workflow")
        
        # Simple default workflow: Start -> AI Agent -> End
        nodes = [
            WorkflowNode(
                id="start",
                type="start",
                config={
                    "greetingMessage": f"Thank you for calling {self.context.business_name}. How can I help you today?"
                }
            ),
            WorkflowNode(
                id="ai-agent-main",
                type="ai-agent",
                config={
                    "systemPrompt": f"""You are a helpful medical receptionist for {self.context.business_name}.
                    
Your role is to:
- Greet callers warmly
- Understand their needs (scheduling, billing, prescriptions, etc.)
- Collect necessary information
- Provide helpful information
- Escalate to a human when needed

Important safety rules:
- ALWAYS escalate medical emergencies immediately
- For clinical questions, offer to transfer to a nurse
- Never provide medical advice

Be professional, empathetic, and efficient.""",
                    "enabledTools": ["scheduling", "departments", "insurance"],
                    "maxTurns": 15,
                    "contextStrategy": "append"
                }
            ),
            WorkflowNode(
                id="end",
                type="end",
                config={
                    "endType": "hangup",
                    "closingMessage": f"Thank you for calling {self.context.business_name}. Have a great day!"
                }
            ),
        ]
        
        edges = [
            WorkflowEdge(id="e1", fromNodeId="start", toNodeId="ai-agent-main"),
            WorkflowEdge(id="e2", fromNodeId="ai-agent-main", toNodeId="end"),
        ]
        
        self.workflow_graph = WorkflowGraph(nodes=nodes, edges=edges)
        
        return True
    
    async def start_execution(self) -> bool:
        """
        Start workflow execution from the start node
        
        Returns:
            True if execution started successfully
        """
        if not self.workflow_graph:
            logger.error("Cannot start execution: no workflow loaded")
            return False
        
        start_node = self.workflow_graph.get_start_node()
        if not start_node:
            logger.error("Workflow has no start node")
            return False
        
        # Initialize execution state
        workflow_id = self.context.workflow.get("id", "default") if self.context.workflow else "default"
        self.execution_state = WorkflowExecutionState(
            workflow_id=workflow_id,
            current_node_id=start_node.id,
            started_at=datetime.now().isoformat()
        )
        
        # Start tracing
        workflow_tracer.start_trace(
            f"workflow_{workflow_id}",
            {
                "workflow_id": workflow_id,
                "business_id": self.context.business_id,
                "call_id": self.context.call_id,
                "call_sid": self.context.call_sid,
            }
        )
        
        logger.info(f"🚀 Starting workflow execution from node: {start_node.id}")
        
        # Execute the start node
        return await self.execute_current_node()
    
    async def execute_current_node(self) -> bool:
        """
        Execute the current node in the workflow
        
        Returns:
            True if execution should continue, False if workflow should end
        """
        if not self.execution_state or not self.workflow_graph:
            logger.error("Cannot execute: workflow not initialized")
            return False
        
        current_node = self.workflow_graph.get_node(self.execution_state.current_node_id)
        if not current_node:
            logger.error(f"Current node not found: {self.execution_state.current_node_id}")
            return False
        
        # Check for infinite loops
        loop_count = self.execution_state.get_loop_count(current_node.id)
        if loop_count > 3:
            logger.error(f"Infinite loop detected at node {current_node.id} (visited {loop_count} times)")
            self.context.state = CallState.ENDING
            self._mark_execution_complete("failed")
            return False
        
        # Add to execution path
        self.execution_state.add_node_to_path(current_node.id)
        self.execution_state.turn_count += 1
        
        logger.info(f"▶️ Executing node: {current_node.id} (type: {current_node.type})")
        
        try:
            # Create executor for this node type
            executor = create_node_executor(current_node, self.context)
            
            # Execute the node
            result = await executor.execute()
            
            # Trace node execution
            await self._maybe_await(workflow_tracer.trace_node_execution(
                node_id=current_node.id,
                node_type=current_node.type,
                config=current_node.config,
                result={
                    "success": result.success,
                    "next_node_id": result.next_node_id,
                    "should_escalate": self._result_flag(result, "should_escalate"),
                    "should_end_call": self._result_flag(result, "should_end_call", "should_end"),
                }
            ))
            
            # Handle result
            if not result.success:
                logger.error(f"Node execution failed: {self._result_text(result, 'error_message')}")
                if self._result_flag(result, "should_end_call", "should_end"):
                    self.context.state = CallState.ENDING
                    self._mark_execution_complete("failed")
                    return False
                # Continue to error handling node if configured
            
            # Store any context updates
            context_updates = getattr(result, "context_updates", {}) or {}
            if not isinstance(context_updates, dict):
                context_updates = {}

            for key, value in context_updates.items():
                self.execution_state.set_node_data(current_node.id, key, value)
            
            # Handle escalation
            if self._result_flag(result, "should_escalate"):
                logger.warning(f"🚨 Escalation requested: {result.escalation_reason}")
                self.execution_state.escalated = True
                self.execution_state.escalation_reason = self._result_text(result, "escalation_reason") or "Workflow escalation requested"
                self.context.escalation_reason = self.execution_state.escalation_reason
                self.context.state = CallState.ESCALATING
                
                # Trace escalation
                await self._maybe_await(workflow_tracer.trace_escalation(
                    reason=self.execution_state.escalation_reason,
                    queue_id=current_node.config.get("queueId", ""),
                    context_package=context_updates
                ))
                
                # Workflow will pause here, human takes over
                self._mark_execution_complete("escalated")
                return False
            
            # Handle call end
            if self._result_flag(result, "should_end_call", "should_end"):
                logger.info("Call ending by node request")
                self.context.state = CallState.ENDING
                self._mark_execution_complete("completed")
                return False
            
            # Determine next node
            next_node_id = await self._determine_next_node(current_node, result)
            
            if not next_node_id:
                logger.info("No next node found, ending workflow")
                self.context.state = CallState.ENDING
                self._mark_execution_complete("completed")
                return False
            
            # Move to next node
            self.execution_state.current_node_id = next_node_id
            logger.info(f"➡️ Moving to next node: {next_node_id}")
            
            # Check if next node is an END node
            next_node = self.workflow_graph.get_node(next_node_id)
            if next_node and next_node.type == "end":
                # Execute end node and finish
                await self.execute_current_node()
                self._mark_execution_complete("completed")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error executing node {current_node.id}: {e}", exc_info=True)
            self.context.state = CallState.ENDING
            self._mark_execution_complete("failed")
            return False
    
    async def _determine_next_node(
        self, 
        current_node: WorkflowNode, 
        execution_result: NodeExecutionResult
    ) -> Optional[str]:
        """
        Determine the next node to execute based on edges and conditions
        
        Args:
            current_node: Current workflow node
            execution_result: Result from executing the current node
            
        Returns:
            ID of the next node, or None if workflow should end
        """
        # If result specifies next node, use that
        if execution_result.next_node_id:
            return execution_result.next_node_id
        
        # Get all outgoing edges
        edges = self.workflow_graph.get_outgoing_edges(current_node.id)
        
        if not edges:
            logger.debug(f"No outgoing edges from {current_node.id}")
            return None
        
        # If only one edge, use it
        if len(edges) == 1 and not edges[0].condition:
            return edges[0].toNodeId
        
        # Evaluate conditional edges
        condition_results = {}
        for edge in edges:
            if edge.condition:
                # Create a temporary executor to evaluate condition
                from node_executors import NodeExecutor
                executor = NodeExecutor.__new__(NodeExecutor)
                executor.node = current_node
                executor.context = self.context
                
                result = executor.evaluate_condition(edge.condition)
                condition_results[edge.condition] = result
                
                if result:
                    logger.info(f"Condition matched: {edge.condition}")
                    
                    # Trace conditional evaluation
                    await self._maybe_await(workflow_tracer.trace_conditional_evaluation(
                        node_id=current_node.id,
                        conditions=[e.condition for e in edges if e.condition],
                        evaluation_results=condition_results,
                        selected_branch=edge.toNodeId
                    ))
                    
                    return edge.toNodeId
            else:
                # No condition, this is the default edge
                return edge.toNodeId
        
        # No matching edge found
        logger.warning(f"No matching edge found from {current_node.id}")
        return None
    
    async def handle_user_input(self, user_message: str) -> Optional[str]:
        """
        Process user input during workflow execution
        
        Args:
            user_message: User's message
            
        Returns:
            Response message, or None if handled by AI agent
        """
        # Add to conversation history
        self.context.add_user_message(user_message)
        
        # Check for emergency keywords
        if await self._check_emergency_keywords(user_message):
            logger.warning("🚨 Emergency detected in user input")
            self.context.is_emergency = True
            self.context.state = CallState.ESCALATING
            return "I understand this is urgent. Let me connect you with someone who can help immediately."
        
        # Check for escalation request
        if self._check_escalation_request(user_message):
            logger.info("User requested human assistance")
            self.context.sentiment.escalation_needed = True
            self.context.escalation_reason = "User requested human assistance"
            return "Of course, let me transfer you to someone who can assist you."
        
        # Continue workflow execution
        # Note: Actual AI response is generated in the Pipecat pipeline
        return None

    async def handle_emergency(self, reason: str) -> bool:
        """Short-circuit the workflow when an emergency is detected."""
        logger.warning(f"Emergency flow triggered: {reason}")
        self.context.is_emergency = True
        self.context.escalation_reason = reason
        self.context.state = CallState.ESCALATING

        if self.execution_state:
            self.execution_state.escalated = True
            self.execution_state.escalation_reason = reason
            self.execution_state.mark_complete()

        await self._maybe_await(workflow_tracer.trace_escalation(
            reason=reason,
            queue_id="emergency",
            context_package={
                "business_id": self.context.business_id,
                "call_id": self.context.call_id,
                "call_sid": self.context.call_sid,
            },
        ))
        workflow_tracer.end_trace(
            "emergency",
            {
                "workflow_id": self.context.workflow.get("id", "default") if self.context.workflow else "default",
                "business_id": self.context.business_id,
                "call_id": self.context.call_id,
                "call_sid": self.context.call_sid,
            },
        )
        return True
    
    async def _check_emergency_keywords(self, text: str) -> bool:
        """Check if text contains emergency keywords"""
        text_lower = text.lower()
        emergency_keywords = [
            "chest pain", "can't breathe", "difficulty breathing",
            "stroke", "heart attack", "bleeding", "unconscious",
            "not breathing", "overdose", "suicide", "kill myself",
            "severe pain", "allergic reaction", "anaphylaxis",
            "choking", "seizure", "unresponsive"
        ]
        
        return any(keyword in text_lower for keyword in emergency_keywords)
    
    def _check_escalation_request(self, text: str) -> bool:
        """Check if user is requesting human assistance"""
        text_lower = text.lower()
        escalation_phrases = [
            "speak to a human", "talk to a person", "real person",
            "speak to someone", "talk to someone", "human agent",
            "representative", "operator", "transfer me"
        ]
        
        return any(phrase in text_lower for phrase in escalation_phrases)
    
    def get_execution_summary(self) -> Dict[str, Any]:
        """
        Get a summary of the workflow execution
        
        Returns:
            Dictionary containing execution summary
        """
        if not self.execution_state:
            return {}
        
        return {
            "workflow_id": self.execution_state.workflow_id,
            "execution_path": self.execution_state.execution_path,
            "turn_count": self.execution_state.turn_count,
            "current_node": self.execution_state.current_node_id,
            "completed": self.execution_state.completed,
            "completed_at": self.execution_state.completed_at,
            "escalated": self.execution_state.escalated,
            "escalation_reason": self.execution_state.escalation_reason,
            "started_at": self.execution_state.started_at,
            "node_data": self.execution_state.node_data,
        }
    
    async def report_progress(self):
        """Report workflow execution progress to Core API"""
        try:
            if not self.context.call_id:
                return
            
            summary = self.get_execution_summary()
            
            # Send progress update to Core API
            # Note: This endpoint will be created in Phase 2
            await api_client.update_call_workflow_progress(
                self.context.call_id,
                {
                    "workflow_execution": summary,
                    "current_state": self.context.state.value,
                    "sentiment": {
                        "frustration": self.context.sentiment.frustration_level,
                        "urgency": self.context.sentiment.urgency_level,
                    },
                }
            )
            
        except Exception as e:
            logger.error(f"Error reporting progress: {e}")
