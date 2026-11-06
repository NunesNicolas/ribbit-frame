import json
import os
import sys
from faster_whisper import WhisperModel

source, output, model_name, language, fmt, model_root = sys.argv[1:7]
os.makedirs(model_root, exist_ok=True)
print(json.dumps({"phase": "model", "label": "Carregando modelo de transcrição…"}), flush=True)
model = WhisperModel(model_name, device="cpu", compute_type="int8", download_root=model_root)
segments, info = model.transcribe(source, language=None if language == "auto" else language,
                                   beam_size=5, vad_filter=True, word_timestamps=True)

def stamp(seconds, separator):
    millis = max(0, round(seconds * 1000))
    hours, rest = divmod(millis, 3600000)
    minutes, rest = divmod(rest, 60000)
    secs, ms = divmod(rest, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02}{separator}{ms:03}"

entries = []
for segment in segments:
    entries.append({"start": segment.start, "end": segment.end, "text": segment.text.strip(),
                    "words": [{"start": word.start, "end": word.end, "word": word.word}
                              for word in (segment.words or [])]})
    percent = min(99, round(segment.end / info.duration * 100)) if info.duration else None
    print(json.dumps({"phase": "transcribing", "percent": percent,
                      "label": f"Transcrevendo: {len(entries)} trecho(s)…"}), flush=True)

if fmt == "json":
    content = json.dumps({"language": info.language, "duration": info.duration,
                          "segments": entries}, ensure_ascii=False, indent=2)
else:
    lines = ["WEBVTT", ""] if fmt == "vtt" else []
    for index, entry in enumerate(entries, 1):
        if fmt == "srt":
            lines.append(str(index))
        lines.append(f"{stamp(entry['start'], ',' if fmt == 'srt' else '.')} --> "
                     f"{stamp(entry['end'], ',' if fmt == 'srt' else '.')}")
        lines.extend([entry["text"], ""])
    content = "\n".join(lines)
with open(output, "w", encoding="utf-8", newline="\n") as target:
    target.write(content)
print(json.dumps({"phase": "saved", "percent": 100, "path": output,
                  "segments": len(entries), "language": info.language}), flush=True)
