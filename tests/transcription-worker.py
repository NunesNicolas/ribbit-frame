import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

worker = Path(__file__).resolve().parents[1] / "src" / "transcribe.py"
stub = '''
class Word:
    start = 0.1
    end = 0.4
    word = " Olá"
class Segment:
    start = 0.0
    end = 1.25
    text = " Olá mundo"
    words = [Word()]
class Info:
    language = "pt"
    duration = 2.0
class WhisperModel:
    def __init__(self, model, *args, **kwargs): assert model == "large-v3-turbo"
    def transcribe(self, *args, **kwargs): return iter([Segment()]), Info()
'''
with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    (root / "faster_whisper.py").write_text(stub, encoding="utf-8")
    for fmt in ("srt", "vtt", "json"):
        output = root / f"result.{fmt}"
        env = {**os.environ, "PYTHONPATH": temp}
        run = subprocess.run([sys.executable, str(worker), str(root / "audio.wav"), str(output),
                              "large-v3-turbo", "pt", fmt, str(root / "models")], env=env,
                             capture_output=True, text=True, check=True)
        assert json.loads(run.stdout.splitlines()[-1])["phase"] == "saved"
        content = output.read_text(encoding="utf-8")
        if fmt == "srt": assert "00:00:00,000 --> 00:00:01,250" in content
        if fmt == "vtt": assert content.startswith("WEBVTT\n") and "00:00:01.250" in content
        if fmt == "json": assert json.loads(content)["segments"][0]["words"][0]["word"] == " Olá"

