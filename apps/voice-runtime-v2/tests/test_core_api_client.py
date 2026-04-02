"""Unit tests for CoreApiClient path prefixing and retry classification."""
from __future__ import annotations

import pathlib
import sys
import unittest
from unittest.mock import MagicMock, patch

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

import config  # noqa: E402
import core_api_client  # noqa: E402


class CoreApiClientTests(unittest.TestCase):
    def test_retryable_status_codes(self):
        for code in (408, 429, 502, 503, 504):
            self.assertTrue(core_api_client._retryable_status(code), code)
        self.assertFalse(core_api_client._retryable_status(500))
        self.assertFalse(core_api_client._retryable_status(200))

    def test_versioned_path_respects_prefix(self):
        mock_client = MagicMock()
        with patch("core_api_client.httpx.AsyncClient", return_value=mock_client):
            with patch.object(config.settings, "core_api_path_prefix", "/api/v1"):
                client = core_api_client.CoreApiClient()
                self.assertEqual(client._versioned_path("/foo"), "/api/v1/foo")
                self.assertEqual(client._versioned_path("bar"), "/api/v1/bar")

    def test_versioned_path_empty_prefix_defaults_to_v1(self):
        mock_client = MagicMock()
        with patch("core_api_client.httpx.AsyncClient", return_value=mock_client):
            with patch.object(config.settings, "core_api_path_prefix", "   "):
                client = core_api_client.CoreApiClient()
                self.assertEqual(client._path_prefix, "/v1")


if __name__ == "__main__":
    unittest.main()
