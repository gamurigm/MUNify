import re

# ── Carga de plantilla LaTeX ──
def load_latex_template(doc_type: str) -> str:
    """Carga la plantilla .tex correspondiente al tipo de documento."""
    templates = {
        "POSITION_PAPER": "templates/position_paper.tex",
        "RESOLUTION": "templates/position_paper.tex",  # Fallback por ahora
    }
    path = templates.get(doc_type, "templates/position_paper.tex")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""

# ── Conversión básica LaTeX → HTML para Tiptap ──
def latex_to_html(latex: str) -> str:
    """Convierte LaTeX básico a HTML para el editor Tiptap."""
    html = latex
    
    # Eliminar preámbulo y document wrappers
    html = re.sub(r'\\documentclass.*?\n', '', html)
    html = re.sub(r'\\usepackage.*?\n', '', html)
    html = re.sub(r'\\geometry\{.*?\}', '', html)
    html = re.sub(r'\\onehalfspacing', '', html)
    html = re.sub(r'\\definecolor\{.*?\}\{.*?\}\{.*?\}', '', html)
    html = re.sub(r'\\pagestyle\{.*?\}', '', html)
    html = re.sub(r'\\fancyhf\{\}', '', html)
    html = re.sub(r'\\fancyhead\[.\]\{.*?\}', '', html)
    html = re.sub(r'\\fancyfoot\[.\]\{.*?\}', '', html)
    html = re.sub(r'\\renewcommand\{.*?\}\{.*?\}', '', html)
    html = re.sub(r'\\titleformat\{.*?\}.*?\n', '', html)
    html = re.sub(r'\\hypersetup\{[^}]*\}', '', html, flags=re.DOTALL)
    html = re.sub(r'\\begin\{document\}', '', html)
    html = re.sub(r'\\end\{document\}', '', html)
    
    # Titlepage → header div
    def titlepage_replace(m):
        content = m.group(1)
        return f'<div class="title-page" style="text-align:center; padding: 2em 0;">{content}</div><hr/>'
    html = re.sub(r'\\begin\{titlepage\}(.*?)\\end\{titlepage\}', titlepage_replace, html, flags=re.DOTALL)
    
    # Secciones
    html = re.sub(r'\\section\{(.*?)\}', r'<h1>\1</h1>', html)
    html = re.sub(r'\\subsection\{(.*?)\}', r'<h2>\1</h2>', html)
    html = re.sub(r'\\subsubsection\{(.*?)\}', r'<h3>\1</h3>', html)
    
    # Formato de texto
    html = re.sub(r'\\textbf\{(.*?)\}', r'<strong>\1</strong>', html)
    html = re.sub(r'\\textit\{(.*?)\}', r'<em>\1</em>', html)
    html = re.sub(r'\\underline\{(.*?)\}', r'<u>\1</u>', html)
    html = re.sub(r'\\textcolor\{[^}]*\}\{(.*?)\}', r'\1', html)
    html = re.sub(r'\\emph\{(.*?)\}', r'<em>\1</em>', html)
    
    # Tamaños de texto
    html = re.sub(r'\{\\Huge\\textbf\{(.*?)\}\}', r'<h1 style="font-size:2.5em">\1</h1>', html)
    html = re.sub(r'\{\\Large\\textbf\{(.*?)\}\}', r'<h2>\1</h2>', html)
    html = re.sub(r'\{\\large (.*?)\}', r'<p style="font-size:1.2em">\1</p>', html)
    html = re.sub(r'\{\\small (.*?)\}', r'<small>\1</small>', html)
    
    # Listas
    def itemize_replace(m):
        items = m.group(1)
        items_html = re.sub(r'\\item\s*(.*?)(?=\\item|$)', r'<li>\1</li>', items, flags=re.DOTALL)
        return f'<ul>{items_html}</ul>'
    html = re.sub(r'\\begin\{itemize\}(.*?)\\end\{itemize\}', itemize_replace, html, flags=re.DOTALL)
    
    def enumerate_replace(m):
        items = m.group(1)
        items_html = re.sub(r'\\item\s*(.*?)(?=\\item|$)', r'<li>\1</li>', items, flags=re.DOTALL)
        return f'<ol>{items_html}</ol>'
    html = re.sub(r'\\begin\{enumerate\}(.*?)\\end\{enumerate\}', enumerate_replace, html, flags=re.DOTALL)
    
    # Tablas simplificadas
    def table_replace(m):
        inner = m.group(1)
        caption = ""
        cap_match = re.search(r'\\caption\{(.*?)\}', inner)
        if cap_match:
            caption = f'<caption>{cap_match.group(1)}</caption>'
        
        tab_match = re.search(r'\\begin\{tabular\}.*?\n(.*?)\\end\{tabular\}', inner, re.DOTALL)
        if not tab_match:
            return inner
        tab_content = tab_match.group(1)
        
        rows = tab_content.strip().split('\\\\')
        html_rows = []
        for i, row in enumerate(rows):
            row = row.strip()
            if not row or row in ('\\toprule', '\\midrule', '\\bottomrule'):
                continue
            row = row.replace('\\toprule', '').replace('\\midrule', '').replace('\\bottomrule', '').strip()
            if not row:
                continue
            cells = [c.strip() for c in row.split('&')]
            tag = 'th' if i == 0 else 'td'
            cells_html = ''.join(f'<{tag}>{c}</{tag}>' for c in cells)
            row_html = f'<tr>{cells_html}</tr>'
            html_rows.append(row_html)
        
        return f'<table>{caption}{"".join(html_rows)}</table>'
    
    html = re.sub(r'\\begin\{table\}\[H?\]?(.*?)\\end\{table\}', table_replace, html, flags=re.DOTALL)
    
    # Limpiar comandos LaTeX restantes
    html = re.sub(r'\\newpage', '<hr/>', html)
    html = re.sub(r'\\tableofcontents', '', html)
    html = re.sub(r'\\centering', '', html)
    html = re.sub(r'\\vspace\*?\{[^}]*\}', '', html)
    html = re.sub(r'\\vfill', '', html)
    html = re.sub(r'\\\\(\[[\d.]+cm\])?', '<br/>', html)
    html = re.sub(r'\\noindent', '', html)
    html = re.sub(r'\\hline', '', html)
    html = re.sub(r'\\includegraphics\[.*?\]\{(.*?)\}', r'<img src="\1" style="max-width:100%"/>', html)
    html = re.sub(r'\\href\{(.*?)\}\{(.*?)\}', r'<a href="\1">\2</a>', html)
    html = re.sub(r'\\url\{(.*?)\}', r'<a href="\1">\1</a>', html)
    html = re.sub(r'\\cite\{(.*?)\}', r'[\1]', html)
    html = re.sub(r'%.*?\n', '\n', html)
    html = re.sub(r'~', '&nbsp;', html)
    html = re.sub(r'---', '—', html)
    html = re.sub(r'--', '–', html)
    
    # Wrap plain paragraphs
    lines = html.split('\n')
    result = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('<') or stripped.startswith('\\'):
            result.append(stripped)
        else:
            result.append(f'<p>{stripped}</p>')
    
    return '\n'.join(result)

# ── Conversión HTML → LaTeX para persistencia ──
def html_to_latex(html: str) -> str:
    """Convierte HTML del editor Tiptap a LaTeX."""
    latex = html
    
    # Headings
    latex = re.sub(r'<h1[^>]*>(.*?)</h1>', r'\\section{\1}', latex)
    latex = re.sub(r'<h2[^>]*>(.*?)</h2>', r'\\subsection{\1}', latex)
    latex = re.sub(r'<h3[^>]*>(.*?)</h3>', r'\\subsubsection{\1}', latex)
    
    # Text formatting
    latex = re.sub(r'<strong>(.*?)</strong>', r'\\textbf{\1}', latex)
    latex = re.sub(r'<b>(.*?)</b>', r'\\textbf{\1}', latex)
    latex = re.sub(r'<em>(.*?)</em>', r'\\textit{\1}', latex)
    latex = re.sub(r'<i>(.*?)</i>', r'\\textit{\1}', latex)
    latex = re.sub(r'<u>(.*?)</u>', r'\\underline{\1}', latex)
    
    # Lists
    def ul_replace(m):
        items = m.group(1)
        items_latex = re.sub(r'<li>(.*?)</li>', r'  \\item \1\n', items, flags=re.DOTALL)
        return f'\\begin{{itemize}}\n{items_latex}\\end{{itemize}}'
    latex = re.sub(r'<ul>(.*?)</ul>', ul_replace, latex, flags=re.DOTALL)
    
    def ol_replace(m):
        items = m.group(1)
        items_latex = re.sub(r'<li>(.*?)</li>', r'  \\item \1\n', items, flags=re.DOTALL)
        return f'\\begin{{enumerate}}\n{items_latex}\\end{{enumerate}}'
    latex = re.sub(r'<ol>(.*?)</ol>', ol_replace, latex, flags=re.DOTALL)
    
    # Paragraphs
    latex = re.sub(r'<p>(.*?)</p>', r'\1\n\n', latex)
    
    # Breaks
    latex = re.sub(r'<br\s*/?>', r'\\\\\n', latex)
    latex = re.sub(r'<hr\s*/?>', r'\\newpage\n', latex)
    
    # Links
    latex = re.sub(r'<a href="(.*?)">(.*?)</a>', r'\\href{\1}{\2}', latex)
    
    # Images
    latex = re.sub(r'<img[^>]*src="(.*?)"[^>]*/>', r'\\includegraphics[width=\\textwidth]{\1}', latex)
    
    # Tables (basic)
    def table_replace(m):
        content = m.group(1)
        rows = re.findall(r'<tr>(.*?)</tr>', content, re.DOTALL)
        if not rows:
            return content
        
        first_cells = re.findall(r'<t[hd]>(.*?)</t[hd]>', rows[0])
        cols = len(first_cells)
        col_spec = '|'.join(['l'] * cols)
        
        latex_rows = []
        for i, row in enumerate(rows):
            cells = re.findall(r'<t[hd]>(.*?)</t[hd]>', row)
            latex_row = ' & '.join(cells) + ' \\\\'
            if i == 0:
                latex_rows.append('\\toprule')
                latex_rows.append(latex_row)
                latex_rows.append('\\midrule')
            else:
                latex_rows.append(latex_row)
        latex_rows.append('\\bottomrule')
        
        return f'\\begin{{table}}[H]\n\\centering\n\\begin{{tabular}}{{@{{}}{col_spec}@{{}}}}\n' + '\n'.join(latex_rows) + f'\n\\end{{tabular}}\n\\end{{table}}'
    
    latex = re.sub(r'<table>(.*?)</table>', table_replace, latex, flags=re.DOTALL)
    
    # Strip remaining HTML tags
    latex = re.sub(r'<[^>]+>', '', latex)
    
    for char in ['#', '$', '%', '&', '_']:
        latex = latex.replace(char, '\\' + char)
    
    return latex.strip()
