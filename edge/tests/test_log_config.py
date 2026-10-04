"""Tests for the structured logging configuration module."""
import json
import logging
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from log_config import (
    ColoredFormatter,
    JSONFormatter,
    get_log_config_summary,
    setup_logging,
)


# ---------------------------------------------------------------------------
# JSONFormatter
# ---------------------------------------------------------------------------

def test_json_formatter_basic():
    """JSONFormatter should produce valid single-line JSON."""
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name='edge', level=logging.INFO, pathname='main.py',
        lineno=42, msg='Telemetry posted', args=(), exc_info=None,
    )
    output = formatter.format(record)
    parsed = json.loads(output)

    assert parsed['level'] == 'INFO'
    assert parsed['logger'] == 'edge'
    assert parsed['message'] == 'Telemetry posted'
    assert parsed['lineno'] == 42
    assert parsed['timestamp'].endswith('Z')


def test_json_formatter_with_exception():
    """JSONFormatter should include exception details when exc_info is set."""
    formatter = JSONFormatter()
    try:
        raise ValueError("test error")
    except ValueError:
        record = logging.LogRecord(
            name='edge', level=logging.ERROR, pathname='main.py',
            lineno=10, msg='Something broke', args=(),
            exc_info=sys.exc_info(),
        )
    output = formatter.format(record)
    parsed = json.loads(output)

    assert 'exception' in parsed
    assert parsed['exception']['type'] == 'ValueError'
    assert parsed['exception']['message'] == 'test error'
    assert isinstance(parsed['exception']['traceback'], list)


def test_json_formatter_extra_fields():
    """JSONFormatter should include whitelisted extra fields if present."""
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name='edge', level=logging.INFO, pathname='main.py',
        lineno=1, msg='payload sent', args=(), exc_info=None,
    )
    record.device_id = 'edge-node-01'
    record.payload_size = 256
    record.latency_ms = 42.5

    output = formatter.format(record)
    parsed = json.loads(output)

    assert parsed['device_id'] == 'edge-node-01'
    assert parsed['payload_size'] == 256
    assert parsed['latency_ms'] == 42.5


def test_json_formatter_no_extra_fields():
    """JSONFormatter should not include extra fields if they aren't set."""
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name='edge', level=logging.INFO, pathname='main.py',
        lineno=1, msg='test', args=(), exc_info=None,
    )
    output = formatter.format(record)
    parsed = json.loads(output)

    assert 'device_id' not in parsed
    assert 'payload_size' not in parsed


# ---------------------------------------------------------------------------
# ColoredFormatter
# ---------------------------------------------------------------------------

def test_colored_formatter_contains_level():
    """ColoredFormatter should include the log level in the output."""
    formatter = ColoredFormatter()
    record = logging.LogRecord(
        name='edge', level=logging.WARNING, pathname='main.py',
        lineno=1, msg='something happened', args=(), exc_info=None,
    )
    output = formatter.format(record)
    assert 'WARNING' in output
    assert 'something happened' in output


def test_colored_formatter_info_level():
    formatter = ColoredFormatter()
    record = logging.LogRecord(
        name='edge', level=logging.INFO, pathname='main.py',
        lineno=1, msg='info msg', args=(), exc_info=None,
    )
    output = formatter.format(record)
    assert 'INFO' in output
    # Should contain ANSI escape codes
    assert '\033[' in output


# ---------------------------------------------------------------------------
# setup_logging
# ---------------------------------------------------------------------------

def test_setup_logging_human_format():
    """setup_logging with 'human' format should install a ColoredFormatter."""
    setup_logging(fmt='human', level='DEBUG')
    root = logging.getLogger()
    assert len(root.handlers) >= 1
    console_handler = root.handlers[0]
    assert isinstance(console_handler.formatter, ColoredFormatter)
    assert root.level == logging.DEBUG


def test_setup_logging_json_format():
    """setup_logging with 'json' format should install a JSONFormatter."""
    setup_logging(fmt='json', level='WARNING')
    root = logging.getLogger()
    assert len(root.handlers) >= 1
    console_handler = root.handlers[0]
    assert isinstance(console_handler.formatter, JSONFormatter)
    assert root.level == logging.WARNING


def test_setup_logging_clears_existing_handlers():
    """Calling setup_logging multiple times should not duplicate handlers."""
    setup_logging(fmt='human')
    handler_count_1 = len(logging.getLogger().handlers)

    setup_logging(fmt='json')
    handler_count_2 = len(logging.getLogger().handlers)

    assert handler_count_1 == handler_count_2


def test_setup_logging_invalid_format():
    with pytest.raises(ValueError, match="Invalid log format"):
        setup_logging(fmt='xml')


def test_setup_logging_invalid_level():
    with pytest.raises(ValueError, match="Invalid log level"):
        setup_logging(level='MEGA')


def test_setup_logging_with_file(tmp_path):
    """setup_logging with log_file should add a RotatingFileHandler."""
    log_file = str(tmp_path / 'edge.log')
    setup_logging(fmt='human', log_file=log_file)

    root = logging.getLogger()
    file_handlers = [
        h for h in root.handlers
        if isinstance(h, logging.handlers.RotatingFileHandler)
    ]
    assert len(file_handlers) == 1
    assert isinstance(file_handlers[0].formatter, JSONFormatter)

    # Verify the log file is created when we actually write
    logging.getLogger('test').info("hello from test")
    file_handlers[0].flush()
    assert Path(log_file).exists()
    content = Path(log_file).read_text(encoding='utf-8')
    parsed = json.loads(content.strip().split('\n')[0])
    assert parsed['message'] == 'hello from test'

    # Cleanup
    setup_logging(fmt='human')


# ---------------------------------------------------------------------------
# get_log_config_summary
# ---------------------------------------------------------------------------

def test_log_config_summary_structure():
    setup_logging(fmt='json', level='INFO')
    summary = get_log_config_summary(fmt='json', level='INFO')

    assert summary['format'] == 'json'
    assert summary['level'] == 'INFO'
    assert summary['log_file'] is None
    assert isinstance(summary['handlers'], list)
    assert len(summary['handlers']) >= 1


def test_log_config_summary_with_file(tmp_path):
    log_file = str(tmp_path / 'test.log')
    setup_logging(fmt='human', log_file=log_file)
    summary = get_log_config_summary(fmt='human', log_file=log_file)

    assert summary['log_file'] == log_file
    assert 'RotatingFileHandler' in summary['handlers']

    # Cleanup
    setup_logging(fmt='human')
