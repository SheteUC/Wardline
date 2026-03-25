"""
LangSmith tracing integration for workflow execution observability
Provides detailed traces of workflow execution, node transitions, and AI interactions
"""
import os
from typing import Optional, Dict, Any
from datetime import datetime
from loguru import logger

# LangSmith imports (optional dependency)
try:
    from langsmith import Client as LangSmithClient
    from langsmith.run_helpers import traceable
    LANGSMITH_AVAILABLE = True
except ImportError:
    logger.warning("LangSmith not installed. Tracing will be disabled.")
    LANGSMITH_AVAILABLE = False
    
    # Mock decorator when LangSmith not available
    def traceable(*args, **kwargs):
        def decorator(func):
            return func
        return decorator


class WorkflowTracer:
    """
    Wrapper for LangSmith tracing of workflow executions
    """
    
    def __init__(self, enabled: bool = True):
        self.enabled = enabled and LANGSMITH_AVAILABLE
        self.client: Optional[LangSmithClient] = None
        self.current_trace_id: Optional[str] = None
        
        if self.enabled:
            self._initialize_client()
    
    def _initialize_client(self):
        """Initialize LangSmith client"""
        try:
            api_key = os.getenv("LANGSMITH_API_KEY")
            if not api_key:
                logger.warning("LANGSMITH_API_KEY not set, tracing disabled")
                self.enabled = False
                return
            
            self.client = LangSmithClient(
                api_key=api_key,
                api_url=os.getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")
            )
            
            logger.info("✅ LangSmith tracing initialized")
            
        except Exception as e:
            logger.error(f"Error initializing LangSmith: {e}")
            self.enabled = False
    
    @traceable(name="workflow_execution", run_type="chain")
    async def trace_workflow_execution(
        self,
        workflow_id: str,
        business_id: str,
        call_id: str,
        execution_data: Dict[str, Any]
    ):
        """
        Trace an entire workflow execution
        
        Args:
            workflow_id: Workflow identifier
            business_id: Business identifier
            call_id: Call session identifier
            execution_data: Execution state data
        """
        if not self.enabled:
            return
        
        try:
            # LangSmith will automatically capture this as a trace
            logger.debug(f"Tracing workflow execution: {workflow_id}")
            
            return {
                "workflow_id": workflow_id,
                "business_id": business_id,
                "call_id": call_id,
                **execution_data
            }
            
        except Exception as e:
            logger.error(f"Error tracing workflow execution: {e}")
    
    @traceable(name="node_execution", run_type="chain")
    async def trace_node_execution(
        self,
        node_id: str,
        node_type: str,
        config: Dict[str, Any],
        result: Dict[str, Any]
    ):
        """
        Trace execution of a single workflow node
        
        Args:
            node_id: Node identifier
            node_type: Type of node
            config: Node configuration
            result: Execution result
        """
        if not self.enabled:
            return
        
        try:
            return {
                "node_id": node_id,
                "node_type": node_type,
                "config": config,
                "result": result,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error tracing node execution: {e}")
    
    @traceable(name="ai_agent_interaction", run_type="llm")
    async def trace_ai_interaction(
        self,
        node_id: str,
        system_prompt: str,
        user_message: str,
        ai_response: str,
        context_data: Dict[str, Any]
    ):
        """
        Trace AI agent interaction
        
        Args:
            node_id: AI agent node ID
            system_prompt: System prompt used
            user_message: User's message
            ai_response: AI's response
            context_data: Additional context
        """
        if not self.enabled:
            return
        
        try:
            return {
                "node_id": node_id,
                "system_prompt": system_prompt[:200],  # Truncate for readability
                "user_message": user_message,
                "ai_response": ai_response,
                "context": context_data,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error tracing AI interaction: {e}")
    
    @traceable(name="safety_event", run_type="tool")
    async def trace_safety_event(
        self,
        keyword: str,
        category: str,
        severity: str,
        action_taken: str,
        context: str
    ):
        """
        Trace safety guard events
        
        Args:
            keyword: Detected keyword
            category: Keyword category
            severity: Event severity
            action_taken: Action taken
            context: Context where keyword was found
        """
        if not self.enabled:
            return
        
        try:
            return {
                "keyword": keyword,
                "category": category,
                "severity": severity,
                "action_taken": action_taken,
                "context": context[:100],
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error tracing safety event: {e}")
    
    @traceable(name="escalation", run_type="tool")
    async def trace_escalation(
        self,
        reason: str,
        queue_id: str,
        context_package: Dict[str, Any]
    ):
        """
        Trace escalation to human agent
        
        Args:
            reason: Escalation reason
            queue_id: Target queue
            context_package: Escalation context
        """
        if not self.enabled:
            return
        
        try:
            return {
                "reason": reason,
                "queue_id": queue_id,
                "context_package": {
                    k: v for k, v in context_package.items()
                    if k not in ["transcript"]  # Exclude large data
                },
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error tracing escalation: {e}")
    
    @traceable(name="conditional_evaluation", run_type="chain")
    async def trace_conditional_evaluation(
        self,
        node_id: str,
        conditions: list,
        evaluation_results: Dict[str, bool],
        selected_branch: str
    ):
        """
        Trace conditional node evaluation
        
        Args:
            node_id: Conditional node ID
            conditions: List of conditions evaluated
            evaluation_results: Results for each condition
            selected_branch: Which branch was taken
        """
        if not self.enabled:
            return
        
        try:
            return {
                "node_id": node_id,
                "conditions": conditions,
                "evaluation_results": evaluation_results,
                "selected_branch": selected_branch,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error tracing conditional evaluation: {e}")
    
    @traceable(name="integration_call", run_type="tool")
    async def trace_integration_call(
        self,
        node_id: str,
        integration_type: str,
        endpoint: str,
        method: str,
        success: bool,
        response_data: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ):
        """
        Trace external integration calls
        
        Args:
            node_id: Integration node ID
            integration_type: Type of integration
            endpoint: API endpoint
            method: HTTP method
            success: Whether call succeeded
            response_data: Response data (if successful)
            error: Error message (if failed)
        """
        if not self.enabled:
            return
        
        try:
            return {
                "node_id": node_id,
                "integration_type": integration_type,
                "endpoint": endpoint,
                "method": method,
                "success": success,
                "response_data": response_data,
                "error": error,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error tracing integration call: {e}")
    
    def start_trace(self, trace_name: str, metadata: Dict[str, Any]):
        """Start a new trace session"""
        if not self.enabled:
            return
        
        try:
            # Store trace metadata
            self.current_trace_id = f"{trace_name}_{datetime.now().isoformat()}"
            logger.debug(f"Started trace: {self.current_trace_id}")
            
        except Exception as e:
            logger.error(f"Error starting trace: {e}")
    
    def end_trace(self, outcome: str, metadata: Dict[str, Any]):
        """End the current trace session"""
        if not self.enabled:
            return
        
        try:
            logger.debug(f"Ended trace: {self.current_trace_id} (outcome: {outcome})")
            self.current_trace_id = None
            
        except Exception as e:
            logger.error(f"Error ending trace: {e}")


# Global tracer instance
workflow_tracer = WorkflowTracer(
    enabled=os.getenv("LANGSMITH_TRACING", "false").lower() == "true"
)
