import os
import glob
import json
import zipfile
import re
import hashlib
import xml.etree.ElementTree as ET

MONTH_MAP = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
}

def parse_robust_date_span(date_str):
    if not date_str:
        return None, 0, False
    s_norm = date_str.lower().replace('—', '-').replace('–', '-').replace('’', '20').replace("'", "20").strip()
    is_current = any(w in s_norm for w in ['present', 'current', 'ongoing'])

    # Check 'X months'
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
        sm = MONTH_MAP.get(m_full.group(1)[:3], 1)
        sy = int(m_full.group(2))
        start_idx = sy * 12 + sm
        if is_current:
            em, ey = 11, 2026
        else:
            em = MONTH_MAP.get(m_full.group(4)[:3], 12) if m_full.group(4) else 12
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
    valid_ivs = [iv for iv in intervals if iv is not None]
    if not valid_ivs:
        return 0
    sorted_ivs = sorted(valid_ivs, key=lambda x: x[0])
    merged = [sorted_ivs[0]]
    for start, end in sorted_ivs[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return sum((end - start + 1) for start, end in merged)

def extract_docx_paras(filepath):
    paras = []
    with zipfile.ZipFile(filepath) as z:
        tree = ET.fromstring(z.read('word/document.xml'))
        for p in tree.iter():
            if p.tag.endswith('}p'):
                t = ''.join([elem.text for elem in p.iter() if elem.tag.endswith('}t') and elem.text]).strip()
                if t:
                    paras.append(t)
    return paras

def parse_resume(filepath):
    filename = os.path.basename(filepath)
    candidate_id = os.path.splitext(filename)[0]
    with open(filepath, 'rb') as f:
        file_bytes = f.read()
    sha256 = hashlib.sha256(file_bytes).hexdigest()

    paras = extract_docx_paras(filepath)
    raw_text = '\n'.join(paras)
    
    if not paras:
        return {
            'candidateId': candidate_id,
            'sourceFilename': filename,
            'sourceFilepath': filepath,
            'sha256': sha256,
            'extractionStatus': 'empty_document',
            'name': 'Unknown (Empty File)',
            'headline': 'Empty Document',
            'summary': '',
            'experience': [],
            'projects': [],
            'education': [],
            'certifications': [],
            'skills': {
                'platforms': [],
                'methods': [],
                'domainKnowledge': [],
                'softSkills': [],
                'allSkills': []
            },
            'totalExperienceMonths': 0,
            'independentLcaExperienceMonths': 0,
            'designExperienceMonths': 0,
            'completedLcaProjectsCount': 0,
            'hasDesignPortfolioOrCaseStudies': False,
            'hasUserResearchEvidence': False,
            'contextualFlags': {
                'relocationMentioned': False,
                'travelWillingnessMentioned': False,
                'commitmentMentioned': False,
                'subjectiveTraitsRequireReview': False
            },
            'rawTextLength': 0,
            'warnings': ['File contains 0 text nodes and 0 drawings in DOCX XML. Flagged as unscorable.'],
            'lcaChunk': '',
            'uiuxChunk': ''
        }

    name = paras[0]
    headline = paras[1] if len(paras) > 1 and not paras[1] in ('Experience', 'Education', 'Projects') else ''

    # Segment into sections
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

    # Parse Experience
    exp_roles = []
    current_role = None

    for line in sections['Experience']:
        is_bullet = line.strip().startswith(('•', '-', '*', '–'))
        if not is_bullet and ('—' in line or ' - ' in line or re.search(r'\b(20\d{2}|19\d{2}|present|ongoing)\b', line, re.I)):
            if current_role:
                exp_roles.append(current_role)
            
            parts = re.split(r'\s+[—-]\s+', line)
            title = parts[0].strip()
            rest = ' — '.join(parts[1:]) if len(parts) > 1 else ''
            
            iv, dur, is_cur = parse_robust_date_span(rest or line)
            company = re.sub(r'([A-Za-z]{3,9}\s+\d{4}|\d{4}|present|current|ongoing).*', '', rest, flags=re.I).strip(' —-,')
            if not company:
                company = rest
                
            current_role = {
                'title': title,
                'company': company,
                'rawDates': rest,
                'interval': iv,
                'durationMonths': dur,
                'isCurrent': is_cur,
                'bullets': [],
                'isIndependentLCA': False,
                'isDesignRole': False
            }
        elif current_role:
            current_role['bullets'].append(line)
        else:
            current_role = {
                'title': line,
                'company': 'Organization',
                'rawDates': '',
                'interval': None,
                'durationMonths': 6,
                'isCurrent': False,
                'bullets': [],
                'isIndependentLCA': False,
                'isDesignRole': False
            }
    if current_role:
        exp_roles.append(current_role)

    # Classify experience items and calculate non-overlapping durations
    all_ivs = [r['interval'] for r in exp_roles if r['interval']]
    total_months = merge_intervals(all_ivs)
    if total_months == 0 and exp_roles:
        total_months = sum(r['durationMonths'] for r in exp_roles)

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
        r['isIndependentLCA'] = is_lca
        r['isDesignRole'] = is_design
        if is_lca and r['interval']:
            lca_ivs.append(r['interval'])
        if is_design and r['interval']:
            design_ivs.append(r['interval'])

    independent_lca_months = merge_intervals(lca_ivs)
    if independent_lca_months == 0 and any(r['isIndependentLCA'] for r in exp_roles):
        independent_lca_months = sum(r['durationMonths'] for r in exp_roles if r['isIndependentLCA'])

    design_months = merge_intervals(design_ivs)
    if design_months == 0 and any(r['isDesignRole'] for r in exp_roles):
        design_months = sum(r['durationMonths'] for r in exp_roles if r['isDesignRole'])

    # Parse Projects
    project_items = []
    current_proj = None
    for line in sections['Projects / Deliverables']:
        is_bullet = line.strip().startswith(('•', '-', '*', '–'))
        if not is_bullet:
            if current_proj:
                project_items.append(current_proj)
            current_proj = {
                'title': line,
                'description': '',
                'bullets': [],
                'tools': [],
                'isLCAProject': False,
                'isDesignProject': False
            }
        elif current_proj:
            current_proj['bullets'].append(line)
        else:
            current_proj = {
                'title': 'Project Deliverable',
                'description': line,
                'bullets': [line],
                'tools': [],
                'isLCAProject': False,
                'isDesignProject': False
            }
    if current_proj:
        project_items.append(current_proj)

    completed_lca_projects_count = 0
    has_design_portfolio = False
    has_user_research = False

    for p in project_items:
        p_text = f"{p['title']} {p['description']} {' '.join(p['bullets'])}".lower()
        if any(term in p_text for term in ['lca', 'life cycle assessment', 'carbon', 'emission', 'footprint', 'gabi', 'simapro', 'openlca', 'iso 14040', 'solid waste', 'embodied energy']):
            p['isLCAProject'] = True
            completed_lca_projects_count += 1
        if any(term in p_text for term in ['figma', 'ui/ux', 'redesign', 'mobile app', 'prototype', 'wireframe', 'case study', 'website', 'design system']):
            p['isDesignProject'] = True
            has_design_portfolio = True
        if any(term in p_text for term in ['user interview', 'user research', 'usability testing', 'personas', 'survey']):
            has_user_research = True

    # Parse Education
    edu_items = []
    edu_lines = sections['Education']
    for line in edu_lines:
        low = line.lower()
        if any(w in low for w in ['cgpa', 'percentage', 'completed in', 'expected in']) and not any(d in low for d in ['bachelor', 'master', 'b.e', 'b.tech', 'm.tech', 'm.sc', 'b.sc', 'degree', 'diploma']):
            continue
        domain = 'general'
        if any(term in low for term in ['environmental', 'sustainability', 'ecology', 'climate', 'renewable', 'energy']):
            domain = 'environmental'
        elif any(term in low for term in ['design', 'hci', 'interaction', 'multimedia', 'animation', 'visual communication']):
            domain = 'design'
        elif any(term in low for term in ['computer science', 'information technology', 'engineering', 'civil', 'chemical', 'technology', 'mechanical']):
            domain = 'allied_technical'

        year_match = re.search(r'\b(20\d{2}|19\d{2})\b', line)
        edu_items.append({
            'degree': line,
            'institution': '',
            'year': year_match.group(0) if year_match else None,
            'domain': domain
        })

    # Parse Skills
    skills_data = {
        'platforms': [],
        'methods': [],
        'domainKnowledge': [],
        'softSkills': [],
        'allSkills': []
    }
    all_skill_tokens = []
    for line in sections['Core Skills']:
        if ':' in line:
            cat, rest = line.split(':', 1)
            tokens = [t.strip() for t in rest.split(',') if t.strip()]
            all_skill_tokens.extend(tokens)
            low_cat = cat.lower()
            if 'platform' in low_cat or 'tool' in low_cat:
                skills_data['platforms'].extend(tokens)
            elif 'method' in low_cat:
                skills_data['methods'].extend(tokens)
            elif 'domain' in low_cat:
                skills_data['domainKnowledge'].extend(tokens)
            elif 'soft' in low_cat:
                skills_data['softSkills'].extend(tokens)
        else:
            tokens = [t.strip() for t in line.split(',') if t.strip()]
            all_skill_tokens.extend(tokens)
            skills_data['platforms'].extend(tokens)
    skills_data['allSkills'] = list(dict.fromkeys(all_skill_tokens))

    # Contextual flags
    summary_text = ' '.join(sections['Professional Summary'])
    full_corpus = f"{raw_text}".lower()
    
    relocation = 'chennai' in full_corpus or 'relocat' in full_corpus
    travel = 'travel' in full_corpus
    commitment = '1 year' in full_corpus or '01 year' in full_corpus or 'commitment' in full_corpus
    subjective_review = any(term in full_corpus for term in ['aesthetic', 'psychology', 'creative', 'curiosity'])
    has_user_research = has_user_research or any(w in full_corpus for w in ['user research', 'user interview', 'usability testing', 'user testing', 'persona'])

    # Prepare focused semantic chunks
    lca_chunk_parts = [headline, summary_text]
    for e in exp_roles:
        if e['isIndependentLCA'] or any(t in e['title'].lower() for t in ['lca', 'sustainability', 'environment', 'impact']):
            lca_chunk_parts.append(f"{e['title']} at {e['company']}: {' '.join(e['bullets'])}")
    for p in project_items:
        if p['isLCAProject']:
            lca_chunk_parts.append(f"Project: {p['title']} - {' '.join(p['bullets'])}")
    lca_chunk_parts.append('Skills: ' + ', '.join(skills_data['allSkills']))
    lca_chunk = ' '.join([p for p in lca_chunk_parts if p]).strip()
    if len(lca_chunk) < 50:
        lca_chunk = raw_text[:1200]

    uiux_chunk_parts = [headline, summary_text]
    for e in exp_roles:
        if e['isDesignRole'] or any(t in e['title'].lower() for t in ['ui', 'ux', 'design', 'frontend', 'product']):
            uiux_chunk_parts.append(f"{e['title']} at {e['company']}: {' '.join(e['bullets'])}")
    for p in project_items:
        if p['isDesignProject']:
            uiux_chunk_parts.append(f"Project: {p['title']} - {' '.join(p['bullets'])}")
    uiux_chunk_parts.append('Skills: ' + ', '.join(skills_data['allSkills']))
    uiux_chunk = ' '.join([p for p in uiux_chunk_parts if p]).strip()
    if len(uiux_chunk) < 50:
        uiux_chunk = raw_text[:1200]

    # Clean exp_roles representation for json serialization (remove interval tuple)
    clean_exp_roles = []
    for r in exp_roles:
        clean_exp_roles.append({
            'title': r['title'],
            'company': r['company'],
            'rawDates': r['rawDates'],
            'durationMonths': r['durationMonths'],
            'isCurrent': r['isCurrent'],
            'bullets': r['bullets'],
            'isIndependentLCA': r['isIndependentLCA'],
            'isDesignRole': r['isDesignRole']
        })

    return {
        'candidateId': candidate_id,
        'sourceFilename': filename,
        'sourceFilepath': filepath,
        'sha256': sha256,
        'extractionStatus': 'ready_for_extraction',
        'name': name,
        'headline': headline,
        'summary': summary_text,
        'experience': clean_exp_roles,
        'projects': project_items,
        'education': edu_items,
        'certifications': sections['Certifications & Licenses'],
        'skills': skills_data,
        'totalExperienceMonths': total_months,
        'independentLcaExperienceMonths': independent_lca_months,
        'designExperienceMonths': design_months,
        'completedLcaProjectsCount': completed_lca_projects_count,
        'hasDesignPortfolioOrCaseStudies': has_design_portfolio,
        'hasUserResearchEvidence': has_user_research,
        'contextualFlags': {
            'relocationMentioned': relocation,
            'travelWillingnessMentioned': travel,
            'commitmentMentioned': commitment,
            'subjectiveTraitsRequireReview': subjective_review
        },
        'rawTextLength': len(raw_text),
        'warnings': [],
        'lcaChunk': lca_chunk[:1800],
        'uiuxChunk': uiux_chunk[:1800]
    }

def main():
    files = sorted(glob.glob('Software Development Assignment Resumes/*.docx'))
    print(f"Extracting structured data from {len(files)} resumes with robust dates and ISO patterns...")
    results = []
    
    for fp in files:
        res = parse_resume(fp)
        results.append(res)

    out_path = 'data/intermediate_extracted.json'
    with open(out_path, 'w') as f:
        json.dump(results, f, indent=2)

    ready = sum(1 for r in results if r['extractionStatus'] == 'ready_for_extraction')
    empty = sum(1 for r in results if r['extractionStatus'] == 'empty_document')
    print(f"Extracted {len(results)} records ({ready} ready, {empty} empty).")
    print(f"Saved to {out_path}")

if __name__ == '__main__':
    main()
