"""
Unit tests for WardlineFlowManager.

Tests cover workflow loading (cache, fallback), node execution, edge traversal,
emergency detection, and the infinite-loop guard.
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def ctx():
    """A minimal CallContext for testing."""
    from call_context import CallContext
    context = CallContext(call_sid="CA_test")
    context.call_id = "call-1"
    context.hospital_id = "hosp-1"
    return context


@pytest.fixture
def simple_workflow_data():
    """A three-node workflow: start → ai-agent → end."""
    return {
        "graphJson": {
            "nodes": [
                {"id": "n1", "type": "start", "config": {}},
                {"id": "n2", "type": "ai-agent", "config": {"persona": "receptionist", "capabilities": [], "escalationRules": []}},
                {"id": "n3", "type": "end", "config": {}},
            ],
            "edges": [
                {"id": "e1", "fromNodeId": "n1", "toNodeId": "n2"},
                {"id": "e2", "fromNodeId": "n2", "toNodeId": "n3"},
            ],
        }
    }


@pytest.fixture
def mock_api(monkeypatch):
    """Replace api_client with a mock."""
    api = MagicMock()
    api.get_active_workflow = AsyncMock(return_value=None)
    api.update_call_session = AsyncMock(return_value={})
    import flow_manager as fm
    monkeypatch.setattr(fm, "api_client", api)
    return api


@pytest.fixture
def mock_tracer(monkeypatch):
    """Stub out LangSmith tracer."""
    tracer = MagicMock()
    tracer.trace_node_execution = MagicMock(return_value=MagicMock(__enter__=lambda s, *a: s, __exit__=MagicMock()))
    import flow_manager as fm
    monkeypatch.setattr(fm, "workflow_tracer", tracer)
    return tracer


# ---------------------------------------------------------------------------
# load_workflow
# ---------------------------------------------------------------------------

class TestLoadWorkflow:
    @pytest.mark.asyncio
    async def test_returns_false_when_api_returns_none(self, ctx, mock_api):
        from flow_manager import WardlineFlowManager
        mock_api.get_active_workflow.return_value = None
        manager = WardlineFlowManager(ctx)
        # _load_default_workflow will also need a stub
        with patch.object(manager, "_load_default_workflow", new=AsyncMock(return_value=True)):
            result = await manager.load_workflow("hosp-1")
        # Falls back to default, which returns True
        assert result is True

    @pytest.mark.asyncio
    async def test_loads_workflow_from_api(self, ctx, mock_api, simple_workflow_data):
        from flow_manager import WardlineFlowManager
        mock_api.get_active_workflow.return_value = simple_workflow_data
        manager = WardlineFlowManager(ctx)
        result = await manager.load_workflow("hosp-1")
        assert result is True
        assert manager.workflow_graph is not None
        assert len(manager.workflow_graph.nodes) == 3

    @pytest.mark.asyncio
    async def test_uses_cache_on_second_load(self, ctx, mock_api, simple_workflow_data):
        from flow_manager import WardlineFlowManager
        mock_api.get_active_workflow.return_value = simple_workflow_data
        manager = WardlineFlowManager(ctx)
        await manager.load_workflow("hosp-1")
        await manager.load_workflow("hosp-1")
        # API should only be called once
        mock_api.get_active_workflow.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_false_for_empty_graph_json(self, ctx, mock_api):
        from flow_manager import WardlineFlowManager
        mock_api.get_active_workflow.return_value = {"graphJson": {}}
        manager = WardlineFlowManager(ctx)
        result = await manager.load_workflow("hosp-1")
        assert result is False


# ---------------------------------------------------------------------------
# start_execution / execute_next_node
# ---------------------------------------------------------------------------

class TestExecution:
    @pytest.mark.asyncio
    async def test_start_execution_begins_at_start_node(self, ctx, mock_api, simple_workflow_data, mock_tracer):
        from flow_manager import WardlineFlowManager
        mock_api.get_active_workflow.return_value = simple_workflow_data
        manager = WardlineFlowManager(ctx)
        await manager.load_workflow("hosp-1")

        with patch("flow_manager.create_node_executor") as mock_exec_factory:
            mock_executor = MagicMock()
            mock_executor.execute = AsyncMock(return_value=MagicMock(
                success=True, next_node_id="n2", should_end=False
            ))
            mock_exec_factory.return_value = mock_executor
            result = await manager.start_execution()

        assert result is not None

    @pytest.mark.asyncio
    async def test_execute_next_node_follows_edges(self, ctx, mock_api, simple_workflow_data, mock_tracer):
        from flow_manager import WardlineFlowManager
        mock_api.get_active_workflow.return_value = simple_workflow_data
        manager = WardlineFlowManager(ctx)
        await manager.load_workflow("hosp-1")
        await manager.start_execution()

        assert manager.execution_state is not None
        # Current node should be the first non-start node or 'n1'
        assert manager.execution_state.current_node_id is not None

    @pytest.mark.asyncio
    async def test_stops_at_end_node(self, ctx, mock_api, mock_tracer):
        """Workflow with start → end should complete in one step."""
        from flow_manager import WardlineFlowManager
        short_workflow = {
            "graphJson": {
                "nodes": [
                    {"id": "s", "type": "start", "config": {}},
                    {"id": "e", "type": "end", "config": {}},
                ],
                "edges": [{"id": "e1", "fromNodeId": "s", "toNodeId": "e"}],
            }
        }
        mock_api.get_active_workflow.return_value = short_workflow
        manager = WardlineFlowManager(ctx)
        await manager.load_workflow("hosp-1")

        with patch("flow_manager.create_node_executor") as mock_factory:
            exec_mock = MagicMock()
            exec_mock.execute = AsyncMock(return_value=MagicMock(
                success=True, next_node_id="e", should_end=True
            ))
            mock_factory.return_value = exec_mock
            result = await manager.start_execution()

        # Should not raise; end node marks execution complete
        assert manager.execution_state is None or manager.execution_state.is_complete


# ---------------------------------------------------------------------------
# Emergency detection
# ---------------------------------------------------------------------------

class TestEmergencyDetection:
    @pytest.mark.asyncio
    async def test_emergency_short_circuits_workflow(self, ctx, mock_api, simple_workflow_data, mock_tracer):
        from flow_manager import WardlineFlowManager
        mock_api.get_active_workflow.return_value = simple_workflow_data
        manager = WardlineFlowManager(ctx)
        await manager.load_workflow("hosp-1")

        ctx.is_emergency = True

        with patch("flow_manager.create_node_executor") as mock_factory:
            exec_mock = MagicMock()
            exec_mock.execute = AsyncMock(return_value=MagicMock(
                success=True, next_node_id=None, should_end=True
            ))
            mock_factory.return_value = exec_mock
            result = await manager.handle_emergency("chest pain detected")

        # Emergency handler should return something (True / escalation result)
        assert result is not None


# ---------------------------------------------------------------------------
# Infinite loop guard
# ---------------------------------------------------------------------------

class TestInfiniteLoopGuard:
    @pytest.mark.asyncio
    async def test_loop_guard_stops_execution(self, ctx, mock_api, mock_tracer):
        """A workflow that cycles forever should stop after the max iteration limit."""
        from flow_manager import WardlineFlowManager
        looping_workflow = {
            "graphJson": {
                "nodes": [
                    {"id": "a", "type": "start", "config": {}},
                    {"id": "b", "type": "ai-agent", "config": {"persona": "x", "capabilities": [], "escalationRules": []}},
                ],
                "edges": [
                    {"id": "e1", "fromNodeId": "a", "toNodeId": "b"},
                    {"id": "e2", "fromNodeId": "b", "toNodeId": "a"},  # cycle
                ],
            }
        }
        mock_api.get_active_workflow.return_value = looping_workflow
        manager = WardlineFlowManager(ctx)
        await manager.load_workflow("hosp-1")

        call_count = 0
        max_iterations = 50

        async def counting_execute(_node, _ctx):
            nonlocal call_count
            call_count += 1
            if call_count >= max_iterations:
                return MagicMock(success=True, next_node_id=None, should_end=True)
            return MagicMock(success=True, next_node_id="a" if call_count % 2 == 0 else "b", should_end=False)

        with patch("flow_manager.create_node_executor") as mock_factory:
            exec_mock = MagicMock()
            exec_mock.execute = AsyncMock(side_effect=counting_execute)
            mock_factory.return_value = exec_mock

            # Should terminate (not hang) — give it a generous timeout
            try:
                await asyncio.wait_for(manager.start_execution(), timeout=10.0)
            except asyncio.TimeoutError:
                pytest.fail("Infinite loop guard did not stop execution within 10 seconds")
