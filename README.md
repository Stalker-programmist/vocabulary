# Vocabulary Trainer

Single-page vocabulary trainer with a lightweight spaced repetition loop.

## Features
- CRUD for words with translation, example, and tags
- Review queue for words due today
- SRS-lite stages with fixed intervals
- Stats for daily activity and upcoming queue

## Tech
- FastAPI + SQLModel
- SQLite
- Vanilla JS, HTML, CSS

## Setup
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Open `http://127.0.0.1:8000`.

API docs: `http://127.0.0.1:8000/docs`

## SRS-lite stages
Stage intervals are fixed: 1, 3, 7, 14, 30 days. Good answers advance the stage, bad answers reset to stage 0.

## Files
- `main.py` - FastAPI app (exports `app`)
- `app/` - backend modules (db/models/routes/services)
- `static/index.html` - UI layout
- `static/styles.css` - CSS entrypoint (imports `static/css/*`)
- `static/css/` - CSS modules
- `static/app.js` - JS entrypoint (imports `static/js/*`)
- `static/js/` - JS modules
- `ROADMAP.md` - development roadmap
