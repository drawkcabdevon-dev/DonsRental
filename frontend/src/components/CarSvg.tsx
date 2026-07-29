interface CarSvgProps {
  className?: string;
  size?: number;
  color?: string;
  wheelSpinning?: boolean;
}

export function CarSvg({ className = '', size = 40, color = '#1a1a1a', wheelSpinning = false }: CarSvgProps) {
  return (
    <svg
      className={`car-svg ${wheelSpinning ? 'car-wheel-spinning' : ''} ${className}`}
      width={size}
      height={size * 0.6}
      viewBox="0 0 100 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Car body */}
      <path
        d="M15 35 L20 20 L35 12 L65 12 L80 20 L85 35 Z"
        fill={color}
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Roof */}
      <path
        d="M28 20 L35 12 L65 12 L72 20 Z"
        fill={color}
        opacity="0.8"
      />
      {/* Windows */}
      <path
        d="M32 20 L37 14 L48 14 L48 20 Z"
        fill="#87CEEB"
        opacity="0.7"
      />
      <path
        d="M52 20 L52 14 L63 14 L68 20 Z"
        fill="#87CEEB"
        opacity="0.7"
      />
      {/* Bottom body */}
      <rect x="10" y="35" width="80" height="12" rx="3" fill={color} />
      {/* Headlight */}
      <rect x="82" y="30" width="6" height="5" rx="1" fill="#FFCC00" />
      {/* Taillight */}
      <rect x="12" y="30" width="4" height="5" rx="1" fill="#ef4444" />
      {/* Wheels */}
      <g className={`car-wheel ${wheelSpinning ? 'car-wheel-anim' : ''}`}>
        <circle cx="28" cy="48" r="8" fill="#333" stroke="#555" strokeWidth="2" />
        <circle cx="28" cy="48" r="3" fill="#888" />
      </g>
      <g className={`car-wheel ${wheelSpinning ? 'car-wheel-anim' : ''}`}>
        <circle cx="72" cy="48" r="8" fill="#333" stroke="#555" strokeWidth="2" />
        <circle cx="72" cy="48" r="3" fill="#888" />
      </g>
    </svg>
  );
}
