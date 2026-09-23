#!/usr/bin/env node
/** Dependency-free manual case ingestion. Source content is data, never code. */
import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT_LIMIT = 10 * 1024 * 1024;
const XLSX_LIMIT = 20 * 1024 * 1024;
const HELP = `Usage:
  node parse-manual-tests.mjs <file> [--sheet <name>]
  node parse-manual-tests.mjs --text <literal text> [--format markdown|csv|text]
  node parse-manual-tests.mjs --stdin --format markdown|csv|text

Formats: .md/.markdown, .csv, .xlsx, .txt. Unknown extensions are retained
as unstructured text. --format overrides text file detection. XLSX requires
Python 3 on PATH; no Python packages are installed. --sheet is XLSX-only.
Use -- before a filename beginning with '-'. --help prints this message.

JSON goes to stdout (exit 0). Fatal input/options errors go to stderr as JSON
(exit 1). Diagnostics may block cases even when parsing succeeds. No browser
actions, formula execution, or generated test files. Text limit: 10 MiB.
`;

class InputError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new InputError(code, message); };
const diagnostic = (code, message, extra = {}, severity = 'warning') => ({ code, severity, message, ...extra });
const normalized = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[*_`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const aliases = new Map();
for (const [field, names] of Object.entries({
  id: ['id', 'test case id', 'case id', 'test id', 'tc id', 'mã tc', 'mã test case', 'mã kiểm thử'],
  title: ['title', 'test case', 'test case title', 'case title', 'name', 'summary', 'tiêu đề', 'tên test case'],
  preconditions: ['preconditions', 'precondition', 'prerequisites', 'điều kiện tiên quyết', 'điều kiện trước', 'tiền điều kiện'],
  steps: ['steps', 'step', 'test steps', 'step description', 'action', 'actions', 'các bước', 'bước thực hiện', 'các bước thực hiện'],
  data: ['test data', 'data', 'input', 'inputs', 'dữ liệu', 'dữ liệu kiểm thử'],
  expectedResults: ['expected result', 'expected results', 'expected', 'expected outcome', 'expected step result', 'step expected', 'kết quả mong đợi', 'kết quả kỳ vọng'],
  priority: ['priority', 'ưu tiên', 'độ ưu tiên', 'mức độ ưu tiên'],
  tags: ['tags', 'labels', 'nhãn'],
})) for (const name of names) aliases.set(normalized(name), field);
const fieldFor = header => aliases.get(normalized(header));

function options(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) return { help: true };
  const result = {};
  const files = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--') { files.push(...args.slice(index + 1)); break; }
    if (arg === '--stdin') {
      if (result.stdin) fail('INVALID_OPTIONS', '--stdin was supplied more than once.');
      result.stdin = true;
    } else if (['--text', '--format', '--sheet'].includes(arg)) {
      const key = arg.slice(2);
      if (key in result || index + 1 >= args.length) fail('INVALID_OPTIONS', `Supply one value for ${arg}.`);
      result[key] = args[++index];
    } else if (arg.startsWith('-')) fail('INVALID_OPTIONS', `Unknown option ${arg}. Use --help for syntax.`);
    else files.push(arg);
  }
  if (files.length > 1 || files.length + Number('text' in result) + Number(Boolean(result.stdin)) !== 1) {
    fail('INVALID_OPTIONS', 'Choose exactly one file, --text <text>, or --stdin --format <format>.');
  }
  if (result.format && !['markdown', 'csv', 'text'].includes(result.format)) fail('INVALID_OPTIONS', '--format must be markdown, csv, or text. XLSX requires a file.');
  if (result.stdin && !result.format) fail('INVALID_OPTIONS', '--stdin requires --format markdown|csv|text.');
  if ('format' in result && !result.format) fail('INVALID_OPTIONS', '--format cannot be empty.');
  result.file = files[0];
  const extension = result.file ? extname(result.file).toLowerCase() : '';
  result.kind = result.format || ({ '.md': 'markdown', '.markdown': 'markdown', '.csv': 'csv', '.txt': 'text', '.xlsx': 'xlsx' }[extension]) || (result.file ? 'unknown' : 'text');
  if (extension === '.xlsx' && result.format) fail('INVALID_OPTIONS', 'An XLSX file cannot be decoded using a text --format.');
  if ('sheet' in result && (result.kind !== 'xlsx' || !result.sheet.trim())) fail('INVALID_OPTIONS', '--sheet requires an XLSX file and a non-empty worksheet name.');
  return result;
}

function readText(opts) {
  try {
    if (opts.file) {
      const info = statSync(opts.file);
      if (!info.isFile()) fail('READ_ERROR', 'Input must be a regular file.');
      if (info.size > TEXT_LIMIT) fail('RESOURCE_LIMIT', 'Text input exceeds the 10 MiB limit.');
    }
    const buffer = 'text' in opts ? Buffer.from(opts.text, 'utf8') : readFileSync(opts.stdin ? 0 : opts.file);
    if (buffer.length > TEXT_LIMIT) fail('RESOURCE_LIMIT', 'Text input exceeds the 10 MiB limit.');
    // Reject invalid UTF-8 instead of silently substituting characters in source data.
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
  } catch (error) {
    if (error instanceof InputError) throw error;
    fail('READ_ERROR', `Cannot read UTF-8 input: ${error.message}`);
  }
}

function readWorkbook(opts) {
  try {
    const info = statSync(opts.file);
    if (!info.isFile()) fail('READ_ERROR', 'Input must be a regular XLSX file.');
    if (info.size > XLSX_LIMIT) fail('RESOURCE_LIMIT', 'XLSX input exceeds the 20 MiB file limit.');
  } catch (error) {
    if (error instanceof InputError) throw error;
    fail('READ_ERROR', `Cannot read XLSX input: ${error.message}`);
  }
  const helper = fileURLToPath(new URL('./read-xlsx.py', import.meta.url));
  const args = [helper, resolve(opts.file)];
  if (opts.sheet) args.push('--sheet', opts.sheet);
  const child = spawnSync('python3', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 30_000, windowsHide: true });
  if (child.error) {
    if (child.error.code === 'ENOENT') fail('PYTHON_REQUIRED', 'XLSX input requires Python 3: install Python 3 and make python3 available on PATH, or export the worksheet as CSV.');
    fail('RESOURCE_LIMIT', `XLSX reader could not finish within its time/output limits: ${child.error.message}`);
  }
  let result;
  try { result = JSON.parse(child.status === 0 ? child.stdout : child.stderr); }
  catch { fail('INVALID_XLSX', 'XLSX reader returned invalid output. Check that python3 is Python 3 and the workbook is valid.'); }
  if (child.status !== 0) fail(result.code || 'INVALID_XLSX', result.message || 'Cannot read workbook.');
  return result;
}

function parseCsv(text) {
  const records = [];
  const input = text.replace(/^\uFEFF/, '');
  let values = [], value = '', state = 'start', line = 1, row = 1, start = 0;
  const emit = end => {
    values.push(value);
    if (values.some(item => item.trim())) records.push({ values, row, raw: input.slice(start, end) });
    values = []; value = ''; state = 'start';
  };
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (state === 'quoted') {
      if (char === '"') {
        if (input[index + 1] === '"') { value += '"'; index++; } else state = 'closed';
      } else {
        value += char;
        if (char === '\n' || (char === '\r' && input[index + 1] !== '\n')) line++;
      }
      continue;
    }
    if (char === ',') { values.push(value); value = ''; state = 'start'; continue; }
    if (char === '\r' || char === '\n') {
      emit(index);
      if (char === '\r' && input[index + 1] === '\n') index++;
      line++; row = line; start = index + 1;
      continue;
    }
    if (state === 'closed') fail('MALFORMED_CSV', `Unexpected character after a closing quote at line ${line}.`);
    if (char === '"') {
      if (state !== 'start') fail('MALFORMED_CSV', `Quote inside an unquoted field at line ${line}.`);
      state = 'quoted';
    } else { value += char; state = 'unquoted'; }
  }
  if (state === 'quoted') fail('MALFORMED_CSV', `Unterminated quoted field beginning in record at line ${row}.`);
  if (start < input.length) emit(input.length);
  return records;
}

function parts(value) {
  return String(value || '').split(/<br\s*\/?\s*>|\r\n|\n|\r/i).map(item => item.trim().replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, '')).filter(Boolean);
}
function blankCase(source) {
  return { id: '', title: '', source, preconditions: [], steps: [], data: [], expectedResults: [], priority: '', tags: [], automationStatus: 'Blocked', automationReason: 'Pending live application exploration and automation suitability review.', discovered: false, metadata: {} };
}

function assign(item, field, value) {
  if (field === 'steps') item.steps = parts(value).map(action => ({ action }));
  else if (['preconditions', 'data', 'expectedResults'].includes(field)) item[field] = parts(value);
  else if (field === 'tags') item.tags = String(value).split(/[,;\n]/).map(tag => tag.trim()).filter(Boolean);
  else item[field] = String(value).trim();
}

function fromRows(records, source, diagnostics) {
  if (!records.length) return [];
  const headers = records[0].values;
  const recognized = headers.some(fieldFor);
  if (!recognized) diagnostics.push(diagnostic('UNRECOGNIZED_HEADERS', 'No recognized test-case columns. Review raw headers and row values.', { row: records[0].row }));
  // Even a header-only formula is visible to reviewers.
  for (const formula of records[0].formulas || []) diagnostics.push(diagnostic('XLSX_FORMULA', `Formula in header cell ${formula.cell} was preserved, not evaluated.`, { row: records[0].row }));
  for (const warning of records[0].warnings || []) diagnostics.push(diagnostic(warning.code, warning.message, { row: records[0].row }));
  return records.slice(1).map(record => {
    const item = blankCase({ ...source, row: record.row, headers, values: record.values, raw: record.raw ?? record.values, ...(record.formulas?.length ? { formulas: record.formulas } : {}), ...(record.cells ? { cells: record.cells, headerCells: records[0].cells } : {}) });
    item.metadata.unknownColumns = [];
    const assigned = new Map();
    if (record.values.length !== headers.length) diagnostics.push(diagnostic('ROW_WIDTH_MISMATCH', 'Row width differs from the header; all values were retained.', { row: record.row }));
    for (let column = 0; column < Math.max(headers.length, record.values.length); column++) {
      const header = headers[column] || '';
      const value = record.values[column] || '';
      const field = fieldFor(header);
      if (!field) {
        if (header || value) item.metadata.unknownColumns.push({ header, value, column: column + 1 });
      } else if (assigned.get(field)?.trim() && value.trim() && assigned.get(field) !== value) {
        diagnostics.push(diagnostic('CONFLICTING_FIELD', `Several columns supply conflicting ${field} values; review source.values.`, { row: record.row }));
      } else if (!assigned.has(field) || value.trim()) {
        assign(item, field, value);
        assigned.set(field, value);
      }
    }
    for (const formula of record.formulas || []) diagnostics.push(diagnostic('XLSX_FORMULA', `Formula in ${formula.cell} was preserved, not evaluated; review its intended value.`, { row: record.row }));
    for (const warning of record.warnings || []) diagnostics.push(diagnostic(warning.code, warning.message, { row: record.row }));
    return item;
  });
}

function markdownCells(line) {
  let input = line.trim();
  if (input.startsWith('|')) input = input.slice(1);
  if (/(?<!\\)\|$/.test(input)) input = input.slice(0, -1);
  const cells = [];
  let cell = '';
  for (let index = 0; index < input.length; index++) {
    if (input[index] === '\\' && input[index + 1] === '|') { cell += '|'; index++; }
    else if (input[index] === '|') { cells.push(cell.trim()); cell = ''; }
    else cell += input[index];
  }
  cells.push(cell.trim());
  return cells;
}

function tablesIn(lines) {
  const tables = [];
  let fence = null;
  for (let index = 0; index < lines.length - 1; index++) {
    const marker = lines[index].match(/^\s*(`{3,}|~{3,})/);
    if (marker) { if (!fence) fence = marker[1][0]; else if (marker[1][0] === fence) fence = null; continue; }
    if (fence || !lines[index].includes('|')) continue;
    const separator = markdownCells(lines[index + 1]);
    const headers = markdownCells(lines[index]);
    if (separator.length !== headers.length || !separator.every(cell => /^:?-{3,}:?$/.test(cell))) continue;
    let end = index + 2;
    const records = [{ row: index + 1, values: headers, raw: lines[index] }];
    while (end < lines.length && lines[end].trim() && lines[end].includes('|')) {
      records.push({ row: end + 1, values: markdownCells(lines[end]), raw: lines[end] });
      end++;
    }
    tables.push({ start: index, end, records, headers });
    index = end - 1;
  }
  return tables;
}

function headingIdentity(text) {
  const value = text.replace(/^\s*#{1,6}\s+/, '').trim().replace(/\s+#+$/, '');
  const matched = value.match(/^([\p{L}\p{N}_.-]*\d[\p{L}\p{N}_.-]*)\s*(?::|：|\s[-–—]\s)\s*(.*)$/u);
  if (matched) return { id: matched[1], title: matched[2] };
  if (/^(?:TC|TEST|CASE)[-_]?\d[\w.-]*$/i.test(value)) return { id: value, title: '' };
  return null;
}

function labelOf(line) {
  const clean = line.trim().replace(/^[-*+]\s+/, '').replace(/^#{1,6}\s+/, '');
  // Accept **Label:** value, **Label**: value and plain Label: value.
  const match = clean.match(/^(?:\*\*|__)?([^:：]+?)(?:\*\*|__)?\s*[:：](?:\*\*|__)?\s*(.*)$/);
  if (match) return { label: match[1].replace(/(?:\*\*|__)$/, '').trim(), value: match[2] };
  if (/^#{1,6}\s+/.test(line) && fieldFor(clean)) return { label: clean, value: '' };
  return null;
}

function fromBlock(lines, offset, source, diagnostics, tableList) {
  const item = blankCase({ ...source, row: offset + 1, raw: lines.join('\n') });
  const firstIdentity = headingIdentity(lines[0] || '');
  if (firstIdentity) Object.assign(item, firstIdentity);
  else if (/^\s*#{1,6}\s+/.test(lines[0] || '')) item.title = lines[0].replace(/^\s*#{1,6}\s+/, '').trim();
  const fields = [];
  let active;
  let fence;
  let structured = Boolean(firstIdentity);
  const stepTables = new Map(tableList.filter(table => table.start >= offset && table.end <= offset + lines.length).map(table => [table.start - offset, table]));
  for (let index = firstIdentity ? 1 : 0; index < lines.length; index++) {
    const marker = lines[index].match(/^\s*(`{3,}|~{3,})/);
    if (marker || fence) {
      if (marker && !fence) fence = marker[1];
      else if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
      if (active) active.values.push(lines[index]);
      continue;
    }
    const table = stepTables.get(index);
    if (table && table.headers.some(header => fieldFor(header) === 'steps')) {
      structured = true;
      const actionColumn = table.headers.findIndex(header => ['action', 'actions', 'step description'].includes(normalized(header)));
      const stepColumn = actionColumn >= 0 ? actionColumn : table.headers.findIndex(header => fieldFor(header) === 'steps');
      const dataColumn = table.headers.findIndex(header => fieldFor(header) === 'data');
      const expectedColumn = table.headers.findIndex(header => fieldFor(header) === 'expectedResults');
      for (const record of table.records.slice(1)) {
        const action = record.values[stepColumn]?.trim() || '';
        const data = record.values[dataColumn]?.trim();
        const expected = record.values[expectedColumn]?.trim();
        item.steps.push({ action, ...(data ? { data } : {}), ...(expected ? { expected } : {}) });
      }
      item.source.stepTables ||= [];
      item.source.stepTables.push({ headers: table.headers, rows: table.records.slice(1) });
      index = table.end - offset - 1;
      active = undefined;
      continue;
    }
    const label = active && /^\s+\S/.test(lines[index]) ? null : labelOf(lines[index]);
    const unknownLabel = label && !fieldFor(label.label);
    const contentField = active && ['steps', 'data', 'preconditions', 'expectedResults'].includes(active.field);
    const nestedContent = contentField && unknownLabel && (active.field === 'data' || /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(lines[index]));
    if (contentField && unknownLabel && !nestedContent) diagnostics.push(diagnostic('AMBIGUOUS_FIELD', `Unrecognized label ${label.label} after ${active.label}; preserved in metadata instead of assuming it is an action or outcome.`, { row: item.source.row }));
    if (label && !nestedContent && (fieldFor(label.label) || /^[\p{L}][\p{L}\p{N} _-]{0,60}$/u.test(label.label))) {
      active = { ...label, field: fieldFor(label.label), values: [label.value] };
      fields.push(active);
      if (active.field) structured = true;
    } else if (active) active.values.push(lines[index]);
  }
  item.metadata.fields = Object.create(null);
  const applied = new Map();
  for (const field of fields) {
    const value = field.values.join('\n').trim();
    if (Object.hasOwn(item.metadata.fields, field.label)) {
      item.metadata.fields[field.label] = [].concat(item.metadata.fields[field.label], value);
    } else item.metadata.fields[field.label] = value;
    if (!field.field) continue;
    if ((applied.has(field.field) && applied.get(field.field) !== value) || (['id', 'title'].includes(field.field) && item[field.field] && item[field.field] !== value)) {
      diagnostics.push(diagnostic('CONFLICTING_FIELD', `Conflicting ${field.field} values in a case block; review raw source.`, { row: item.source.row }));
      continue;
    }
    if (field.field === 'steps' && item.steps.length) item.steps.unshift(...parts(value).map(action => ({ action })));
    else assign(item, field.field, value);
    applied.set(field.field, value);
  }
  if (!structured) {
    // A free-text title is a label only, never an inferred action or assertion.
    item.title ||= lines.find(line => line.trim())?.trim() || '';
    diagnostics.push(diagnostic('UNSTRUCTURED_INPUT', 'Input has no recognized structured case fields; preserve and clarify its intent.', { row: item.source.row }));
  }
  return item;
}

function parseText(text, source, diagnostics, unknown = false) {
  if (!text.trim()) return [];
  if (unknown) {
    diagnostics.push(diagnostic('UNKNOWN_FORMAT', 'Unknown file extension; retained as unstructured text. Use --format only when its format is known.', { row: 1 }));
    const item = blankCase({ ...source, row: 1, raw: text });
    item.title = text.split(/\r?\n/).find(line => line.trim())?.trim() || '';
    return [item];
  }
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  const tables = tablesIn(lines);
  const caseTables = tables.filter(table => table.headers.some(header => ['id', 'title'].includes(fieldFor(header))));
  const excluded = new Set(caseTables.flatMap(table => Array.from({ length: table.end - table.start }, (_, i) => i + table.start)));
  const cases = caseTables.flatMap(table => fromRows(table.records, source, diagnostics));
  let start = -1;
  let meaningful = false;
  let currentId;
  let explicitId = false;
  let fence;
  const flush = end => {
    if (start < 0) return;
    let last = end;
    while (last > start && !lines[last - 1].trim()) last--;
    const chunk = lines.slice(start, last);
    const prose = chunk.some(line => line.trim() && !/^\s*#{1,6}\s+/.test(line));
    if (last > start && (meaningful || prose)) cases.push(fromBlock(chunk, start, source, diagnostics, tables));
    start = -1; meaningful = false; currentId = undefined; explicitId = false;
  };
  for (let index = 0; index < lines.length; index++) {
    if (excluded.has(index)) { flush(index); continue; }
    const line = lines[index];
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker || fence) {
      if (start < 0) start = index;
      if (marker && !fence) fence = marker[1];
      else if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
      continue;
    }
    const identity = (/^\s*#/.test(line) || /^(?:TC|TEST|CASE)[-_]?\d/i.test(line) || start < 0) ? headingIdentity(line) : null;
    const heading = /^\s*#{2,6}\s+/.test(line) && !fieldFor(line.replace(/^\s*#{1,6}\s+/, ''));
    const label = /^\s+\S/.test(line) ? null : labelOf(line);
    const idLabel = label && fieldFor(label.label) === 'id';
    if (identity || heading || (idLabel && (explicitId || (currentId && currentId !== label.value.trim())))) flush(index);
    if (start < 0 && line.trim()) start = index;
    if (identity || (label && fieldFor(label.label)) || (heading && start === index)) meaningful = true;
    if (identity) currentId = identity.id;
    if (idLabel) { currentId = label.value.trim(); explicitId = true; }
  }
  flush(lines.length);
  if (!cases.length) cases.push(fromBlock(lines, 0, source, diagnostics, tables));
  return cases.sort((left, right) => left.source.row - right.source.row);
}

function validate(cases, diagnostics) {
  const reserved = new Set(cases.map(item => item.id).filter(Boolean));
  let nextId = 1;
  for (const item of cases) {
    if (!item.id) {
      while (reserved.has(`LOCAL-${String(nextId).padStart(3, '0')}`)) nextId++;
      item.id = `LOCAL-${String(nextId++).padStart(3, '0')}`;
      reserved.add(item.id);
      diagnostics.push(diagnostic('MISSING_ID', 'Source has no ID; assigned a local ID. Confirm a durable ID before automation.', { caseId: item.id, row: item.source.row }));
    }
    const required = [['title', 'MISSING_TITLE'], ['steps', 'MISSING_STEPS']];
    for (const [field, code] of required) {
      if (!item[field].length || (field === 'steps' && item.steps.some(step => !step.action))) diagnostics.push(diagnostic(code, `Case is missing ${field === 'steps' ? 'one or more step actions' : 'a title'}.`, { caseId: item.id, row: item.source.row }));
    }
    if (!item.expectedResults.length && !item.steps.some(step => step.expected)) diagnostics.push(diagnostic('MISSING_EXPECTED', 'Case has no explicit expected result; do not infer one from the application.', { caseId: item.id, row: item.source.row }));
  }
  const counts = new Map();
  for (const item of cases) counts.set(item.id, (counts.get(item.id) || 0) + 1);
  for (const item of cases) {
    if (counts.get(item.id) > 1) diagnostics.push(diagnostic('DUPLICATE_ID', 'Source ID appears more than once; rows were kept separate. Reconcile export step rows or conflicting cases before automation.', { caseId: item.id, row: item.source.row }));
  }
  const byRow = new Map();
  for (const entry of diagnostics) {
    if (entry.row === undefined || entry.code === 'ROW_WIDTH_MISMATCH') continue;
    if (!byRow.has(entry.row)) byRow.set(entry.row, []);
    byRow.get(entry.row).push(entry);
  }
  for (const item of cases) {
    const problems = byRow.get(item.source.row) || [];
    for (const problem of problems) problem.caseId ??= item.id;
    if (problems.length) {
      item.automationStatus = 'Needs clarification';
      item.automationReason = [...new Set(problems.map(entry => entry.message))].join(' ');
    }
  }
}

function main() {
  const opts = options(process.argv.slice(2));
  if (opts.help) { process.stdout.write(HELP); return; }
  const source = { kind: opts.kind, ...(opts.file ? { path: opts.file } : {}) };
  const diagnostics = [];
  let cases;
  if (opts.kind === 'xlsx') {
    const workbook = readWorkbook(opts);
    if (workbook.sheet) source.sheet = workbook.sheet;
    source.sheets = workbook.sheets;
    cases = fromRows(workbook.rows, source, diagnostics);
  } else {
    const raw = readText(opts);
    // Full original text is retained for audit, including BOM, preambles and CRLF.
    source.raw = raw;
    const provenance = { kind: source.kind, ...(opts.file ? { path: opts.file } : {}) };
    cases = opts.kind === 'csv' ? fromRows(parseCsv(raw), provenance, diagnostics) : parseText(raw, provenance, diagnostics, opts.kind === 'unknown');
  }
  if (!cases.length) diagnostics.push(diagnostic('EMPTY_INPUT', 'No test cases found in the selected input.'));
  validate(cases, diagnostics);
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, source, cases, diagnostics }, null, 2)}\n`);
}

try { main(); }
catch (error) {
  process.stderr.write(`${JSON.stringify({ schemaVersion: 1, diagnostics: [diagnostic(error.code || 'READ_ERROR', error.message, {}, 'error')] })}\n`);
  process.exitCode = 1;
}
