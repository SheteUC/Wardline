"""Unit tests for llm_client client selection and helpers."""
from __future__ import annotations

import pathlib
import sys
import unittest
from unittest.mock import AsyncMock, Mock, patch

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

    def test_get_client_uses_openai_without_azure_settings(self):
        llm_client.reset_client_for_tests()
        sentinel = object()
        with patch.object(config.settings, "llm_provider", "openai"), patch.object(
            config.settings,
            "openai_api_key",
            "sk-test",
        ), patch.object(config.settings, "azure_openai_key", ""), patch.object(
            config.settings,
            "azure_openai_endpoint",
            "",
        ), patch.object(llm_client, "AsyncOpenAI", return_value=sentinel) as openai_ctor:
            self.assertIs(llm_client._get_client(), sentinel)
        openai_ctor.assert_called_once()


class FakeStatusError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


class LlmClientAsyncTests(unittest.IsolatedAsyncioTestCase):
    def tearDown(self):
        llm_client.reset_client_for_tests()

    async def test_chat_json_completion_returns_none_on_openai_auth_failure(self):
        create_mock = AsyncMock(side_effect=FakeStatusError(401, "invalid_api_key"))
        llm_client._client = Mock(
            chat=Mock(completions=Mock(create=create_mock)),
        )

        with patch.object(config.settings, "llm_provider", "openai"), patch.object(
            config.settings,
            "openai_api_key",
            "sk-invalid",
        ), patch.object(llm_client, "active_llm_model_name", return_value="gpt-4o-2024-08-06"):
            result = await llm_client.chat_json_completion(
                system_prompt="system",
                user_prompt="user",
            )

        self.assertIsNone(result)
        create_mock.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
