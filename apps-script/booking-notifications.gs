/**
 * Google Apps Script for Don's Rental booking notifications
 * 
 * INSTALLATION:
 * 1. Open your Google Sheet
 * 2. Extensions > Apps Script
 * 3. Paste this code into Code.gs
 * 4. Save (Ctrl+S)
 * 5. Run `setupTriggers()` once to install the triggers
 * 6. Approve permissions when prompted
 */

const SHEET_NAME = 'Bookings';
const OWNER_EMAIL = 'devon@onlineverywhere.com';
const COMPANY_NAME = "Don's Rental";
const COMPANY_EMAIL = 'bookings@donsrental.com';
const COMPANY_PHONE = '+1 (246) 268-2842';

// Column indices (1-based) matching the sheet headers
const COL = {
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
  notes: 21
};

// Find the Bookings sheet by name - fail if not found
function getBookingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found. Available sheets: ${ss.getSheets().map(s => s.getName()).join(', ')}`);
  }
  return sheet;
}

/**
 * Time-driven trigger: scans for new Confirmed bookings every 5 minutes
 * This is the PRIMARY trigger — onEdit doesn't fire for API writes
 */
function checkNewBookings() {
  try {
    const sheet = getBookingsSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      console.log('checkNewBookings: no data rows');
      return;
    }
    
    // Read all data at once for efficiency
    const data = sheet.getRange(2, 1, lastRow - 1, COL.notes).getValues();
    let processed = 0;
    
    for (let i = 0; i < data.length; i++) {
      const row = i + 2;
      const status = data[i][COL.status - 1];
      const invoiceSent = data[i][COL.invoiceSentAt - 1];
      const bookingId = data[i][COL.bookingId - 1];
      
      // Only send if status is Confirmed and invoice hasn't been sent yet
      if (status === 'Confirmed' && !invoiceSent && bookingId) {
        console.log(`checkNewBookings: processing row ${row} — ${bookingId}`);
        sendBookingEmails(row);
        processed++;
      }
    }
    
    console.log(`checkNewBookings: processed ${processed} booking(s)`);
  } catch (err) {
    console.error('checkNewBookings error:', err);
  }
}

/**
 * onEdit trigger — fires for manual edits in the sheet
 * NOTE: Does NOT fire when backend writes via Sheets API
 */
function onEdit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();

    // Only process edits on the Bookings sheet
    const bookingsSheet = getBookingsSheet();
    if (sheet.getSheetId() !== bookingsSheet.getSheetId()) return;

    const startRow = range.getRow();
    const numRows = range.getNumRows();
    const startCol = range.getColumn();
    const numCols = range.getNumColumns();

    // Check if the status column is in the edited range
    const statusColInRange = startCol <= COL.status && COL.status < startCol + numCols;
    if (!statusColInRange) return;

    for (let i = 0; i < numRows; i++) {
      const row = startRow + i;
      if (row <= 1) continue;

      const status = sheet.getRange(row, COL.status).getValue();
      const invoiceSent = sheet.getRange(row, COL.invoiceSentAt).getValue();

      if (status === 'Confirmed' && !invoiceSent) {
        console.log(`onEdit: processing row ${row}`);
        sendBookingEmails(row);
      }
    }
  } catch (err) {
    console.error('onEdit error:', err);
  }
}

/**
 * Send confirmation emails for a booking
 */
function sendBookingEmails(row) {
  const sheet = getBookingsSheet();
  
  try {
    console.log(`sendBookingEmails: reading row ${row}`);
    
    // Read all booking data
    const data = {};
    Object.entries(COL).forEach(([key, col]) => {
      data[key] = sheet.getRange(row, col).getValue();
    });
    
    console.log(`sendBookingEmails: bookingId=${data.bookingId}, email=${data.custEmail}, name=${data.custName}`);
    
    // Skip if missing required fields
    if (!data.bookingId) {
      console.log('sendBookingEmails: missing bookingId, skipping');
      return;
    }
    if (!data.custEmail) {
      console.log('sendBookingEmails: missing custEmail, skipping');
      // Log to sheet so we know why it was skipped
      sheet.getRange(row, COL.notes).setValue('Skipped: no customer email');
      return;
    }
    
    // Send customer confirmation
    try {
      sendCustomerConfirmation(data);
      console.log(`sendBookingEmails: customer email sent to ${data.custEmail}`);
    } catch (err) {
      console.error(`sendBookingEmails: customer email failed: ${err.message}`);
      sheet.getRange(row, COL.notes).setValue(`Customer email error: ${err.message}`);
    }
    
    // Send owner notification
    try {
      sendOwnerNotification(data);
      console.log(`sendBookingEmails: owner notification sent to ${OWNER_EMAIL}`);
    } catch (err) {
      console.error(`sendBookingEmails: owner notification failed: ${err.message}`);
      // Don't overwrite customer error note
      const existing = sheet.getRange(row, COL.notes).getValue();
      if (!existing) {
        sheet.getRange(row, COL.notes).setValue(`Owner email error: ${err.message}`);
      }
    }
    
    // Mark invoice as sent (timestamp)
    sheet.getRange(row, COL.invoiceSentAt).setValue(new Date());
    
    console.log(`sendBookingEmails: done for ${data.bookingId}`);
  } catch (err) {
    console.error('sendBookingEmails error:', err);
    try {
      sheet.getRange(row, COL.notes).setValue(`Error: ${err.message}`);
    } catch (e) {
      console.error('Failed to log error to sheet:', e);
    }
  }
}

/**
 * Send booking confirmation to customer
 */
function sendCustomerConfirmation(data) {
  const subject = `Booking Confirmation — ${COMPANY_NAME} (Ref: ${data.bookingId})`;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;">
      <div style="background:#0f3460;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;">
        <h2 style="margin:0;">${escapeHtml(COMPANY_NAME)}</h2>
        <p style="margin:4px 0 0;opacity:.85;">Booking Confirmation &amp; Invoice</p>
      </div>
      <div style="padding:24px 32px;border:1px solid #e0e0e0;border-top:0;border-radius:0 0 12px 12px;">
        <p>Hi <strong>${escapeHtml(data.custName || 'Customer')}</strong>,</p>
        <p>Your booking is confirmed!</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Reference</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700;">${escapeHtml(data.bookingId)}</td></tr>
          <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Vehicle</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(data.vehicleName || 'Standard Rental Car')}</td></tr>
          <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Pick-up</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;">${formatDate(data.pickupDate)} at ${escapeHtml(data.pickupTime || '09:00')}</td></tr>
          <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Return</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;">${formatDate(data.returnDate)} at ${escapeHtml(data.returnTime || '09:00')}</td></tr>
          <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Duration</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;">${calculateDays(data.pickupDate, data.returnDate)} day(s)</td></tr>
          <tr><td style="padding:8px 12px;color:#666;">Total Due</td>
              <td style="padding:8px 12px;font-size:1.15rem;font-weight:700;color:#0f3460;">Bds$${data.totalAmount || 0}</td></tr>
        </table>
        <h3>Payment</h3>
        <p style="color:#555;">Pay when you pick up the vehicle. We accept cash and card.</p>
        ${data.licenseNum ? `
        <h3 style="margin-top:24px;">License</h3>
        <p style="color:#555;">${escapeHtml(data.licenseNum)} (exp ${escapeHtml(data.licenseExpiry || 'N/A')}) &bull; ${escapeHtml(data.licenseIssuer || 'N/A')}</p>
        ` : ''}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#999;font-size:.85rem;">${escapeHtml(COMPANY_NAME)} &bull; ${escapeHtml(COMPANY_PHONE)} &bull; ${escapeHtml(COMPANY_EMAIL)}</p>
      </div>
    </body>
    </html>
  `;
  
  const textBody = `
${COMPANY_NAME} — Booking Confirmation

Reference: ${data.bookingId}
Customer: ${data.custName || 'Customer'}
Vehicle: ${data.vehicleName || 'Standard Rental Car'}
Pick-up: ${formatDate(data.pickupDate)} at ${data.pickupTime || '09:00'}
Return: ${formatDate(data.returnDate)} at ${data.returnTime || '09:00'}
Duration: ${calculateDays(data.pickupDate, data.returnDate)} day(s)
Total Due: Bds$${data.totalAmount || 0}

Payment: Pay when you pick up the vehicle. We accept cash and card.

${COMPANY_NAME} • ${COMPANY_PHONE} • ${COMPANY_EMAIL}
  `.trim();
  
  MailApp.sendEmail({
    to: data.custEmail,
    subject: subject,
    htmlBody: htmlBody,
    textBody: textBody,
    name: COMPANY_NAME,
    replyTo: COMPANY_EMAIL
  });
}

/**
 * Send notification to owner
 */
function sendOwnerNotification(data) {
  const subject = `New Booking: ${data.custName || 'Unknown'} — ${data.vehicleName || 'Vehicle'} (${data.bookingId})`;
  
  const body = `
New booking received!

Reference: ${data.bookingId}
Customer: ${data.custName || 'N/A'}
Email: ${data.custEmail}
Phone: ${data.custPhone || 'N/A'}
Vehicle: ${data.vehicleName || 'Standard Rental Car'}
Pick-up: ${formatDate(data.pickupDate)} at ${data.pickupTime || '09:00'}
Return: ${formatDate(data.returnDate)} at ${data.returnTime || '09:00'}
Duration: ${calculateDays(data.pickupDate, data.returnDate)} day(s)
Total: Bds$${data.totalAmount || 0}
License: ${data.licenseNum || 'N/A'} (exp ${data.licenseExpiry || 'N/A'})

View in sheet: ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}
  `.trim();
  
  MailApp.sendEmail({
    to: OWNER_EMAIL,
    subject: subject,
    textBody: body
  });
}

/**
 * Helper: Format date for display
 */
function formatDate(dateVal) {
  if (!dateVal) return 'N/A';
  try {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(dateVal);
  }
}

/**
 * Helper: Calculate days between dates
 */
function calculateDays(pickup, returnDate) {
  if (!pickup || !returnDate) return 1;
  try {
    const p = pickup instanceof Date ? pickup : new Date(pickup);
    const r = returnDate instanceof Date ? returnDate : new Date(returnDate);
    return Math.max(1, Math.ceil((r - p) / (1000 * 60 * 60 * 24)) + 1);
  } catch (e) {
    return 1;
  }
}

/**
 * Helper: Escape HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Run once to install triggers
 */
function setupTriggers() {
  // Delete existing triggers for this script
  const allTriggers = ScriptApp.getProjectTriggers();
  allTriggers.forEach(t => {
    ScriptApp.deleteTrigger(t);
  });
  
  // Time-driven trigger: check for new bookings every 5 minutes
  ScriptApp.newTrigger('checkNewBookings')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  console.log('Trigger installed: checkNewBookings runs every 5 minutes');
  console.log('Go to Triggers (clock icon) to verify it appears');
}

/**
 * Test function - run manually to test emails
 * Sends emails for the last booking in the sheet
 */
function testEmails() {
  const sheet = getBookingsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    console.log('No bookings found');
    return;
  }
  
  console.log(`Testing emails for row ${lastRow}...`);
  sendBookingEmails(lastRow);
  console.log('Test complete — check your email and the notes column');
}

/**
 * Manual retry - try sending emails for a specific row
 * Usage: retryRow(2) to retry row 2
 */
function retryRow(row) {
  console.log(`Retrying row ${row}...`);
  // Clear any previous error
  const sheet = getBookingsSheet();
  sheet.getRange(row, COL.notes).setValue('');
  sheet.getRange(row, COL.invoiceSentAt).setValue('');
  sendBookingEmails(row);
  console.log('Retry complete');
}

/**
 * Backfill - send emails for all existing confirmed bookings without invoiceSentAt
 */
function backfillEmails() {
  const sheet = getBookingsSheet();
  const lastRow = sheet.getLastRow();
  let count = 0;
  
  for (let row = 2; row <= lastRow; row++) {
    const status = sheet.getRange(row, COL.status).getValue();
    const invoiceSent = sheet.getRange(row, COL.invoiceSentAt).getValue();
    
    if (status === 'Confirmed' && !invoiceSent) {
      sendBookingEmails(row);
      count++;
    }
  }
  console.log(`Backfill complete — processed ${count} booking(s)`);
}

/**
 * Debug - check sheet status and print info
 */
function debugSheet() {
  const sheet = getBookingsSheet();
  const lastRow = sheet.getLastRow();
  console.log(`Sheet: ${sheet.getName()}, Rows: ${lastRow}`);
  
  if (lastRow <= 1) {
    console.log('No data rows');
    return;
  }
  
  const data = sheet.getRange(2, 1, lastRow - 1, COL.notes).getValues();
  for (let i = 0; i < data.length; i++) {
    const row = i + 2;
    const bookingId = data[i][COL.bookingId - 1];
    const status = data[i][COL.status - 1];
    const email = data[i][COL.custEmail - 1];
    const invoiceSent = data[i][COL.invoiceSentAt - 1];
    const notes = data[i][COL.notes - 1];
    console.log(`Row ${row}: ${bookingId} | status=${status} | email=${email} | invoiceSent=${invoiceSent} | notes=${notes}`);
  }
}