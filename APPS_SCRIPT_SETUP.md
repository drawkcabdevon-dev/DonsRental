# Apps Script Installation for Booking Notifications

## Overview
This script sends email notifications when new bookings are added to the Google Sheet. It runs directly in the Sheet (no external dependencies).

## Installation Steps

### 1. Open the Script Editor
1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1i8rkv11Zmuv_btAiJNji1MAj9GylHOJZEUucAqqb6-0/edit
2. Go to **Extensions > Apps Script**
3. Delete any existing code in `Code.gs`

### 2. Paste the Script
Copy the entire contents of `apps-script/booking-notifications.gs` into the editor.

### 3. Configure Settings
Edit the constants at the top of the script:
```javascript
const OWNER_EMAIL = 'devon@onlineverywhere.com';        // Your notification email
const COMPANY_NAME = "Don's Rental";
const COMPANY_EMAIL = 'bookings@donsrental.com';
const COMPANY_PHONE = '+1 (246) 268-2842';
```

### 4. Save
Press **Ctrl+S** (or **Cmd+S**) to save. Name the project "Don's Rental Notifications".

### 5. Install Trigger
1. In the Apps Script editor, select the `setupTriggers` function from the dropdown
2. Click **Run** (▶️)
3. Approve permissions when prompted:
   - "This app isn't verified" → **Advanced** → **Go to Don's Rental Notifications (unsafe)**
   - Allow access to Google Sheets and Gmail

### 6. Verify
Check that the trigger was created:
- Click the **Triggers** icon (clock) in the left sidebar
- You should see `onEdit` trigger for `onEdit` function

## How It Works

| Event | Action |
|-------|--------|
| New row added to `Bookings` tab with status "Confirmed" | Sends customer confirmation + owner notification |
| `invoiceSentAt` column populated | Prevents duplicate sends |
| Errors | Logged to `notes` column |

## Column Mapping (must match Sheet headers)
| Column | Purpose |
|--------|---------|
| A (bookingId) | Unique reference |
| B (status) | Must be "Confirmed" to trigger |
| T (invoiceSentAt) | Timestamp when emails sent |
| U (notes) | Error messages |

## Testing
1. Add a test row manually to the `Bookings` tab:
   - A: `BK-TEST001`
   - B: `Confirmed`
   - J (custName): `Test User`
   - K (custEmail): `your-email@example.com`
   - F (pickupDate): `2026-08-15`
   - G (pickupTime): `10:00`
   - H (returnDate): `2026-08-17`
   - I (returnTime): `10:00`
   - S (totalAmount): `240`

2. Wait ~30 seconds, check:
   - Your email for owner notification
   - Test email for customer confirmation
   - Column T populated with timestamp

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Script function not found" | Ensure function names match exactly: `onEdit`, `sendBookingEmails`, `setupTriggers` |
| Emails not sending | Check Gmail quota (100/day free), verify `OWNER_EMAIL` |
| Trigger not firing | Re-run `setupTriggers()`, check trigger list |
| Permission denied | Re-authorize: Run > setupTriggers > accept permissions |

## Files
- `apps-script/booking-notifications.gs` — Main script
- This file: `APPS_SCRIPT_SETUP.md`