import os
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf():
    input_path = os.path.join('docs', 'IEEE-PAPER-FINAL.md')
    output_path = os.path.join('docs', 'HEATSHIELD-AI-IEEE-PAPER.pdf')

    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        return

    with open(input_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Custom IEEE Styles
    title_style = ParagraphStyle(
        'IEEETitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        alignment=1, # Center
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=10
    )

    meta_style = ParagraphStyle(
        'IEEEMeta',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=12,
        alignment=1,
        textColor=colors.HexColor('#475569'),
        spaceAfter=15
    )

    abstract_style = ParagraphStyle(
        'IEEEAbstract',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=8,
        spaceAfter=10
    )

    h1_style = ParagraphStyle(
        'IEEEH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0284C7'),
        spaceBefore=14,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'IEEEBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=6
    )

    code_style = ParagraphStyle(
        'IEEECode',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#0F172A'),
        backColor=colors.HexColor('#F1F5F9'),
        borderColor=colors.HexColor('#CBD5E1'),
        borderWidth=0.5,
        borderPadding=6,
        spaceBefore=4,
        spaceAfter=6
    )

    story = []

    # Simple Markdown Parser
    lines = md_text.split('\n')
    in_code_block = False
    code_lines = []
    in_table = False
    table_rows = []

    for line in lines:
        stripped = line.strip()

        # Code block handling
        if stripped.startswith('```'):
            if in_code_block:
                in_code_block = False
                code_text = "<br/>".join(code_lines).replace(" ", "&nbsp;")
                story.append(Paragraph(code_text, code_style))
                code_lines = []
            else:
                in_code_block = True
            continue

        if in_code_block:
            safe_code = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            code_lines.append(safe_code)
            continue

        # Table handling
        if stripped.startswith('|') and stripped.endswith('|'):
            if '---' in stripped:
                continue # Skip divider row
            cols = [c.strip() for c in stripped.split('|')[1:-1]]
            table_rows.append(cols)
            in_table = True
            continue
        elif in_table:
            in_table = False
            if table_rows:
                # Render table
                formatted_table = []
                for r_idx, row in enumerate(table_rows):
                    formatted_row = []
                    for cell in row:
                        safe_cell = cell.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                        safe_cell = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', safe_cell)
                        p_style = ParagraphStyle('TableCell', parent=body_style, fontSize=7.5, leading=9.5)
                        if r_idx == 0:
                            p_style.fontName = 'Helvetica-Bold'
                            p_style.textColor = colors.white
                        formatted_row.append(Paragraph(safe_cell, p_style))
                    formatted_table.append(formatted_row)

                t = Table(formatted_table, colWidths=None)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
                    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#F8FAFC'), colors.white]),
                    ('TOPPADDING', (0,0), (-1,-1), 4),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ]))
                story.append(t)
                story.append(Spacer(1, 6))
                table_rows = []

        if not stripped:
            continue

        # Headers
        if stripped.startswith('# '):
            story.append(Paragraph(stripped[2:], title_style))
        elif stripped.startswith('**Authors**'):
            story.append(Paragraph(stripped, meta_style))
        elif stripped.startswith('## ABSTRACT'):
            story.append(Paragraph("<b>ABSTRACT</b>", h1_style))
        elif stripped.startswith('## KEYWORDS'):
            story.append(Paragraph("<b>KEYWORDS</b>", h1_style))
        elif stripped.startswith('## '):
            story.append(Paragraph(stripped[3:], h1_style))
        elif stripped.startswith('*Figure') or stripped.startswith('*Table'):
            fig_style = ParagraphStyle('FigCap', parent=meta_style, fontSize=8, leading=10, spaceBefore=4, spaceAfter=8)
            story.append(Paragraph(stripped, fig_style))
        else:
            # Inline formatting (bold, italic)
            formatted_line = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            formatted_line = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', formatted_line)
            formatted_line = re.sub(r'\*(.*?)\*', r'<i>\1</i>', formatted_line)
            formatted_line = re.sub(r'`(.*?)`', r'<font face="Courier" color="#0284C7">\1</font>', formatted_line)
            story.append(Paragraph(formatted_line, body_style))

    doc.build(story)
    print(f"Successfully generated PDF at: {output_path}")

if __name__ == '__main__':
    generate_pdf()
