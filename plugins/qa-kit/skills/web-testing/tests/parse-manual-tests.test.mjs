import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));
const parser = path.resolve(here, '../scripts/parse-manual-tests.mjs');
const fixture = name => path.join(here, 'fixtures', name);
let temporary;

before(() => {
  temporary = mkdtempSync(path.join(tmpdir(), 'qa-kit-parser-'));
  const build = spawnSync('python3', [fixture('build-xlsx.py'), temporary], { encoding: 'utf8' });
  assert.equal(build.status, 0, `Python 3 fixture generation failed: ${build.stderr}`);
});
after(() => rmSync(temporary, { recursive: true, force: true }));

function run(args, input, options = {}) {
  const result = spawnSync(process.execPath, [parser, ...args], {
    encoding: 'utf8', input, maxBuffer: 30 * 1024 * 1024, ...options,
  });
  return { ...result, json: result.status === 0 && result.stdout.trim().startsWith('{') ? JSON.parse(result.stdout) : undefined };
}

function success(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.schemaVersion, 1);
  return result.json;
}

function fatal(result, code) {
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, '');
  const error = JSON.parse(result.stderr);
  assert.ok(error.diagnostics.some(item => item.code === code), result.stderr);
  return error;
}

test('CSV preserves quoted commas, multiline fields, BOM, CRLF and physical rows', () => {
  const csv = '\uFEFFID,Title,Preconditions,Steps,Test Data,Expected Result,Priority,Owner\r\n' +
    'TC-1,"Sign in, successfully",Account exists,"1. Open /login\r\n2. Click ""Sign in""",email=qa@example.test,Dashboard appears,P1,Linh\r\n' +
    'TC-2,Blank password,,Submit,,Error appears,P2,An\r\n';
  const output = success(run(['--stdin', '--format', 'csv'], csv));
  assert.equal(output.source.kind, 'csv');
  assert.equal(output.cases.length, 2);
  const first = output.cases[0];
  assert.equal(first.id, 'TC-1');
  assert.equal(first.title, 'Sign in, successfully');
  assert.deepEqual(first.steps, [{ action: 'Open /login' }, { action: 'Click "Sign in"' }]);
  assert.deepEqual(first.data, ['email=qa@example.test']);
  assert.deepEqual(first.expectedResults, ['Dashboard appears']);
  assert.equal(first.source.row, 2);
  assert.equal(output.cases[1].source.row, 4);
  assert.equal(first.source.values[3], '1. Open /login\r\n2. Click "Sign in"');
  assert.match(first.source.raw, /Click ""Sign in""/);
  assert.deepEqual(first.metadata.unknownColumns, [{ header: 'Owner', value: 'Linh', column: 8 }]);
  assert.equal(first.automationStatus, 'Blocked');
  assert.match(first.automationReason, /explor/i);
  assert.equal(first.discovered, false);
});

test('Vietnamese Markdown aliases preserve escaped pipes and unknown columns', () => {
  const output = success(run([fixture('vietnamese.md')]));
  const first = output.cases[0];
  assert.equal(output.source.kind, 'markdown');
  assert.equal(output.cases.length, 2);
  assert.equal(first.id, 'TC-01');
  assert.equal(first.title, 'Đăng nhập hợp lệ');
  assert.deepEqual(first.preconditions, ['Tài khoản đã tồn tại']);
  assert.deepEqual(first.steps, [{ action: 'Mở /login' }, { action: 'Nhập tên `a|b`' }, { action: 'Nhấn Đăng nhập' }]);
  assert.deepEqual(first.expectedResults, ['Hiển thị trang tổng quan']);
  assert.equal(first.priority, 'Cao');
  assert.deepEqual(first.metadata.unknownColumns, [{ header: 'Người phụ trách', value: 'Linh', column: 8 }]);
  assert.equal(first.source.row, 5);
});

test('structured Markdown headings and bold labels produce separate grounded cases', () => {
  const output = success(run([fixture('structured.md')]));
  assert.deepEqual(output.cases.map(item => item.id), ['TC-10', 'TC-11']);
  assert.deepEqual(output.cases[0].steps, [{ action: 'Open /login' }, { action: 'Submit the form' }]);
  assert.deepEqual(output.cases[0].preconditions, ['Account exists']);
  assert.deepEqual(output.cases[1].expectedResults, ['Required error appears']);
  assert.equal(output.cases[0].metadata.fields.Owner, 'Mei');
  assert.match(output.cases[0].source.raw, /\*\*Owner:\*\* Mei/);
});

test('inline structured text keeps literal shell syntax and does not execute it', () => {
  const marker = path.join(temporary, 'should-not-exist');
  const output = success(run(['--text', `TC-7: Literal input\nSteps: Echo $(touch ${marker}) and \`pwd\`\nExpected Result: Literal output`]));
  assert.equal(output.cases[0].id, 'TC-7');
  assert.equal(output.cases[0].steps[0].action, `Echo $(touch ${marker}) and \`pwd\``);
  assert.equal(output.cases[0].automationStatus, 'Blocked');
  assert.equal(existsSync(marker), false);
});

test('Vietnamese guide aliases and labeled pasted blocks retain setup and tags', () => {
  const csv = 'Mã TC,Tiêu đề,Tiền điều kiện,Các bước,Dữ liệu,Kết quả mong đợi,Độ ưu tiên,Nhãn\nLOGIN-01,Từ chối mật khẩu sai,Có tài khoản test,Gửi form,Tài khoản: qa-user,Hiển thị lỗi,High,"login,validation"';
  const output = success(run(['--stdin', '--format', 'csv'], csv));
  assert.deepEqual(output.cases[0].preconditions, ['Có tài khoản test']);
  assert.deepEqual(output.cases[0].tags, ['login', 'validation']);
  const pasted = success(run(['--text', 'ID: LOGIN-01\nTitle: Require email\nSteps:\n1. Open /login\n2. Submit\nExpected Results: Required error']));
  assert.equal(pasted.cases[0].id, 'LOGIN-01');
  assert.deepEqual(pasted.cases[0].steps, [{ action: 'Open /login' }, { action: 'Submit' }]);
});

test('nested colon values remain part of Test Data and do not create phantom cases', () => {
  const input = '## PAY-01: Payment validation\nSteps:\n1. Enter data\n   Note: Keep the leading zero\n2. Submit\nTest Data:\nuser1: example user\n  email: qa@example.test\nExpected Result: Error appears';
  const output = success(run(['--text', input]));
  assert.equal(output.cases.length, 1);
  assert.equal(output.cases[0].id, 'PAY-01');
  assert.deepEqual(output.cases[0].data, ['user1: example user', 'email: qa@example.test']);
  assert.ok(output.cases[0].steps.some(step => step.action === 'Note: Keep the leading zero'));
  assert.deepEqual(output.cases[0].expectedResults, ['Error appears']);
});

test('indented recognized labels remain inside their enclosing step content', () => {
  const input = '## TC-1: Login\nSteps:\n1. Open /login\n2. Enter username\n   Data: alice\n3. Submit\nExpected Results: Dashboard appears';
  const output = success(run(['--text', input]));
  assert.deepEqual(output.cases[0].steps, [{ action: 'Open /login' }, { action: 'Enter username' }, { action: 'Data: alice' }, { action: 'Submit' }]);
  assert.deepEqual(output.cases[0].data, []);
  assert.deepEqual(output.cases[0].expectedResults, ['Dashboard appears']);
});

test('an ambiguous unknown field never becomes an invented expected result', () => {
  const input = '## TC-1: Login\nSteps: Submit\nExpected Results: Dashboard appears\nOwner: Mei';
  const output = success(run(['--text', input]));
  assert.deepEqual(output.cases[0].expectedResults, ['Dashboard appears']);
  assert.equal(output.cases[0].metadata.fields.Owner, 'Mei');
  assert.equal(output.cases[0].automationStatus, 'Needs clarification');
  assert.ok(output.diagnostics.some(item => item.code === 'AMBIGUOUS_FIELD'));
});

test('fenced examples with ID and Title stay literal test data', () => {
  const input = '## TC-1: Import\nSteps: Paste sample\nTest Data:\n```text\nID: CUSTOMER-1\nTitle: Alice\n```\nExpected Results: Customer imported';
  const output = success(run(['--text', input]));
  assert.equal(output.cases.length, 1);
  assert.equal(output.cases[0].id, 'TC-1');
  assert.ok(output.cases[0].data.includes('ID: CUSTOMER-1'));
  assert.ok(output.cases[0].data.includes('Title: Alice'));
  assert.deepEqual(output.cases[0].expectedResults, ['Customer imported']);
});

test('trailing unstructured manual intent after a table becomes an unresolved case', () => {
  const input = '| ID | Title | Steps | Expected Result |\n| --- | --- | --- | --- |\n| TC-1 | Login | Submit | Dashboard |\n\nAlso verify password reset sends an email.';
  const output = success(run(['--text', input]));
  assert.equal(output.cases.length, 2);
  assert.equal(output.cases[1].source.raw, 'Also verify password reset sends an email.');
  assert.equal(output.cases[1].automationStatus, 'Needs clarification');
  assert.deepEqual(output.cases[1].expectedResults, []);
});

test('a human case heading followed by explicit ID describes one case', () => {
  const output = success(run(['--text', '## Login\nID: TC-1\nSteps: Submit\nExpected Result: Dashboard']));
  assert.equal(output.cases.length, 1);
  assert.equal(output.cases[0].id, 'TC-1');
  assert.equal(output.cases[0].title, 'Login');
});

test('a blank duplicate alias permits the explicit populated value', () => {
  const output = success(run(['--stdin', '--format', 'csv'], 'ID,Mã TC,Title,Steps,Expected Result\n,TC-2,Login,Open,Form'));
  assert.equal(output.cases[0].id, 'TC-2');
  assert.equal(output.cases[0].automationStatus, 'Blocked');
  assert.equal(output.diagnostics.length, 0);
});

test('unstructured inline text is retained without inventing expected behavior', () => {
  const raw = 'TC01: Guest checkout should be tested someday';
  const output = success(run(['--text', raw]));
  assert.equal(output.cases.length, 1);
  assert.equal(output.cases[0].id, 'TC01');
  assert.equal(output.cases[0].source.raw, raw);
  assert.deepEqual(output.cases[0].expectedResults, []);
  assert.deepEqual(output.cases[0].steps, []);
  assert.equal(output.cases[0].automationStatus, 'Needs clarification');
  assert.ok(output.diagnostics.some(item => item.code === 'MISSING_EXPECTED'));
});

test('unrecognized file format stays unstructured even when it looks like a table', () => {
  const name = path.join(temporary, 'unknown.custom');
  const raw = 'ID,Title,Steps,Expected Result\nTC-1,Login,Submit,Dashboard';
  writeFileSync(name, raw);
  const output = success(run([name]));
  assert.equal(output.cases[0].source.raw, raw);
  assert.equal(output.cases[0].automationStatus, 'Needs clarification');
  assert.ok(output.diagnostics.some(item => item.code === 'UNKNOWN_FORMAT'));
});

test('missing essentials are named; idless cases get stable collision-free IDs', () => {
  const csv = 'ID,Title,Steps,Expected Result\nLOCAL-001,Known,Open,Visible\n,Unnamed,Open,Visible\nTC-3,,,\n';
  const output = success(run(['--stdin', '--format', 'csv'], csv));
  assert.deepEqual(output.cases.map(item => item.id), ['LOCAL-001', 'LOCAL-002', 'TC-3']);
  assert.equal(output.cases[1].automationStatus, 'Needs clarification');
  assert.deepEqual(output.diagnostics.filter(item => item.caseId === 'TC-3').map(item => item.code).sort(),
    ['MISSING_EXPECTED', 'MISSING_STEPS', 'MISSING_TITLE']);
  assert.deepEqual(success(run(['--stdin', '--format', 'csv'], csv)).cases.map(item => item.id), ['LOCAL-001', 'LOCAL-002', 'TC-3']);
});

test('duplicate export IDs keep all rows and flag all conflicting cases', () => {
  const output = success(run(['--stdin', '--format', 'csv'], 'ID,Title,Steps,Expected Result\nTC-1,Login,Open,Form\nTC-1,Login,Submit,Dashboard\n'));
  assert.equal(output.cases.length, 2);
  assert.deepEqual(output.cases.map(item => item.steps[0].action), ['Open', 'Submit']);
  assert.ok(output.cases.every(item => item.automationStatus === 'Needs clarification'));
  assert.deepEqual(output.diagnostics.filter(item => item.code === 'DUPLICATE_ID').map(item => item.row), [2, 3]);
});

test('unknown and duplicate columns survive without silently replacing field values', () => {
  const output = success(run(['--stdin', '--format', 'csv'], 'ID,Title,Steps,Expected Result,Owner,Owner\nTC-1,Login,Open,Form,A,B,extra'));
  assert.deepEqual(output.cases[0].source.values, ['TC-1', 'Login', 'Open', 'Form', 'A', 'B', 'extra']);
  assert.deepEqual(output.cases[0].metadata.unknownColumns, [
    { header: 'Owner', value: 'A', column: 5 }, { header: 'Owner', value: 'B', column: 6 }, { header: '', value: 'extra', column: 7 },
  ]);
  assert.ok(output.diagnostics.some(item => item.code === 'ROW_WIDTH_MISMATCH'));
});

test('conflicting aliased fields remain reviewable and need clarification', () => {
  const output = success(run(['--stdin', '--format', 'csv'], 'ID,Mã TC,Title,Steps,Expected Result\nTC-1,TC-2,Login,Open,Form'));
  assert.equal(output.cases[0].source.values[1], 'TC-2');
  assert.equal(output.cases[0].automationStatus, 'Needs clarification');
  assert.ok(output.diagnostics.some(item => item.code === 'CONFLICTING_FIELD'));
});

test('an unrecognized CSV header retains every record as unclear input', () => {
  const output = success(run(['--stdin', '--format', 'csv'], 'Something,Else\none,two\nthree,four'));
  assert.equal(output.cases.length, 2);
  assert.deepEqual(output.cases[1].source.values, ['three', 'four']);
  assert.ok(output.cases.every(item => item.automationStatus === 'Needs clarification'));
  assert.ok(output.diagnostics.some(item => item.code === 'UNRECOGNIZED_HEADERS'));
});

test('per-step expected values in a structured table retain their association', () => {
  const input = '## TC-90: Sign in\n\n| Step | Test Data | Expected Result |\n| --- | --- | --- |\n| Open /login | | Form visible |\n| Submit | email=a@example.test | Dashboard visible |';
  const output = success(run(['--text', input]));
  assert.equal(output.cases.length, 1);
  assert.deepEqual(output.cases[0].steps, [
    { action: 'Open /login', expected: 'Form visible' },
    { action: 'Submit', data: 'email=a@example.test', expected: 'Dashboard visible' },
  ]);
  assert.equal(output.cases[0].automationStatus, 'Blocked');
});

test('a step-number column never replaces the action in a structured step table', () => {
  const input = '## TC-90: Login\n\n| Step | Action | Expected Result |\n| --- | --- | --- |\n| 1 | Open /login | Form visible |\n| 2 | Submit | Dashboard visible |';
  const output = success(run(['--text', input]));
  assert.deepEqual(output.cases[0].steps, [
    { action: 'Open /login', expected: 'Form visible' }, { action: 'Submit', expected: 'Dashboard visible' },
  ]);
  assert.equal(output.cases[0].source.stepTables[0].rows[0].values[0], '1');
});

test('empty readable input produces a diagnostic and no invented cases', () => {
  const output = success(run(['--text', '   \n']));
  assert.deepEqual(output.cases, []);
  assert.ok(output.diagnostics.some(item => item.code === 'EMPTY_INPUT'));
});

for (const [name, csv] of [
  ['unterminated quote', 'ID,Title\nTC-1,"unterminated'],
  ['characters after a quoted field', 'ID,Title\nTC-1,"title"junk'],
  ['quote inside an unquoted field', 'ID,Title\nTC-1,ti"tle'],
]) {
  test(`malformed CSV rejects ${name} instead of losing data`, () => fatal(run(['--stdin', '--format', 'csv'], csv), 'MALFORMED_CSV'));
}

test('XLSX selects only non-empty sheet and preserves shared strings and sparse rows', () => {
  const output = success(run([path.join(temporary, 'single.xlsx')], undefined, { cwd: tmpdir() }));
  assert.equal(output.source.kind, 'xlsx');
  assert.equal(output.source.sheet, 'Login');
  assert.equal(output.cases[0].id, 'TC-X1');
  assert.equal(output.cases[0].title, 'Sign in');
  assert.equal(output.cases[0].source.row, 7);
  assert.equal(output.cases[0].source.values[2], '');
  assert.equal(output.cases[0].source.values[7], 'Linh');
  assert.deepEqual(output.cases[0].steps, [{ action: 'Open page' }, { action: 'Submit' }]);
  assert.equal(output.cases[0].automationStatus, 'Blocked');
});

test('XLSX ambiguous and unknown sheet errors list names; --sheet resolves ambiguity', () => {
  const name = path.join(temporary, 'multiple.xlsx');
  const ambiguous = fatal(run([name]), 'AMBIGUOUS_SHEET');
  assert.match(ambiguous.diagnostics[0].message, /Login/);
  assert.match(ambiguous.diagnostics[0].message, /Checkout/);
  const missing = fatal(run([name, '--sheet', 'Missing']), 'UNKNOWN_SHEET');
  assert.match(missing.diagnostics[0].message, /Login/);
  assert.equal(success(run([name, '--sheet', 'Checkout'])).source.sheet, 'Checkout');
});

test('XLSX formulas are preserved and flagged without trusting cached results', () => {
  const output = success(run([path.join(temporary, 'formula.xlsx')]));
  const item = output.cases[0];
  assert.equal(item.automationStatus, 'Needs clarification');
  assert.deepEqual(item.expectedResults, []);
  assert.equal(item.source.formulas[0].cell, 'F8');
  assert.equal(item.source.formulas[0].expression, 'HYPERLINK("https://example.test", "expected")');
  assert.equal(item.source.formulas[0].cachedValue, 'cached result');
  assert.ok(output.diagnostics.some(item => item.code === 'XLSX_FORMULA' && item.row === 8));
});

test('styled XLSX numerics retain raw cell metadata and require display-format review', () => {
  const output = success(run([path.join(temporary, 'styled.xlsx')]));
  const item = output.cases[0];
  assert.equal(item.id, '7');
  assert.equal(item.automationStatus, 'Needs clarification');
  assert.equal(item.source.cells[0].cell, 'A4');
  assert.equal(item.source.cells[0].rawValue, '7');
  assert.equal(item.source.cells[0].style, '1');
  assert.equal(item.source.cells[0].type, 'n');
  assert.ok(output.diagnostics.some(item => item.code === 'XLSX_FORMATTED_VALUE'));
});

test('XLSX error cells stay in provenance but never become asserted outcomes', () => {
  const output = success(run([path.join(temporary, 'cell-error.xlsx')]));
  assert.deepEqual(output.cases[0].expectedResults, []);
  assert.equal(output.cases[0].source.cells[3].rawValue, '#VALUE!');
  assert.equal(output.cases[0].automationStatus, 'Needs clarification');
  assert.ok(output.diagnostics.some(item => item.code === 'XLSX_CELL_ERROR'));
});

test('formula-only sheet counts as non-empty, and a truly empty workbook returns no cases', () => {
  const calculated = success(run([path.join(temporary, 'formula-only.xlsx')]));
  assert.equal(calculated.source.sheet, 'Calculated');
  assert.ok(calculated.diagnostics.some(item => item.code === 'XLSX_FORMULA'));
  const empty = success(run([path.join(temporary, 'empty.xlsx')]));
  assert.deepEqual(empty.cases, []);
  assert.ok(empty.diagnostics.some(item => item.code === 'EMPTY_INPUT'));
});

test('invalid XLSX archive and out-of-range references fail clearly', () => {
  const name = path.join(temporary, 'broken.xlsx');
  writeFileSync(name, 'this is not a zip archive');
  fatal(run([name]), 'INVALID_XLSX');
  fatal(run([path.join(temporary, 'bad-shared.xlsx')]), 'INVALID_XLSX');
  fatal(run([path.join(temporary, 'bad-reference.xlsx')]), 'INVALID_XLSX');
});

test('XLSX archive member limits reject oversized content before expansion', () => {
  fatal(run([path.join(temporary, 'oversized-member.xlsx')]), 'RESOURCE_LIMIT');
});

test('XLSX XML containing entity declarations is refused without expansion', () => {
  fatal(run([path.join(temporary, 'hostile-xml.xlsx')]), 'INVALID_XLSX');
});

test('missing Python runtime reports the exact prerequisite', () => {
  const result = fatal(run([path.join(temporary, 'single.xlsx')], undefined, { env: { ...process.env, PATH: temporary } }), 'PYTHON_REQUIRED');
  assert.match(result.diagnostics[0].message, /Python 3/);
});

test('help prints supported syntax without reading inputs', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0);
  for (const flag of ['--text', '--stdin', '--format', '--sheet']) assert.ok(result.stdout.includes(flag));
  assert.equal(result.stderr, '');
});

for (const args of [[], ['--unknown'], ['--text'], ['--stdin'], ['--text', 'x', '--stdin'], ['a.csv', 'b.csv'], ['--text', 'x', '--sheet', 'Login'], ['--stdin', '--format', 'xlsx'], ['--text', 'x', '--format', 'tsv']]) {
  test(`invalid CLI options ${JSON.stringify(args)} report structured error`, () => fatal(run(args, ''), 'INVALID_OPTIONS'));
}

test('unreadable input and oversized text fail clearly', () => {
  fatal(run([path.join(temporary, 'missing.csv')]), 'READ_ERROR');
  const name = path.join(temporary, 'large.txt');
  writeFileSync(name, 'x'.repeat(11 * 1024 * 1024));
  fatal(run([name]), 'RESOURCE_LIMIT');
});
