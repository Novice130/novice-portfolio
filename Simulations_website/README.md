# Word → Presentation (Quiz Slide Maker)

Convert Word documents (DOCX / DOC / PDF) containing multiple-choice, fill-in-the-blank, or short-answer questions into clean PowerPoint slides for quizzes and presentations.

Quick start

- Create and activate a virtual environment (recommended):

```powershell
python -m venv .venv
& .venv\Scripts\Activate.ps1
```

- Install dependencies:

```powershell
pip install -r requirements.txt
```

- Run the app:

```powershell
python app.py
```

- Open http://127.0.0.1:5000/ and upload a file (DOCX, DOC, or PDF). The app will show a preview and let you convert to PPTX. The downloaded PPTX will use the uploaded filename as its base name.

Notes

- `.doc` support: requires LibreOffice (`soffice`) installed and available on PATH (or in the default Program Files path on Windows). The app converts `.doc` to `.docx` for parsing.
- PDF text extraction uses `PyPDF2` — image-based PDFs (scans) won't extract text; use OCR if needed.
- The converter preserves option labels (e.g., `A) ...`) and existing answer underscore lines where present.

Files of interest

- `app.py` — Flask server and conversion logic.
- `templates/index.html` — upload UI and preview grid.
- `requirements.txt` — Python dependencies.
