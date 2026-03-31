# PDF Corrector App

## Overview
This Flask app corrects spacing errors in PowerPoint presentations by comparing them with PDF references.

## How It Works
1. Takes a PPTX file (output from the word-to-presentation converter)
2. Optionally takes the original PDF file as reference
3. Applies comprehensive spacing corrections
4. Returns a corrected PPTX file

## Installation

```bash
cd pdf_corrector_app
pip install flask python-pptx PyPDF2
```

## Usage

### Start the Server
```bash
python corrector_app.py
```

The app will run on **http://localhost:5001**

### Use the Web Interface
1. Open http://localhost:5001 in your browser
2. Upload your PPTX file (required)
3. Upload the original PDF file (optional - for reference)
4. Click "Correct PPTX"
5. Download the corrected file

## Features

### Automatic Corrections
- Fixes concatenated words (e.g., "Whatisthevalueof" → "What is the value of")
- Preserves fonts (Lucida, Arial, etc.)
- Preserves formatting (bold, italic, colors)
- Uses PDF as reference when provided

### Comprehensive Dictionary
The corrector includes 179+ static corrections for:
- Question starters
- Math terms
- Number types
- Common phrases

### PDF Reference Mode
When you provide a PDF file:
- Extracts text from PDF
- Creates dynamic corrections based on PDF content
- Combines with static dictionary for maximum coverage

## File Structure
```
pdf_corrector_app/
├── corrector_app.py           # Flask app
├── pptx_pdf_corrector.py      # Correction module
├── templates/
│   └── corrector_index.html   # Web interface
├── uploads/                    # Temporary uploads
└── README.md                   # This file
```

## API Endpoint

### POST /correct
Upload files and get corrected PPTX

**Request:**
- `pptx_file`: PPTX file (required)
- `pdf_file`: PDF file (optional)

**Response:**
- Corrected PPTX file for download

## Integration with Main App

This app is designed to work with the word-to-presentation converter:

1. **Main App** (port 5000): Converts Word/PDF → PPTX
2. **PDF Corrector** (port 5001): Corrects PPTX spacing errors

### Workflow
```
User uploads Word/PDF
    ↓
Main App converts to PPTX
    ↓
User downloads PPTX
    ↓
User uploads PPTX + original PDF to Corrector
    ↓
Corrector fixes spacing
    ↓
User downloads corrected PPTX
```

## Notes

- Maximum file size: 50MB
- Supported formats: .pptx, .pdf
- PDF extraction uses PyPDF2 (may have limitations with scanned PDFs)
- Static dictionary provides fallback when PDF extraction fails
