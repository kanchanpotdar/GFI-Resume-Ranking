import os
import sys
import time
import json
import io
import zipfile
import xml.etree.ElementTree as ET
import urllib.request
import urllib.parse

API_URL = "http://localhost:3000/api/upload"

def create_simple_docx(paragraphs):
    """Creates a genuine, valid DOCX container in memory."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        # [Content_Types].xml
        z.writestr('[Content_Types].xml', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>""")
        # _rels/.rels
        z.writestr('_rels/.rels', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>""")
        # word/document.xml
        body_xml = "".join([f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paragraphs])
        z.writestr('word/document.xml', f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>{body_xml}</w:body>
</w:document>""")
    return buf.getvalue()

def create_simple_pdf(text_lines):
    """Creates a genuine, valid PDF using standard macOS cupsfilter utility."""
    import subprocess
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as tf:
        tf.write("\n\n".join(text_lines))
        tf_path = tf.name
    try:
        cmd = ["/usr/sbin/cupsfilter", "-m", "application/pdf", tf_path]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        if res.returncode == 0 and len(res.stdout) > 0:
            return res.stdout
        raise RuntimeError("cupsfilter failed to generate PDF binary")
    finally:
        if os.path.exists(tf_path):
            os.remove(tf_path)

def upload_file(filename, file_bytes, content_type="application/octet-stream"):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"))
    body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
    body.extend(file_bytes)
    body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))

    req = urllib.request.Request(API_URL, data=body)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

    start_time = time.time()
    try:
        with urllib.request.urlopen(req) as resp:
            elapsed = time.time() - start_time
            data = resp.read()
            return resp.status, json.loads(data.decode("utf-8")), elapsed
    except urllib.error.HTTPError as e:
        elapsed = time.time() - start_time
        data = e.read()
        try:
            parsed = json.loads(data.decode("utf-8"))
        except:
            parsed = {"raw": data.decode("utf-8", errors="ignore")}
        return e.code, parsed, elapsed

def main():
    print("=================================================================")
    print("SPRINT 2 END-TO-END HTTP ENDPOINT & PIPELINE VERIFICATION")
    print("=================================================================\n")

    results = []

    # TEST 1: Baseline DOCX Upload -> Expect Exact SHA-256 Duplicate (when local archive is present)
    print("--- Test 1: Uploading baseline resume (anonymized_TM_1793682784495.docx) ---")
    tm_path = "Software Development Assignment Resumes/anonymized_TM_1793682784495.docx"
    if os.path.exists(tm_path):
        with open(tm_path, "rb") as f:
            tm_bytes = f.read()

        status, res, elapsed = upload_file("anonymized_TM_1793682784495.docx", tm_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        print(f"Status: {status} | Elapsed: {elapsed*1000:.1f}ms")
        print(f"Response: isDuplicate={res.get('isDuplicate')}, candidateId={res.get('candidate', {}).get('candidateId')}")
        assert status == 200, f"Expected 200, got {status}"
        assert res.get("isDuplicate") is True, "Expected duplicate detection for baseline file"
        assert "TM_1793682784495" in res.get("candidate", {}).get("candidateId"), "Candidate ID must match baseline"
        results.append(("Test 1: Baseline DOCX Duplicate Detection", "PASS", f"{elapsed*1000:.1f}ms"))
    else:
        print("Skipped Test 1: Local baseline DOCX archive omitted in clean checkout")
        results.append(("Test 1: Baseline DOCX Duplicate Detection", "SKIP (no archive)", "0.0ms"))

    # TEST 2: New Real DOCX Upload -> Cold-Start & Full Pipeline Verification
    print("\n--- Test 2: Uploading genuine NEW DOCX (Dr. Evelyn Vance - LCA Consultant) ---")
    new_docx_paras = [
        "Dr. Evelyn Vance",
        "Senior LCA Consultant & Environmental Systems Engineer",
        "Professional Summary",
        "Experienced environmental engineer with 4 years conducting comprehensive Life Cycle Assessments using GaBi and SimaPro in strict compliance with ISO 14040 and ISO 14044 standards. Willing to relocate to Chennai.",
        "Work Experience",
        "Lead LCA Analyst - EcoMetrics Consulting  01/2023 - 10/2026",
        "• Conducted 4 cradle-to-grave LCA studies on renewable energy components and industrial packaging.",
        "• Built comprehensive Life Cycle Inventory (LCI) models using SimaPro and ecoinvent datasets.",
        "Projects / Deliverables",
        "Solar PV Lifecycle Assessment",
        "• Conducted cradle-to-grave LCA study on solar panels using SimaPro and ecoinvent.",
        "Industrial Packaging LCA",
        "• Completed comparative LCA study for packaging materials adhering to ISO 14040/14044.",
        "Automotive Components PCF Study",
        "• Executed comprehensive Product Carbon Footprint study using GaBi software.",
        "Core Skills",
        "Platforms: GaBi, SimaPro, OpenLCA, Python, Excel",
        "Methods: Life Cycle Assessment, LCI modeling, ISO 14040, ISO 14044, EPD",
        "Education",
        "Ph.D. in Environmental Engineering",
        "Indian Institute of Technology Madras  2022"
    ]
    new_docx_bytes = create_simple_docx(new_docx_paras)
    status, res, elapsed = upload_file("Evelyn_Vance_LCA.docx", new_docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    print(f"Status: {status} | Elapsed: {elapsed*1000:.1f}ms")
    cand = res.get("candidate", {})
    lca_score = cand.get("scores", {}).get("lca", {})
    uiux_score = cand.get("scores", {}).get("uiux", {})
    print(f"Assigned Candidate ID: {cand.get('candidateId')}")
    print(f"Classification: {cand.get('classification')} (Reason: {cand.get('classificationReason')})")
    print(f"LCA Score: {lca_score.get('totalScore')}/100 (Eligibility: {lca_score.get('eligibilityFlags', {}).get('eligibilityStatus')})")
    print(f"UI/UX Score: {uiux_score.get('totalScore')}/100")
    print(f"Embedding Dims: {cand.get('embeddings', {}).get('dimensions')}")

    assert status == 200, f"Expected 200, got {status}"
    assert cand.get("classification") == "lca", f"Expected LCA classification, got {cand.get('classification')}"
    assert lca_score.get("totalScore") >= 70, f"Expected strong LCA score >= 70, got {lca_score.get('totalScore')}"
    assert lca_score.get("eligibilityFlags", {}).get("isEligible") is True, "Expected isEligible=True for qualified LCA specialist"
    assert cand.get("embeddings", {}).get("dimensions") == 384, "Embeddings must be 384 dimensions"
    results.append(("Test 2: New DOCX LCA Full Pipeline & Cold Start", "PASS", f"{elapsed*1000:.1f}ms"))

    # TEST 3: New Real PDF Upload -> Warm Inference & UI/UX Pipeline Verification
    print("\n--- Test 3: Uploading genuine NEW PDF (Aiden Chen - UI/UX Designer) ---")
    new_pdf_lines = [
        "Aiden Chen",
        "UI/UX Designer & Product Interaction Specialist",
        "Professional Summary",
        "Creative interaction designer with hands-on expertise building responsive mobile and web applications in Figma.",
        "Specializes in human-centered design, user interviews, and high-fidelity interactive prototyping.",
        "Work Experience",
        "UI/UX Design Intern - PixelCraft Studios  06/2024 - 05/2025",
        "- Designed and shipped interactive mobile application in Figma with comprehensive design system.",
        "- Conducted 15 moderated usability testing sessions and user interviews with personas.",
        "Projects / Deliverables",
        "FinTrack Mobile Dashboard",
        "- Complete end-to-end design case study with Figma prototypes, dark mode styling, and responsive user flows.",
        "Education",
        "Bachelor of Design (B.Des) in Interaction Design",
        "National Institute of Design  2024",
        "Core Skills",
        "Platforms: Figma, Sketch, Framer, Adobe XD",
        "Methods: Wireframing, Prototyping, User Research, Usability Testing, Design Systems"
    ]
    new_pdf_bytes = create_simple_pdf(new_pdf_lines)
    status, res, elapsed = upload_file("Aiden_Chen_UIUX.pdf", new_pdf_bytes, "application/pdf")
    print(f"Status: {status} | Elapsed: {elapsed*1000:.1f}ms")
    cand = res.get("candidate", {})
    lca_score = cand.get("scores", {}).get("lca", {})
    uiux_score = cand.get("scores", {}).get("uiux", {})
    print(f"Assigned Candidate ID: {cand.get('candidateId')}")
    print(f"Classification: {cand.get('classification')} (Reason: {cand.get('classificationReason')})")
    print(f"UI/UX Score: {uiux_score.get('totalScore')}/100 (Eligibility: {uiux_score.get('eligibilityFlags', {}).get('eligibilityStatus')})")
    print(f"LCA Score: {lca_score.get('totalScore')}/100")

    assert status == 200, f"Expected 200, got {status}"
    assert cand.get("classification") == "uiux", f"Expected UI/UX classification, got {cand.get('classification')}"
    assert uiux_score.get("totalScore") >= 70, f"Expected strong UI/UX score >= 70, got {uiux_score.get('totalScore')}"
    results.append(("Test 3: New PDF UI/UX Pipeline & Warm Inference", "PASS", f"{elapsed*1000:.1f}ms"))

    # TEST 4: Invalid File Format (.txt) -> 400 Bad Request
    print("\n--- Test 4: Uploading unsupported file format (.txt) ---")
    status, res, elapsed = upload_file("notes.txt", b"Random text notes", "text/plain")
    print(f"Status: {status} | Error: {res.get('error')}")
    assert status == 400, f"Expected 400, got {status}"
    results.append(("Test 4: Unsupported Format Rejection (.txt)", "PASS", f"{elapsed*1000:.1f}ms"))

    # TEST 5: Fake PDF (Magic Bytes Mismatch) -> 400 Bad Request
    print("\n--- Test 5: Uploading fake PDF (text content renamed to .pdf) ---")
    fake_pdf = b"Hello world, I am not a real PDF binary!"
    status, res, elapsed = upload_file("fake.pdf", fake_pdf, "application/pdf")
    print(f"Status: {status} | Error: {res.get('error')}")
    assert status == 400, f"Expected 400, got {status}"
    assert "binary signature" in res.get("error", "").lower(), "Must reject magic byte mismatch"
    results.append(("Test 5: Content Magic Byte Verification (PDF)", "PASS", f"{elapsed*1000:.1f}ms"))

    # TEST 6: Fake DOCX (Magic Bytes Mismatch) -> 400 Bad Request
    print("\n--- Test 6: Uploading fake DOCX (text content renamed to .docx) ---")
    fake_docx = b"This is plain text with a .docx extension"
    status, res, elapsed = upload_file("fake.docx", fake_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    print(f"Status: {status} | Error: {res.get('error')}")
    assert status == 400, f"Expected 400, got {status}"
    assert "binary signature" in res.get("error", "").lower(), "Must reject magic byte mismatch"
    results.append(("Test 6: Content Magic Byte Verification (DOCX)", "PASS", f"{elapsed*1000:.1f}ms"))

    # TEST 7: Empty File (0 Bytes) -> 400 Bad Request
    print("\n--- Test 7: Uploading 0-byte file ---")
    status, res, elapsed = upload_file("empty.pdf", b"", "application/pdf")
    print(f"Status: {status} | Error: {res.get('error')}")
    assert status == 400, f"Expected 400, got {status}"
    assert "empty" in res.get("error", "").lower(), "Must report 0-byte file error"
    results.append(("Test 7: 0-Byte Empty File Rejection", "PASS", f"{elapsed*1000:.1f}ms"))

    # TEST 8: File Exceeding 5MB Limit -> 400 Bad Request
    print("\n--- Test 8: Uploading file exceeding 5MB limit ---")
    oversize_pdf = b"%PDF-1.4\n" + (b"0" * (5 * 1024 * 1024 + 1024))
    status, res, elapsed = upload_file("huge.pdf", oversize_pdf, "application/pdf")
    print(f"Status: {status} | Error: {res.get('error')}")
    assert status == 400, f"Expected 400, got {status}"
    assert "exceeds" in res.get("error", "").lower(), "Must report size limit exceeded"
    results.append(("Test 8: 5MB Size Limit Enforcement", "PASS", f"{elapsed*1000:.1f}ms"))

    # TEST 9: Empty Document Container -> 200 OK, 0 Score, Neither Classification
    print("\n--- Test 9: Uploading valid DOCX with 0 text nodes (empty document) ---")
    empty_docx = create_simple_docx([])
    status, res, elapsed = upload_file("empty_doc.docx", empty_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    print(f"Status: {status} | Elapsed: {elapsed*1000:.1f}ms")
    cand = res.get("candidate", {})
    print(f"Classification: {cand.get('classification')}")
    print(f"Extraction Status: {cand.get('extraction', {}).get('extractionStatus')}")
    print(f"LCA Score: {cand.get('scores', {}).get('lca', {}).get('totalScore')}")
    print(f"UI/UX Score: {cand.get('scores', {}).get('uiux', {}).get('totalScore')}")

    assert status == 200, f"Expected 200, got {status}"
    assert cand.get("extraction", {}).get("extractionStatus") == "empty_document"
    assert cand.get("classification") == "neither_or_uncertain"
    assert cand.get("scores", {}).get("lca", {}).get("totalScore") == 0
    assert cand.get("scores", {}).get("uiux", {}).get("totalScore") == 0
    results.append(("Test 9: Empty Document Zero-Score Handling", "PASS", f"{elapsed*1000:.1f}ms"))

    # TEST 10: ZIP Bomb (Central Directory >25MB uncompressed) -> 400 Bad Request
    print("\n--- Test 10: Uploading crafted ZIP bomb DOCX container ---")
    import struct
    local_hdr = bytearray(34)
    struct.pack_into("<I", local_hdr, 0, 0x04034b50)
    struct.pack_into("<H", local_hdr, 6, 0x08) # data descriptor
    struct.pack_into("<H", local_hdr, 26, 4)
    local_hdr[30:34] = b"test"
    cd_hdr = bytearray(50)
    struct.pack_into("<I", cd_hdr, 0, 0x02014b50)
    struct.pack_into("<I", cd_hdr, 20, 1024)
    struct.pack_into("<I", cd_hdr, 24, 50 * 1024 * 1024)
    struct.pack_into("<H", cd_hdr, 28, 4)
    cd_hdr[46:50] = b"test"
    eocd = bytearray(22)
    struct.pack_into("<I", eocd, 0, 0x06054b50)
    struct.pack_into("<HHII", eocd, 8, 1, 1, len(cd_hdr), len(local_hdr))
    zip_bomb = bytes(local_hdr + cd_hdr + eocd)
    status, res, elapsed = upload_file("bomb.docx", zip_bomb, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    print(f"Status: {status} | Error: {res.get('error')}")
    assert status == 400, f"Expected 400 for zip bomb, got {status}"
    results.append(("Test 10: Central Directory Zip Bomb Rejection", "PASS", f"{elapsed*1000:.1f}ms"))

    # TEST 11: Corrupt Internal DOCX -> 400 Bad Request (no stack trace or 500)
    print("\n--- Test 11: Uploading structurally corrupt DOCX (valid ZIP, missing word/document.xml) ---")
    corrupt_zip_buf = io.BytesIO()
    with zipfile.ZipFile(corrupt_zip_buf, "w") as z:
        z.writestr("not_word.txt", "corrupt")
    status, res, elapsed = upload_file("corrupt_internal.docx", corrupt_zip_buf.getvalue(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    print(f"Status: {status} | Error: {res.get('error')}")
    assert status == 400, f"Expected 400 for corrupt DOCX, got {status}"
    assert "/Users/" not in res.get("error", "") and "Error:" not in res.get("error", "")
    results.append(("Test 11: Corrupt Internal DOCX Clean 400 Rejection", "PASS", f"{elapsed*1000:.1f}ms"))

    print("\n=================================================================")
    print("ALL HTTP ENDPOINT VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=================================================================")
    for name, verdict, timing in results:
        print(f"✔ {name:<50} [{verdict}] ({timing})")

if __name__ == "__main__":
    main()
