"""Unit tests for llm_client client selection and helpers."""
from __future__ import annotations

import pathlib
import sys
import unittest
from unittest.mock import patch

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

import config  # noqa: E402
import llm_client  # noqa: E402


class LlmClientTests(unittest.TestCase):
    def tearDown(self):
        llm_client.reset_client_for_tests()

    def test_get_client_returns_none_without_credentials(self):
        llm_client.reset_client_for_tests()
        with patch.object(config.settings, "llm_provider", "openai"), patch.object(
            config.settings,
            "openai_api_key",
            "",
        ), patch.object(config.settings, "azure_openai_key", ""):
            self.assertIsNone(llm_client._get_client())

    def test_active_llm_model_name_follows_settings(self):
        llm_client.reset_client_for_tests()
        with patch.object(config.settings, "llm_provider", "openai"), patch.object(
            config.settings,
            "openai_api_key",
            "sk-test",
        ), patch.object(config.settings, "openai_model", "gpt-4o-mini"):
            self.assertEqual(llm_client.active_llm_model_name(), "gpt-4o-mini")


if __name__ == "__main__":
    unittest.main()
