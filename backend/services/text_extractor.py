import fitz  # PyMuPDF
import os

def extract_text_from_pdf(file_path):
    """
    Extract text from a PDF file using PyMuPDF.
    
    Args:
        file_path (str): Path to the PDF file
        
    Returns:
        str: Extracted text from the PDF
    """
    try:
        # Open the PDF file
        doc = fitz.open(file_path)
        text = ""
        
        # Extract text from each page
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text += page.get_text()
        
        doc.close()
        return text.strip()
        
    except Exception as e:
        raise Exception(f"Error extracting text from PDF: {str(e)}")

def extract_text_from_file(file_path):
    """
    Extract text from a file based on its extension.
    Currently supports PDF files.
    
    Args:
        file_path (str): Path to the file
        
    Returns:
        str: Extracted text from the file
    """
    file_extension = os.path.splitext(file_path)[1].lower()
    
    if file_extension == '.pdf':
        return extract_text_from_pdf(file_path)
    else:
        raise Exception(f"Unsupported file type: {file_extension}") 