/**
 * Tests for apps-script/booking-notifications.gs
 *
 * booking-notifications.gs is a Google Apps Script file, not a CommonJS
 * module, so it can't be `require()`-d directly: it has no exports and it
 * references Apps Script-only globals (SpreadsheetApp, MailApp, ScriptApp).
 * On top of that, the file as currently committed does not even parse as
 * valid JavaScript (see the "known source bugs" suite below).
 *
 * To unit test the individual functions in isolation, this suite:
 *   1. Reads the raw .gs source from disk.
 *   2. Extracts single top-level function/const blocks by locating the
 *      declaration line and the matching un-indented closing brace.
 *   3. Evaluates each extracted block inside a fresh `vm` sandbox that is
 *      seeded with only the globals/collaborators that particular block
 *      needs (mocked Apps Script APIs, or the real sibling helper function
 *      when it is itself under test).
 *
 * This lets each function be exercised independently without needing the
 * whole (currently broken) file to load, and without modifying the
 * production .gs file in any way.
 *
 * Run with: node --test apps-script/booking-notifications.test.js
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const SOURCE_PATH = path.join(__dirname, 'booking-notifications.gs');
const SOURCE = fs.readFileSync(SOURCE_PATH, 'utf8');

/**
 * Extract a top-level block of source starting at the first line matching
 * `startRegex` and ending at the next line that is exactly `}` or `};`
 * (i.e. an un-indented closing brace, which is how every top-level
 * function/const in this file is closed).
 */
function extractBlock(source, startRegex) {
  const lines = source.split('\n');
  const startIdx = lines.findIndex((line) => startRegex.test(line));
  if (startIdx === -1) {
    throw new Error(`Could not find a line matching ${startRegex} in source`);
  }
  let endIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i] === '}' || lines[i] === '};') {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) {
    throw new Error(`Could not find the end of the block starting at line ${startIdx}`);
  }
  return lines.slice(startIdx, endIdx + 1).join('\n');
}

/** Evaluate `code` in a fresh sandbox seeded with `globals`, returning the value of the final expression. */
function loadInSandbox(code, globals = {}) {
  const sandbox = {
    console,
    Date,
    Math,
    String,
    Object,
    JSON,
    RegExp,
    ...globals,
  };
  vm.createContext(sandbox);
  return vm.runInContext(code, sandbox);
}

/** Minimal call-recording spy compatible with plain function references. */
function spy(impl) {
  const fn = (...args) => {
    fn.calls.push(args);
    if (impl) return impl(...args);
  };
  fn.calls = [];
  return fn;
}

/** In-memory fake Sheet supporting getRange(row, col).getValue()/.setValue(). */
function makeMockSheet(initialCellsByColumn = {}) {
  const store = new Map(Object.entries(initialCellsByColumn).map(([col, v]) => [Number(col), v]));
  return {
    getRange(_row, col) {
      return {
        getValue: () => (store.has(col) ? store.get(col) : ''),
        setValue: (v) => store.set(col, v),
      };
    },
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// Shared, reusable pieces loaded once.
// ---------------------------------------------------------------------------

const COL_SRC = extractBlock(SOURCE, /^const COL = \{/);
// Re-hydrated as a plain object in the current realm so that assert.deepEqual
// (which uses deepStrictEqual and is prototype-sensitive) can compare it
// against a plain literal without cross-realm prototype mismatches.
const COL = Object.assign({}, loadInSandbox(`${COL_SRC}\nCOL;`));

const FORMAT_DATE_SRC = extractBlock(SOURCE, /^function formatDate\(/);
const formatDate = loadInSandbox(`${FORMAT_DATE_SRC}\nformatDate;`);

const CALCULATE_DAYS_SRC = extractBlock(SOURCE, /^function calculateDays\(/);
const calculateDays = loadInSandbox(`${CALCULATE_DAYS_SRC}\ncalculateDays;`);

// ---------------------------------------------------------------------------
// Known bugs present in the current source (regression guards).
//
// These tests intentionally assert the *current*, buggy behavior so the
// suite documents known issues without silently patching the shipped file.
// If these ever start failing, it means the underlying bug has been fixed
// and the corresponding test (and this comment) should be updated/removed.
// ---------------------------------------------------------------------------

describe('known source bugs (regression guards)', () => {
  it('the file as committed does not compile: COMPANY_PHONE is an unterminated string literal', () => {
    assert.throws(() => new vm.Script(SOURCE), SyntaxError);
  });

  it('the COMPANY_PHONE declaration line alone is missing its closing quote', () => {
    const line = SOURCE.split('\n').find((l) => l.includes('COMPANY_PHONE'));
    assert.ok(line, 'expected to find a COMPANY_PHONE line');
    assert.throws(() => new vm.Script(line), SyntaxError);
  });

  it('escapeHtml as written fails to compile due to a malformed final replace() call', () => {
    const src = extractBlock(SOURCE, /^function escapeHtml\(/);
    // The sandboxed code is compiled in a separate vm realm, so its thrown
    // SyntaxError is not `instanceof` this realm's SyntaxError; compare by
    // name instead.
    assert.throws(
      () => loadInSandbox(`${src}\nescapeHtml;`),
      (err) => err.name === 'SyntaxError'
    );
  });

  it('escapeHtml\'s escaping replacements for &, < and > are no-ops rather than HTML entities', () => {
    const src = extractBlock(SOURCE, /^function escapeHtml\(/);
    const cases = [
      { char: '&', pattern: /\.replace\(\/&\/g, '(.*?)'\)/ },
      { char: '<', pattern: /\.replace\(\/<\/g, '(.*?)'\)/ },
      { char: '>', pattern: /\.replace\(\/>\/g, '(.*?)'\)/ },
    ];
    for (const { char, pattern } of cases) {
      const match = pattern.exec(src);
      assert.ok(match, `expected to find a replace() call for "${char}"`);
      assert.equal(
        match[1],
        char,
        `expected escapeHtml's replacement for "${char}" to currently be a no-op (bug), but it differs`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// COL column map
// ---------------------------------------------------------------------------

describe('COL column mapping', () => {
  it('maps every booking field to the expected 1-based column index', () => {
    assert.deepEqual(COL, {
      bookingId: 1,
      status: 2,
      createdAt: 3,
      vehicleId: 4,
      vehicleName: 5,
      pickupDate: 6,
      pickupTime: 7,
      returnDate: 8,
      returnTime: 9,
      custName: 10,
      custEmail: 11,
      custPhone: 12,
      custAddress: 13,
      licenseNum: 14,
      licenseExpiry: 15,
      licenseIssuer: 16,
      licenseClass: 17,
      paymentMethod: 18,
      totalAmount: 19,
      invoiceSentAt: 20,
      notes: 21,
    });
  });

  it('matches the spreadsheet column letters documented in APPS_SCRIPT_SETUP.md', () => {
    assert.equal(COL.bookingId, 1); // A
    assert.equal(COL.status, 2); // B
    assert.equal(COL.pickupDate, 6); // F
    assert.equal(COL.pickupTime, 7); // G
    assert.equal(COL.returnDate, 8); // H
    assert.equal(COL.returnTime, 9); // I
    assert.equal(COL.custName, 10); // J
    assert.equal(COL.custEmail, 11); // K
    assert.equal(COL.totalAmount, 19); // S
    assert.equal(COL.invoiceSentAt, 20); // T
    assert.equal(COL.notes, 21); // U
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('formats a Date instance as "DD Mon YYYY"', () => {
    assert.equal(formatDate(new Date(2026, 7, 15)), '15 Aug 2026');
  });

  it('formats a date string input', () => {
    assert.equal(formatDate('2026-08-15'), '15 Aug 2026');
  });

  it('returns an empty string for falsy input', () => {
    assert.equal(formatDate(''), '');
    assert.equal(formatDate(null), '');
    assert.equal(formatDate(undefined), '');
  });
});

// ---------------------------------------------------------------------------
// calculateDays
// ---------------------------------------------------------------------------

describe('calculateDays', () => {
  it('returns 1 for a same-day pickup and return', () => {
    assert.equal(calculateDays('2026-08-15', '2026-08-15'), 1);
  });

  it('counts an inclusive day span for multi-day rentals', () => {
    assert.equal(calculateDays('2026-08-15', '2026-08-17'), 3);
  });

  it('defaults to 1 when the pickup date is missing', () => {
    assert.equal(calculateDays(null, '2026-08-17'), 1);
    assert.equal(calculateDays(undefined, '2026-08-17'), 1);
  });

  it('defaults to 1 when the return date is missing', () => {
    assert.equal(calculateDays('2026-08-15', null), 1);
  });

  it('never returns less than 1, even if return precedes pickup', () => {
    assert.equal(calculateDays('2026-08-17', '2026-08-15'), 1);
  });

  it('accepts Date instances directly', () => {
    assert.equal(calculateDays(new Date(2026, 7, 15), new Date(2026, 7, 17)), 3);
  });
});

// ---------------------------------------------------------------------------
// onEdit
// ---------------------------------------------------------------------------

describe('onEdit', () => {
  const src = extractBlock(SOURCE, /^function onEdit\(/);

  function buildEvent({ sheetName = 'Bookings', row = 5, status = 'Confirmed', invoiceSent = '' } = {}) {
    const sheet = makeMockSheet({
      [COL.status]: status,
      [COL.invoiceSentAt]: invoiceSent,
    });
    sheet.getName = () => sheetName;
    const e = {
      range: {
        getRow: () => row,
        getSheet: () => sheet,
      },
    };
    return { e, sheet };
  }

  function run(eventOpts) {
    const sendBookingEmails = spy();
    const { e } = buildEvent(eventOpts);
    const onEdit = loadInSandbox(`${src}\nonEdit;`, { SHEET_NAME: 'Bookings', sendBookingEmails, COL });
    onEdit(e);
    return sendBookingEmails;
  }

  it('ignores edits on sheets other than the Bookings sheet', () => {
    const sendBookingEmails = run({ sheetName: 'OtherSheet' });
    assert.equal(sendBookingEmails.calls.length, 0);
  });

  it('ignores edits on the header row', () => {
    const sendBookingEmails = run({ row: 1 });
    assert.equal(sendBookingEmails.calls.length, 0);
  });

  it('ignores rows whose status is not Confirmed', () => {
    const sendBookingEmails = run({ status: 'Pending' });
    assert.equal(sendBookingEmails.calls.length, 0);
  });

  it('ignores rows where the invoice has already been sent', () => {
    const sendBookingEmails = run({ status: 'Confirmed', invoiceSent: new Date() });
    assert.equal(sendBookingEmails.calls.length, 0);
  });

  it('sends booking emails for a newly-confirmed row without an invoice timestamp', () => {
    const sendBookingEmails = run({ status: 'Confirmed', invoiceSent: '', row: 8 });
    assert.equal(sendBookingEmails.calls.length, 1);
    assert.equal(sendBookingEmails.calls[0][1], 8);
  });
});

// ---------------------------------------------------------------------------
// sendBookingEmails
// ---------------------------------------------------------------------------

describe('sendBookingEmails', () => {
  const src = extractBlock(SOURCE, /^function sendBookingEmails\(/);

  const FULL_ROW = {
    [COL.bookingId]: 'BK-1001',
    [COL.custEmail]: 'jane@example.com',
    [COL.custName]: 'Jane Doe',
    [COL.vehicleName]: 'Toyota Corolla',
    [COL.totalAmount]: 240,
  };

  function build({ row = FULL_ROW, throwOnCustomerConfirmation = false } = {}) {
    const sendCustomerConfirmation = throwOnCustomerConfirmation
      ? spy(() => {
          throw new Error('boom');
        })
      : spy();
    const sendOwnerNotification = spy();
    const sheet = makeMockSheet(row);
    const fn = loadInSandbox(`${src}\nsendBookingEmails;`, {
      sendCustomerConfirmation,
      sendOwnerNotification,
      COL,
    });
    return { fn, sheet, sendCustomerConfirmation, sendOwnerNotification };
  }

  it('skips sending when custEmail is missing', () => {
    const { fn, sheet, sendCustomerConfirmation, sendOwnerNotification } = build({
      row: { ...FULL_ROW, [COL.custEmail]: '' },
    });
    fn(sheet, 2);
    assert.equal(sendCustomerConfirmation.calls.length, 0);
    assert.equal(sendOwnerNotification.calls.length, 0);
  });

  it('skips sending when bookingId is missing', () => {
    const { fn, sheet, sendCustomerConfirmation, sendOwnerNotification } = build({
      row: { ...FULL_ROW, [COL.bookingId]: '' },
    });
    fn(sheet, 2);
    assert.equal(sendCustomerConfirmation.calls.length, 0);
    assert.equal(sendOwnerNotification.calls.length, 0);
  });

  it('sends the customer and owner emails and stamps invoiceSentAt on success', () => {
    const { fn, sheet, sendCustomerConfirmation, sendOwnerNotification } = build();
    fn(sheet, 2);
    assert.equal(sendCustomerConfirmation.calls.length, 1);
    assert.equal(sendOwnerNotification.calls.length, 1);
    assert.equal(sendCustomerConfirmation.calls[0][0].bookingId, 'BK-1001');
    assert.equal(sendOwnerNotification.calls[0][0].custName, 'Jane Doe');
    assert.ok(sheet._store.get(COL.invoiceSentAt) instanceof Date);
  });

  it('records the error in the notes column and skips the owner email if sending fails', () => {
    const { fn, sheet, sendOwnerNotification } = build({ throwOnCustomerConfirmation: true });
    fn(sheet, 2);
    assert.equal(sendOwnerNotification.calls.length, 0);
    assert.equal(sheet._store.get(COL.notes), 'Email error: boom');
    assert.equal(sheet._store.get(COL.invoiceSentAt), undefined);
  });
});

// ---------------------------------------------------------------------------
// sendCustomerConfirmation
// ---------------------------------------------------------------------------

describe('sendCustomerConfirmation', () => {
  const src = extractBlock(SOURCE, /^function sendCustomerConfirmation\(/);

  // escapeHtml itself is broken (see "known source bugs" above), so a
  // simple passthrough stand-in is injected here to unit test
  // sendCustomerConfirmation's own email-composition logic in isolation.
  const escapeHtml = (v) => (v === null || v === undefined ? '' : String(v));

  function build() {
    const MailApp = { sendEmail: spy() };
    const fn = loadInSandbox(`${src}\nsendCustomerConfirmation;`, {
      MailApp,
      escapeHtml,
      formatDate,
      calculateDays,
      COMPANY_NAME: "Test Co",
      COMPANY_EMAIL: 'bookings@test.co',
      COMPANY_PHONE: '+1 (555) 000-0000',
    });
    return { fn, MailApp };
  }

  const sampleData = {
    bookingId: 'BK-1001',
    custName: 'Jane Doe',
    custEmail: 'jane@example.com',
    vehicleName: 'Toyota Corolla',
    pickupDate: '2026-08-15',
    pickupTime: '10:00',
    returnDate: '2026-08-17',
    returnTime: '10:00',
    totalAmount: 240,
    licenseNum: 'LIC123',
    licenseExpiry: '2030-01-01',
    licenseIssuer: 'Barbados Licensing Authority',
  };

  it('sends exactly one email addressed to the customer with the booking details', () => {
    const { fn, MailApp } = build();
    fn(sampleData);
    assert.equal(MailApp.sendEmail.calls.length, 1);
    const [email] = MailApp.sendEmail.calls[0];
    assert.equal(email.to, 'jane@example.com');
    assert.match(email.subject, /BK-1001/);
    assert.match(email.htmlBody, /Jane Doe/);
    assert.match(email.htmlBody, /Toyota Corolla/);
    assert.match(email.htmlBody, /Bds\$240/);
    assert.equal(email.name, 'Test Co');
    assert.equal(email.replyTo, 'bookings@test.co');
  });

  it('includes the rental duration computed from the pickup/return dates in the text body', () => {
    const { fn, MailApp } = build();
    fn(sampleData);
    const [email] = MailApp.sendEmail.calls[0];
    assert.match(email.textBody, /Duration: 3 day\(s\)/);
    assert.match(email.textBody, /Total Due: Bds\$240/);
  });
});

// ---------------------------------------------------------------------------
// sendOwnerNotification
// ---------------------------------------------------------------------------

describe('sendOwnerNotification', () => {
  const src = extractBlock(SOURCE, /^function sendOwnerNotification\(/);

  function build({ sheetUrl = 'https://example.com/sheet' } = {}) {
    const MailApp = { sendEmail: spy() };
    const SpreadsheetApp = { getActiveSpreadsheet: () => ({ getUrl: () => sheetUrl }) };
    const fn = loadInSandbox(`${src}\nsendOwnerNotification;`, {
      MailApp,
      SpreadsheetApp,
      OWNER_EMAIL: 'owner@test.co',
      formatDate,
      calculateDays,
    });
    return { fn, MailApp };
  }

  const sampleData = {
    bookingId: 'BK-1001',
    custName: 'Jane Doe',
    custEmail: 'jane@example.com',
    custPhone: '246-555-0000',
    vehicleName: 'Toyota Corolla',
    pickupDate: '2026-08-15',
    pickupTime: '10:00',
    returnDate: '2026-08-17',
    returnTime: '10:00',
    totalAmount: 240,
    licenseNum: 'LIC123',
    licenseExpiry: '2030-01-01',
  };

  it('notifies the fixed OWNER_EMAIL address with customer and booking details', () => {
    const { fn, MailApp } = build();
    fn(sampleData);
    assert.equal(MailApp.sendEmail.calls.length, 1);
    const [email] = MailApp.sendEmail.calls[0];
    assert.equal(email.to, 'owner@test.co');
    assert.match(email.subject, /Jane Doe/);
    assert.match(email.subject, /BK-1001/);
    assert.match(email.textBody, /Toyota Corolla/);
  });

  it('links back to the active spreadsheet URL', () => {
    const { fn, MailApp } = build({ sheetUrl: 'https://sheets.example/xyz' });
    fn(sampleData);
    const [email] = MailApp.sendEmail.calls[0];
    assert.match(email.textBody, /View in sheet: https:\/\/sheets\.example\/xyz/);
  });
});

// ---------------------------------------------------------------------------
// setupTriggers
// ---------------------------------------------------------------------------

describe('setupTriggers', () => {
  const src = extractBlock(SOURCE, /^function setupTriggers\(/);

  it('deletes any existing onEdit trigger and installs a fresh onEdit trigger', () => {
    const deleted = [];
    const chain = {
      forSpreadsheet: () => chain,
      onEdit: () => chain,
      create: () => chain,
    };
    const newTriggerCalls = [];
    const staleOnEditTrigger = { getHandlerFunction: () => 'onEdit' };
    const unrelatedTrigger = { getHandlerFunction: () => 'someOtherFn' };
    const ScriptApp = {
      getProjectTriggers: () => [staleOnEditTrigger, unrelatedTrigger],
      deleteTrigger: (t) => deleted.push(t),
      newTrigger: (name) => {
        newTriggerCalls.push(name);
        return chain;
      },
    };
    const SpreadsheetApp = { getActiveSpreadsheet: () => 'the-active-spreadsheet' };

    const fn = loadInSandbox(`${src}\nsetupTriggers;`, { ScriptApp, SpreadsheetApp });
    fn();

    assert.deepEqual(deleted, [staleOnEditTrigger]);
    assert.deepEqual(newTriggerCalls, ['onEdit']);
  });
});

// ---------------------------------------------------------------------------
// testEmails
// ---------------------------------------------------------------------------

describe('testEmails', () => {
  const src = extractBlock(SOURCE, /^function testEmails\(/);

  function build(sheetOrNull) {
    const sendBookingEmails = spy();
    const SpreadsheetApp = {
      getActiveSpreadsheet: () => ({ getSheetByName: () => sheetOrNull }),
    };
    const fn = loadInSandbox(`${src}\ntestEmails;`, {
      SpreadsheetApp,
      sendBookingEmails,
      SHEET_NAME: 'Bookings',
    });
    fn();
    return sendBookingEmails;
  }

  it('does nothing when the Bookings sheet does not exist', () => {
    const sendBookingEmails = build(null);
    assert.equal(sendBookingEmails.calls.length, 0);
  });

  it('does nothing when there are no booking rows beyond the header', () => {
    const sendBookingEmails = build({ getLastRow: () => 1 });
    assert.equal(sendBookingEmails.calls.length, 0);
  });

  it('sends a test email for the last row when bookings exist', () => {
    const sheet = { getLastRow: () => 7 };
    const sendBookingEmails = build(sheet);
    assert.equal(sendBookingEmails.calls.length, 1);
    assert.equal(sendBookingEmails.calls[0][0], sheet);
    assert.equal(sendBookingEmails.calls[0][1], 7);
  });
});

// ---------------------------------------------------------------------------
// backfillEmails
// ---------------------------------------------------------------------------

describe('backfillEmails', () => {
  const src = extractBlock(SOURCE, /^function backfillEmails\(/);

  function build(sheetOrNull) {
    const sendBookingEmails = spy();
    const SpreadsheetApp = {
      getActiveSpreadsheet: () => ({ getSheetByName: () => sheetOrNull }),
    };
    const fn = loadInSandbox(`${COL_SRC}\n${src}\nbackfillEmails;`, {
      SpreadsheetApp,
      sendBookingEmails,
      SHEET_NAME: 'Bookings',
    });
    fn();
    return sendBookingEmails;
  }

  function makeRowsSheet(rows) {
    // rows[i] describes row (i + 1); rows[0] is the header row and is unused.
    return {
      getLastRow: () => rows.length,
      getRange(row, col) {
        const data = rows[row - 1] || {};
        return {
          getValue: () => {
            if (col === COL.status) return data.status ?? '';
            if (col === COL.invoiceSentAt) return data.invoiceSent ?? '';
            return '';
          },
        };
      },
    };
  }

  it('sends emails only for Confirmed rows that have no invoice timestamp yet', () => {
    const sheet = makeRowsSheet([
      {}, // row 1: header, ignored (loop starts at row 2)
      { status: 'Confirmed', invoiceSent: '' }, // row 2: should send
      { status: 'Confirmed', invoiceSent: new Date() }, // row 3: already sent
      { status: 'Pending', invoiceSent: '' }, // row 4: not confirmed
    ]);
    const sendBookingEmails = build(sheet);
    assert.equal(sendBookingEmails.calls.length, 1);
    assert.equal(sendBookingEmails.calls[0][1], 2);
  });

  it('does nothing when the sheet has no data rows', () => {
    const sheet = makeRowsSheet([{}]);
    const sendBookingEmails = build(sheet);
    assert.equal(sendBookingEmails.calls.length, 0);
  });

  it('returns without error when the Bookings sheet is missing', () => {
    const sendBookingEmails = build(null);
    assert.equal(sendBookingEmails.calls.length, 0);
  });
});