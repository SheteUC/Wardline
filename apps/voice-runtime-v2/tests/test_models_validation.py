"""Pydantic validation edge cases for voice runtime models."""
from __future__ import annotations

import pathlib
import sys
import unittest

from pydantic import ValidationError

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from models import AfterHoursPolicy, DaytimeHandoffPolicy, ServicePolicy  # noqa: E402


class ModelsValidationTests(unittest.TestCase):
    def test_after_hours_policy_rejects_invalid_mode(self):
        with self.assertRaises(ValidationError):
            AfterHoursPolicy.model_validate(
                {
                    "mode": "not_a_valid_mode",
                    "greeting": "Hi",
                    "sendUrgentToVoicemail": False,
                }
            )

    def test_daytime_handoff_policy_rejects_invalid_mode(self):
        with self.assertRaises(ValidationError):
            DaytimeHandoffPolicy.model_validate(
                {
                    "mode": "invalid",
                    "transferTargetLabel": "desk",
                    "transferPhone": "",
                    "ringTimeoutSeconds": 20,
                    "collectReasonFirst": True,
                    "fallbackSummary": "",
                }
            )

    def test_service_policy_requires_runtime_action_and_integration(self):
        with self.assertRaises(ValidationError):
            ServicePolicy.model_validate({"enabled": True})

        row = ServicePolicy.model_validate(
            {
                "enabled": True,
                "runtimeAction": "appointment-request",
                "integrationCategory": "SCHEDULING",
            }
        )
        self.assertEqual(row.runtimeAction, "appointment-request")


if __name__ == "__main__":
    unittest.main()
