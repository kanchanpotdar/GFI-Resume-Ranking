import os
import glob
import json
import zipfile
import re
import hashlib
import xml.etree.ElementTree as ET

# Configurable evaluation reference date (November 2026 for this assignment baseline)
EVAL_REF_YEAR = 2026
EVAL_REF_MONTH = 11

MONTH_MAP = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
    'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
}

KNOWN_PLATFORMS = {
    'gabi', 'simapro', 'openlca', 'umberto', 'one click lca', 'eime', 'aspen plus', 'aspen hysys',
    'pvsyst', 'arcgis', 'qgis', 'google earth engine', 'autocad', 'solidworks', 'ansys',
    'creo parametric', 'catia', 'bluestar', 'inventor', 'autodesk inventor', 'siemens nx',
    'figma', 'sketch', 'adobe xd', 'invision', 'photoshop', 'illustrator', 'after effects',
    'spline', 'canva', 'framer', 'miro', 'jira', 'confluence', 'salesforce', 'power bi',
    'tableau', 'excel', 'microsoft excel', 'powerpoint', 'word', 'sap erp', 'python',
    'react', 'html', 'css', 'javascript', 'typescript', 'sql', 'matlab', 'simulink'
}

KNOWN_METHODS = {
    'life cycle assessment', 'lca', 'environmental impact assessment', 'eia',
    'social impact assessment', 'sia', 'cradle-to-gate', 'cradle-to-grave',
    'cradle - to - gate', 'cradle - to - grave', 'gate-to-gate', 'ghg accounting',
    'carbon footprint', 'carbon footprinting', 'scope 1', 'scope 2', 'scope 3',
    'iso 14040', 'iso 14044', 'iso 14040/44', 'epd', 'environmental product declaration',
    'product environmental profile', 'pep', 'material flow analysis', 'mfa', 'mfca',
    'water footprint', 'user research', 'user interviews', 'usability testing',
    'wireframing', 'prototyping', 'interaction design', 'information architecture',
    'design systems', 'heuristic evaluation', 'journey mapping', 'persona creation',
    'human-centered design', 'hcd', 'design thinking', 'responsive design', 'a/b testing'
}

KNOWN_SOFT_SKILLS = {
    'communication', 'collaboration', 'leadership', 'teamwork', 'critical thinking',
    'problem solving', 'adaptability', 'cross-functional collaboration', 'presentation skills',
    'time management', 'attention to detail', 'quick learner', 'self-motivated', 'innovative',
    'proactive', 'organized', 'stakeholder management', 'content writing'
}

DEGREE_PATTERN = re.compile(
    r'\b(?:bachelor|master|doctor|ph\.?d|b\.?\s*tech|m\.?\s*tech|b\.?\s*des|m\.?\s*des|'
    r'b\.?\s*e\b|m\.?\s*e\b|b\.?\s*sc|m\.?\s*sc|b\.?\s*a\b|m\.?\s*a\b|mba|bba|bca|m\.?\s*s\b|'
    r'pgd|post graduate|diploma|class\s+(?:xii|x\b)|hsc|ssc|intermediate|'
    r'higher secondary|secondary|pre-university|science stream|cbse)\b',
    re.I
)

INSTITUTION_KEYWORDS = ('university', 'institute', 'college', 'academy', 'school', 'polytechnic', 'campus', 'vidyalaya')

LCA_METHODOLOGY_TERMS = [
    r'\blca\b', r'life cycle assessment', r'life-cycle assessment',
    r'cradle[\s-]+to[\s-]+gate', r'cradle[\s-]+to[\s-]+grave',
    r'openlca\b', r'simapro\b', r'gabi\b', r'one click lca\b',
    r'recipe\s*(?:2016|\d+)?', r'ecoinvent\b', r'\blci\b',
    r'life cycle inventory', r'\bepd\b', r'product environmental profile'
]

STRICT_LCA_EXP_TERMS = [
    r'\blca\b', r'life cycle assessment', r'life-cycle assessment',
    r'simapro\b', r'gabi\b', r'openlca\b', r'iso\s*(?:14040|14044|/|:2006)',
    r'cradle[\s-]+to[\s-]+gate', r'cradle[\s-]+to[\s-]+grave',
    r'\blci\b', r'life cycle inventory', r'\bepd\b'
]

ACTION_VERB_PREFIXES = (
    'designed', 'developed', 'conducted', 'performed', 'created', 'built', 'led',
    'exploring', 'enabling', 'project aimed at', 'identified', 'completed',
    'contributed', 'secured', 'published', 'drove', 'steered', 'fabricated',
    'assessed', 'operated', 'engineered', 'applied', 'utilized', 'worked on',
    'focused on', 'spearheaded', 'managed', 'formulated', 'modeled', 'modelling',
    'redesigned', 'built the', 'immersive', 'high-fidelity', 'end-to-end'
)


def parse_robust_date_span(date_str, eval_ref_year=EVAL_REF_YEAR, eval_ref_month=EVAL_REF_MONTH):
    """
    Parses date strings into calendar interval (start_idx, end_idx), duration in months,
    and current employment flag. Does not invent dates for unknown spans.
    """
    if not date_str:
        return None, 0, False

    s_norm = date_str.lower().replace('—', '-').replace('–', '-').replace('’', '20').replace("'", "20").strip()
    is_current = any(w in s_norm for w in ['present', 'current', 'ongoing'])

    # Check relative duration: 'X months' (no specific calendar interval synthesized)
    m_dur = re.search(r'(\d+)\s*months?', s_norm)
    if m_dur:
        months = int(m_dur.group(1))
        return None, months, False

    # Check MM/YYYY - MM/YYYY or MM/YYYY - Present
    m_slash = re.search(r'(\d{1,2})/(\d{4})\s*-\s*(\d{1,2})/(\d{4})', s_norm)
    if m_slash:
        sm, sy, em, ey = int(m_slash.group(1)), int(m_slash.group(2)), int(m_slash.group(3)), int(m_slash.group(4))
        start_idx = sy * 12 + sm
        end_idx = ey * 12 + em
        return (start_idx, end_idx), max(1, end_idx - start_idx + 1), False

    m_slash_curr = re.search(r'(\d{1,2})/(\d{4})\s*-\s*(?:present|current|ongoing)', s_norm)
    if m_slash_curr:
        sm, sy = int(m_slash_curr.group(1)), int(m_slash_curr.group(2))
        start_idx = sy * 12 + sm
        end_idx = eval_ref_year * 12 + eval_ref_month
        return (start_idx, end_idx), max(1, end_idx - start_idx + 1), True

    # Check Month YYYY - Month YYYY / Present
    m_full = re.search(r'([a-z]{3,9})\s+(\d{4})\s*-\s*(([a-z]{3,9})\s+(\d{4})|present|current|ongoing)', s_norm)
    if m_full:
        sm = MONTH_MAP.get(m_full.group(1).lower(), 1)
        sy = int(m_full.group(2))
        start_idx = sy * 12 + sm
        if is_current:
            em, ey = eval_ref_month, eval_ref_year
        else:
            em = MONTH_MAP.get(m_full.group(4).lower(), 12) if m_full.group(4) else 12
            ey = int(m_full.group(5)) if m_full.group(5) else sy
        end_idx = ey * 12 + em
        return (start_idx, end_idx), max(1, end_idx - start_idx + 1), is_current

    # Check Month - Month YYYY (e.g. 'Jun - Jul 2024')
    m_single_year = re.search(r'([a-z]{3,9})\s*-\s*([a-z]{3,9})\s+(\d{4})', s_norm)
    if m_single_year:
        sm = MONTH_MAP.get(m_single_year.group(1).lower(), 1)
        em = MONTH_MAP.get(m_single_year.group(2).lower(), 12)
        ey = int(m_single_year.group(3))
        start_idx = ey * 12 + sm
        end_idx = ey * 12 + em
        return (start_idx, end_idx), max(1, end_idx - start_idx + 1), False

    # Check YYYY - YYYY / Present
    m_year = re.search(r'(\d{4})\s*-\s*(\d{4}|present|current|ongoing)', s_norm)
    if m_year:
        sy = int(m_year.group(1))
        ey = eval_ref_year if is_current else int(m_year.group(2))
        start_idx = sy * 12 + 1
        end_idx = ey * 12 + 12
        return (start_idx, end_idx), max(1, end_idx - start_idx + 1), is_current

    return None, 0, is_current


def merge_intervals(intervals):
    """Computes total months using non-overlapping interval union."""
    if not intervals:
        return 0
    valid_ivs = [iv for iv in intervals if iv is not None and isinstance(iv, (tuple, list)) and len(iv) == 2]
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


def classify_edu_domain(degree_text):
    low = degree_text.lower()
    if any(w in low for w in ['environmental', 'sustainability', 'ecology', 'climate', 'renewable', 'energy']):
        return 'environmental'
    elif any(w in low for w in ['design', 'hci', 'interaction', 'multimedia', 'animation', 'visual communication', 'communication design', 'fashion technology']):
        return 'design'
    elif any(w in low for w in [
        'computer science', 'information technology', 'engineering', 'civil', 'chemical',
        'technology', 'mechanical', 'automotive', 'biotechnology', 'artificial intelligence',
        'data', 'information science'
    ]):
        return 'allied_technical'
    return 'general'


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

    warnings = []
    name = paras[0]
    headline = paras[1] if len(paras) > 1 and not paras[1] in ('Experience', 'Education', 'Projects') else ''

    # Segment into sections with full known headers
    sec_names = [
        'Experience', 'Projects / Deliverables', 'Education', 'Certifications & Licenses',
        'Professional Summary', 'Core Skills', 'Tools / Technologies', 'Awards / Honors',
        'Languages', 'Interests'
    ]
    sections = {s: [] for s in sec_names}
    sections['Other'] = []
    current_sec = 'Other'
    idx = 2 if headline else 1

    while idx < len(paras):
        p = paras[idx]
        matched = False
        for s in sec_names:
            if p.lower().strip() == s.lower() or p.lower().strip().startswith(s.lower()):
                current_sec = s
                matched = True
                break
        if not matched:
            sections[current_sec].append(p)
        idx += 1

    # 1. Parse Experience
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
                'isDesignRole': False,
                'evidenceSpan': line
            }
        elif current_role:
            current_role['bullets'].append(line)
        else:
            # Experience line with missing dates: set duration to 0 and record warning (non-fabrication policy)
            warnings.append(f"Experience entry '{line[:40]}' lacks explicit dates; duration set to 0 months.")
            current_role = {
                'title': line,
                'company': 'Organization',
                'rawDates': '',
                'interval': None,
                'durationMonths': 0,
                'isCurrent': False,
                'bullets': [],
                'isIndependentLCA': False,
                'isDesignRole': False,
                'evidenceSpan': line
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

        # Strict independent LCA criteria: require direct LCA execution or explicit LCA role title
        is_lca_title = any(term in r['title'].lower() for term in [
            'lca consultant', 'lca analyst', 'life cycle assessment', 'lca engineer', 'lca specialist'
        ])
        has_lca_execution = any(re.search(pat, r_text) for pat in STRICT_LCA_EXP_TERMS)
        is_lca = is_lca_title or has_lca_execution

        # UI/UX criteria
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

    # 2. Parse Projects (Grouping title + description + bullets into distinct records)
    project_items = []
    curr_proj = None

    for line in sections['Projects / Deliverables']:
        line_clean = line.strip()
        is_bullet = line_clean.startswith(('•', '-', '*', '–'))

        if is_bullet:
            b_text = line_clean.lstrip('•-*– ').strip()
            if curr_proj:
                curr_proj['bullets'].append(b_text)
            else:
                curr_proj = {
                    'title': 'Project Deliverable',
                    'description': '',
                    'bullets': [b_text],
                    'tools': [],
                    'isLCAProject': False,
                    'isDesignProject': False,
                    'evidenceSpan': line_clean
                }
            continue

        # Non-bullet line
        if curr_proj is None:
            curr_proj = {
                'title': line_clean,
                'description': '',
                'bullets': [],
                'tools': [],
                'isLCAProject': False,
                'isDesignProject': False,
                'evidenceSpan': line_clean
            }
        elif curr_proj['description'] == '' and len(curr_proj['bullets']) == 0:
            # First line after title is the project description / subtitle
            curr_proj['description'] = line_clean
            curr_proj['evidenceSpan'] += f" | {line_clean}"
        else:
            # Start of a new distinct project
            project_items.append(curr_proj)
            curr_proj = {
                'title': line_clean,
                'description': '',
                'bullets': [],
                'tools': [],
                'isLCAProject': False,
                'isDesignProject': False,
                'evidenceSpan': line_clean
            }

    if curr_proj:
        project_items.append(curr_proj)

    completed_lca_projects_count = 0
    has_design_portfolio = False
    has_user_research = False

    for p in project_items:
        p_text = f"{p['title']} {p['description']} {' '.join(p['bullets'])}".lower()

        # Strict LCA project criteria: methodology evidence and completed execution
        has_lca_method = any(re.search(pat, p_text) for pat in LCA_METHODOLOGY_TERMS)
        is_assisting = any(re.search(r'\b(?:assist(?:ed|ing)?|support(?:ed|ing)?|contribut(?:ed|ing)?)\b', p_text) for _ in [1]) and not any(v in p_text for v in ['conducted', 'performed', 'engineered', 'executed', 'developed lca', 'built life cycle'])
        is_ongoing = any(re.search(r'\b(?:ongoing|in progress|expected)\b', p_text) for _ in [1])

        if has_lca_method and not is_assisting and not is_ongoing:
            p['isLCAProject'] = True
            completed_lca_projects_count += 1
        elif has_lca_method and (is_assisting or is_ongoing):
            p['isLCAProject'] = False
            warnings.append(f"LCA project '{p['title'][:40]}' flagged as supported/ongoing; requires recruiter confirmation.")

        # Design project criteria
        design_terms = [
            'figma', 'ui/ux', 'ux/ui', 'redesign', 'mobile app', 'prototype', 'wireframe',
            'case study', 'website', 'design system', 'hcd', 'interaction design', 'user flow',
            'visual hierarchy', 'interface', 'micro-interaction', 'usability', 'landing page',
            'dashboard', 'dark theme', 'shopping flow'
        ]
        has_design_keyword = any(term in p_text for term in design_terms) or bool(re.search(r'\b(?:ui|ux)\b', p_text))
        if has_design_keyword:
            p['isDesignProject'] = True
            has_design_portfolio = True

        if any(term in p_text for term in ['user interview', 'user research', 'usability testing', 'personas', 'survey']):
            has_user_research = True

    # 3. Parse Education (State machine: Degree -> Institution & Dates -> Score)
    edu_items = []
    curr_edu = None

    for line in sections['Education']:
        lc = line.strip()
        low = lc.lower()

        m_score = re.search(r'(?:cgpa|gpa|cgpi|ogpa|percentage|score|marks?)\s*[:–-]?\s*([0-9.]+(?:\s*(?:/|out of)\s*[0-9.]+)?%?)', low)
        is_score_only = bool((m_score or re.match(r'^[0-9.]+\s*%$', lc)) and len(lc) < 35 and not any(kw in low for kw in INSTITUTION_KEYWORDS))
        is_year_only = bool(re.match(r'^(?:19|20)\d{2}(?:\s*[-–]\s*(?:19|20)\d{2})?$', lc))
        has_inst_keyword = any(kw in low for kw in INSTITUTION_KEYWORDS)
        is_degree_start = bool(DEGREE_PATTERN.search(low)) and not has_inst_keyword

        if is_score_only and curr_edu:
            curr_edu['score'] = lc
            curr_edu['evidenceSpan'] += f" | {lc}"
            continue

        if is_year_only and curr_edu:
            curr_edu['year'] = lc
            curr_edu['evidenceSpan'] += f" | {lc}"
            continue

        if is_degree_start:
            if curr_edu:
                edu_items.append(curr_edu)
            ym = re.search(r'\b(20\d{2}|19\d{2})\b', lc)
            curr_edu = {
                'degree': lc,
                'institution': 'Unknown Institution',
                'year': ym.group(0) if ym else None,
                'score': None,
                'domain': classify_edu_domain(lc),
                'evidenceSpan': lc
            }
        elif curr_edu and curr_edu['institution'] == 'Unknown Institution':
            curr_edu['evidenceSpan'] += f" | {lc}"
            if not curr_edu['year']:
                ym = re.search(r'\b(20\d{2}|19\d{2})\b', lc)
                if ym:
                    curr_edu['year'] = ym.group(0)
            inst_clean = re.sub(r'[,–—-]?\s*(?:[A-Za-z]{3,9}\s+)?(?:19|20)\d{2}.*', '', lc).strip(' ,–—-')
            curr_edu['institution'] = inst_clean if inst_clean else lc
        elif curr_edu:
            curr_edu['evidenceSpan'] += f" | {lc}"

    if curr_edu:
        edu_items.append(curr_edu)

    # 4. Parse Skills (Category-aware and prevent pollution from awards/hackathons)
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
                skills_data['domainKnowledge'].extend(tokens)
        else:
            # Un-categorized line: classify tokens by vocabulary rather than blindly dumping to platforms
            tokens = [t.strip() for t in line.split(',') if t.strip()]
            all_skill_tokens.extend(tokens)
            for t in tokens:
                t_low = t.lower()
                if any(p in t_low for p in KNOWN_PLATFORMS):
                    skills_data['platforms'].append(t)
                elif any(m in t_low for m in KNOWN_METHODS):
                    skills_data['methods'].append(t)
                elif any(s in t_low for s in KNOWN_SOFT_SKILLS):
                    skills_data['softSkills'].append(t)
                else:
                    skills_data['domainKnowledge'].append(t)

    # Add Tools / Technologies section if present
    for line in sections['Tools / Technologies']:
        tokens = [t.strip() for t in line.split(',') if t.strip()]
        for t in tokens:
            t_low = t.lower()
            if any(p in t_low for p in KNOWN_PLATFORMS):
                skills_data['platforms'].append(t)
            all_skill_tokens.append(t)

    # Deduplicate skills
    for k in ['platforms', 'methods', 'domainKnowledge', 'softSkills']:
        skills_data[k] = list(dict.fromkeys(skills_data[k]))
    skills_data['allSkills'] = list(dict.fromkeys(all_skill_tokens))

    # 5. Contextual flags
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

    # Clean exp_roles representation for JSON serialization
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
            'isDesignRole': r['isDesignRole'],
            'evidenceSpan': r.get('evidenceSpan', '')
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
        'warnings': warnings,
        'lcaChunk': lca_chunk[:1800],
        'uiuxChunk': uiux_chunk[:1800]
    }


def main():
    files = sorted(glob.glob('Software Development Assignment Resumes/*.docx'))
    print(f"Extracting structured data from {len(files)} resumes with remediated parser...")
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
