from __future__ import annotations

import logging
import os

_log = logging.getLogger(__name__)


def instrument_app(app) -> None:
    """Enable OTLP traces + auto instrumentation when OTEL_EXPORTER_OTLP_ENDPOINT is set."""
    endpoint = (os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT") or "").strip()
    if not endpoint or os.environ.get("OTEL_SDK_DISABLED", "").lower() == "true":
        return
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError as e:
        _log.warning("OpenTelemetry packages missing; skipping OTEL: %s", e)
        return

    try:
        resource = Resource.create(
            {
                "service.name": os.environ.get("OTEL_SERVICE_NAME", "wardline-voice-runtime-v2"),
            }
        )
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor.instrument_app(app)
        HTTPXClientInstrumentor().instrument()
    except Exception as e:
        _log.warning("OpenTelemetry setup failed; continuing without OTEL: %s", e)
