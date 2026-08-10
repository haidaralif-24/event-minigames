# Content Pack Format

Each event is a folder: `src/content/<event-id>/`

Files:
- `meta.json` — `{ "id": "...", "title": "...", "tagline": "...", "teamCount": number }`
- `questions.json` — array of `{ "id": "...", "prompt": "...", "choices": ["..."], "answerIndex": number, "sourceRef": "..." }`
- `README.md` — event-specific notes (optional)
