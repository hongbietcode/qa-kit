#!/usr/bin/env python3
"""Read XLSX rows with Python 3's standard library; never extract or evaluate.

Intentionally ignores styles, date display formats, drawings and macros. Values
stay strings, formulas stay provenance, and callers must review diagnostics.
"""
import argparse
import json
import pathlib
import posixpath
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

FILE_LIMIT = 20 * 1024 * 1024
MEMBER_LIMIT = 10 * 1024 * 1024
TOTAL_LIMIT = 50 * 1024 * 1024
MEMBER_COUNT_LIMIT = 1000
CELL_LIMIT = 100_000
ROW_LIMIT = 100_000
COLUMN_LIMIT = 16_384
TEXT_LIMIT = 10 * 1024 * 1024


class InputError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def fail(code, message):
    raise InputError(code, message)


def local(element):
    return element.tag.rsplit("}", 1)[-1]


def children(element, name):
    return [child for child in element if local(child) == name]


def first(element, name):
    return next(iter(children(element, name)), None)


def text_content(element):
    # Phonetic annotations (rPh) are not part of the displayed cell string.
    if element is None:
        return ""
    if local(element) == "t":
        return element.text or ""
    return "".join(text_content(child) for child in element if local(child) != "rPh")


def xml(archive, name):
    try:
        content = archive.read(name)
    except KeyError:
        fail("INVALID_XLSX", f"Workbook is missing required part {name}.")
    # ElementTree expands internal entities; prohibit all DTDs and entities.
    probe = content.replace(b"\x00", b"").upper()
    if b"<!DOCTYPE" in probe or b"<!ENTITY" in probe:
        fail("INVALID_XLSX", f"DTD/entity declarations are not supported in {name}.")
    return ET.fromstring(content)


def target_path(base, target):
    if "\\" in target or ":" in target or "?" in target or "#" in target:
        fail("INVALID_XLSX", "Invalid workbook relationship target.")
    result = posixpath.normpath(target.lstrip("/") if target.startswith("/") else posixpath.join(posixpath.dirname(base), target))
    if result == ".." or result.startswith("../"):
        fail("INVALID_XLSX", "Workbook relationship escapes the archive root.")
    return result


def relationships(archive, name, base):
    result = {}
    for relation in xml(archive, name):
        if local(relation) != "Relationship":
            continue
        identifier = relation.get("Id")
        if not identifier or identifier in result:
            fail("INVALID_XLSX", "Missing or duplicate workbook relationship ID.")
        # Never follow external relationships, including hyperlinks/connections.
        result[identifier] = {
            "type": relation.get("Type", "").rsplit("/", 1)[-1],
            "path": None if relation.get("TargetMode") == "External" else target_path(base, relation.get("Target", "")),
        }
    return result


def column_number(value):
    number = 0
    for letter in value:
        number = number * 26 + ord(letter) - ord("A") + 1
    return number


def sheet_rows(archive, part, shared, number_formats, budget):
    root = xml(archive, part)
    data = first(root, "sheetData")
    if data is None:
        return []
    records = []
    previous_row = 0
    for row in children(data, "row"):
        number = int(row.get("r", str(previous_row + 1)))
        if number <= previous_row or number > 1_048_576:
            fail("INVALID_XLSX", "Invalid, duplicate or out-of-order worksheet row reference.")
        previous_row = number
        budget["rows"] += 1
        if budget["rows"] > ROW_LIMIT:
            fail("RESOURCE_LIMIT", "Workbook exceeds the 100,000-row limit.")
        values = {}
        formulas = []
        cells = []
        warnings = []
        previous_column = 0
        for cell in children(row, "c"):
            budget["cells"] += 1
            if budget["cells"] > CELL_LIMIT:
                fail("RESOURCE_LIMIT", "Workbook exceeds the 100,000-cell limit.")
            reference = cell.get("r")
            if reference:
                match = re.fullmatch(r"([A-Z]{1,3})([1-9][0-9]{0,6})", reference)
                if not match or int(match[2]) != number:
                    fail("INVALID_XLSX", "Invalid worksheet cell reference.")
                column = column_number(match[1])
            else:
                column = previous_column + 1
                reference = f"column {column}, row {number}"
            if column <= previous_column or column > COLUMN_LIMIT:
                fail("INVALID_XLSX", "Invalid, duplicate or out-of-order worksheet column reference.")
            previous_column = column
            value_node = first(cell, "v")
            raw_value = value_node.text or "" if value_node is not None else ""
            cell_type = cell.get("t", "n")
            style = cell.get("s")
            cells.append({"cell": reference, "type": cell_type, "rawValue": raw_value if cell_type != "inlineStr" else text_content(first(cell, "is")), **({"style": style} if style is not None else {})})
            formula = first(cell, "f")
            if formula is not None:
                formulas.append({"cell": reference, "expression": formula.text or "", "cachedValue": raw_value, "attributes": formula.attrib})
                value = ""
            elif cell_type == "e":
                warnings.append({"code": "XLSX_CELL_ERROR", "message": f"Spreadsheet error {raw_value} in {reference}; raw value retained but not used as case content."})
                value = ""
            elif cell_type == "s":
                if not re.fullmatch(r"[0-9]+", raw_value) or int(raw_value) >= len(shared):
                    fail("INVALID_XLSX", f"Invalid shared string index in {reference}.")
                value = shared[int(raw_value)]
            elif cell_type == "inlineStr":
                value = text_content(first(cell, "is"))
            else:
                value = raw_value
            if cell_type == "n" and value and style is not None and number_formats.get(style) != "0":
                warnings.append({"code": "XLSX_FORMATTED_VALUE", "message": f"Numeric cell {reference} uses display style {style}; raw stored value retained. Confirm formatted IDs, dates and numbers against the source."})
            values[column] = value
            budget["text"] += len(value.encode("utf-8")) + len(raw_value.encode("utf-8"))
            if budget["text"] > TEXT_LIMIT:
                fail("RESOURCE_LIMIT", "Workbook cell text exceeds the 10 MiB limit.")
        if any(value.strip() for value in values.values()) or formulas or warnings:
            width = max(values, default=0)
            budget["expanded"] += width
            if budget["expanded"] > 1_000_000:
                fail("RESOURCE_LIMIT", "Sparse workbook expansion exceeds 1,000,000 cells.")
            records.append({"row": number, "values": [values.get(i, "") for i in range(1, width + 1)], "formulas": formulas, "cells": cells, "warnings": warnings})
    return records


def read_workbook(filename, requested):
    path = pathlib.Path(filename)
    if not path.is_file():
        fail("READ_ERROR", "Input must be a regular XLSX file.")
    if path.stat().st_size > FILE_LIMIT:
        fail("RESOURCE_LIMIT", "XLSX input exceeds the 20 MiB file limit.")
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        if len(members) > MEMBER_COUNT_LIMIT or sum(info.file_size for info in members) > TOTAL_LIMIT:
            fail("RESOURCE_LIMIT", "XLSX exceeds 1,000 archive members or 50 MiB uncompressed content.")
        names = set()
        for info in members:
            if info.file_size > MEMBER_LIMIT:
                fail("RESOURCE_LIMIT", f"Archive member {info.filename} exceeds the 10 MiB uncompressed limit.")
            if info.flag_bits & 1:
                fail("INVALID_XLSX", "Encrypted XLSX archives are not supported; export a plain worksheet as CSV.")
            if info.filename in names:
                fail("INVALID_XLSX", "Duplicate archive member names are not supported.")
            names.add(info.filename)
        roots = relationships(archive, "_rels/.rels", "")
        books = [relation["path"] for relation in roots.values() if relation["type"] == "officeDocument" and relation["path"]]
        if len(books) != 1:
            fail("INVALID_XLSX", "Workbook must contain one internal officeDocument relationship.")
        book_path = books[0]
        book = xml(archive, book_path)
        rel_path = posixpath.join(posixpath.dirname(book_path), "_rels", posixpath.basename(book_path) + ".rels")
        relations = relationships(archive, rel_path, book_path)
        strings = [relation["path"] for relation in relations.values() if relation["type"] == "sharedStrings" and relation["path"]]
        if len(strings) > 1:
            fail("INVALID_XLSX", "Workbook contains multiple shared string tables.")
        shared = [text_content(value) for value in xml(archive, strings[0]) if local(value) == "si"] if strings else []
        styles = [relation["path"] for relation in relations.values() if relation["type"] == "styles" and relation["path"]]
        if len(styles) > 1:
            fail("INVALID_XLSX", "Workbook contains multiple style tables.")
        number_formats = {}
        if styles:
            cell_formats = first(xml(archive, styles[0]), "cellXfs")
            if cell_formats is not None:
                number_formats = {str(index): item.get("numFmtId", "0") for index, item in enumerate(children(cell_formats, "xf"))}
        sheets_node = first(book, "sheets")
        if sheets_node is None:
            fail("INVALID_XLSX", "Workbook has no worksheet list.")
        sheets = []
        for sheet in children(sheets_node, "sheet"):
            identifier = next((value for key, value in sheet.attrib.items() if key.rsplit("}", 1)[-1] == "id"), None)
            relation = relations.get(identifier)
            if not relation or not relation["path"]:
                fail("INVALID_XLSX", "Missing or external worksheet relationship.")
            # Chartsheets do not hold manual cases.
            if relation["type"] != "worksheet":
                continue
            name = sheet.get("name", "")
            if not name or name in [item["name"] for item in sheets]:
                fail("INVALID_XLSX", "Missing or duplicate worksheet name.")
            sheets.append({"name": name, "path": relation["path"]})
        names = [sheet["name"] for sheet in sheets]
        if requested is not None and requested not in names:
            fail("UNKNOWN_SHEET", f"Unknown worksheet {requested!r}. Available worksheets: {', '.join(names) or '(none)'}. Supply --sheet with an exact name.")
        budget = {"rows": 0, "cells": 0, "text": 0, "expanded": 0}
        candidates = []
        for sheet in sheets:
            if requested is None or sheet["name"] == requested:
                records = sheet_rows(archive, sheet["path"], shared, number_formats, budget)
                if records or requested is not None:
                    candidates.append({"sheet": sheet["name"], "rows": records})
        if len(candidates) > 1:
            fail("AMBIGUOUS_SHEET", f"Several non-empty worksheets: {', '.join(item['sheet'] for item in candidates)}. Select one using --sheet <name>.")
        return {**(candidates[0] if candidates else {"rows": []}), "sheets": names}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file")
    parser.add_argument("--sheet")
    args = parser.parse_args()
    try:
        print(json.dumps(read_workbook(args.file, args.sheet), ensure_ascii=False))
    except InputError as error:
        print(json.dumps({"code": error.code, "message": str(error)}), file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, ET.ParseError, zipfile.BadZipFile, RuntimeError, NotImplementedError) as error:
        print(json.dumps({"code": "INVALID_XLSX", "message": f"Cannot read XLSX workbook: {error}"}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
