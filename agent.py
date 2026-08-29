import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
BUILDS_DIR = ROOT / "builds"
HISTORY_FILE = ROOT / "factory-history.json"
REPORT_FILE = ROOT / "TODAY_OUTPUT.md"
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.7-flash").strip()
MAX_REPAIR_ATTEMPTS = 2

SYSTEM_PROMPT = r"""
You are the builder inside an autonomous software factory.
Your task is to propose and build ONE small, useful, local-first web application that solves a real software/user pain point.

Hard rules:
- Return ONLY valid JSON. No markdown fences and no commentary.
- Do not claim external research, users, tests, integrations, or metrics you did not actually perform.
- Do not create malware, credential theft, surveillance, evasion, exploit tooling, or destructive software.
- Do not require paid services or hidden credentials for core functionality.
- Prefer a browser-only app using index.html, style.css, and app.js.
- No placeholders, TODOs, fake buttons, fake APIs, or fake success messages.
- The app must work by opening index.html directly in a modern browser.
- All file paths must be relative and must not contain '..', absolute paths, or hidden secret files.

Return this exact JSON shape:
{
  "name": "Human Readable Name",
  "slug": "lowercase-kebab-case",
  "problem": "specific problem being solved",
  "category": "short category",
  "features": ["feature 1", "feature 2", "feature 3"],
  "files": {
    "README.md": "complete markdown",
    "index.html": "complete html",
    "style.css": "complete css",
    "app.js": "complete javascript"
  }
}
"""


def log(message: str) -> None:
    print(message, flush=True)


def load_history() -> list[dict]:
    if not HISTORY_FILE.exists():
        return []
    try:
        data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def history_summary(history: list[dict]) -> str:
    if not history:
        return "No previous releases."
    recent = history[-40:]
    lines = []
    for item in recent:
        lines.append(
            f"- {item.get('name', '')} | {item.get('slug', '')} | "
            f"{item.get('category', '')} | {item.get('problem', '')}"
        )
    return "\n".join(lines)


def call_gemini(user_prompt: str, timeout: int = 180) -> str:
    if not GEMINI_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.65,
            "responseMimeType": "application/json",
        },
    }

    last_error = "unknown error"
    for attempt in range(1, 4):
        try:
            response = requests.post(url, json=payload, timeout=timeout)
            if response.status_code == 200:
                data = response.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
            last_error = f"HTTP {response.status_code}: {response.text[:300]}"
            if response.status_code not in (429, 500, 502, 503, 504):
                break
        except requests.RequestException as exc:
            last_error = str(exc)
        time.sleep(min(5 * attempt, 15))
    raise RuntimeError(f"Gemini request failed: {last_error}")


def parse_payload(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("model response is not a JSON object")
    return data


def safe_slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value[:64]


def validate_spec(spec: dict) -> list[str]:
    errors: list[str] = []
    required = ["name", "slug", "problem", "category", "features", "files"]
    for key in required:
        if key not in spec:
            errors.append(f"missing key: {key}")

    slug = safe_slug(str(spec.get("slug", "")))
    if not slug or slug != spec.get("slug"):
        errors.append("slug must be lowercase kebab-case")

    features = spec.get("features")
    if not isinstance(features, list) or len(features) < 3:
        errors.append("at least 3 features are required")

    files = spec.get("files")
    if not isinstance(files, dict):
        errors.append("files must be an object")
        return errors

    for required_file in ("README.md", "index.html", "style.css", "app.js"):
        if required_file not in files or not str(files[required_file]).strip():
            errors.append(f"missing or empty file: {required_file}")

    for path, content in files.items():
        p = Path(path)
        if p.is_absolute() or ".." in p.parts or path.startswith("."):
            errors.append(f"unsafe path: {path}")
        if not isinstance(content, str):
            errors.append(f"non-text file: {path}")
        if len(str(content)) > 500_000:
            errors.append(f"file too large: {path}")

    joined = "\n".join(str(v) for v in files.values()).lower()
    for marker in ("todo", "coming soon", "placeholder", "lorem ipsum"):
        if marker in joined:
            errors.append(f"placeholder marker found: {marker}")
    return errors


def fingerprint(spec: dict) -> str:
    material = "|".join(
        [
            str(spec.get("name", "")),
            str(spec.get("slug", "")),
            str(spec.get("problem", "")),
            str(spec.get("category", "")),
            ",".join(map(str, spec.get("features", []))),
        ]
    ).lower()
    normalized = re.sub(r"[^a-z0-9]+", " ", material).strip()
    return hashlib.sha256(normalized.encode()).hexdigest()[:20]


def is_duplicate(spec: dict, history: list[dict]) -> bool:
    fp = fingerprint(spec)
    slug = spec.get("slug")
    for item in history:
        if item.get("fingerprint") == fp or item.get("slug") == slug:
            return True
    return False


def write_project(spec: dict, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=False)
    for rel, content in spec["files"].items():
        target = destination / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content.rstrip() + "\n", encoding="utf-8")


def validate_project(path: Path) -> list[str]:
    errors: list[str] = []
    required = [path / "README.md", path / "index.html", path / "style.css", path / "app.js"]
    for file in required:
        if not file.exists() or file.stat().st_size < 20:
            errors.append(f"missing/too-small {file.name}")

    if errors:
        return errors

    html = (path / "index.html").read_text(encoding="utf-8", errors="replace")
    js = (path / "app.js").read_text(encoding="utf-8", errors="replace")
    css = (path / "style.css").read_text(encoding="utf-8", errors="replace")

    if "<html" not in html.lower() or "</html>" not in html.lower():
        errors.append("index.html is not a complete HTML document")
    if "style.css" not in html:
        errors.append("index.html does not reference style.css")
    if "app.js" not in html:
        errors.append("index.html does not reference app.js")
    if len(css.strip()) < 200:
        errors.append("style.css is suspiciously small")
    if len(js.strip()) < 200:
        errors.append("app.js is suspiciously small")

    node = shutil.which("node")
    if node:
        proc = subprocess.run(
            [node, "--check", str(path / "app.js")],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if proc.returncode != 0:
            errors.append("JavaScript syntax check failed: " + (proc.stderr.strip()[:500] or "unknown"))
    return errors


def repair_spec(spec: dict, errors: list[str], history: list[dict]) -> dict:
    prompt = f"""
The generated project failed validation.
Validation errors:
{json.dumps(errors, indent=2)}

Previous releases to avoid duplicating:
{history_summary(history)}

Return a COMPLETE replacement JSON project using the required schema. Fix every listed error.
Current project JSON:
{json.dumps(spec, ensure_ascii=False)}
"""
    return parse_payload(call_gemini(prompt))


def write_report(status: str, details: str) -> None:
    stamp = datetime.now(timezone.utc).isoformat()
    REPORT_FILE.write_text(
        f"# Autonomous Software Factory Run\n\n"
        f"- Status: **{status}**\n"
        f"- UTC: `{stamp}`\n"
        f"- Model: `{GEMINI_MODEL}`\n\n"
        f"## Details\n\n{details}\n",
        encoding="utf-8",
    )


def main() -> int:
    history = load_history()
    BUILDS_DIR.mkdir(exist_ok=True)

    prompt = f"""
Create today's release. Choose a real, specific pain point that is meaningfully different from all previous releases below.
Do not simply rename or reskin an old idea.

Previous releases:
{history_summary(history)}
"""

    try:
        spec = parse_payload(call_gemini(prompt))
    except Exception as exc:
        write_report("FAILED", f"Discovery/build request failed: `{exc}`")
        log(f"FAILED: {exc}")
        return 1

    for repair_no in range(MAX_REPAIR_ATTEMPTS + 1):
        spec_errors = validate_spec(spec)
        if not spec_errors and is_duplicate(spec, history):
            spec_errors = ["duplicate project/problem detected from release history"]

        if spec_errors:
            if repair_no >= MAX_REPAIR_ATTEMPTS:
                write_report("NO_RELEASE", "Spec quality gate failed:\n\n- " + "\n- ".join(spec_errors))
                log("NO_RELEASE: spec failed quality gate")
                return 0
            try:
                spec = repair_spec(spec, spec_errors, history)
                continue
            except Exception as exc:
                write_report("FAILED", f"Repair request failed: `{exc}`")
                return 1

        slug = safe_slug(spec["slug"])
        date_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        final_dir = BUILDS_DIR / f"{date_prefix}-{slug}"
        if final_dir.exists():
            spec_errors = [f"release directory already exists: {final_dir.name}"]
            if repair_no >= MAX_REPAIR_ATTEMPTS:
                write_report("NO_RELEASE", spec_errors[0])
                return 0
            spec = repair_spec(spec, spec_errors, history)
            continue

        with tempfile.TemporaryDirectory(prefix="factory-") as tmp:
            staged = Path(tmp) / slug
            write_project(spec, staged)
            project_errors = validate_project(staged)
            if project_errors:
                if repair_no >= MAX_REPAIR_ATTEMPTS:
                    write_report("NO_RELEASE", "Project validation failed:\n\n- " + "\n- ".join(project_errors))
                    log("NO_RELEASE: project validation failed")
                    return 0
                spec = repair_spec(spec, project_errors, history)
                continue
            shutil.copytree(staged, final_dir)

        entry = {
            "released_at": datetime.now(timezone.utc).isoformat(),
            "name": spec["name"],
            "slug": slug,
            "problem": spec["problem"],
            "category": spec["category"],
            "features": spec["features"],
            "path": str(final_dir.relative_to(ROOT)),
            "fingerprint": fingerprint(spec),
            "model": GEMINI_MODEL,
        }
        history.append(entry)
        HISTORY_FILE.write_text(json.dumps(history, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        write_report(
            "SUCCESS",
            f"Released **{spec['name']}**.\n\n"
            f"- Problem: {spec['problem']}\n"
            f"- Category: {spec['category']}\n"
            f"- Path: `{entry['path']}`\n"
            f"- Validation: required files + HTML references + JS syntax check passed.",
        )
        log(f"SUCCESS: {spec['name']} -> {entry['path']}")
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
