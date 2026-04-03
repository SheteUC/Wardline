import pathlib
import re
import sys
import unittest

APP_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))


class VoiceRuntimeDependencyTests(unittest.TestCase):
    def test_runtime_source_has_no_livekit_python_imports(self):
        import_pattern = re.compile(r"^\s*(?:from|import)\s+(livekit|livekit_agents)\b", re.MULTILINE)
        python_files = [
            path
            for path in APP_ROOT.glob("*.py")
            if path.is_file()
        ]

        offending_files = []
        for path in python_files:
            source = path.read_text(encoding="utf-8")
            if import_pattern.search(source):
                offending_files.append(path.name)

        self.assertEqual(offending_files, [])


if __name__ == "__main__":
    unittest.main()
