# Don's Rental — Frontend

A Bauhaus Neo-Brutalist SPA (Single Page Application) for fast, hassle-free car rentals powered by Vertex AI Agent Engine.

## Tech Stack

- **React 19** with TypeScript
- **Vite** — blazing-fast build tool
- **GSAP** — animations and motion design
- **React Router** — client-side routing (/terms, /privacy)
- **Google Identity Services** — Sign-In integration
- **Space Grotesk** — geometric sans-serif font

## Architecture: 6-Step Booking Flow

```
Step 1: Vehicle Selection + Availability Calendar
  └─ Interactive calendar shows available/booked dates
  └─ Click a date → jumps to Step 2 with dates pre-filled
  └─ Browse fleet with specs and pricing

Step 2: Dates & Pricing
  └─ Pick-up/return dates, times
  └─ Live availability checking (500ms debounce)
  └─ Pricing package selection
  └─ "Next" blocked if dates unavailable

Step 3: Driver's License Verification
  └─ Upload/photo capture (OCR via Gemini)
  └─ Manual entry fallback
  └─ Camera integration on mobile

Step 4: Your Info
  └─ Name, email, phone, address
  └─ Auto-fills from Google Sign-In profile

Step 5: Review & Confirm
  └─ Summary card with total cost (BBD)
  └─ License photo preview
  └─ Terms & Conditions acceptance checkbox
  └─ Submit booking → success confirmation

Step 6: Confirmed
  └─ Booking reference
  └─ Profile save prompt (for logged-in users)
```

## Design System: Bauhaus Neo-Brutalist

### Colors
- **Primary Black**: `#1a1a1a`
- **Accent Yellow**: `#FFCC00`
- **Light Gray**: `#f5f5f0`
- **Dark Gray**: `#2d2d2d`

### Typography
- **Font**: Space Grotesk (400, 600, 700, 800)
- **Style**: Uppercase headlines, geometric
- **Hierarchy**: 4xl → xs with consistent spacing

### Components
- Heavy 2-4px borders
- Sharp corners (no rounded borders except buttons)
- Minimal shadows, high contrast
- Clear CTAs with bold typography

## Project Structure

```
src/
├── components/
│   ├── index.ts              # Core UI library (Button, Input, Card, etc.)
│   ├── AvailabilityCalendar.tsx  # Interactive month calendar with availability dots
│   ├── VehicleCard.tsx       # Vehicle display & pricing breakdown
│   ├── DrivingStepper.tsx    # GSAP-animated progress stepper
│   ├── DrivingLoader.tsx     # Loading animation
│   ├── CarSvg.tsx            # Car SVG illustration
│   ├── Forms.tsx             # Personal info & license forms
│   └── Summary.tsx           # Booking review & confirmation
├── pages/
│   ├── TermsAndConditions.tsx    # Terms & Conditions page
│   └── PrivacyPolicy.tsx         # Privacy Policy page
├── services/
│   └── api.ts                # Backend API integration
├── hooks/
│   └── useAnimations.ts      # GSAP animation hooks
├── types/
│   └── index.ts              # TypeScript interfaces
├── styles/
│   ├── variables.css         # CSS custom properties
│   └── components.css        # Component styles
├── App.tsx                   # Main booking app (6 steps)
└── main.tsx                  # React entry + BrowserRouter

tailwind.config.js            # Design system configuration
postcss.config.js             # PostCSS plugins
```

## Getting Started

### Install Dependencies
```bash
npm install
```

### Set Environment Variables
```bash
cp .env.example .env
# Edit .env with your API endpoints
```

### Development Server
```bash
npm run dev
```

Runs at `http://localhost:5173`

### Build for Production
```bash
npm run build
```

Outputs to `dist/` for deployment.

## Component API Reference

### Button
```tsx
<Button variant="primary|secondary|outline|danger" size="sm|md|lg" isLoading={false}>
  Click me
</Button>
```

### Input
```tsx
<Input 
  label="Field Name" 
  variant="text|email|date|time"
  error="Error message"
  hint="Help text"
/>
```

### Card
```tsx
<Card elevated={false} dense={false}>
  Content
</Card>
```

### AvailabilityCalendar
```tsx
<AvailabilityCalendar
  onDateSelect={(date) => { /* date clicked */ }}
  selectedPickup="2026-07-29"
  selectedReturn="2026-07-31"
/>
```

### DrivingStepper
```tsx
<DrivingStepper
  steps={['Vehicle', 'Dates', 'License', 'Info', 'Review']}
  currentStep={1}
/>
```

## API Integration

The app communicates with the backend at `VITE_API_BASE` (default: `http://localhost:8000/api`).

### Endpoints

- `GET /api/vehicles` — List available vehicles
- `POST /api/bookings` — Create a booking
- `POST /api/check-availability` — Check single date range
- `POST /api/check-availability-batch` — Check multiple date ranges (for calendar)
- `POST /api/scan-license` — OCR license photo
- `GET /api/profiles/{email}` — Get user profile
- `POST /api/profiles` — Create/update user profile

See [src/services/api.ts](src/services/api.ts) for implementation.

## Features

- **Availability Calendar** — Interactive month view with green (available) / red (booked) dots
- **Google Sign-In** — Auto-fill from saved profile on return visits
- **Profile Auto-fill** — Previous booking data pre-fills Step 4
- **Live Availability** — Real-time checking with visual status indicator
- **Toast Notifications** — Success/error feedback
- **Accessibility** — ARIA labels, keyboard nav, focus management, color contrast
- **SEO** — Meta tags, Open Graph, JSON-LD structured data, sitemap.xml
- **GSAP Animations** — Driving stepper, smooth transitions, motion design

## Deployment

### Cloud Run (via backend)
The frontend is built into the Docker image and served as static files from the Cloud Run backend:

```python
# backend/main.py
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

ISC — Don's Rental © 2024
