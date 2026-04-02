from __future__ import annotations

import logging
import os
import sys

import structlog


def configure_logging() -> None:
    """JSON logs when WARDLINE_LOG_FORMAT=json or production-style env; else console."""
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_format = os.environ.get("WARDLINE_LOG_FORMAT", "").lower()
    env = os.environ.get("ENVIRONMENT", os.environ.get("NODE_ENV", "")).lower()
    json_logs = log_format == "json" or env == "production"

    timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)

    shared = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        timestamper,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    processors = [
        *shared,
        structlog.processors.JSONRenderer()
        if json_logs
        else structlog.dev.ConsoleRenderer(colors=True),
    ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, level, logging.INFO),
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
