# Don's Rental — Frontend

A Bauhaus Neo-Brutalist SPA (Single Page Application) for fast, hassle-free car rentals powered by Vertex AI Agent Engine.

## Tech Stack

- **React 19** with TypeScript
- **Vite** — blazing-fast build tool
- **Tailwind CSS 4** — utility-first CSS
- **Space Grotesk** — geometric sans-serif font

## Architecture: 5-Step Booking Flow

```
Step 1: Vehicle Selection
  └─ Browse fleet with specs and pricing

Step 2: Dates & Logistics
  └─ Pick-up/return dates, times, drop-off location
  └─ Live pricing summary

Step 3: Personal Information
  └─ Name, email, phone, address

Step 4: Driver's License Verification
  └─ Upload/photo capture (OCR via Gemini)
  └─ Manual entry fallback

Step 5: Review & Confirm
  └─ Summary card with total cost (BBD)
  └─ Submit booking → success confirmation
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
│   ├── VehicleCard.tsx       # Vehicle display & pricing breakdown
│   ├── Forms.tsx             # Personal info & license forms
│   └── Summary.tsx           # Booking review & confirmation
├── services/
│   └── api.ts                # Backend API integration
├── types/
│   └── index.ts              # TypeScript interfaces
├── styles/
│   └── index.css             # Tailwind + component layer CSS
├── App.tsx                   # Main booking app (5 steps)
└── main.tsx                  # React entry point

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

### ProgressStepper
```tsx
<ProgressStepper 
  steps={['Step 1', 'Step 2', 'Step 3']} 
  currentStep={1} 
/>
```

## API Integration

The app communicates with the backend at `VITE_API_BASE` (default: `http://localhost:8000/api`).

### Endpoints

- `GET /api/vehicles` — List available vehicles
- `POST /api/bookings` — Create a booking
- `POST /api/scan-license` — OCR license photo

See [src/services/api.ts](src/services/api.ts) for implementation.

## Styling & Customization

All design tokens are in `tailwind.config.js`:

```js
colors: {
  'bau-black': '#1a1a1a',
  'bau-yellow': '#FFCC00',
  // ...
}
```

Component styles are defined in `src/styles/index.css` using `@layer components`.

## Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 5173
CMD ["npm", "run", "dev"]
```

### Cloud Run (via backend)
The frontend can be served as static files from the Cloud Run backend:

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
