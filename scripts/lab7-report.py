"""ЛР7: собрать DOCX из Markdown стандартной библиотекой, без скриншотов."""
from pathlib import Path
import re
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "otchet" / "lab7.md"
OUTPUT = ROOT / "otchet" / "РИЗ-250213у-Романов-Сергей-Лр7.docx"
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def paragraph(text="", style="Normal", align=None):
    props = f'<w:pStyle w:val="{style}"/>'
    if align:
        props += f'<w:jc w:val="{align}"/><w:ind w:firstLine="0"/>'
    return (
        f"<w:p><w:pPr>{props}</w:pPr><w:r>"
        f'<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'
    )


def table(rows):
    width = 9350 // len(rows[0])
    borders = "".join(
        f'<w:{side} w:val="single" w:sz="4" w:color="808080"/>'
        for side in ("top", "left", "bottom", "right", "insideH", "insideV")
    )
    content = []
    for index, row in enumerate(rows):
        cells = []
        for cell in row:
            cells.append(
                f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/></w:tcPr>'
                + paragraph(cell, "TableHeader" if index == 0 else "TableText")
                + "</w:tc>"
            )
        row_props = "<w:trPr><w:tblHeader/></w:trPr>" if index == 0 else ""
        content.append("<w:tr>" + row_props + "".join(cells) + "</w:tr>")
    grid = "".join(f'<w:gridCol w:w="{width}"/>' for _ in rows[0])
    return (
        '<w:tbl><w:tblPr><w:tblW w:w="9350" w:type="dxa"/>'
        f"<w:tblBorders>{borders}</w:tblBorders></w:tblPr>"
        f"<w:tblGrid>{grid}</w:tblGrid>{''.join(content)}</w:tbl>"
    )


def build_document(markdown):
    cover, body = markdown.split("## Цель работы", 1)
    parts = [line.strip() for line in cover.splitlines() if line.strip()]
    paragraphs = [paragraph(line, "Cover", "center") for line in parts[1:6]]
    paragraphs.extend([paragraph(), paragraph()])
    paragraphs.append(paragraph(parts[6], "Cover", "center"))
    paragraphs.append(paragraph(parts[0].lstrip("# "), "Title", "center"))
    paragraphs.append(paragraph(parts[7], "Cover", "center"))
    paragraphs.extend([paragraph(), paragraph()])
    paragraphs.extend(paragraph(line, "Cover", "right") for line in parts[8:10])
    paragraphs.extend([paragraph(), paragraph(), paragraph()])
    paragraphs.append(paragraph(parts[10], "Cover", "center"))
    paragraphs.append('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
    lines = ("## Цель работы" + body).splitlines()
    index = 0
    in_code = False
    while index < len(lines):
        line = lines[index]
        index += 1
        if line.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            paragraphs.append(paragraph(line, "Code"))
        elif line.startswith("|"):
            rows = []
            while True:
                cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", cell) for cell in cells):
                    rows.append(cells)
                if index >= len(lines) or not lines[index].startswith("|"):
                    break
                line = lines[index]
                index += 1
            paragraphs.append(table(rows))
        elif line.startswith("### "):
            paragraphs.append(paragraph(line[4:], "Heading2"))
        elif line.startswith("## "):
            paragraphs.append(paragraph(line[3:], "Heading1"))
        elif line.strip():
            paragraphs.append(paragraph(line))
    section = (
        '<w:sectPr><w:footerReference w:type="default" r:id="rId2"/>'
        '<w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" '
        'w:header="567" w:footer="567"/><w:titlePg/></w:sectPr>'
    )
    return f'<w:document xmlns:w="{W}" xmlns:r="{R}"><w:body>{"".join(paragraphs)}{section}</w:body></w:document>'


def build_styles():
    styles = (
        '<w:docDefaults><w:rPrDefault><w:rPr>'
        '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" '
        'w:eastAsia="Times New Roman" w:cs="Times New Roman"/>'
        '<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="ru-RU"/>'
        '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>'
        '<w:spacing w:after="120" w:line="360" w:lineRule="auto"/>'
        '</w:pPr></w:pPrDefault></w:docDefaults>'
    )
    for name in ("Normal", "Title", "Heading1", "Heading2", "Cover", "Code", "TableHeader", "TableText"):
        heading = name in ("Title", "Heading1", "Heading2")
        p_props = '<w:ind w:firstLine="709"/>' if name == "Normal" else '<w:ind w:firstLine="0"/>'
        if heading:
            p_props += '<w:keepNext/><w:spacing w:before="240" w:after="120"/>'
        if name in ("Code", "Cover", "TableText", "TableHeader"):
            p_props += '<w:spacing w:after="0"/>'
        if name.startswith("Heading"):
            p_props += f'<w:outlineLvl w:val="{0 if name == "Heading1" else 1}"/>'
        r_props = '<w:b/>' if heading or name == "TableHeader" else ""
        if heading:
            r_props += '<w:sz w:val="28"/>'
        styles += (
            f'<w:style w:type="paragraph" w:styleId="{name}"><w:name w:val="{name}"/>'
            f"<w:pPr>{p_props}</w:pPr><w:rPr>{r_props}</w:rPr></w:style>"
        )
    return f'<w:styles xmlns:w="{W}">{styles}</w:styles>'


def main():
    content_types = (
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
        '</Types>'
    )
    rel_ns = "http://schemas.openxmlformats.org/package/2006/relationships"
    files = {
        "[Content_Types].xml": content_types,
        "_rels/.rels": f'<Relationships xmlns="{rel_ns}"><Relationship Id="rId1" Type="{R}/officeDocument" Target="word/document.xml"/></Relationships>',
        "word/document.xml": build_document(SOURCE.read_text(encoding="utf-8")),
        "word/styles.xml": build_styles(),
        "word/_rels/document.xml.rels": f'<Relationships xmlns="{rel_ns}"><Relationship Id="rId1" Type="{R}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="{R}/footer" Target="footer1.xml"/></Relationships>',
        "word/footer1.xml": f'<w:ftr xmlns:w="{W}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>',
    }
    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
        for name, xml in files.items():
            archive.writestr(name, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + xml)
    print(OUTPUT)


if __name__ == "__main__":
    main()
