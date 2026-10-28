"""Курсовая: собрать пояснительную записку DOCX с диаграммами, без скриншотов."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape
import re
import runpy
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "otchet/coursework.md"
OUTPUT = ROOT / "otchet/РИЗ-250213у-Романов-Сергей-Курсовая.docx"
helpers = runpy.run_path(str(ROOT / "scripts/lab7-report.py"))
paragraph, table = helpers["paragraph"], helpers["table"]
W, R = helpers["W"], helpers["R"]


def picture(path, number):
    data = path.read_bytes()
    width, height = struct.unpack(">II", data[16:24])
    cx = 5800000
    cy = round(cx * height / width)
    return f'''<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing>
<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/>
<wp:docPr id="{number}" name="Figure {number}"/>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic><pic:nvPicPr><pic:cNvPr id="{number}" name="{escape(path.name)}"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rId{number + 10}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'''


def document(markdown):
    cover, body = markdown.split("## СОДЕРЖАНИЕ", 1)
    parts = [line.strip() for line in cover.splitlines() if line.strip()]
    content = [paragraph(line, "Cover", "center") for line in parts[1:6]]
    content += [paragraph(), paragraph(parts[6], "Cover", "center"), paragraph(parts[0].lstrip("# "), "Title", "center"), paragraph(parts[7], "Cover", "center"), paragraph(), paragraph()]
    content += [paragraph(line, "Cover", "right") for line in parts[8:10]]
    content += [paragraph(), paragraph(), paragraph(parts[10], "Cover", "center"), '<w:p><w:r><w:br w:type="page"/></w:r></w:p>']
    lines = ("## СОДЕРЖАНИЕ" + body).splitlines()
    images = []
    code = False
    index = 0
    while index < len(lines):
        line = lines[index]
        index += 1
        if line.startswith("```"):
            code = not code
        elif code:
            content.append(paragraph(line, "Code"))
        elif line == "[АВТОСОДЕРЖАНИЕ]":
            content.append('<w:p><w:fldSimple w:instr="TOC &amp;quot;unused&amp;quot;"><w:r><w:t>Содержание</w:t></w:r></w:fldSimple></w:p>'.replace('TOC &amp;quot;unused&amp;quot;', 'TOC \\o &quot;1-2&quot; \\h \\z \\u'))
        elif line.startswith("!["):
            match = re.fullmatch(r"!\[(.*?)\]\((.*?)\)", line)
            if not match:
                raise ValueError("Некорректная ссылка на диаграмму")
            path = SOURCE.parent / match[2]
            number = len(images) + 1
            images.append(path)
            content.append(picture(path, number))
            content.append(paragraph(match[1], "Cover", "center"))
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
            content.append(table(rows))
        elif line.startswith("### "):
            content.append(paragraph(line[4:], "Heading2"))
        elif line.startswith("## "):
            content.append(paragraph(line[3:], "Heading1"))
        elif line.strip():
            content.append(paragraph(line))
    content.append('<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="567" w:footer="567"/><w:titlePg/></w:sectPr>')
    namespaces = f'xmlns:w="{W}" xmlns:r="{R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'
    return f'<w:document {namespaces}><w:body>{"".join(content)}</w:body></w:document>', images


def main():
    doc, images = document(SOURCE.read_text(encoding="utf-8"))
    rel_ns = "http://schemas.openxmlformats.org/package/2006/relationships"
    types_ns = "http://schemas.openxmlformats.org/package/2006/content-types"
    types = [f'<Types xmlns="{types_ns}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>']
    for name, suffix in [("document", "document.main"), ("styles", "styles"), ("settings", "settings"), ("footer1", "footer")]:
        types.append(f'<Override PartName="/word/{name}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.{suffix}+xml"/>')
    types.append('</Types>')
    relations = [f'<Relationships xmlns="{rel_ns}"><Relationship Id="rId1" Type="{R}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="{R}/footer" Target="footer1.xml"/><Relationship Id="rId3" Type="{R}/settings" Target="settings.xml"/>']
    for index, path in enumerate(images, 1):
        relations.append(f'<Relationship Id="rId{index + 10}" Type="{R}/image" Target="media/{path.name}"/>')
    relations.append('</Relationships>')
    files = {
        '[Content_Types].xml': ''.join(types),
        '_rels/.rels': f'<Relationships xmlns="{rel_ns}"><Relationship Id="rId1" Type="{R}/officeDocument" Target="word/document.xml"/></Relationships>',
        'word/document.xml': doc,
        'word/styles.xml': helpers['build_styles'](),
        'word/settings.xml': f'<w:settings xmlns:w="{W}"><w:updateFields w:val="true"/></w:settings>',
        'word/_rels/document.xml.rels': ''.join(relations),
        'word/footer1.xml': f'<w:ftr xmlns:w="{W}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>',
    }
    with ZipFile(OUTPUT, 'w', ZIP_DEFLATED) as archive:
        for name, xml in files.items():
            archive.writestr(name, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + xml)
        for path in images:
            archive.write(path, 'word/media/' + path.name)
    print(OUTPUT)


if __name__ == '__main__':
    main()
