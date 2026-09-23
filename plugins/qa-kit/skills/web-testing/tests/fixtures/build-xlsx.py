"""Create real, small OOXML archives for parser integration tests (stdlib only)."""
import json
import pathlib
import sys
import zipfile
from xml.sax.saxutils import escape, quoteattr

MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG = "http://schemas.openxmlformats.org/package/2006/relationships"


def workbook(path, sheets, shared=(), extra=None):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        sheet_nodes = []
        relationships = []
        for i, (name, rows) in enumerate(sheets, 1):
            sheet_nodes.append(f'<sheet name={quoteattr(name)} sheetId="{i}" r:id="rId{i}"/>')
            relationships.append(f'<Relationship Id="rId{i}" Type="{REL}/worksheet" Target="worksheets/sheet{i}.xml"/>')
            archive.writestr(f"xl/worksheets/sheet{i}.xml", f'<worksheet xmlns="{MAIN}"><sheetData>{rows}</sheetData></worksheet>')
        if shared:
            relationships.append(f'<Relationship Id="strings" Type="{REL}/sharedStrings" Target="sharedStrings.xml"/>')
            archive.writestr("xl/sharedStrings.xml", f'<sst xmlns="{MAIN}">' + "".join(f"<si>{value}</si>" for value in shared) + "</sst>")
        archive.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        archive.writestr("_rels/.rels", f'<Relationships xmlns="{PKG}"><Relationship Id="book" Type="{REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        archive.writestr("xl/workbook.xml", f'<workbook xmlns="{MAIN}" xmlns:r="{REL}"><sheets>{"".join(sheet_nodes)}</sheets></workbook>')
        archive.writestr("xl/_rels/workbook.xml.rels", f'<Relationships xmlns="{PKG}">{"".join(relationships)}</Relationships>')
        for name, data in (extra or {}).items():
            archive.writestr(name, data)


def row(number, cells):
    values = []
    for column, value in cells:
        if isinstance(value, dict):
            if "shared" in value:
                values.append(f'<c r="{column}{number}" t="s"><v>{value["shared"]}</v></c>')
            elif "raw" in value:
                style = f' s="{value["style"]}"' if "style" in value else ""
                values.append(f'<c r="{column}{number}" t="{value.get("type", "n")}"{style}><v>{escape(value["raw"])}</v></c>')
            else:
                values.append(f'<c r="{column}{number}"><f>{escape(value["formula"])}</f><v>{escape(value.get("cached", ""))}</v></c>')
        else:
            values.append(f'<c r="{column}{number}" t="inlineStr"><is><t xml:space="preserve">{escape(value)}</t></is></c>')
    return f'<row r="{number}">{"".join(values)}</row>'


out = pathlib.Path(sys.argv[1])
headers = row(3, [("A", "ID"), ("B", "Title"), ("D", "Steps"), ("F", "Expected Result"), ("H", "Owner")])
case = row(7, [("A", "TC-X1"), ("B", {"shared": 0}), ("D", "1. Open page\n2. Submit"), ("F", "Dashboard visible"), ("H", "Linh")])
shared = ['<r><t>Sign </t></r><r><t>in</t></r>']
workbook(out / "single.xlsx", [("Empty", row(1, [("A", "")])), ("Login", headers + case)], shared)
workbook(out / "multiple.xlsx", [("Login", headers + case), ("Checkout", headers + case)], shared)
formula = row(8, [("A", "TC-X2"), ("B", "Formula result"), ("D", "Submit"), ("F", {"formula": 'HYPERLINK("https://example.test", "expected")', "cached": "cached result"})])
workbook(out / "formula.xlsx", [("Formulas", headers + formula)])
workbook(out / "formula-only.xlsx", [("Empty", ""), ("Calculated", row(1, [("A", {"formula": "1+1"})]))])
workbook(out / "empty.xlsx", [("Empty", "")])
workbook(out / "oversized-member.xlsx", [("Login", headers + case)], shared, {"padding.xml": "x" * (11 * 1024 * 1024)})
workbook(out / "hostile-xml.xlsx", [("Login", '<!DOCTYPE x [<!ENTITY a "abc">]><x>&a;</x>')])
workbook(out / "bad-shared.xlsx", [("Login", headers + row(7, [("A", {"shared": 99})]))])
workbook(out / "bad-reference.xlsx", [("Login", '<row r="1"><c r="ZZZZ999999999" t="inlineStr"><is><t>x</t></is></c></row>')])
styled = row(4, [("A", {"raw": "7", "style": 1}), ("B", "Formatted numeric ID"), ("D", "Open page"), ("F", "Form visible")])
workbook(out / "styled.xlsx", [("Login", headers + styled)])
cell_error = row(4, [("A", "TC-E1"), ("B", "Error expectation"), ("D", "Open page"), ("F", {"raw": "#VALUE!", "type": "e"})])
workbook(out / "cell-error.xlsx", [("Login", headers + cell_error)])
print(json.dumps({"fixtures": str(out)}))
