import { motion, useScroll, useTransform, useSpring, useInView, AnimatePresence } from 'motion/react';
import { useRef, useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Vehicle } from '../types';

/* ─── SVG Icons ────────────────────────────────────── */
const Icons = {
  car: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  ),
  calendar: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  ),
  camera: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
    </svg>
  ),
  check: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  bolt: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  shield: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  clock: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  ),
  globe: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  ),
  star: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  arrowRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  phone: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" />
    </svg>
  ),
};

/* ─── Animated Counter ─────────────────────────────── */
function AnimCounter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const dur = 1200;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      setVal(Math.floor(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, target]);
  return <span ref={ref}>{prefix}{val}{suffix}</span>;
}

/* ─── Marquee ──────────────────────────────────────── */
const MARQUEE = ['Airport Pickup', 'No Booking Fees', '24/7 Online', 'Instant Confirmation', 'Full Insurance', 'Barbados Fleet', 'Free Cancellation', 'Fast & Easy'];
function Marquee() {
  return (
    <div style={{ overflow: 'hidden', backgroundColor: 'var(--color-yellow)', padding: 'var(--space-3) 0', borderBottom: '4px solid var(--color-black)' }}>
      <motion.div animate={{ x: ['0%', '-50%'] }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} style={{ display: 'flex', width: 'max-content', gap: 'var(--space-12)' }}>
        {[...MARQUEE, ...MARQUEE].map((item, i) => (
          <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-black)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Icons.bolt style={{ width: 12, height: 12, stroke: 'var(--color-black)', strokeWidth: 2.5 }} /> {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ─── Step Screen Content ──────────────────────────── */
function StepScreen({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 24, fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--color-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color: 'var(--color-black)' }}>{step}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999' }}>Step {step}</div>
          <div style={{ fontSize: 18, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>{title}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

const STEPS = [
  {
    label: 'Choose',
    title: 'Pick Your Ride',
    icon: Icons.car,
    content: (
      <div style={{ background: '#f5f5f0', borderRadius: 14, padding: 18, border: '2px solid #2d2d2d' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {['Picanto', 'Swift', 'Corolla'].map((name, i) => (
            <div key={name} style={{ flex: 1, padding: 10, borderRadius: 8, border: i === 1 ? '2px solid var(--color-yellow)' : '2px solid #e5e5e5', backgroundColor: i === 1 ? '#fffef0' : '#fff', textAlign: 'center' }}>
              <div style={{ marginBottom: 6 }}><Icons.car style={{ width: 28, height: 28, stroke: i === 1 ? 'var(--color-yellow)' : '#666' }} /></div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{name}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-yellow)', marginTop: 4 }}>${[120, 135, 160][i]}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 14px', backgroundColor: 'var(--color-yellow)', borderRadius: 8, textAlign: 'center', fontWeight: 800, fontSize: 13, color: 'var(--color-black)' }}>
          <Icons.bolt style={{ width: 14, height: 14, stroke: 'var(--color-black)', strokeWidth: 2.5, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Select Suzuki Swift
        </div>
      </div>
    ),
  },
  {
    label: 'Dates',
    title: 'Set Your Dates',
    icon: Icons.calendar,
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { label: 'Pick-up', value: 'Aug 26, 2026 — 9:00 AM', icon: Icons.bolt },
          { label: 'Return', value: 'Aug 28, 2026 — 5:00 PM', icon: Icons.bolt },
        ].map((f) => (
          <div key={f.label} style={{ padding: '12px 14px', border: '2px solid #e5e5e5', borderRadius: 10, backgroundColor: '#fafafa' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', marginBottom: 4, letterSpacing: '0.05em' }}>{f.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{f.value}</div>
          </div>
        ))}
        <div style={{ padding: 12, backgroundColor: 'var(--color-yellow)', borderRadius: 10, textAlign: 'center', fontWeight: 800, fontSize: 14, color: 'var(--color-black)' }}>
          2 Days × $135 = <strong>Bds$270</strong>
        </div>
      </div>
    ),
  },
  {
    label: 'Scan',
    title: 'Snap License',
    icon: Icons.camera,
    content: (
      <div>
        <div style={{ padding: 32, border: '3px dashed #d4d4d4', borderRadius: 14, textAlign: 'center', marginBottom: 12 }}>
          <Icons.camera style={{ width: 44, height: 44, stroke: '#bbb', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#666' }}>Tap to upload or take photo</div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>JPEG, PNG, or HEIC</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', backgroundColor: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
          <Icons.bolt style={{ width: 16, height: 16, stroke: '#16a34a' }} />
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>License recognized instantly</span>
        </div>
      </div>
    ),
  },
  {
    label: 'Confirm',
    title: 'Book & Go',
    icon: Icons.check,
    content: (
      <div style={{ backgroundColor: '#f5f5f0', borderRadius: 14, padding: 18, border: '2px solid #2d2d2d' }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Booking Summary</div>
        {[
          ['Vehicle', 'Suzuki Swift'],
          ['Dates', 'Aug 26 → Aug 28'],
          ['Customer', 'John Smith'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #e5e5e5', fontSize: 12 }}>
            <span style={{ color: '#999', fontWeight: 600 }}>{k}</span>
            <span style={{ fontWeight: 700 }}>{v}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 12 }}>
          <span style={{ color: '#999', fontWeight: 600 }}>License</span>
          <span style={{ fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}><Icons.check style={{ width: 14, height: 14, stroke: '#16a34a', strokeWidth: 3 }} /> Scanned</span>
        </div>
        <div style={{ marginTop: 14, padding: 12, backgroundColor: 'var(--color-yellow)', borderRadius: 10, textAlign: 'center', fontWeight: 800, fontSize: 14, color: 'var(--color-black)' }}>
          <Icons.bolt style={{ width: 14, height: 14, stroke: 'var(--color-black)', strokeWidth: 2.5, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Confirm Booking
        </div>
      </div>
    ),
  },
];

/* ─── How It Works — Tabbed Walkthrough ──────────── */
function HowItWorksTabs() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActive((p) => (p + 1) % 4), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="landing-how-it-works-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--space-10)', alignItems: 'center' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === active;
          return (
            <motion.button key={i} onClick={() => setActive(i)} whileHover={{ x: 6 }} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-5)', backgroundColor: isActive ? 'var(--color-yellow)' : 'transparent', color: isActive ? 'var(--color-black)' : 'var(--color-dark-gray)', border: isActive ? '2px solid var(--color-yellow)' : '2px solid transparent', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left', transition: 'all 0.3s ease' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: isActive ? 'var(--color-black)' : 'var(--color-charcoal)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon style={{ width: 20, height: 20, stroke: isActive ? 'var(--color-yellow)' : 'var(--color-medium-gray)' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: 2 }}>Step {i + 1}</div>
                <div style={{ fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>{s.label}</div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Device frame */}
      <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.3 }} style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 420, backgroundColor: 'var(--color-charcoal)', borderRadius: 28, padding: '14px 14px 0', boxShadow: '0 30px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)' }}>
          {/* Notch */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <div style={{ width: 90, height: 6, backgroundColor: '#444', borderRadius: 3 }} />
          </div>
          {/* Screen */}
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.35 }} style={{ backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', minHeight: 340 }}>
              <StepScreen step={active + 1} title={STEPS[active].title}>
                {STEPS[active].content}
              </StepScreen>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Main Landing Page ────────────────────────────── */
export function LandingPage({ onBookNow }: { onBookNow: () => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 25 });
  const heroY = useTransform(smoothProgress, [0, 0.35], [0, -150]);
  const heroScale = useTransform(smoothProgress, [0, 0.35], [1, 0.93]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.25], [1, 0]);

  useEffect(() => { api.getVehicles().then(setVehicles).catch(() => {}); }, []);

  return (
    <div style={{ backgroundColor: 'var(--color-black)' }}>
      <Marquee />

      {/* ═══ HERO — MOTION GRAPHIC ═════════════════════ */}
      <motion.header ref={heroRef} style={{ y: heroY, scale: heroScale, opacity: heroOpacity }}>
        <div className="landing-hero" style={{
          minHeight: '100vh',
          backgroundColor: 'var(--color-black)',
          color: 'var(--color-white)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Animated grid */}
          <motion.div animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }} style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,204,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,204,0,0.06) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />

          {/* Rotating bolt behind content */}
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} style={{ position: 'absolute', width: 500, height: 500, pointerEvents: 'none', opacity: 0.08 }}>
            <Icons.bolt style={{ width: '100%', height: '100%', stroke: 'var(--color-yellow)', strokeWidth: 0.5 }} />
          </motion.div>

          {/* Lightning flash overlay */}
          <motion.div animate={{ opacity: [0, 0, 0, 0.15, 0, 0.08, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--color-yellow)', pointerEvents: 'none', zIndex: 3 }} />

          {/* Center content */}
          <div className="landing-hero-content" style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 var(--space-6)', maxWidth: 900 }}>
            {/* Flash flicker on content */}
            <motion.div animate={{ opacity: [1, 1, 1, 0.6, 1, 0.85, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}>
            {/* Bolt icon - large */}
            <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="landing-hero-bolt" style={{ marginBottom: 'var(--space-6)' }}>
              <motion.div animate={{ filter: ['drop-shadow(0 0 20px rgba(255,204,0,0.6))', 'drop-shadow(0 0 40px rgba(255,204,0,0.9))', 'drop-shadow(0 0 20px rgba(255,204,0,0.6))'] }} transition={{ duration: 2, repeat: Infinity }}>
                <Icons.bolt style={{ width: 80, height: 80, stroke: 'var(--color-yellow)', strokeWidth: 2, margin: '0 auto' }} />
              </motion.div>
            </motion.div>

            {/* Main title - cinematic reveal */}
            <div style={{ overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
              <motion.div initial={{ y: '120%' }} animate={{ y: 0 }} transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} style={{ fontSize: 'clamp(4rem, 10vw, 8rem)', fontWeight: 900, lineHeight: 0.9, letterSpacing: '-0.04em', textTransform: 'uppercase', fontFamily: "'Inter', 'Arial Black', sans-serif" }}>
                DON<span style={{ display: 'inline-flex', verticalAlign: 'super', marginTop: '-0.15em' }}><Icons.bolt style={{ width: '0.65em', height: '0.65em', stroke: 'var(--color-yellow)', strokeWidth: 2.5, fill: 'var(--color-yellow)' }} /></span>S
              </motion.div>
            </div>
            <div style={{ overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
              <motion.div initial={{ y: '120%' }} animate={{ y: 0 }} transition={{ duration: 1, delay: 0.45, ease: [0.16, 1, 0.3, 1] }} style={{ fontSize: 'clamp(4rem, 10vw, 8rem)', fontWeight: 900, lineHeight: 0.9, letterSpacing: '-0.04em', textTransform: 'uppercase', color: 'var(--color-yellow)', fontFamily: "'Inter', 'Arial Black', sans-serif" }}>
                RENTAL
              </motion.div>
            </div>

            {/* Animated underline */}
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }} style={{ height: 4, backgroundColor: 'var(--color-yellow)', margin: 'var(--space-6) auto', maxWidth: 200, transformOrigin: 'center' }} />

            {/* Tagline */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1 }} style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.7)', marginBottom: 'var(--space-2)' }}>
              Barbados Car Rental
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1.15 }} className="landing-hero-subtitle" style={{ fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)', color: 'rgba(255,255,255,0.45)', marginBottom: 'var(--space-10)', fontFamily: 'var(--font-mono)' }}>
              Online Booking · Zero Phone Calls · Fast & Easy
            </motion.div>

            {/* CTA buttons */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 1.3 }} className="landing-hero-cta" style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <motion.button whileHover={{ scale: 1.06, boxShadow: '0 0 60px rgba(255,204,0,0.5)' }} whileTap={{ scale: 0.95 }} onClick={onBookNow} style={{ backgroundColor: 'var(--color-yellow)', color: 'var(--color-black)', border: 'none', padding: 'var(--space-5) var(--space-12)', fontSize: 'var(--font-size-lg)', fontWeight: 800, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <Icons.bolt style={{ width: 20, height: 20 }} /> Book Now
              </motion.button>
              <motion.a whileHover={{ scale: 1.06, borderColor: 'var(--color-yellow)', color: 'var(--color-yellow)' }} whileTap={{ scale: 0.95 }} href="#how-it-works" style={{ color: 'var(--color-white)', border: '2px solid rgba(255,255,255,0.3)', padding: 'var(--space-5) var(--space-10)', fontSize: 'var(--font-size-lg)', fontWeight: 700, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                How It Works ↓
              </motion.a>
            </motion.div>

            {/* Stats row */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.6 }} className="landing-hero-stats" style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-12)', marginTop: 'var(--space-16)', flexWrap: 'wrap' }}>
              {[
                { value: '2min', label: 'Book & Drive' },
                { value: '24/7', label: 'Online Booking' },
                { value: '$0', label: 'Hidden Fees' },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.7 + i * 0.1 }} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 900, color: 'var(--color-yellow)', lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
            </motion.div>
          </div>

          {/* Bottom fade */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(transparent, var(--color-black))', pointerEvents: 'none' }} />
        </div>
      </motion.header>

      {/* ═══ STATS ═══════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.7 }} style={{ backgroundColor: 'var(--color-white)', borderTop: '2px solid var(--color-charcoal)', borderBottom: '2px solid var(--color-charcoal)' }}>
        <div className="landing-stats" style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { icon: Icons.clock, val: 24, pre: '', suf: '/7', label: 'Online' },
            { icon: Icons.globe, val: 100, pre: '', suf: '%', label: 'Digital' },
            { icon: Icons.bolt, val: 2, pre: '<', suf: 'min', label: 'Booking' },
            { icon: Icons.shield, val: 0, pre: '$', suf: '', label: 'Fees' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }} whileHover={{ backgroundColor: 'var(--color-light-gray)' }} className="landing-stat-item" style={{ padding: 'var(--space-7) var(--space-5)', textAlign: 'center', borderRight: i < 3 ? '2px solid var(--color-charcoal)' : 'none', cursor: 'default', transition: 'background-color 0.2s' }}>
              <s.icon style={{ width: 22, height: 22, stroke: 'var(--color-yellow)', margin: '0 auto var(--space-3)' }} />
              <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-yellow)', fontFamily: 'var(--font-mono)' }}>
                <AnimCounter target={s.val} prefix={s.pre} suffix={s.suf} />
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-dark-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 'var(--space-2)' }}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ═══ HOW IT WORKS — Interactive Walkthrough ═════ */}
      <section id="how-it-works" className="landing-section" style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', padding: 'var(--space-24) var(--space-6)' }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ marginBottom: 'var(--space-12)', textAlign: 'center' }}>
          <motion.div initial={{ width: 0 }} whileInView={{ width: 60 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }} style={{ height: 4, backgroundColor: 'var(--color-yellow)', margin: '0 auto var(--space-4)' }} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-yellow)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-3)' }}>How It Works</p>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Four Steps. Done.</h2>
        </motion.div>

        {/* Tabbed walkthrough */}
        <HowItWorksTabs />

        {/* Connecting line */}
        <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.6 }} style={{ height: 3, background: 'var(--color-yellow)', marginTop: 'var(--space-10)', transformOrigin: 'left' }} />
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.9 }} style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-dark-gray)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          → That's it. No phone calls. No waiting.
        </motion.p>
      </section>

      {/* ═══ VEHICLES ═══════════════════════════════════ */}
      {vehicles.length > 0 && (
        <section className="landing-section landing-vehicles" style={{ backgroundColor: 'var(--color-black)', color: 'var(--color-white)', padding: 'var(--space-24) var(--space-6)', borderTop: '4px solid var(--color-yellow)', borderBottom: '4px solid var(--color-yellow)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,204,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,204,0,0.03) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
          <div style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ marginBottom: 'var(--space-12)' }}>
              <motion.div initial={{ width: 0 }} whileInView={{ width: 60 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }} style={{ height: 4, backgroundColor: 'var(--color-yellow)', marginBottom: 'var(--space-4)' }} />
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-yellow)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-3)' }}>Our Fleet</p>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>What You'll Drive</h2>
            </motion.div>
            <div className="landing-vehicle-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 'var(--space-8)' }}>
              {vehicles.map((v, i) => (
                <motion.div key={v.id} initial={{ opacity: 0, y: 60, rotateY: -6 }} whileInView={{ opacity: 1, y: 0, rotateY: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }} whileHover={{ y: -10, scale: 1.02 }} style={{ backgroundColor: 'var(--color-charcoal)', border: '2px solid var(--color-dark-gray)', overflow: 'hidden', position: 'relative' }}>
                  <div className="landing-vehicle-img" style={{ height: 280, background: 'linear-gradient(135deg, #2d2d2d, #1a1a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', borderBottom: '4px solid var(--color-yellow)' }}>
                    <motion.img animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} src="/vehicle.png" alt={v.name} width={400} height={280} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.4))' }} />
                    <motion.div initial={{ x: '-100%', opacity: 0.4 }} whileInView={{ x: '200%', opacity: 0 }} viewport={{ once: true }} transition={{ duration: 1.5, delay: 0.5 + i * 0.2 }} style={{ position: 'absolute', width: 80, height: '200%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', transform: 'skewX(-20deg)' }} />
                  </div>
                  <div style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>{v.name}</h3>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-medium-gray)', lineHeight: 1.7, marginBottom: 'var(--space-5)' }}>{v.description}</p>
                    {v.features && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
                        {v.features.slice(0, 3).map((f) => (
                          <span key={f} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-yellow)', padding: '2px 8px', border: '1px solid rgba(255,204,0,0.3)' }}>{f}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-dark-gray)', paddingTop: 'var(--space-4)' }}>
                      <div>
                        <span style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-yellow)', fontFamily: 'var(--font-mono)' }}>${v.rate}</span>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-medium-gray)', marginLeft: 'var(--space-2)' }}>/ day</span>
                      </div>
                      <motion.button whileHover={{ scale: 1.08, boxShadow: '0 0 25px rgba(255,204,0,0.35)' }} whileTap={{ scale: 0.94 }} onClick={onBookNow} style={{ backgroundColor: 'var(--color-yellow)', color: 'var(--color-black)', border: 'none', padding: 'var(--space-3) var(--space-6)', fontSize: 'var(--font-size-sm)', fontWeight: 700, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        Book Now <Icons.arrowRight style={{ width: 14, height: 14 }} />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ HOW IT'S FAST ═════════════════════════════════ */}
      <section className="landing-section" style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', padding: 'var(--space-24) var(--space-6)' }}>
        <div className="landing-how-fast-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-16)', alignItems: 'center' }}>
          <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <motion.div initial={{ width: 0 }} whileInView={{ width: 60 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }} style={{ height: 4, backgroundColor: 'var(--color-yellow)', marginBottom: 'var(--space-4)' }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-yellow)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-3)' }}>Built For Speed</p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 'var(--space-6)', lineHeight: 1.15 }}>
              Snap Your License.<br /><span style={{ color: 'var(--color-yellow)' }}>We'll Do The Rest.</span>
            </h2>
            <p style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-dark-gray)', lineHeight: 1.7, marginBottom: 'var(--space-8)' }}>
              Take a photo of your Barbados driver's license and we'll handle the details. No typing, no hassle — just snap and go.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {[
                { icon: Icons.bolt, text: 'Instant license recognition' },
                { icon: Icons.check, text: 'Auto-filled personal info' },
                { icon: Icons.shield, text: 'Secure photo storage' },
                { icon: Icons.phone, text: 'Works with any device camera' },
              ].map((item, i) => (
                <motion.div key={item.text} initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }} whileHover={{ x: 8, backgroundColor: 'var(--color-light-gray)' }} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', borderLeft: '3px solid var(--color-yellow)', transition: 'all 0.2s' }}>
                  <item.icon style={{ width: 20, height: 20, stroke: 'var(--color-yellow)', flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 500 }}>{item.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 50, rotateY: 8 }} whileInView={{ opacity: 1, x: 0, rotateY: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.2 }}>
            <motion.div whileHover={{ rotateY: 4, rotateX: -2, scale: 1.02 }} transition={{ duration: 0.3 }} style={{ backgroundColor: 'var(--color-white)', border: '4px solid var(--color-charcoal)', padding: 'var(--space-12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 380, position: 'relative', overflow: 'hidden', perspective: 1000 }}>
              {/* Corner accents */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTop: '4px solid var(--color-yellow)', borderLeft: '4px solid var(--color-yellow)' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottom: '4px solid var(--color-yellow)', borderRight: '4px solid var(--color-yellow)' }} />
              <motion.img animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} src="/dons-car.png" alt="Don's Rental car" width={180} height={240} loading="lazy" style={{ width: 180, height: 240, objectFit: 'cover', borderRadius: 12, filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.15))' }} />
              <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)' }}>
                {['JPEG', 'PNG', 'HEIC'].map((fmt) => (
                  <span key={fmt} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-medium-gray)', padding: '3px 10px', border: '1px solid var(--color-charcoal)' }}>{fmt}</span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ TESTIMONIAL ════════════════════════════════ */}
      <section className="landing-section-compact" style={{ backgroundColor: 'var(--color-charcoal)', color: 'var(--color-white)', padding: 'var(--space-20) var(--space-6)', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 'var(--space-6)' }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <motion.div key={s} initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: s * 0.1, type: 'spring', stiffness: 300 }}>
                <Icons.star style={{ width: 24, height: 24, color: 'var(--color-yellow)' }} />
              </motion.div>
            ))}
          </div>
          <p style={{ fontSize: 'var(--font-size-xl)', fontStyle: 'italic', lineHeight: 1.7, marginBottom: 'var(--space-6)', opacity: 0.9 }}>
            "Booked my car in 90 seconds. Snapped my license, picked dates, done. No phone calls, no waiting on hold. This is how it should be."
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-yellow)', textTransform: 'uppercase' }}>— Happy Customer, Barbados</p>
        </motion.div>
      </section>

      {/* ═══ CTA ════════════════════════════════════════ */}
      <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="landing-cta-section" style={{ backgroundColor: 'var(--color-yellow)', padding: 'var(--space-24) var(--space-6)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 35, repeat: Infinity, ease: 'linear' }} style={{ position: 'absolute', top: -220, right: -220, width: 520, height: 520, border: '4px solid rgba(0,0,0,0.06)', borderRadius: '50%' }} />
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 28, repeat: Infinity, ease: 'linear' }} style={{ position: 'absolute', bottom: -170, left: -170, width: 420, height: 420, border: '3px solid rgba(0,0,0,0.04)', borderRadius: '50%' }} />
        {/* Bolt decorations */}
        <motion.div animate={{ opacity: [0.06, 0.12, 0.06] }} transition={{ duration: 3, repeat: Infinity }} style={{ position: 'absolute', top: 40, left: 60, pointerEvents: 'none' }}>
          <Icons.bolt style={{ width: 100, height: 100, stroke: 'var(--color-black)', strokeWidth: 1.5 }} />
        </motion.div>
        <motion.div animate={{ opacity: [0.04, 0.1, 0.04] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }} style={{ position: 'absolute', bottom: 40, right: 80, pointerEvents: 'none' }}>
          <Icons.bolt style={{ width: 70, height: 70, stroke: 'var(--color-black)', strokeWidth: 1.5 }} />
        </motion.div>
        <div style={{ maxWidth: 650, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, scale: 0.5 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, type: 'spring', stiffness: 200 }} style={{ marginBottom: 'var(--space-4)' }}>
            <Icons.bolt style={{ width: 48, height: 48, stroke: 'var(--color-black)', strokeWidth: 2.5, margin: '0 auto' }} />
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-black)', marginBottom: 'var(--space-4)', letterSpacing: '-0.02em' }}>
            Ready to Drive?
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15 }} style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-charcoal)', marginBottom: 'var(--space-10)', lineHeight: 1.6 }}>
            No phone calls. No waiting. No middlemen.<br />Book your Barbados car rental <strong>in under 2 minutes</strong>.
          </motion.p>
          <motion.button initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }} whileHover={{ scale: 1.06, boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }} whileTap={{ scale: 0.95 }} onClick={onBookNow} style={{ backgroundColor: 'var(--color-black)', color: 'var(--color-yellow)', border: 'none', padding: 'var(--space-6) var(--space-14)', fontSize: 'var(--font-size-xl)', fontWeight: 800, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Icons.bolt style={{ width: 22, height: 22 }} /> Book Now
          </motion.button>
        </div>
      </motion.section>

      {/* ═══ FOOTER ═════════════════════════════════════ */}
      <footer className="landing-footer" style={{ backgroundColor: 'var(--color-black)', color: 'var(--color-white)', padding: 'var(--space-12) var(--space-6)', borderTop: '4px solid var(--color-yellow)' }}>
        <div style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Icons.bolt style={{ width: 24, height: 24, stroke: 'var(--color-yellow)' }} />
              <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 'var(--font-size-lg)' }}>Don's Car Rental</span>
              <span style={{ color: 'var(--color-medium-gray)', marginLeft: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>Barbados</span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-6)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-medium-gray)' }}>
              <a href="/privacy" style={{ color: 'var(--color-medium-gray)', textDecoration: 'none' }}>Privacy</a>
              <a href="/terms" style={{ color: 'var(--color-medium-gray)', textDecoration: 'none' }}>Terms</a>
              <a href="mailto:bookings@donsrental.com" style={{ color: 'var(--color-medium-gray)', textDecoration: 'none' }}>Contact</a>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-dark-gray)' }}>© {new Date().getFullYear()} Don's Car Rental. All rights reserved.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-dark-gray)' }}>
              <span>Built by</span>
              <a href="https://onlineverywhere.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-yellow)', textDecoration: 'none', fontWeight: 600 }}>OnlineVeryWhere</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
