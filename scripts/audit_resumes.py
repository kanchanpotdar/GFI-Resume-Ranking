import os
import glob
import hashlib
import zipfile
import json
import xml.etree.ElementTree as ET

def audit_all_resumes(resume_dir="Software Development Assignment Resumes", output_path="data/input_manifest.json"):
    files = sorted(glob.glob(os.path.join(resume_dir, "*.docx")))
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    manifest = []

    for filepath in files:
        filename = os.path.basename(filepath)
        with open(filepath, "rb") as f:
            file_bytes = f.read()
        sha256 = hashlib.sha256(file_bytes).hexdigest()
        file_size = len(file_bytes)
        
        text = []
        para_count = 0
        table_count = 0
        drawing_count = 0
        
        try:
            with zipfile.ZipFile(filepath) as z:
                xml_content = z.read("word/document.xml")
                tree = ET.fromstring(xml_content)
                
                for elem in tree.iter():
                    tag = elem.tag.split("}")[-1]
                    if tag == "p":
                        para_count += 1
                    elif tag == "tbl":
                        table_count += 1
                    elif tag in ("drawing", "shape", "pict"):
                        drawing_count += 1
                    elif tag == "t" and elem.text:
                        text.append(elem.text)
                        
            full_text = " ".join(text).strip()
            text_length = len(full_text)
            
            if text_length == 0:
                status = "empty_document"
                notes = "File contains valid DOCX XML but zero text elements (<w:t> is empty) and zero drawings/shapes."
            else:
                status = "ready_for_extraction"
                notes = f"Valid DOCX with {para_count} paragraphs and {table_count} tables."
                
        except Exception as e:
            status = "corrupt"
            text_length = 0
            notes = f"Failed to parse DOCX: {str(e)}"
            
        entry = {
            "candidate_id": os.path.splitext(filename)[0],
            "filename": filename,
            "filepath": filepath,
            "sha256": sha256,
            "file_size_bytes": file_size,
            "paragraph_count": para_count,
            "table_count": table_count,
            "drawing_count": drawing_count,
            "character_count": text_length,
            "status": status,
            "notes": notes
        }
        manifest.append(entry)

    manifest_data = {
        "total_files": len(manifest),
        "ready_count": sum(1 for m in manifest if m["status"] == "ready_for_extraction"),
        "empty_count": sum(1 for m in manifest if m["status"] == "empty_document"),
        "corrupt_count": sum(1 for m in manifest if m["status"] == "corrupt"),
        "entries": manifest
    }

    with open(output_path, "w") as f:
        json.dump(manifest_data, f, indent=2)

    print(f"Audited {len(manifest)} files: {manifest_data['ready_count']} ready, {manifest_data['empty_count']} empty, {manifest_data['corrupt_count']} corrupt.")
    return manifest_data

if __name__ == "__main__":
    audit_all_resumes()
