import { motion, useScroll, useTransform, useSpring, useInView } from 'motion/react';
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
const MARQUEE = ['⚡ Airport Pickup', '⚡ AI License Scan', '⚡ No Booking Fees', '⚡ 24/7 Online', '⚡ Instant Confirmation', '⚡ Full Insurance', '⚡ Barbados Fleet', '⚡ Free Cancellation'];
function Marquee() {
  return (
    <div style={{ overflow: 'hidden', backgroundColor: 'var(--color-yellow)', padding: 'var(--space-3) 0', borderBottom: '4px solid var(--color-black)' }}>
      <motion.div animate={{ x: ['0%', '-50%'] }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} style={{ display: 'flex', width: 'max-content', gap: 'var(--space-12)' }}>
        {[...MARQUEE, ...MARQUEE].map((item, i) => (
          <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-black)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
            {item} <span style={{ margin: '0 var(--space-4)', opacity: 0.3 }}>●</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ─── Device Frame (for walkthrough) ───────────────── */
function DeviceFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <motion.div whileHover={{ y: -6, scale: 1.01 }} transition={{ duration: 0.3 }} style={{ position: 'relative' }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: 24,
        padding: '12px 12px 0',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        {/* Notch */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <div style={{ width: 80, height: 6, backgroundColor: '#333', borderRadius: 3 }} />
        </div>
        {/* Screen */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          overflow: 'hidden',
          minHeight: 320,
          position: 'relative',
        }}>
          {children}
        </div>
      </div>
      <p style={{
        textAlign: 'center',
        marginTop: 'var(--space-4)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-medium-gray)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        {label}
      </p>
    </motion.div>
  );
}

/* ─── Step Screen Content ──────────────────────────── */
function Step1Screen() {
  return (
    <div style={{ padding: 20, fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#FFCC00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>1</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 1</div>
          <div style={{ fontSize: 16, fontWeight: 800, textTransform: 'uppercase' }}>Choose Vehicle</div>
        </div>
      </div>
      <div style={{ background: '#f5f5f0', borderRadius: 12, padding: 16, border: '2px solid #2d2d2d' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🏎️</div>
        <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', marginBottom: 4 }}>Standard Rental Car</div>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>Clean, reliable car for getting around Barbados.</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 20, color: '#FFCC00' }}>$120<span style={{ fontSize: 11, color: '#999' }}>/day</span></span>
          <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: '#FFCC00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icons.check style={{ width: 12, height: 12, stroke: '#000', strokeWidth: 3 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step2Screen() {
  return (
    <div style={{ padding: 20, fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#FFCC00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>2</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 2</div>
          <div style={{ fontSize: 16, fontWeight: 800, textTransform: 'uppercase' }}>Select Dates</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { label: 'Pick-up Date', value: '2026-08-26' },
          { label: 'Pick-up Time', value: '09:00' },
          { label: 'Return Date', value: '2026-08-28' },
          { label: 'Return Time', value: '17:00' },
        ].map((f) => (
          <div key={f.label}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>{f.label}</div>
            <div style={{ padding: '8px 12px', border: '2px solid #ddd', borderRadius: 6, fontSize: 13, fontWeight: 600, backgroundColor: '#fafafa' }}>{f.value}</div>
          </div>
        ))}
        <div style={{ marginTop: 4, padding: 12, backgroundColor: '#FFCC00', borderRadius: 8, textAlign: 'center', fontWeight: 800, fontSize: 13 }}>
          Total: Bds$240 (2 days × $120)
        </div>
      </div>
    </div>
  );
}

function Step3Screen() {
  return (
    <div style={{ padding: 20, fontFamily: 'var(--font-sans)', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, textAlign: 'left' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#FFCC00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>3</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 3</div>
          <div style={{ fontSize: 16, fontWeight: 800, textTransform: 'uppercase' }}>Scan License</div>
        </div>
      </div>
      <div style={{ padding: 30, border: '3px dashed #ddd', borderRadius: 12, marginBottom: 12 }}>
        <Icons.camera style={{ width: 40, height: 40, stroke: '#ccc', margin: '0 auto 8px' }} />
        <div style={{ fontSize: 13, fontWeight: 600, color: '#666' }}>Tap to upload or take photo</div>
        <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>JPEG, PNG, or HEIC</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
        <Icons.bolt style={{ width: 16, height: 16, stroke: '#16a34a' }} />
        <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>AI reads your license instantly</span>
      </div>
    </div>
  );
}

function Step4Screen() {
  return (
    <div style={{ padding: 20, fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#FFCC00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>4</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 4</div>
          <div style={{ fontSize: 16, fontWeight: 800, textTransform: 'uppercase' }}>Confirm</div>
        </div>
      </div>
      <div style={{ backgroundColor: '#f5f5f0', borderRadius: 12, padding: 16, border: '2px solid #2d2d2d' }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, textTransform: 'uppercase' }}>Booking Summary</div>
        {[
          ['Vehicle', 'Standard Rental Car'],
          ['Dates', 'Aug 26 → Aug 28'],
          ['Customer', 'John Smith'],
          ['License', '••••4582'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 12 }}>
            <span style={{ color: '#666' }}>{k}</span>
            <span style={{ fontWeight: 600 }}>{v}</span>
          </div>
        ))}
        <div style={{ marginTop: 12, padding: 12, backgroundColor: '#FFCC00', borderRadius: 8, textAlign: 'center', fontWeight: 800, fontSize: 14 }}>
          ✓ Confirm Booking
        </div>
      </div>
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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-background)' }}>
      <Marquee />

      {/* ═══ HERO ═══════════════════════════════════════ */}
      <motion.header ref={heroRef} style={{ y: heroY, scale: heroScale, opacity: heroOpacity }}>
        <div style={{
          backgroundColor: 'var(--color-black)',
          color: 'var(--color-white)',
          padding: 'var(--space-24) var(--space-6) var(--space-20)',
          borderBottom: '4px solid var(--color-yellow)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Grid bg */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,204,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,204,0,0.04) 1px, transparent 1px)', backgroundSize: '50px 50px', pointerEvents: 'none' }} />

          {/* Floating orbs */}
          <motion.div animate={{ y: [0, -25, 0], x: [0, 12, 0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', top: '12%', right: '8%', width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,204,0,0.25), transparent 70%)', filter: 'blur(35px)', pointerEvents: 'none' }} />
          <motion.div animate={{ y: [0, 18, 0], x: [0, -15, 0] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', bottom: '18%', left: '6%', width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,204,0,0.18), transparent 70%)', filter: 'blur(28px)', pointerEvents: 'none' }} />

          {/* Bolt decorations */}
          <motion.div animate={{ opacity: [0.03, 0.08, 0.03], rotate: [0, 5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', top: '8%', left: '15%', pointerEvents: 'none' }}>
            <Icons.bolt style={{ width: 120, height: 120, stroke: 'var(--color-yellow)', strokeWidth: 1 }} />
          </motion.div>
          <motion.div animate={{ opacity: [0.02, 0.06, 0.02], rotate: [-10, 0, -10] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }} style={{ position: 'absolute', bottom: '10%', right: '12%', pointerEvents: 'none' }}>
            <Icons.bolt style={{ width: 80, height: 80, stroke: 'var(--color-yellow)', strokeWidth: 1 }} />
          </motion.div>

          {/* Rings */}
          <motion.div initial={{ opacity: 0, scale: 0.4, rotate: -90 }} animate={{ opacity: 0.06, scale: 1, rotate: 0 }} transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }} style={{ position: 'absolute', top: -160, right: -160, width: 520, height: 520, border: '6px solid var(--color-yellow)', borderRadius: '50%' }} />
          <motion.div initial={{ opacity: 0, scale: 0.4, rotate: 90 }} animate={{ opacity: 0.04, scale: 1, rotate: 0 }} transition={{ duration: 2, delay: 0.15, ease: [0.16, 1, 0.3, 1] }} style={{ position: 'absolute', bottom: -120, left: -120, width: 380, height: 380, border: '4px solid var(--color-white)', borderRadius: '50%' }} />

          <div style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-12)', alignItems: 'center' }}>
            {/* Left — text */}
            <div>
              <motion.div initial={{ opacity: 0, x: -40, filter: 'blur(8px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} transition={{ duration: 0.6, delay: 0.2 }} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-yellow)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-8)', padding: '6px 14px', border: '1px solid rgba(255,204,0,0.3)' }}>
                <Icons.bolt style={{ width: 14, height: 14 }} />
                Lightning-Fast Booking — Barbados
              </motion.div>

              <div style={{ overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
                  {['Book', 'A', 'Car.'].map((word, i) => (
                    <motion.span key={i} initial={{ y: '110%', rotateX: -40 }} animate={{ y: 0, rotateX: 0 }} transition={{ duration: 0.8, delay: 0.3 + i * 0.12, ease: [0.16, 1, 0.3, 1] }} style={{ fontSize: 'clamp(3rem, 7vw, 6rem)', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', textTransform: 'uppercase', display: 'inline-block' }}>
                      {word}
                    </motion.span>
                  ))}
                </div>
              </div>
              <div style={{ overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
                <motion.div initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)', fontWeight: 800, lineHeight: 1, textTransform: 'uppercase', color: 'var(--color-yellow)' }}>
                  No Calls. No Hassle.
                </motion.div>
              </div>

              <motion.p initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.7, delay: 0.9 }} style={{ fontSize: 'var(--font-size-lg)', opacity: 0.7, maxWidth: 480, lineHeight: 1.7, marginBottom: 'var(--space-10)' }}>
                AI-powered online booking for Barbados. Upload your license, pick your dates, drive away. Under 2 minutes, zero phone calls.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 1.1 }} style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <motion.button whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(255,204,0,0.4)' }} whileTap={{ scale: 0.96 }} onClick={onBookNow} style={{ backgroundColor: 'var(--color-yellow)', color: 'var(--color-black)', border: 'none', padding: 'var(--space-5) var(--space-10)', fontSize: 'var(--font-size-lg)', fontWeight: 800, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  Book Now <Icons.arrowRight style={{ width: 20, height: 20 }} />
                </motion.button>
                <motion.a whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.08)' }} whileTap={{ scale: 0.96 }} href="#how-it-works" style={{ color: 'var(--color-white)', border: '2px solid rgba(255,255,255,0.35)', padding: 'var(--space-5) var(--space-10)', fontSize: 'var(--font-size-lg)', fontWeight: 700, fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  How It Works ↓
                </motion.a>
              </motion.div>
            </div>

            {/* Right — hero car image */}
            <motion.div initial={{ opacity: 0, x: 60, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }} style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'relative', width: '100%', maxWidth: 380, overflow: 'hidden', borderRadius: 16 }}>
                <img src="/dons-car.png" alt="Don's Rental Car" style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover', filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.5))' }} />
              </motion.div>
              {/* Price badge */}
              <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 1.2, type: 'spring', stiffness: 300 }} style={{ position: 'absolute', bottom: 20, right: 10, backgroundColor: 'var(--color-yellow)', color: 'var(--color-black)', padding: '10px 18px', fontWeight: 800, fontSize: 18, boxShadow: '0 8px 25px rgba(0,0,0,0.3)' }}>
                From $120/day
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* ═══ STATS ═══════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.7 }} style={{ backgroundColor: 'var(--color-white)', borderBottom: '2px solid var(--color-charcoal)' }}>
        <div style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {[
            { icon: Icons.clock, val: 24, pre: '', suf: '/7', label: 'Online' },
            { icon: Icons.globe, val: 100, pre: '', suf: '%', label: 'Digital' },
            { icon: Icons.bolt, val: 2, pre: '<', suf: 'min', label: 'Booking' },
            { icon: Icons.shield, val: 0, pre: '$', suf: '', label: 'Fees' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }} whileHover={{ backgroundColor: 'var(--color-light-gray)' }} style={{ padding: 'var(--space-7) var(--space-5)', textAlign: 'center', borderRight: i < 3 ? '2px solid var(--color-charcoal)' : 'none', cursor: 'default', transition: 'background-color 0.2s' }}>
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
      <section id="how-it-works" style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', padding: 'var(--space-24) var(--space-6)' }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ marginBottom: 'var(--space-16)', textAlign: 'center' }}>
          <motion.div initial={{ width: 0 }} whileInView={{ width: 60 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }} style={{ height: 4, backgroundColor: 'var(--color-yellow)', margin: '0 auto var(--space-4)' }} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-yellow)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-3)' }}>How It Works</p>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Four Steps. Done.</h2>
          <p style={{ marginTop: 'var(--space-4)', color: 'var(--color-dark-gray)', maxWidth: 500, margin: 'var(--space-4) auto 0', lineHeight: 1.6 }}>See exactly how easy it is. Each step takes seconds.</p>
        </motion.div>

        {/* Device mockups */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-6)' }}>
          {[
            { step: <Step1Screen />, label: 'Pick your ride' },
            { step: <Step2Screen />, label: 'Set your dates' },
            { step: <Step3Screen />, label: 'Snap your license' },
            { step: <Step4Screen />, label: 'Confirm & go' },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.15 }}>
              <DeviceFrame label={s.label}>{s.step}</DeviceFrame>
            </motion.div>
          ))}
        </div>

        {/* Connecting line */}
        <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.6 }} style={{ height: 3, background: 'linear-gradient(90deg, var(--color-yellow), var(--color-yellow))', marginTop: 'var(--space-10)', transformOrigin: 'left' }} />
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.9 }} style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-dark-gray)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          → That's it. No phone calls. No waiting.
        </motion.p>
      </section>

      {/* ═══ VEHICLES ═══════════════════════════════════ */}
      {vehicles.length > 0 && (
        <section style={{ backgroundColor: 'var(--color-black)', color: 'var(--color-white)', padding: 'var(--space-24) var(--space-6)', borderTop: '4px solid var(--color-yellow)', borderBottom: '4px solid var(--color-yellow)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,204,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,204,0,0.03) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
          <div style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ marginBottom: 'var(--space-12)' }}>
              <motion.div initial={{ width: 0 }} whileInView={{ width: 60 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }} style={{ height: 4, backgroundColor: 'var(--color-yellow)', marginBottom: 'var(--space-4)' }} />
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-yellow)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-3)' }}>Our Fleet</p>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>What You'll Drive</h2>
            </motion.div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-8)' }}>
              {vehicles.map((v, i) => (
                <motion.div key={v.id} initial={{ opacity: 0, y: 60, rotateY: -6 }} whileInView={{ opacity: 1, y: 0, rotateY: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }} whileHover={{ y: -10, scale: 1.02 }} style={{ backgroundColor: 'var(--color-charcoal)', border: '2px solid var(--color-dark-gray)', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: 280, background: 'linear-gradient(135deg, #2d2d2d, #1a1a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', borderBottom: '4px solid var(--color-yellow)' }}>
                    <motion.img animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} src="/vehicle.png" alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.4))' }} />
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

      {/* ═══ AI FEATURE ═════════════════════════════════ */}
      <section style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', padding: 'var(--space-24) var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-16)', alignItems: 'center' }}>
          <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <motion.div initial={{ width: 0 }} whileInView={{ width: 60 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }} style={{ height: 4, backgroundColor: 'var(--color-yellow)', marginBottom: 'var(--space-4)' }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-yellow)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-3)' }}>Powered by AI</p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 'var(--space-6)', lineHeight: 1.15 }}>
              Snap Your License.<br /><span style={{ color: 'var(--color-yellow)' }}>We'll Do The Rest.</span>
            </h2>
            <p style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-dark-gray)', lineHeight: 1.7, marginBottom: 'var(--space-8)' }}>
              Our AI reads your Barbados driver's license from a single photo. Name, number, expiry — extracted in seconds. No typing, no errors.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {[
                { icon: Icons.bolt, text: 'Instant license scanning' },
                { icon: Icons.check, text: 'Auto-filled personal info' },
                { icon: Icons.shield, text: 'Photo stored securely in GCS' },
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
              <motion.img animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} src="/dons-car.png" alt="License scan demo" style={{ width: 180, height: 240, objectFit: 'cover', borderRadius: 12, filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.15))' }} />
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
      <section style={{ backgroundColor: 'var(--color-charcoal)', color: 'var(--color-white)', padding: 'var(--space-20) var(--space-6)', textAlign: 'center' }}>
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
      <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }} style={{ backgroundColor: 'var(--color-yellow)', padding: 'var(--space-24) var(--space-6)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
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
      <footer style={{ backgroundColor: 'var(--color-black)', color: 'var(--color-white)', padding: 'var(--space-12) var(--space-6)', borderTop: '4px solid var(--color-yellow)' }}>
        <div style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Icons.bolt style={{ width: 24, height: 24, stroke: 'var(--color-yellow)' }} />
            <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 'var(--font-size-lg)' }}>Don's Car Rental</span>
            <span style={{ color: 'var(--color-medium-gray)', marginLeft: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>Barbados</span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-6)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-medium-gray)' }}>
            <a href="#" style={{ color: 'var(--color-medium-gray)', textDecoration: 'none' }}>Privacy</a>
            <a href="#" style={{ color: 'var(--color-medium-gray)', textDecoration: 'none' }}>Terms</a>
            <a href="#" style={{ color: 'var(--color-medium-gray)', textDecoration: 'none' }}>Contact</a>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-dark-gray)' }}>© {new Date().getFullYear()} All rights reserved</div>
        </div>
      </footer>
    </div>
  );
}
