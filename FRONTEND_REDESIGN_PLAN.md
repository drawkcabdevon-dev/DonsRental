# Frontend Redesign Plan — Don's Rental

## Branching Strategy

This is a major undertaking — all work happens on a feature branch with a PR for review before merging.

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feat/frontend-redesign-gsap

# Work happens on this branch
# ... commits ...

# Push and create PR
git push origin feat/frontend-redesign-gsap
# PR → main with description of all changes
```

**Rules:**
- No direct pushes to `main`
- All changes committed to `feat/frontend-redesign-gsap`
- PR created for review
- User merges after review
- Cloud Build auto-deploys from `main` after merge

---

## Current State

- **Framework**: React 19 + TypeScript + Vite
- **CSS**: Custom Bauhaus Neo-Brutalist system (CSS variables + hand-written utility classes)
- **Components**: 16 total (9 core UI + 3 vehicle/pricing + 2 forms + 2 summary)
- **Animations**: Only 3 CSS keyframe animations (spin, pulse, typing dots)
- **No animation library, no page transitions, no scroll effects**

## Motion Personality: Corporate

For a rental booking app, **Corporate** is the right fit — clean, professional, trustworthy. Not playful (this isn't a game), not premium (this is practical), not energetic (this is calm and focused).

| Constant | Value | Rationale |
|----------|-------|-----------|
| **Signature easing** | `cubic-bezier(0.2, 0, 0, 1)` | Material Design standard — smooth, decisive |
| **Quick duration** | 120ms | Button feedback, toggles, micro-interactions |
| **Standard duration** | 250ms | Card entrances, form transitions, state changes |
| **Slow duration** | 400ms | Page transitions, dramatic reveals, modals |
| **Entrance pattern** | Fade up 16px + opacity 0→1 | Consistent, clean, professional |

---

## Phase 1: Install Skills & Dependencies

### 1.1 Install AI skills
```bash
# GSAP skills (8 skill files: core, timeline, scrolltrigger, plugins, utils, react, performance, frameworks)
npx skills add https://github.com/greensock/gsap-skills

# Motion Design skill (principles, timing, easing, choreography)
npx skills add https://github.com/lottiefiles/motion-design-skill
```

### 1.2 Install GSAP in frontend
```bash
cd frontend
npm install gsap @gsap/react
```

### 1.3 Register plugins in main.tsx
```typescript
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);
```

---

## Phase 2: Motion Tokens (variables.css)

Add to `variables.css`:

```css
:root {
  /* Motion tokens */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-entrance: cubic-bezier(0, 0, 0, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --ease-bounce: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  
  --duration-quick: 120ms;
  --duration-standard: 250ms;
  --duration-slow: 400ms;
  --duration-page: 500ms;
  
  --entrance-distance: 16px;
}
```

---

## Phase 3: Driving Progress Stepper (Hero Feature)

Replace the generic circle stepper with a **road checkpoint system** — a mini car drives along a road as the customer progresses through booking steps.

### 3.1 Visual Concept
```
[HOUSE]----CAR--->[PLATE]-------->[GPS]-------->[FORM]-------->[CHECK]---->[FLAG]
  Step 1          Step 2          Step 3          Step 4          Step 5     Done
```

- **Road**: Horizontal dashed line (2px dashed, charcoal) connecting checkpoint nodes
- **Checkpoints**: Icons at each step (car, calendar, license, form, checkmark, flag)
- **Car SVG**: Small car icon positioned on the road, moves left→right as steps complete
- **Completed road**: Dashed line becomes solid yellow as car passes
- **Active checkpoint**: Pulses yellow glow
- **Completed checkpoint**: Fills green with checkmark

### 3.2 Car Animation
- **Move to next step**: Car slides right (500ms, ease-in-out) with slight bounce at arrival
- **Wheel rotation**: Continuous spin while car is moving (CSS `@keyframes`)
- **Idle at checkpoint**: Subtle idle bounce (scale 1.0→1.02, 1s loop)
- **Engine vibrate**: Micro shake on the car body while moving (1px translate, 50ms loop)

### 3.3 Checkpoint Arrival
When car reaches a new checkpoint:
1. **Road fills**: Dashed line → solid yellow (300ms, width animation)
2. **Checkpoint pulse**: Circle scales 1.0→1.3→1.0 (400ms, bounce ease)
3. **Icon morph**: Step icon transitions to checkmark (fade swap)
4. **Confetti burst**: 3-5 tiny yellow particles burst outward from checkpoint (600ms, gravity)

### 3.4 Step Content Transitions
- **Enter**: Content fades in + slides up 16px (250ms, ease-out)
- **Exit**: Content fades out + slides down 8px (200ms, ease-in)
- Car moves simultaneously with content transition (staggered 100ms after content starts exiting)

### 3.5 Mobile Adaptation
On screens <768px, switch to **vertical road**:
- Road runs top→bottom
- Car rotates 90° (or use a vertical car variant)
- Checkpoints stack vertically
- Same animation principles, vertical axis

---

## Phase 4: Driving Loading States

### 4.1 Booking Submission Loader
When "Confirm Booking" is clicked and API call is in progress:

```
  🚗💨━━━━━━━━━━━━━━━━━━━━━
  Booking your rental...
```

- **Car drives across**: Full-width road animation, car travels left→right (2s loop)
- **Road scrolling**: Dashed road line scrolls left (like a side-scroller)
- **Speed lines**: 3 horizontal lines behind car that fade in/out (motion blur feel)
- **Dust particles**: Tiny dots behind car that drift up and fade (3 particles, staggered)
- **Text pulse**: "Booking your rental..." fades between opacity 0.6 and 1.0
- **Total duration**: Loops until API responds

### 4.2 Vehicle Loading (Step 1)
When vehicles are being fetched:

- **Skeleton cards**: 2 card placeholders with shimmer sweep (CSS gradient animation)
- **Road idle**: Small car sits at Step 1 checkpoint with engine idle animation
- **Subtle bounce**: Car bounces 1px up/down (800ms loop, sine ease)

### 4.3 OCR Processing (Step 3)
When license photo is being scanned:

- **Scanning line**: Horizontal yellow line sweeps down over the license photo preview (like a copier)
- **Progress dots**: 3 dots animate in sequence below the photo
- **Car at license checkpoint**: Subtle pulse while processing

### 4.4 Photo Upload (Step 5)
When license photo is uploading to GCS:

- **Upload progress**: Road fills proportionally to upload % (if progress available)
- **Fallback**: Car drives with dust particles (same as booking loader but shorter)

---

## Phase 5: Component Animations

### 5.1 Buttons
- **Hover**: Scale 1.02 + shadow lift (120ms)
- **Press**: Scale 0.97 (80ms, ease-in)
- **Release**: Spring back to 1.0 (200ms, bounce ease)
- **Loading**: Spinner fades in, text fades out

### 5.2 Vehicle Cards (Step 1)
- **Stagger entrance**: Cards fade up 20px with 80ms stagger
- **Hover**: Subtle lift (translateY -4px) + shadow grow
- **Selected state**: Yellow border draws in, checkmark scales from 0

### 5.3 Pricing Packages (Step 1)
- **Stagger entrance**: Packages slide in from right with 60ms stagger
- **Hover**: Scale 1.02 + border color transition
- **Selected**: Checkmark pops in with bounce ease

### 5.4 Form Inputs
- **Focus**: Border transitions to yellow (150ms), subtle glow pulse
- **Error**: Shake animation (2 oscillations, 300ms) + red border
- **Success/autofill**: Brief green flash + checkmark

### 5.5 Chat Widget
- **Open**: Window scales from 0.8 + fades in (300ms, bounce ease)
- **Close**: Scale to 0.8 + fade out (200ms)
- **Messages**: Each message slides up 8px + fades in (200ms, stagger 50ms)
- **Suggestion chips**: Stagger in from bottom (30ms each)

### 5.6 Booking Summary (Step 5)
- **Stagger rows**: Each detail row fades in left-to-right (40ms stagger)
- **Total cost**: Numbers count up animation
- **Photo preview**: Scale in from 0.9 + fade

---

## Phase 6: Confirmation Arrival Animation

### 6.1 Car Arrives at Destination
When booking is confirmed, the driving stepper reaches the final checkpoint:

1. **Car reaches flag**: Car slides to final position (600ms, ease-in-out)
2. **Celebration burst**: Car "jumps" slightly (scale 1.0→1.1→1.0, 200ms)
3. **Road complete**: Entire road turns solid yellow
4. **All checkpoints green**: Sequential checkmark fill (stagger 80ms)

### 6.2 Success Content
- **Checkmark**: SVG stroke draw-in animation (600ms)
- **Reference number**: Type-in effect, characters appear one by one (50ms each)
- **"Booking confirmed"**: Fade in + slide up (300ms)
- **Details rows**: Stagger fade in from left (40ms each)
- **Ambient**: Subtle yellow particle burst from car position (5 particles, 800ms, gravity)

### 6.3 "Book Another" Reset
- Car drives back to start (reverse animation, 400ms)
- All checkpoints reset (fade to empty circles)
- Content fades out, fresh step 1 fades in

---

## Phase 7: Scroll Effects

### 7.1 Section headers
- Fade up 20px as they enter viewport (ScrollTrigger, start: "top 85%")

### 7.2 Vehicle grid
- Cards stagger in as grid enters viewport

### 7.3 Pricing breakdown
- Slides in from right as it enters viewport

### 7.4 Chat banner (Step 1)
- Parallax: banner moves at 80% scroll speed for depth

### 7.5 Footer
- Fade in as it enters viewport

---

## Phase 8: Accessibility & Polish

### 8.1 Reduced motion
```typescript
useGSAP(() => {
  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: reduce)", () => {
    // Disable all animations, use instant transitions
    gsap.globalTimeline.timeScale(100); // effectively instant
  });
});
```

### 8.2 Performance
- Use `will-change: transform` on animated elements
- Use `autoAlpha` instead of `opacity` (hides from screen readers when invisible)
- Use `gsap.context()` for cleanup on unmount
- Batch ScrollTrigger calls

### 8.3 Responsive
- Desktop: Full animations
- Tablet: Reduced stagger distances
- Mobile: Simplified animations (fewer secondary motions), vertical road

---

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/package.json` | Add `gsap`, `@gsap/react` |
| `frontend/src/main.tsx` | Register GSAP plugins |
| `frontend/src/styles/variables.css` | Add motion tokens |
| `frontend/src/styles/components.css` | Add animation classes, update existing hover/focus states, driving road styles |
| `frontend/src/App.tsx` | Step transitions, scroll effects, entrance animations |
| `frontend/src/components/index.tsx` | Button press/hover, ChatWidget open/close, message animations |
| `frontend/src/components/VehicleCard.tsx` | Card stagger entrance, hover lift, selected state |
| `frontend/src/components/Forms.tsx` | Input focus animations, error shake, OCR scanning line |
| `frontend/src/components/Summary.tsx` | Row stagger, success checkmark |

## New Files

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useAnimations.ts` | Shared animation hooks (step transitions, stagger entrance, etc.) |
| `frontend/src/components/AnimatedContainer.tsx` | Wrapper for step transitions |
| `frontend/src/components/DrivingStepper.tsx` | Road checkpoint stepper with car SVG, animations |
| `frontend/src/components/DrivingLoader.tsx` | Loading states with driving car animation |
| `frontend/src/components/CarSvg.tsx` | Reusable car SVG icon (with wheel rotation animation) |

## Driving-Specific CSS (components.css additions)

```css
/* Road container */
.driving-road {
  position: relative;
  display: flex;
  align-items: center;
  padding: var(--space-8) 0;
}

/* Dashed road line */
.road-line {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: repeating-linear-gradient(
    90deg,
    var(--color-charcoal) 0px,
    var(--color-charcoal) 8px,
    transparent 8px,
    transparent 16px
  );
  transform: translateY(-50%);
  z-index: 0;
}

/* Completed road (solid yellow) */
.road-line-fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 2px;
  background: var(--color-yellow);
  transform: translateY(-50%);
  z-index: 1;
  transition: width 500ms var(--ease-standard);
}

/* Checkpoint node */
.road-checkpoint {
  position: relative;
  z-index: 2;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: var(--border-normal) solid var(--color-charcoal);
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 250ms var(--ease-standard);
}

.road-checkpoint.active {
  border-color: var(--color-yellow);
  box-shadow: 0 0 0 4px rgba(255, 204, 0, 0.2);
}

.road-checkpoint.completed {
  background: var(--color-success);
  border-color: var(--color-success);
  color: white;
}

/* Car on road */
.road-car {
  position: absolute;
  z-index: 3;
  transition: left 500ms var(--ease-standard);
}

.road-car.moving {
  animation: carBounce 400ms ease-in-out;
}

@keyframes carBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

/* Wheel rotation */
.car-wheel {
  animation: wheelSpin 600ms linear infinite;
}

.road-car.idle .car-wheel {
  animation: none;
}

@keyframes wheelSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Speed lines behind car */
.speed-line {
  position: absolute;
  height: 2px;
  background: var(--color-medium-gray);
  border-radius: 1px;
  opacity: 0;
  animation: speedFade 800ms ease-in-out infinite;
}

@keyframes speedFade {
  0% { opacity: 0; transform: translateX(0); }
  30% { opacity: 0.6; }
  100% { opacity: 0; transform: translateX(-30px); }
}

/* Dust particles */
.dust-particle {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-medium-gray);
  animation: dustFloat 1s ease-out infinite;
}

@keyframes dustFloat {
  0% { opacity: 0.8; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(-20px, -10px) scale(0); }
}

/* OCR scanning line */
.scanning-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-yellow);
  box-shadow: 0 0 8px var(--color-yellow);
  animation: scanSweep 1.5s ease-in-out infinite;
}

@keyframes scanSweep {
  0% { top: 0; }
  50% { top: 100%; }
  100% { top: 0; }
}

/* Mobile: vertical road */
@media (max-width: 768px) {
  .driving-road {
    flex-direction: column;
    padding: 0 var(--space-8);
  }
  .road-line {
    width: 2px;
    height: 100%;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    background: repeating-linear-gradient(
      180deg,
      var(--color-charcoal) 0px,
      var(--color-charcoal) 8px,
      transparent 8px,
      transparent 16px
    );
  }
  .road-line-fill {
    width: 2px;
    height: var(--fill-height, 0%);
    top: 0;
    left: 50%;
    transform: translateX(-50%);
  }
}
```

---

## Execution Order

1. Install dependencies (GSAP + skills)
2. Add motion tokens to variables.css
3. Create CarSvg component
4. Create DrivingStepper component (replace ProgressStepper)
5. Create DrivingLoader component
6. Create useAnimations hook
7. Add step transition animations to App.tsx
8. Wire up DrivingStepper with car movement
9. Animate buttons (hover/press feedback)
10. Animate vehicle cards (stagger entrance)
11. Animate pricing packages (stagger entrance)
12. Animate form inputs (focus/error states, OCR scanning line)
13. Animate chat widget (open/close, messages)
14. Add scroll effects (section headers, parallax)
15. Add confirmation arrival animation
16. Add reduced motion support
17. Test on mobile (vertical road)
18. Performance audit
