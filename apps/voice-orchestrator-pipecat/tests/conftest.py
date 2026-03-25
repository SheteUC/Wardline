import pytest


@pytest.fixture
def benchmark():
    """Fallback benchmark fixture when pytest-benchmark is not installed."""

    def _benchmark(func, *args, **kwargs):
        return func(*args, **kwargs)

    return _benchmark
