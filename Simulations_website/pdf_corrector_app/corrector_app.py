#!/usr/bin/env python3
"""
PDF Corrector Flask App
========================
This app takes a PPTX file (from the word-to-presentation converter) and 
an original PDF file, then uses the PDF as a reference to fix spacing errors.

Usage:
    python corrector_app.py
    
Then visit: http://localhost:5001
"""

from flask import Flask, request, render_template, send_file, jsonify
import os
import io
from werkzeug.utils import secure_filename
from pptx_pdf_corrector import correct_pptx_with_pdf

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

ALLOWED_PPTX_EXTENSIONS = {'pptx'}
ALLOWED_PDF_EXTENSIONS = {'pdf'}


def allowed_file(filename, allowed_extensions):
    """Check if file has allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


@app.route('/')
def index():
    """Render the main page."""
    return render_template('corrector_index.html')


@app.route('/correct', methods=['POST'])
def correct():
    """Handle the correction request."""
    # Check if files were uploaded
    if 'pptx_file' not in request.files:
        return jsonify({'error': 'No PPTX file uploaded'}), 400
    
    pptx_file = request.files['pptx_file']
    pdf_file = request.files.get('pdf_file')  # Optional
    
    # Validate PPTX file
    if pptx_file.filename == '':
        return jsonify({'error': 'No PPTX file selected'}), 400
    
    if not allowed_file(pptx_file.filename, ALLOWED_PPTX_EXTENSIONS):
        return jsonify({'error': 'Invalid PPTX file'}), 400
    
    # Validate PDF file if provided
    if pdf_file and pdf_file.filename != '':
        if not allowed_file(pdf_file.filename, ALLOWED_PDF_EXTENSIONS):
            return jsonify({'error': 'Invalid PDF file'}), 400
    
    try:
        # Read files into BytesIO
        pptx_bytes = io.BytesIO(pptx_file.read())
        pdf_bytes = None
        
        if pdf_file and pdf_file.filename != '':
            pdf_bytes = io.BytesIO(pdf_file.read())
        
        # Apply corrections
        corrected_io, stats = correct_pptx_with_pdf(pptx_bytes, pdf_bytes)
        
        if not corrected_io:
            return jsonify({'error': 'Correction failed'}), 500
        
        # Generate download filename
        original_name = secure_filename(pptx_file.filename)
        base_name = os.path.splitext(original_name)[0]
        download_name = f"{base_name}_CORRECTED.pptx"
        
        # Log stats to console
        print(f"\n[PDF Corrector] Corrections applied:")
        print(f"  - Total corrections: {stats.get('total_corrections', 0)}")
        print(f"  - Dictionary size: {stats.get('dictionary_size', 0)}")
        print(f"  - Elapsed time: {stats.get('elapsed_seconds', 0):.2f}s")
        if stats.get('fonts_preserved'):
            print(f"  - Fonts preserved: {', '.join(stats['fonts_preserved'].keys())}")
        
        # Return corrected file
        return send_file(
            corrected_io,
            as_attachment=True,
            download_name=download_name,
            mimetype='application/vnd.openxmlformats-officedocument.presentationml.presentation'
        )
    
    except Exception as e:
        print(f"[PDF Corrector] Error: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("=" * 70)
    print("PDF CORRECTOR APP")
    print("=" * 70)
    print("\nStarting server on http://localhost:5001")
    print("\nThis app corrects PPTX files using PDF as reference.")
    print("Upload:")
    print("  1. PPTX file (from word-to-presentation converter)")
    print("  2. Original PDF file (optional - for reference)")
    print("\n" + "=" * 70 + "\n")
    
    app.run(debug=True, port=5001)
