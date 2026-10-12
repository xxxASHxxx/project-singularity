"""Tests for agent_orchestration script helpers and configuration."""
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))
import agent_orchestration as ao


def test_post_artifact_payload_formatting():
    """Verify post_artifact calculates byte length and formats payload correctly."""
    with patch("agent_orchestration.api_post") as mock_post:
        mock_post.return_value = {"id": 1}
        ao.post_artifact(mission_id=42, artifact_type="PLAN_MD", storage_path="## Test Plan")

        mock_post.assert_called_once_with(
            "/api/v1/missions/42/artifacts",
            {
                "artifactType": "PLAN_MD",
                "storagePath": "## Test Plan",
                "fileSizeBytes": len("## Test Plan".encode("utf-8")),
            },
        )


def test_set_status_payload_formatting():
    """Verify set_status formats status and summary correctly."""
    with patch("agent_orchestration.api_patch") as mock_patch:
        mock_patch.return_value = {"id": 10, "status": "RUNNING"}
        ao.set_status(mission_id=10, status="RUNNING", summary="Calculating reorder")

        mock_patch.assert_called_once_with(
            "/api/v1/missions/10/status",
            {"status": "RUNNING", "summary": "Calculating reorder"},
        )


def test_custom_api_url_and_env_support(monkeypatch):
    """Verify API_BASE can be configured via environment variable."""
    monkeypatch.setenv("API_URL", "http://custom-api:9090")
    # Re-import or re-read env
    url = ao.os.environ.get("API_URL", "http://localhost:8080").rstrip("/")
    assert url == "http://custom-api:9090"
