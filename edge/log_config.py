"""Configurable structured logging for the edge node.

Supports two output formats:
  - **human** (default): Colored, human-readable console output for development
  - **json**: Structured JSON lines for production log aggregation (ELK, Datadog, etc.)

Also configures file-based log rotation to prevent disk fill-up on
long-running edge deployments.

Usage:
    from log_config import setup_logging

    # Development (default)
    setup_logging()

    # Production JSON output
    setup_logging(fmt='json', level='INFO')

    # With file rotation
    setup_logging(fmt='json', log_file='edge.log', max_bytes=10_000_000, backup_count=5)
"""
import datetime
import json
import logging
import logging.handlers
import sys
import traceback
from typing import Optional


class JSONFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects.

    Output fields:
        timestamp, level, logger, message, module, funcName, lineno
        + exc_info if an exception is attached
    """

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            'timestamp': datetime.datetime.fromtimestamp(
                record.created, tz=datetime.timezone.utc
            ).isoformat().replace('+00:00', 'Z'),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'funcName': record.funcName,
            'lineno': record.lineno,
        }

        if record.exc_info and record.exc_info[0] is not None:
            log_entry['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': traceback.format_exception(*record.exc_info),
            }

        # Include any extra fields attached to the record
        for key in ('device_id', 'payload_size', 'latency_ms', 'anomaly', 'z_score'):
            if hasattr(record, key):
                log_entry[key] = getattr(record, key)

        return json.dumps(log_entry, default=str)


class ColoredFormatter(logging.Formatter):
    """Human-readable formatter with ANSI color codes for terminal output.

    Color scheme:
        DEBUG    → dim gray
        INFO     → cyan
        WARNING  → yellow
        ERROR    → red
        CRITICAL → bold red background
    """

    COLORS = {
        logging.DEBUG:    '\033[90m',      # dim gray
        logging.INFO:     '\033[36m',      # cyan
        logging.WARNING:  '\033[33m',      # yellow
        logging.ERROR:    '\033[31m',      # red
        logging.CRITICAL: '\033[41;97m',   # white on red background
    }
    RESET = '\033[0m'

    def __init__(self, fmt: Optional[str] = None, datefmt: Optional[str] = None):
        super().__init__(
            fmt=fmt or '%(asctime)s %(colored_level)s %(name)s: %(message)s',
            datefmt=datefmt or '%H:%M:%S',
        )

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelno, '')
        record.colored_level = f"{color}[{record.levelname}]{self.RESET}"
        return super().format(record)


def setup_logging(
    fmt: str = 'human',
    level: str = 'INFO',
    log_file: Optional[str] = None,
    max_bytes: int = 10_000_000,  # 10 MB
    backup_count: int = 3,
) -> None:
    """Configure logging for the edge node.

    Args:
        fmt: Output format — 'human' for colored console, 'json' for structured.
        level: Log level string (DEBUG, INFO, WARNING, ERROR, CRITICAL).
        log_file: Optional path to a log file. Enables rotating file handler.
        max_bytes: Max log file size before rotation (default: 10MB).
        backup_count: Number of rotated backup files to keep (default: 3).
    """
    if fmt not in ('human', 'json'):
        raise ValueError(f"Invalid log format: {fmt!r}. Must be 'human' or 'json'.")

    numeric_level = getattr(logging, level.upper(), None)
    if not isinstance(numeric_level, int):
        raise ValueError(f"Invalid log level: {level!r}")

    root = logging.getLogger()

    # Clear any existing handlers (prevents duplicate handlers on re-init)
    root.handlers.clear()
    root.setLevel(numeric_level)

    # Console handler
    console = logging.StreamHandler(sys.stderr)
    console.setLevel(numeric_level)

    if fmt == 'json':
        console.setFormatter(JSONFormatter())
    else:
        console.setFormatter(ColoredFormatter())

    root.addHandler(console)

    # File handler with rotation (always JSON for machine parsing)
    if log_file:
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding='utf-8',
        )
        file_handler.setLevel(numeric_level)
        file_handler.setFormatter(JSONFormatter())
        root.addHandler(file_handler)


def get_log_config_summary(
    fmt: str = 'human',
    level: str = 'INFO',
    log_file: Optional[str] = None,
    max_bytes: int = 10_000_000,
    backup_count: int = 3,
) -> dict:
    """Return a summary dict of the current logging configuration (for health reports)."""
    return {
        'format': fmt,
        'level': level,
        'log_file': log_file,
        'max_bytes': max_bytes,
        'backup_count': backup_count,
        'handlers': [type(h).__name__ for h in logging.getLogger().handlers],
    }
