import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { CarSvg } from './CarSvg';
import { Car, Calendar, CreditCard, User, CheckCircle, Flag, Check, MapPin } from 'lucide-react';

interface DrivingStepperProps {
  steps: string[];
  currentStep: number;
}

const STEP_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Vehicle: Car,
  Dates: Calendar,
  License: CreditCard,
  'Your Info': User,
  Review: CheckCircle,
  Confirmed: Flag,
};

export function DrivingStepper({ steps, currentStep }: DrivingStepperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const roadFillRef = useRef<HTMLDivElement>(null);
  const [wheelsSpinning, setWheelsSpinning] = useState(false);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Spin wheels briefly when the step changes
  useEffect(() => {
    setWheelsSpinning(true);
    if (spinTimer.current) clearTimeout(spinTimer.current);
    spinTimer.current = setTimeout(() => setWheelsSpinning(false), 700);
    return () => {
      if (spinTimer.current) clearTimeout(spinTimer.current);
    };
  }, [currentStep]);

  const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  useGSAP(() => {
    if (!containerRef.current || !carRef.current || !roadFillRef.current) return;

    const totalSteps = steps.length;
    const stepIndex = Math.min(currentStep - 1, totalSteps - 1);
    const fillPercent = (stepIndex / (totalSteps - 1)) * 100;

    // Kill any in-flight tweens to prevent conflicts
    gsap.killTweensOf([carRef.current, roadFillRef.current]);

    const mobile = isMobile();

    // Animate road fill (width on desktop, height on mobile)
    const roadProps: gsap.TweenVars = mobile
      ? { height: `${fillPercent}%`, duration: 0.5, ease: 'power2.inOut' }
      : { width: `${fillPercent}%`, duration: 0.5, ease: 'power2.inOut' };
    gsap.to(roadFillRef.current, roadProps);

    // Animate car position (left on desktop, top on mobile)
    const carProps: gsap.TweenVars = mobile
      ? { top: `${fillPercent}%`, duration: 0.5, ease: 'power2.inOut' }
      : { left: `${fillPercent}%`, duration: 0.5, ease: 'power2.inOut' };
    gsap.to(carRef.current, {
      ...carProps,
      onStart: () => {
        carRef.current?.classList.add('moving');
      },
      onComplete: () => {
        setTimeout(() => {
          carRef.current?.classList.remove('moving');
        }, 200);
      },
    });

    // Animate checkpoint completions
    const circles = containerRef.current.querySelectorAll('.stepper-checkpoint');
    circles.forEach((circle, i) => {
      if (i < stepIndex) {
        // Completed
        gsap.to(circle, {
          scale: 1.1,
          duration: 0.2,
          ease: 'back.out(1.7)',
          onComplete: () => {
            gsap.to(circle, { scale: 1, duration: 0.15 });
          },
        });
      } else if (i === stepIndex) {
        // Active - pulse
        gsap.fromTo(circle,
          { scale: 0.95 },
          { scale: 1, duration: 0.3, ease: 'back.out(2)' }
        );
      }
    });

  }, { scope: containerRef, dependencies: [currentStep, steps.length] });

  return (
    <div className="driving-stepper" ref={containerRef}>
      {/* Road */}
      <div className="stepper-road">
        {/* Dashed background */}
        <div className="stepper-road-dash" />
        {/* Solid fill */}
        <div className="stepper-road-fill" ref={roadFillRef} />
      </div>

      {/* Checkpoints */}
      <div className="stepper-checkpoints">
        {steps.map((step, i) => {
          const isCompleted = currentStep > i + 1;
          const isActive = currentStep === i + 1;

          return (
            <div
              key={step}
              className={`stepper-checkpoint ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
            >
              <div className="checkpoint-icon">
                {isCompleted ? (
                  <Check size={14} className="checkmark-icon" />
                ) : (
                  (() => {
                    const Icon = STEP_ICONS[step] || MapPin;
                    return <Icon size={14} className="checkpoint-lucide" />;
                  })()
                )}
              </div>
              <span className="checkpoint-label">{step}</span>
            </div>
          );
        })}
      </div>

      {/* Car */}
      <div className="stepper-car" ref={carRef}>
        <CarSvg size={32} wheelSpinning={wheelsSpinning} />
      </div>
    </div>
  );
}
