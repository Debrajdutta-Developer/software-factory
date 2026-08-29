# Autonomous Software Factory

A GitHub Actions powered software factory that attempts one validated, local-first software release every day.

## Daily lifecycle

1. Read persistent release history.
2. Ask Gemini for a genuinely different real-world problem and a complete small web app.
3. Parse a strict JSON project specification.
4. Reject unsafe paths, incomplete files, placeholders, and duplicate releases.
5. Stage the generated project outside the repository.
6. Validate required files, HTML asset references, and JavaScript syntax.
7. Send validation failures back for at most two bounded repair attempts.
8. Publish into `builds/YYYY-MM-DD-<slug>/` only after validation passes.
9. Update `factory-history.json` and `TODAY_OUTPUT.md`.
10. GitHub Actions commits and pushes only repository changes that actually exist.

A failed quality gate produces `NO_RELEASE`; the factory does not pretend an app succeeded.

## Schedule

`.github/workflows/daily.yml` runs at `03:00 UTC` (08:30 IST) every day and can also be started manually with **Run workflow**.

## Required GitHub configuration

Create an Actions secret named `GEMINI_API_KEY` containing a valid Gemini API key. The workflow uses `gemini-3.7-flash` by default through `GEMINI_MODEL`.

The workflow declares `contents: write` so its `GITHUB_TOKEN` can publish successful releases. Repository/organization policy must also permit GitHub Actions write access.

## Run locally

```bash
python -m pip install requests
export GEMINI_API_KEY="your-key"
python agent.py
```

Node.js is optional locally; when installed, the factory additionally runs `node --check` against generated `app.js`. GitHub Actions always installs Node for this validation.

## Output

- `builds/` — validated generated projects
- `factory-history.json` — persistent duplicate-detection/release history
- `TODAY_OUTPUT.md` — latest run status and details

## Security model

Model output is treated as untrusted data. The factory only writes relative project files into a staging directory, rejects traversal/hidden paths, does not execute model-provided commands, and only runs its own allowlisted JavaScript syntax validation.
