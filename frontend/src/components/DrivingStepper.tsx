import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { CarSvg } from './CarSvg';

interface DrivingStepperProps {
  steps: string[];
  currentStep: number;
}

const STEP_ICONS: Record<string, string> = {
  Vehicle: '🚗',
  Dates: '📅',
  License: '🪪',
  'Your Info': '📝',
  Review: '✅',
  Confirmed: '🏁',
};

export function DrivingStepper({ steps, currentStep }: DrivingStepperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const roadFillRef = useRef<HTMLDivElement>(null);
  const prevStep = useRef(currentStep);

  useGSAP(() => {
    if (!containerRef.current || !carRef.current || !roadFillRef.current) return;

    const totalSteps = steps.length;
    const stepIndex = Math.min(currentStep - 1, totalSteps - 1);
    const fillPercent = (stepIndex / (totalSteps - 1)) * 100;

    // Animate road fill
    gsap.to(roadFillRef.current, {
      width: `${fillPercent}%`,
      duration: 0.5,
      ease: 'power2.inOut',
    });

    // Animate car position
    gsap.to(carRef.current, {
      left: `${fillPercent}%`,
      duration: 0.5,
      ease: 'power2.inOut',
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

    prevStep.current = currentStep;
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
          const isConfirmation = step === 'Confirmed';

          return (
            <div
              key={step}
              className={`stepper-checkpoint ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
            >
              <div className="checkpoint-icon">
                {isCompleted ? (
                  <span className="checkmark">✓</span>
                ) : isConfirmation ? (
                  <span className="checkpoint-emoji">{STEP_ICONS[step] || '🏁'}</span>
                ) : (
                  <span className="checkpoint-emoji">{STEP_ICONS[step] || '📍'}</span>
                )}
              </div>
              <span className="checkpoint-label">{step}</span>
            </div>
          );
        })}
      </div>

      {/* Car */}
      <div className="stepper-car" ref={carRef}>
        <CarSvg size={32} wheelSpinning={prevStep.current !== currentStep} />
      </div>
    </div>
  );
}
