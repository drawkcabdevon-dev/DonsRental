import { CarSvg } from './CarSvg';

interface DrivingLoaderProps {
  message?: string;
  variant?: 'full' | 'compact' | 'scanning';
}

export function DrivingLoader({ message = 'Booking your rental...', variant = 'full' }: DrivingLoaderProps) {
  if (variant === 'scanning') {
    return (
      <div className="driving-loader scanning-loader">
        <div className="scanning-dots">
          <span className="scan-dot" />
          <span className="scan-dot" />
          <span className="scan-dot" />
        </div>
        <p className="loader-message">{message}</p>
      </div>
    );
  }

  return (
    <div className={`driving-loader ${variant === 'compact' ? 'compact' : ''}`}>
      <div className="loader-road">
        <div className="loader-road-line" />
        <div className="loader-car-track">
          <div className="loader-car">
            <CarSvg size={36} wheelSpinning={true} />
          </div>
          {/* Speed lines */}
          <div className="speed-lines">
            <span className="speed-line" style={{ top: '8px', animationDelay: '0s' }} />
            <span className="speed-line" style={{ top: '14px', animationDelay: '0.2s' }} />
            <span className="speed-line" style={{ top: '20px', animationDelay: '0.4s' }} />
          </div>
          {/* Dust particles */}
          <div className="dust-particles">
            <span className="dust-particle" style={{ animationDelay: '0s' }} />
            <span className="dust-particle" style={{ animationDelay: '0.3s' }} />
            <span className="dust-particle" style={{ animationDelay: '0.6s' }} />
          </div>
        </div>
      </div>
      {message && <p className="loader-message">{message}</p>}
    </div>
  );
}
