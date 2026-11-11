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

def parse_date_duration(date_str):
    if not date_str:
        return 0, False
    s = date_str.lower().replace('–', '-').strip()
    is_current = 'present' in s or 'current' in s
    
    # Pattern: Month YYYY - Month YYYY / Present
    m1 = re.search(r'([a-z]{3,9})[\s,]+(\d{4})\s*-\s*([a-z]{3,9})?[\s,]*(\d{4}|present|current)', s)
    if m1:
        start_m = MONTH_MAP.get(m1.group(1)[:3].lower(), 1)
        start_y = int(m1.group(2))
        if is_current:
            end_m = 11
            end_y = 2026
        else:
            end_m = MONTH_MAP.get(m1.group(3)[:3].lower(), 12) if m1.group(3) else 12
            end_y = int(m1.group(4)) if m1.group(4) and m1.group(4).isdigit() else start_y
        months = max(1, (end_y - start_y) * 12 + (end_m - start_m) + 1)
        return months, is_current
        
    # Pattern: YYYY - YYYY / Present
    m2 = re.search(r'(\d{4})\s*-\s*(\d{4}|present|current)', s)
    if m2:
        start_y = int(m2.group(1))
        end_y = 2026 if is_current else int(m2.group(2))
        months = max(1, (end_y - start_y) * 12)
        return months, is_current
        
    return 6, is_current

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
            'warnings': ['File contains 0 text nodes and 0 drawings in DOCX XML'],
            'lcaChunk': '',
            'uiuxChunk': ''
        }

    name = paras[0] if len(paras) > 0 else 'Candidate'
    headline = paras[1] if len(paras) > 1 and not paras[1] in ('Experience', 'Education', 'Projects') else ''

    # Segment into sections
    sections = {
        'Experience': [],
        'Projects / Deliverables': [],
        'Education': [],
        'Certifications & Licenses': [],
        'Professional Summary': [],
        'Core Skills': [],
        'Other': []
    }
    
    current_sec = 'Other'
    idx = 2 if headline else 1
    
    while idx < len(paras):
        p = paras[idx]
        matched_sec = None
        for sec_name in ['Experience', 'Projects / Deliverables', 'Education', 'Certifications & Licenses', 'Professional Summary', 'Core Skills']:
            if p.lower() == sec_name.lower() or p.lower().startswith(sec_name.lower()):
                matched_sec = sec_name
                break
        
        if matched_sec:
            current_sec = matched_sec
        else:
            sections[current_sec].append(p)
        idx += 1

    # Parse Experience
    exp_items = []
    current_exp = None
    for line in sections['Experience']:
        # Header pattern: Title — Company Dates or Title - Company Dates
        if '—' in line or (' - ' in line and any(m in line.lower() for m in ['20', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'present'])):
            if current_exp:
                exp_items.append(current_exp)
            
            parts = re.split(r'\s+[—-]\s+', line)
            title = parts[0].strip() if len(parts) > 0 else 'Role'
            rest = ' — '.join(parts[1:]) if len(parts) > 1 else ''
            
            # extract dates from rest
            date_match = re.search(r'([A-Za-z]{3,9}\s+\d{4}|\d{4})\s*[-–]\s*([A-Za-z]{3,9}\s+\d{4}|\d{4}|[Pp]resent|[Cc]urrent)', rest)
            raw_dates = date_match.group(0) if date_match else ''
            company = rest.replace(raw_dates, '').strip(' —-,') if raw_dates else rest
            months, is_current = parse_date_duration(raw_dates)
            
            current_exp = {
                'title': title,
                'company': company,
                'rawDates': raw_dates,
                'durationMonths': months,
                'isCurrent': is_current,
                'bullets': [],
                'isIndependentLCA': False,
                'isDesignRole': False
            }
        elif current_exp:
            current_exp['bullets'].append(line)
        else:
            # First line without explicit dash
            current_exp = {
                'title': line,
                'company': 'Organization',
                'rawDates': '',
                'durationMonths': 6,
                'isCurrent': False,
                'bullets': [],
                'isIndependentLCA': False,
                'isDesignRole': False
            }
    if current_exp:
        exp_items.append(current_exp)

    # Classify experience items
    independent_lca_months = 0
    design_months = 0
    total_exp_months = sum(e['durationMonths'] for e in exp_items)
    
    for e in exp_items:
        exp_text = f"{e['title']} {e['company']} {' '.join(e['bullets'])}".lower()
        
        # LCA check
        is_lca = any(term in exp_text for term in [
            'life cycle assessment', 'lca', 'lci', 'gabi', 'simapro', 'iso 14040',
            'iso 14044', 'carbon footprint', 'decarbonisation', 'scope 1-3', 'circularity', 'epd'
        ])
        e['isIndependentLCA'] = is_lca
        if is_lca:
            independent_lca_months += e['durationMonths']
            
        # Design check
        is_design = any(term in exp_text for term in [
            'ui/ux', 'ux/ui', 'product design', 'visual design', 'figma',
            'user research', 'user experience', 'interaction design', 'wirefram'
        ])
        e['isDesignRole'] = is_design
        if is_design:
            design_months += e['durationMonths']

    # Parse Projects
    project_items = []
    current_proj = None
    for line in sections['Projects / Deliverables']:
        if line.startswith('•') or line.startswith('-'):
            if current_proj:
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
        else:
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
    if current_proj:
        project_items.append(current_proj)

    completed_lca_projects_count = 0
    has_design_portfolio = False
    has_user_research = False

    for p in project_items:
        p_text = f"{p['title']} {p['description']} {' '.join(p['bullets'])}".lower()
        if any(term in p_text for term in ['lca', 'life cycle assessment', 'carbon', 'emission', 'footprint', 'gabi', 'simapro', 'iso 14040', 'solid waste', 'embodied energy']):
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
    i = 0
    while i < len(edu_lines):
        line = edu_lines[i]
        domain = 'general'
        low = line.lower()
        if any(term in low for term in ['environmental', 'sustainability', 'ecology', 'climate', 'renewable', 'energy']):
            domain = 'environmental'
        elif any(term in low for term in ['design', 'hci', 'interaction', 'multimedia', 'animation', 'visual communication']):
            domain = 'design'
        elif any(term in low for term in ['computer science', 'information technology', 'engineering', 'civil', 'chemical', 'technology']):
            domain = 'allied_technical'

        inst = edu_lines[i+1] if i+1 < len(edu_lines) and not any(m in edu_lines[i+1].lower() for m in ['bachelor', 'master', 'b.', 'm.', 'class xii', 'class x']) else ''
        year_match = re.search(r'\b(20\d{2}|19\d{2})\b', f"{line} {inst}")
        
        edu_items.append({
            'degree': line,
            'institution': inst,
            'year': year_match.group(0) if year_match else None,
            'domain': domain
        })
        i += 2 if inst else 1

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

    # Prepare focused semantic chunks
    # LCA Chunk: Headline + Summary + LCA-related experience + LCA projects + Skills
    lca_chunk_parts = [headline, summary_text]
    for e in exp_items:
        if e['isIndependentLCA'] or any(t in e['title'].lower() for t in ['lca', 'sustainability', 'environment', 'impact']):
            lca_chunk_parts.append(f"{e['title']} at {e['company']}: {' '.join(e['bullets'])}")
    for p in project_items:
        if p['isLCAProject']:
            lca_chunk_parts.append(f"Project: {p['title']} - {' '.join(p['bullets'])}")
    lca_chunk_parts.append('Skills: ' + ', '.join(skills_data['allSkills']))
    lca_chunk = ' '.join([p for p in lca_chunk_parts if p]).strip()
    if len(lca_chunk) < 50:
        lca_chunk = raw_text[:1200]

    # UI/UX Chunk: Headline + Summary + Design experience + Design projects + Skills
    uiux_chunk_parts = [headline, summary_text]
    for e in exp_items:
        if e['isDesignRole'] or any(t in e['title'].lower() for t in ['ui', 'ux', 'design', 'frontend', 'product']):
            uiux_chunk_parts.append(f"{e['title']} at {e['company']}: {' '.join(e['bullets'])}")
    for p in project_items:
        if p['isDesignProject']:
            uiux_chunk_parts.append(f"Project: {p['title']} - {' '.join(p['bullets'])}")
    uiux_chunk_parts.append('Skills: ' + ', '.join(skills_data['allSkills']))
    uiux_chunk = ' '.join([p for p in uiux_chunk_parts if p]).strip()
    if len(uiux_chunk) < 50:
        uiux_chunk = raw_text[:1200]

    return {
        'candidateId': candidate_id,
        'sourceFilename': filename,
        'sourceFilepath': filepath,
        'sha256': sha256,
        'extractionStatus': 'ready_for_extraction',
        'name': name,
        'headline': headline,
        'summary': summary_text,
        'experience': exp_items,
        'projects': project_items,
        'education': edu_items,
        'certifications': sections['Certifications & Licenses'],
        'skills': skills_data,
        'totalExperienceMonths': total_exp_months,
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
    print(f"Extracting structured data from {len(files)} resumes...")
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
