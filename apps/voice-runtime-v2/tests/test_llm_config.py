import os
import pathlib
import sys
import unittest
from unittest.mock import patch

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from config import Settings  # noqa: E402
from providers import ReasoningAdapter  # noqa: E402


class LlmConfigTests(unittest.TestCase):
    def test_auto_prefers_openai_when_both_keys_present(self):
        with patch.dict(
            os.environ,
            {
                "OPENAI_API_KEY": "sk-test",
                "AZURE_OPENAI_KEY": "azure-key",
                "AZURE_OPENAI_DEPLOYMENT": "my-deploy",
                "OPENAI_MODEL": "gpt-4o-mini",
                "LLM_PROVIDER": "auto",
            },
            clear=False,
        ):
            s = Settings()
        self.assertEqual(s.active_llm_provider(), "openai")
        self.assertEqual(s.active_llm_model(), "gpt-4o-mini")

    def test_auto_falls_back_to_azure_when_only_azure_key(self):
        with patch.dict(
            os.environ,
            {
                "OPENAI_API_KEY": "",
                "AZURE_OPENAI_KEY": "azure-key",
                "AZURE_OPENAI_DEPLOYMENT": "gpt-4.1-mini",
                "LLM_PROVIDER": "auto",
            },
            clear=False,
        ):
            s = Settings()
        self.assertEqual(s.active_llm_provider(), "azure")
        self.assertEqual(s.active_llm_model(), "gpt-4.1-mini")

    def test_llm_provider_azure_forces_azure_even_with_openai_key(self):
        with patch.dict(
            os.environ,
            {
                "OPENAI_API_KEY": "sk-test",
                "AZURE_OPENAI_KEY": "azure-key",
                "AZURE_OPENAI_DEPLOYMENT": "deploy-x",
                "LLM_PROVIDER": "azure",
            },
            clear=False,
        ):
            s = Settings()
        self.assertEqual(s.active_llm_provider(), "azure")
        self.assertEqual(s.active_llm_model(), "deploy-x")

    @patch("providers.settings")
    def test_reasoning_adapter_validate_matches_active_provider(self, mock_settings):
        mock_settings.active_llm_provider.return_value = "openai"
        mock_settings.active_llm_model.return_value = "gpt-4o"
        adapter = ReasoningAdapter()
        self.assertEqual(
            adapter.validate(),
            {"configured": True, "provider": "openai", "model": "gpt-4o"},
        )


if __name__ == "__main__":
    unittest.main()
