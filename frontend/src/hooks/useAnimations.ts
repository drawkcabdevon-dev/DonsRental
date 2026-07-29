import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';

/**
 * Hook for step transition animations
 */
export function useStepTransition(stepKey: string | number) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    // Entrance: fade in + slide up
    gsap.fromTo(containerRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
    );
  }, { scope: containerRef, dependencies: [stepKey] });

  return containerRef;
}

/**
 * Hook for stagger entrance animations
 */
export function useStaggerEntrance(
  selector: string,
  deps: (string | number | boolean)[] = []
) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    const elements = containerRef.current.querySelectorAll(selector);
    if (elements.length === 0) return;

    gsap.fromTo(elements,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        stagger: 0.08,
        ease: 'power2.out',
      }
    );
  }, { scope: containerRef, dependencies: deps });

  return containerRef;
}

/**
 * Hook for button hover/press animations
 */
export function useButtonAnimation() {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useGSAP(() => {
    if (!buttonRef.current) return;

    const btn = buttonRef.current;

    const handleEnter = () => {
      gsap.to(btn, { scale: 1.02, duration: 0.12, ease: 'power2.out' });
    };

    const handleLeave = () => {
      gsap.to(btn, { scale: 1, duration: 0.2, ease: 'power2.out' });
    };

    const handleDown = () => {
      gsap.to(btn, { scale: 0.97, duration: 0.08, ease: 'power2.in' });
    };

    const handleUp = () => {
      gsap.to(btn, { scale: 1.02, duration: 0.2, ease: 'back.out(1.7)' });
    };

    btn.addEventListener('mouseenter', handleEnter);
    btn.addEventListener('mouseleave', handleLeave);
    btn.addEventListener('mousedown', handleDown);
    btn.addEventListener('mouseup', handleUp);

    return () => {
      btn.removeEventListener('mouseenter', handleEnter);
      btn.removeEventListener('mouseleave', handleLeave);
      btn.removeEventListener('mousedown', handleDown);
      btn.removeEventListener('mouseup', handleUp);
    };
  }, { scope: buttonRef });

  return buttonRef;
}

/**
 * Hook for scroll-triggered entrance
 */
export function useScrollReveal(
  selector: string,
  options?: { start?: string; stagger?: number }
) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    const elements = containerRef.current.querySelectorAll(selector);
    if (elements.length === 0) return;

    gsap.fromTo(elements,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: options?.stagger ?? 0.1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: containerRef.current,
          start: options?.start ?? 'top 85%',
          once: true,
        },
      }
    );
  }, { scope: containerRef });

  return containerRef;
}
