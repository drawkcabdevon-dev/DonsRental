/**
 * Google Apps Script for Don's Rental booking notifications
 * 
 * INSTALLATION:
 * 1. Open your Google Sheet
 * 2. Extensions > Apps Script
 * 3. Paste this code into Code.gs
 * 4. Save (Ctrl+S)
 * 5. Run `setupTriggers()` once to install the onEdit trigger
 * 6. Approve permissions when prompted
 */

const SHEET_NAME = 'Bookings';
const OWNER_EMAIL = 'devon@onlineverywhere.com';
const COMPANY_NAME = "Don's Rental";
const COMPANY_EMAIL = 'bookings@donsrental.com';
const COMPANY_PHONE = '+1 (246) 268-2842';

// Try to find the Bookings sheet by name, then by index (2nd tab)
function getBookingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Bookings');
  if (!sheet) {
    // Fallback: try second tab (index 1)
    const sheets = ss.getSheets();
    if (sheets.length > 1) {
      sheet = sheets[1];
    }
  }
  if (!sheet) {
    throw new Error('Bookings sheet not found');
  }
  return sheet;
}

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

/**
 * Main trigger function - runs on every edit
 */
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  
  // Only process edits on the Bookings sheet
  const bookingsSheet = getBookingsSheet();
  if (sheet.getSheetId() !== bookingsSheet.getSheetId()) return;
  
  // Only process new rows (row > 1, assuming row 1 is headers)
  const row = range.getRow();
  if (row <= 1) return;
  
  // Check if this is a new booking (status column was just set to 'Confirmed')
  const status = sheet.getRange(row, COL.status).getValue();
  const invoiceSent = sheet.getRange(row, COL.invoiceSentAt).getValue();
  
  // Only send if status is Confirmed and invoice hasn't been sent yet
  if (status === 'Confirmed' && !invoiceSent) {
    sendBookingEmails(row);
  }
}

/**
 * Send confirmation emails for a booking
 */
function sendBookingEmails(row) {
  try {
    const sheet = getBookingsSheet();
    // Read all booking data
    const data = {};
    Object.entries(COL).forEach(([key, col]) => {
      data[key] = sheet.getRange(row, col).getValue();
    });
    
    // Skip if missing required fields
    if (!data.custEmail || !data.bookingId) {
      console.log('Missing email or bookingId, skipping');
      return;
    }
    
    // Send customer confirmation
    sendCustomerConfirmation(data);
    
    // Send owner notification
    sendOwnerNotification(data);
    
    // Mark invoice as sent (timestamp)
    sheet.getRange(row, COL.invoiceSentAt).setValue(new Date());
    
    console.log(`Emails sent for booking ${data.bookingId}`);
  } catch (err) {
    console.error('Error sending emails:', err);
    // Log error to sheet notes column
    try {
      const sheet = getBookingsSheet();
      sheet.getRange(row, COL.notes).setValue(`Email error: ${err.message}`);
    } catch (e) {
      console.error('Failed to log error to sheet:', e);
    }
  }
}
    sheet.getRange(row, COL.notes).setValue(`Email error: ${err.message}`);
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
    <body style="font-family: Arial, sans-serif; color: #1a1a2e; max-width: 600px; margin: 0 auto;">
      <div style="background: #0f3460; color: #fff; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h2 style="margin: 0;">${COMPANY_NAME}</h2>
        <p style="margin: 4px 0 0; opacity: .85;">Booking Confirmation & Invoice</p>
      </div>
      <div style="padding: 24px 32px; border: 1px solid #e0e0e0; border-top: 0; border-radius: 0 0 12px 12px;">
        <p>Hi <strong>${escapeHtml(data.custName)}</strong>,</p>
        <p>Your booking is confirmed!</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666;">Reference</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 700;">${escapeHtml(data.bookingId)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666;">Vehicle</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${escapeHtml(data.vehicleName)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666;">Pick-up</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${formatDate(data.pickupDate)} at ${escapeHtml(data.pickupTime)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666;">Return</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${formatDate(data.returnDate)} at ${escapeHtml(data.returnTime)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666;">Duration</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${calculateDays(data.pickupDate, data.returnDate)} day(s)</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; color: #666;">Total Due</td>
            <td style="padding: 8px 12px; font-size: 1.15rem; font-weight: 700; color: #0f3460;">Bds$${data.totalAmount}</td>
          </tr>
        </table>
        
        <h3>Payment</h3>
        <p style="color: #555;">Pay when you pick up the vehicle. We accept cash and card.</p>
        
        <h3 style="margin-top: 24px;">License</h3>
        <p style="color: #555;">${escapeHtml(data.licenseNum)} (exp ${escapeHtml(data.licenseExpiry)}) &bull; ${escapeHtml(data.licenseIssuer)}</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: .85rem;">${COMPANY_NAME} &bull; ${COMPANY_PHONE} &bull; ${COMPANY_EMAIL}</p>
      </div>
    </body>
    </html>
  `;
  
  const textBody = `
${COMPANY_NAME} — Booking Confirmation

Reference: ${data.bookingId}
Customer: ${data.custName}
Vehicle: ${data.vehicleName}
Pick-up: ${formatDate(data.pickupDate)} at ${data.pickupTime}
Return: ${formatDate(data.returnDate)} at ${data.returnTime}
Duration: ${calculateDays(data.pickupDate, data.returnDate)} day(s)
Total Due: Bds$${data.totalAmount}

Payment: Pay when you pick up the vehicle. We accept cash and card.

License: ${data.licenseNum} (exp ${data.licenseExpiry}) • ${data.licenseIssuer}

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
  const subject = `New Booking: ${data.custName} — ${data.vehicleName} (${data.bookingId})`;
  
  const body = `
New booking received!

Reference: ${data.bookingId}
Customer: ${data.custName}
Email: ${data.custEmail}
Phone: ${data.custPhone}
Vehicle: ${data.vehicleName}
Pick-up: ${formatDate(data.pickupDate)} at ${data.pickupTime}
Return: ${formatDate(data.returnDate)} at ${data.returnTime}
Duration: ${calculateDays(data.pickupDate, data.returnDate)} day(s)
Total: Bds$${data.totalAmount}
License: ${data.licenseNum} (exp ${data.licenseExpiry})

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
  if (!dateVal) return '';
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Helper: Calculate days between dates
 */
function calculateDays(pickup, returnDate) {
  if (!pickup || !returnDate) return 1;
  const p = pickup instanceof Date ? pickup : new Date(pickup);
  const r = returnDate instanceof Date ? returnDate : new Date(returnDate);
  return Math.max(1, Math.ceil((r - p) / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Helper: Escape HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, ''');
}

/**
 * Run once to install the trigger
 */
function setupTriggers() {
  // Delete existing triggers for this script
  const allTriggers = ScriptApp.getProjectTriggers();
  allTriggers.forEach(t => {
    if (t.getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // Create new onEdit trigger
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  
  console.log('Trigger installed successfully');
}

/**
 * Test function - run manually to test emails
 */
function testEmails() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    console.log('Bookings sheet not found');
    return;
  }
  
  // Find last row with data
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    console.log('No bookings found');
    return;
  }
  
  sendBookingEmails(sheet, lastRow);
  console.log('Test emails sent for row', lastRow);
}

/**
 * Backfill - send emails for all existing confirmed bookings without invoiceSentAt
 */
function backfillEmails() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return;
  
  const lastRow = sheet.getLastRow();
  for (let row = 2; row <= lastRow; row++) {
    const status = sheet.getRange(row, COL.status).getValue();
    const invoiceSent = sheet.getRange(row, COL.invoiceSentAt).getValue();
    
    if (status === 'Confirmed' && !invoiceSent) {
      sendBookingEmails(sheet, row);
    }
  }
  console.log('Backfill complete');
}
