import os
import glob
import json
import zipfile
import re
import hashlib
import xml.etree.ElementTree as ET
import math

MONTHS = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
}

def parse_date_span(date_str):
    if not date_str:
        return None, None, False
    s_norm = date_str.lower().replace('—', '-').replace('–', '-').replace('’', '20').replace("'", "20").strip()
    is_current = any(w in s_norm for w in ['present', 'current', 'ongoing'])

    # Check X months
    m_dur = re.search(r'(\d+)\s*months?', s_norm)
    if m_dur:
        months = int(m_dur.group(1))
        return (2025*12 + 1, 2025*12 + months), months, False

    # Check MM/YYYY - MM/YYYY
    m_slash = re.search(r'(\d{1,2})/(\d{4})\s*-\s*(\d{1,2})/(\d{4})', s_norm)
    if m_slash:
        sm, sy, em, ey = int(m_slash.group(1)), int(m_slash.group(2)), int(m_slash.group(3)), int(m_slash.group(4))
        start_idx = sy * 12 + sm
        end_idx = ey * 12 + em
        return (start_idx, end_idx), max(1, end_idx - start_idx + 1), False

    # Check Month YYYY - Month YYYY / Present
    m_full = re.search(r'([a-z]{3,9})\s+(\d{4})\s*-\s*(([a-z]{3,9})\s+(\d{4})|present|current|ongoing)', s_norm)
    if m_full:
        sm = MONTHS.get(m_full.group(1)[:3], 1)
        sy = int(m_full.group(2))
        start_idx = sy * 12 + sm
        if is_current:
            em, ey = 11, 2026
        else:
            em = MONTHS.get(m_full.group(4)[:3], 12) if m_full.group(4) else 12
            ey = int(m_full.group(5)) if m_full.group(5) else sy
        end_idx = ey * 12 + em
        return (start_idx, end_idx), max(1, end_idx - start_idx + 1), is_current

    # Check YYYY - YYYY / Present
    m_year = re.search(r'(\d{4})\s*-\s*(\d{4}|present|current|ongoing)', s_norm)
    if m_year:
        sy = int(m_year.group(1))
        ey = 2026 if is_current else int(m_year.group(2))
        start_idx = sy * 12 + 1
        end_idx = ey * 12 + 12
        return (start_idx, end_idx), max(1, end_idx - start_idx + 1), is_current

    return None, 0, is_current

def merge_intervals(intervals):
    if not intervals:
        return 0
    sorted_ivs = sorted(intervals, key=lambda x: x[0])
    merged = [sorted_ivs[0]]
    for start, end in sorted_ivs[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return sum((end - start + 1) for start, end in merged)

def audit_single_resume(filepath):
    filename = os.path.basename(filepath)
    candidate_id = os.path.splitext(filename)[0]

    with open(filepath, 'rb') as f:
        file_bytes = f.read()
    sha256 = hashlib.sha256(file_bytes).hexdigest()

    with zipfile.ZipFile(filepath) as z:
        tree = ET.fromstring(z.read('word/document.xml'))
        paras = []
        for p in tree.iter():
            if p.tag.endswith('}p'):
                t = ''.join([e.text for e in p.iter() if e.tag.endswith('}t') and e.text]).strip()
                if t:
                    paras.append(t)

    if not paras:
        return {
            'candidateId': candidate_id,
            'filename': filename,
            'sha256': sha256,
            'is_empty': True,
            'char_count': 0
        }

    raw_text = '\n'.join(paras)
    name = paras[0]
    headline = paras[1] if len(paras) > 1 and not paras[1] in ('Experience', 'Education', 'Projects') else ''

    # Identify sections
    sec_names = ['Experience', 'Projects / Deliverables', 'Education', 'Certifications & Licenses', 'Professional Summary', 'Core Skills']
    sections = {s: [] for s in sec_names}
    sections['Other'] = []
    current_sec = 'Other'
    idx = 2 if headline else 1

    while idx < len(paras):
        p = paras[idx]
        matched = False
        for s in sec_names:
            if p.lower() == s.lower() or p.lower().startswith(s.lower()):
                current_sec = s
                matched = True
                break
        if not matched:
            sections[current_sec].append(p)
        idx += 1

    # Audit Experience
    exp_roles = []
    current_role = None

    for line in sections['Experience']:
        is_bullet = line.strip().startswith(('•', '-', '*', '–'))
        if not is_bullet and ('—' in line or ' - ' in line or re.search(r'\b(20\d{2}|19\d{2}|present|ongoing)\b', line, re.I)):
            if current_role:
                exp_roles.append(current_role)
            
            # Split title and company/dates
            parts = re.split(r'\s+[—-]\s+', line)
            title = parts[0].strip()
            rest = ' — '.join(parts[1:]) if len(parts) > 1 else ''
            
            iv, dur, is_cur = parse_date_span(rest or line)
            company = re.sub(r'([A-Za-z]{3,9}\s+\d{4}|\d{4}|present|current|ongoing).*', '', rest, flags=re.I).strip(' —-,')
            if not company:
                company = rest
                
            current_role = {
                'title': title,
                'company': company,
                'raw': line,
                'interval': iv,
                'duration': dur,
                'bullets': []
            }
        elif current_role:
            current_role['bullets'].append(line)
        else:
            current_role = {
                'title': line,
                'company': 'Organization',
                'raw': line,
                'interval': None,
                'duration': 0,
                'bullets': []
            }
    if current_role:
        exp_roles.append(current_role)

    # Classify experience items and calculate non-overlapping durations
    all_ivs = [r['interval'] for r in exp_roles if r['interval']]
    total_months = merge_intervals(all_ivs)

    lca_ivs = []
    design_ivs = []

    for r in exp_roles:
        r_text = f"{r['title']} {r['company']} {' '.join(r['bullets'])}".lower()
        is_lca = any(term in r_text for term in [
            'life cycle assessment', 'lca', 'lci', 'gabi', 'simapro', 'iso 14040',
            'iso 14044', 'carbon footprint', 'decarbonisation', 'scope 1-3', 'circularity', 'epd', 'openlca'
        ])
        is_design = any(term in r_text for term in [
            'ui/ux', 'ux/ui', 'product design', 'visual design', 'figma',
            'user research', 'user experience', 'interaction design', 'wirefram', 'prototyp'
        ])
        r['isLCA'] = is_lca
        r['isDesign'] = is_design
        if is_lca and r['interval']:
            lca_ivs.append(r['interval'])
        if is_design and r['interval']:
            design_ivs.append(r['interval'])

    independent_lca_months = merge_intervals(lca_ivs)
    design_months = merge_intervals(design_ivs)

    # Audit Projects
    projects = []
    curr_proj = None
    for line in sections['Projects / Deliverables']:
        is_bullet = line.strip().startswith(('•', '-', '*', '–'))
        if not is_bullet:
            if curr_proj:
                projects.append(curr_proj)
            curr_proj = {'title': line, 'bullets': []}
        elif curr_proj:
            curr_proj['bullets'].append(line)
        else:
            curr_proj = {'title': 'Project Deliverable', 'bullets': [line]}
    if curr_proj:
        projects.append(curr_proj)

    completed_lca_projects = 0
    has_design_portfolio = False
    has_user_research = False

    for p in projects:
        p_text = f"{p['title']} {' '.join(p['bullets'])}".lower()
        if any(term in p_text for term in ['lca', 'life cycle assessment', 'carbon', 'emission', 'footprint', 'gabi', 'simapro', 'openlca', 'iso 14040', 'solid waste', 'embodied energy']):
            completed_lca_projects += 1
        if any(term in p_text for term in ['figma', 'ui/ux', 'redesign', 'mobile app', 'prototype', 'wireframe', 'case study', 'website', 'design system']):
            has_design_portfolio = True
        if any(term in p_text for term in ['user interview', 'user research', 'usability testing', 'personas', 'survey']):
            has_user_research = True

    # Audit Software and Standards
    full_lower = raw_text.lower()
    has_gabi = 'gabi' in full_lower
    has_simapro = 'simapro' in full_lower
    has_openlca = 'openlca' in full_lower or 'open lca' in full_lower
    has_figma = 'figma' in full_lower
    has_prototyping = any(w in full_lower for w in ['prototyp', 'wirefram', 'mockup'])
    has_uiux_methods = any(w in full_lower for w in ['human-centered', 'user-centered', 'design thinking', 'design system', 'responsive'])
    has_user_research_keyword = any(w in full_lower for w in ['user research', 'user interview', 'usability testing', 'user testing', 'persona'])

    # ISO compliance audit: Check for literal 14040/44 OR anonymized patterns in LCA context
    has_iso = bool(re.search(r'iso\s*(14040|14044|/|:2006|lca|s\b)', full_lower) and any(w in full_lower for w in ['lca', 'life cycle', 'footprint', 'cradle', 'epd', 'environmental']))

    # Education audit
    edu_text = ' '.join(sections['Education']).lower()
    has_env_edu = any(w in edu_text for w in ['environmental', 'sustainability', 'ecology', 'climate', 'renewable', 'energy'])
    has_design_edu = any(w in edu_text for w in ['design', 'hci', 'interaction', 'multimedia', 'animation', 'visual communication'])
    has_allied_edu = any(w in edu_text for w in ['engineering', 'computer science', 'technology', 'civil', 'chemical', 'mechanical', 'b.e', 'b.tech', 'm.tech'])

    return {
        'candidateId': candidate_id,
        'filename': filename,
        'sha256': sha256,
        'is_empty': False,
        'name': name,
        'headline': headline,
        'total_months': total_months,
        'independent_lca_months': independent_lca_months,
        'design_months': design_months,
        'completed_lca_projects': completed_lca_projects,
        'has_design_portfolio': has_design_portfolio,
        'has_user_research': has_user_research or has_user_research_keyword,
        'has_gabi': has_gabi,
        'has_simapro': has_simapro,
        'has_openlca': has_openlca,
        'has_iso': has_iso,
        'has_figma': has_figma,
        'has_prototyping': has_prototyping,
        'has_uiux_methods': has_uiux_methods,
        'has_env_edu': has_env_edu,
        'has_design_edu': has_design_edu,
        'has_allied_edu': has_allied_edu,
        'raw_text_length': len(raw_text)
    }

def independent_oracle_score(audited_rec, raw_lca_cos=0.6, raw_uiux_cos=0.6):
    if audited_rec['is_empty']:
        return {'lca_total': 0, 'uiux_total': 0, 'classification': 'neither_or_uncertain'}

    # 1. LCA Scoring Oracle
    # Skills (30)
    gabi_simapro_pts = 15 if (audited_rec['has_gabi'] or audited_rec['has_simapro']) else (5 if audited_rec['has_openlca'] else 0)
    iso_pts = 8 if audited_rec['has_iso'] else 0
    lci_pts = 7 if (audited_rec['independent_lca_months'] > 0 or audited_rec['completed_lca_projects'] > 0) else 0
    lca_skills = gabi_simapro_pts + iso_pts + lci_pts

    # Experience (30)
    lca_m = audited_rec['independent_lca_months']
    if lca_m >= 36: lca_exp = 30
    elif lca_m >= 24: lca_exp = 28
    elif lca_m >= 12: lca_exp = 18
    elif lca_m > 0: lca_exp = 10
    else: lca_exp = 0

    # Projects (20)
    p_cnt = audited_rec['completed_lca_projects']
    if p_cnt >= 3: lca_proj = 20
    elif p_cnt == 2: lca_proj = 14
    elif p_cnt == 1: lca_proj = 8
    else: lca_proj = 0

    # Semantic (15)
    clamped_lca_cos = max(0.50, min(0.85, raw_lca_cos))
    norm_lca = (clamped_lca_cos - 0.50) / 0.35
    lca_sem = round(norm_lca * 15 * 10) / 10

    # Education (5)
    lca_edu = 5 if audited_rec['has_env_edu'] else (3 if audited_rec['has_allied_edu'] else 0)

    lca_total = round((lca_skills + lca_exp + lca_proj + lca_sem + lca_edu) * 10) / 10

    # 2. UI/UX Scoring Oracle
    # Skills (30)
    figma_pts = 15 if (audited_rec['has_figma'] and audited_rec['has_prototyping']) else (12 if audited_rec['has_figma'] else (6 if audited_rec['has_prototyping'] else 0))
    principles_pts = 10 if audited_rec['has_uiux_methods'] else 0
    research_pts = 5 if audited_rec['has_user_research'] else 0
    uiux_skills = figma_pts + principles_pts + research_pts

    # Experience (10)
    des_m = audited_rec['design_months']
    if des_m > 0: uiux_exp = 10
    elif audited_rec['has_design_portfolio']: uiux_exp = 8
    else: uiux_exp = 0

    # Projects (30)
    portfolio_pts = 20 if audited_rec['has_design_portfolio'] else 0
    interview_pts = 10 if audited_rec['has_user_research'] else 0
    uiux_proj = portfolio_pts + interview_pts

    # Semantic (20)
    clamped_uiux_cos = max(0.50, min(0.85, raw_uiux_cos))
    norm_uiux = (clamped_uiux_cos - 0.50) / 0.35
    uiux_sem = round(norm_uiux * 20 * 10) / 10

    # Education (10)
    uiux_edu = 10 if audited_rec['has_design_edu'] else (7 if audited_rec['has_allied_edu'] else 4)

    uiux_total = round((uiux_skills + uiux_exp + uiux_proj + uiux_sem + uiux_edu) * 10) / 10

    # Classification
    lca_pass = lca_total >= 50
    uiux_pass = uiux_total >= 50
    if lca_pass and uiux_pass:
        cls = 'both'
    elif lca_pass:
        cls = 'lca'
    elif uiux_pass:
        cls = 'uiux'
    else:
        cls = 'neither_or_uncertain'

    return {
        'lca_skills': lca_skills,
        'lca_exp': lca_exp,
        'lca_proj': lca_proj,
        'lca_sem': lca_sem,
        'lca_edu': lca_edu,
        'lca_total': lca_total,
        'uiux_skills': uiux_skills,
        'uiux_exp': uiux_exp,
        'uiux_proj': uiux_proj,
        'uiux_sem': uiux_sem,
        'uiux_edu': uiux_edu,
        'uiux_total': uiux_total,
        'classification': cls
    }

def main():
    os.makedirs('reports', exist_ok=True)
    baseline_data = json.load(open('data/baseline.json'))
    b_map = {c['candidateId']: c for c in baseline_data['candidates']}

    files = sorted(glob.glob('Software Development Assignment Resumes/*.docx'))
    print(f"Auditing all {len(files)} resumes independently...")

    extraction_discrepancies = []
    scoring_reconciliation = []
    manual_review_queue = []

    audited_records = []

    for fp in files:
        rec = audit_single_resume(fp)
        audited_records.append(rec)
        cid = rec['candidateId']
        b_c = b_map.get(cid)

        if rec['is_empty']:
            continue

        b_ext = b_c['extraction']
        b_lca = b_c['scores']['lca']
        b_uiux = b_c['scores']['uiux']

        # Check discrepancies
        disc_list = []
        if b_ext['totalExperienceMonths'] != rec['total_months']:
            disc_list.append(f"Total Exp: baseline={b_ext['totalExperienceMonths']}m vs audited={rec['total_months']}m")
        if b_ext['independentLcaExperienceMonths'] != rec['independent_lca_months']:
            disc_list.append(f"LCA Exp: baseline={b_ext['independentLcaExperienceMonths']}m vs audited={rec['independent_lca_months']}m")
        if b_ext['designExperienceMonths'] != rec['design_months']:
            disc_list.append(f"Design Exp: baseline={b_ext['designExperienceMonths']}m vs audited={rec['design_months']}m")
        if (b_lca['subScores']['skills'] < 8) and rec['has_iso']:
            disc_list.append("ISO 14040/44 standard missed due to anonymization token scrubbing")

        if disc_list:
            extraction_discrepancies.append({
                'candidate_id': cid,
                'filename': rec['filename'],
                'severity': 'HIGH' if 'LCA Exp' in str(disc_list) or 'ISO' in str(disc_list) else 'MEDIUM',
                'discrepancies': ' | '.join(disc_list)
            })

        # Run reference oracle
        raw_lca_cos = b_lca['semanticRawCosine']
        raw_uiux_cos = b_uiux['semanticRawCosine']
        oracle = independent_oracle_score(rec, raw_lca_cos, raw_uiux_cos)

        scoring_reconciliation.append({
            'candidate_id': cid,
            'baseline_lca': b_lca['totalScore'],
            'oracle_lca': oracle['lca_total'],
            'delta_lca': round(oracle['lca_total'] - b_lca['totalScore'], 1),
            'baseline_uiux': b_uiux['totalScore'],
            'oracle_uiux': oracle['uiux_total'],
            'delta_uiux': round(oracle['uiux_total'] - b_uiux['totalScore'], 1),
            'baseline_class': b_c['classification'],
            'oracle_class': oracle['classification'],
            'class_match': b_c['classification'] == oracle['classification']
        })

        # Check if manual review needed
        if abs(oracle['lca_total'] - b_lca['totalScore']) >= 10 or abs(oracle['uiux_total'] - b_uiux['totalScore']) >= 10 or (b_c['classification'] != oracle['classification']):
            manual_review_queue.append({
                'candidate_id': cid,
                'headline': rec['headline'],
                'baseline_class': b_c['classification'],
                'oracle_class': oracle['classification'],
                'reason': f"Score delta LCA={round(oracle['lca_total'] - b_lca['totalScore'], 1)}, UIUX={round(oracle['uiux_total'] - b_uiux['totalScore'], 1)}"
            })

    # Write CSVs
    import csv
    with open('reports/extraction_discrepancies.csv', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['candidate_id', 'filename', 'severity', 'discrepancies'])
        w.writeheader()
        w.writerows(extraction_discrepancies)

    with open('reports/scoring_reconciliation.csv', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['candidate_id', 'baseline_lca', 'oracle_lca', 'delta_lca', 'baseline_uiux', 'oracle_uiux', 'delta_uiux', 'baseline_class', 'oracle_class', 'class_match'])
        w.writeheader()
        w.writerows(scoring_reconciliation)

    with open('reports/manual_review_queue.csv', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['candidate_id', 'headline', 'baseline_class', 'oracle_class', 'reason'])
        w.writeheader()
        w.writerows(manual_review_queue)

    print(f"Extraction discrepancies found in {len(extraction_discrepancies)} candidates.")
    print(f"Scoring reconciliation completed ({sum(1 for s in scoring_reconciliation if not s['class_match'])} classification changes in oracle).")
    print(f"Manual review queue: {len(manual_review_queue)} candidates flagged.")

if __name__ == '__main__':
    main()
