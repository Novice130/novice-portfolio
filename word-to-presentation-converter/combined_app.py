#!/usr/bin/env python3
"""
Combined Word-to-Presentation + PDF Corrector Server
=====================================================
This unified Flask app:
1. Converts Word/PDF to PPTX (like the main app)
2. Automatically applies PDF-reference corrections
3. Returns a corrected PPTX in one step

Port: 5002
"""

from flask import Flask, request, render_template, send_file, send_from_directory, jsonify
import os
import io
import sys
from werkzeug.utils import secure_filename
from docx import Document
import PyPDF2

# Add parent directory to path to import from main app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

# Import from main app
from app import parse_docx, parse_pdf, create_pptx, convert_doc_to_docx

# Import PDF corrector
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pdf_corrector_app'))
from pptx_pdf_corrector import correct_pptx_with_pdf

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB
app.config['UPLOAD_FOLDER'] = 'uploads'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'docx', 'doc', 'pdf'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    """Render the main page."""
    return render_template('combined_index.html')


@app.route('/convert', methods=['POST'])
def convert():
    """
    Combined conversion + correction endpoint.
    
    Steps:
    1. Parse uploaded document (Word/PDF)
    2. Generate PPTX
    3. Apply PDF corrections
    4. Return corrected PPTX
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400
    
    try:
        # Get styling options
        font_family = request.form.get('font_family', 'Calibri')
        try:
            font_size = int(request.form.get('font_size', 36))
        except:
            font_size = 36
        try:
            line_spacing = float(request.form.get('line_spacing', 1.25))
        except:
            line_spacing = 1.25
        
        filename = secure_filename(file.filename)
        ext = filename.rsplit('.', 1)[1].lower()
        
        # Step 1: Parse document
        print(f"\n[Combined Server] Step 1: Parsing {filename}...")
        
        if ext == 'doc':
            # Convert DOC to DOCX first
            doc_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(doc_path)
            docx_path = convert_doc_to_docx(doc_path)
            if not docx_path:
                return jsonify({'error': 'Failed to convert DOC to DOCX'}), 500
            with open(docx_path, 'rb') as f:
                stream = io.BytesIO(f.read())
            title, questions = parse_docx(stream)
            os.remove(doc_path)
            os.remove(docx_path)
        
        elif ext == 'docx':
            stream = io.BytesIO(file.read())
            title, questions = parse_docx(stream)
        
        elif ext == 'pdf':
            stream = io.BytesIO(file.read())
            stream.seek(0)  # Reset for PDF correction later
            pdf_bytes = io.BytesIO(stream.read())  # Save for correction
            stream.seek(0)
            title, questions = parse_pdf(stream)
        
        print(f"[Combined Server] Parsed {len(questions)} questions")
        
        # Step 2: Generate PPTX
        print(f"[Combined Server] Step 2: Generating PPTX...")
        pptx_io = create_pptx(
            title,
            questions,
            font_family=font_family,
            font_size=font_size,
            line_spacing=line_spacing
        )
        
        # Step 3: Apply PDF corrections
        print(f"[Combined Server] Step 3: Applying corrections...")
        
        # Use PDF as reference if available
        pdf_ref = pdf_bytes if ext == 'pdf' else None
        
        corrected_io, stats = correct_pptx_with_pdf(pptx_io, pdf_ref)
        
        if corrected_io:
            pptx_io = corrected_io
            if stats:
                print(f"[Combined Server] Applied {stats.get('total_corrections', 0)} corrections")
                print(f"[Combined Server] Dictionary size: {stats.get('dictionary_size', 0)}")
        else:
            print(f"[Combined Server] Warning: Correction failed, using uncorrected PPTX")
        
        # Step 4: Return corrected PPTX
        base = os.path.splitext(filename)[0]
        safe_base = secure_filename(base) or 'converted'
        download_name = safe_base + '_CORRECTED.pptx'
        
        print(f"[Combined Server] ✓ Complete! Sending {download_name}\n")
        
        return send_file(
            pptx_io,
            as_attachment=True,
            download_name=download_name,
            mimetype='application/vnd.openxmlformats-officedocument.presentationml.presentation'
        )
    
    except Exception as e:
        print(f"[Combined Server] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """Serve uploaded files."""
    uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
    return send_from_directory(uploads_dir, filename)


if __name__ == '__main__':
    print("=" * 80)
    print("COMBINED WORD-TO-PRESENTATION + PDF CORRECTOR SERVER")
    print("=" * 80)
    print("\nStarting server on http://localhost:5002")
    print("\nThis server combines both functionalities:")
    print("  1. Converts Word/PDF to PPTX")
    print("  2. Automatically applies spacing corrections")
    print("  3. Returns corrected PPTX in one step")
    print("\n" + "=" * 80 + "\n")
    
    app.run(debug=True, port=5002)
