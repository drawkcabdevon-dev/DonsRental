import type { BookingData, Vehicle } from '../types';
import type { RefObject } from 'react';
import { Card } from './index';
import { Check, Image, Mail } from 'lucide-react';

interface BookingSummaryProps {
  booking: BookingData;
  vehicle?: Vehicle;
  capturedPhotoPreview?: string | null;
}

export function BookingSummary({ booking, vehicle, capturedPhotoPreview }: BookingSummaryProps) {
  const reviewItems = [
    { label: 'Vehicle', value: vehicle?.name || booking.vehicleId },
    { label: 'Pickup Date', value: booking.pickupDate },
    { label: 'Pickup Time', value: booking.pickupTime },
    { label: 'Return Date', value: booking.returnDate },
    { label: 'Return Time', value: booking.returnTime },
    { label: 'Drop-off Location', value: booking.dropoffLocation },
    { label: 'Duration', value: booking.totalDays ? `${booking.totalDays} day(s)` : '' },
    { label: 'Your Name', value: booking.customerName },
    { label: 'Email', value: booking.customerEmail },
    { label: 'Phone', value: booking.customerPhone },
    { label: 'License Number', value: booking.licenseNumber },
  ];

  return (
    <div className="space-y-lg">
      <Card className="border-4 border-bau-yellow" aria-labelledby="booking-summary-heading">
        <h3 id="booking-summary-heading" className="text-2xl font-bold text-uppercase mb-lg">Booking Summary</h3>
        
        <div className="space-y-md">
          {reviewItems.map((item, idx) => (
            item.value && (
              <div key={idx} className="summary-row flex justify-between items-start border-b-2 border-bau-light-gray pb-md">
                <span className="font-semibold text-bau-black text-uppercase">{item.label}</span>
                <span className="font-bold text-right">{item.value}</span>
              </div>
            )
          ))}
        </div>
      </Card>

      {/* License Photo Preview */}
      {capturedPhotoPreview && (
        <Card className="border-4 border-bau-yellow" aria-labelledby="license-photo-heading">
          <h3 id="license-photo-heading" className="text-2xl font-bold text-uppercase mb-lg">License Photo</h3>
          <p className="text-sm text-bau-gray mb-md">Your license photo will be uploaded after booking confirmation.</p>
          <img
            src={capturedPhotoPreview}
            alt="Preview of your captured driver's license photo"
            style={{ maxHeight: '200px', borderRadius: '8px', border: '2px solid var(--color-yellow)', display: 'block', margin: '0 auto' }}
          />
        </Card>
      )}

      <Card className="bg-bau-black text-white p-2xl border-4 border-bau-yellow" aria-label={`Total cost: ${booking.totalCost} Barbados dollars`}>
        <p className="text-sm text-uppercase opacity-75 mb-sm">Total Cost (BBD)</p>
        <p className="text-4xl font-extrabold text-bau-yellow">Bds${booking.totalCost}</p>
      </Card>
    </div>
  );
}

interface BookingConfirmationProps {
  bookingRef: string;
  email: string;
  photoUrl?: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}

export function BookingConfirmation({ bookingRef, email, photoUrl, headingRef }: BookingConfirmationProps) {
  return (
    <div className="text-center space-y-lg">
      <div className="confirm-checkmark-wrapper" aria-hidden="true">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="22" stroke="var(--color-yellow)" strokeWidth="4" className="confirm-checkmark" fill="none" />
          <path d="M14 24l7 7 13-13" stroke="var(--color-yellow)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="confirm-checkmark" fill="none" style={{ animationDelay: '0.4s' }} />
        </svg>
      </div>
      <h2 ref={headingRef} tabIndex={-1} style={{ outline: 'none' }} className="text-3xl font-extrabold text-uppercase">Booking Confirmed</h2>
      
      <Card className="border-4 border-bau-yellow bg-bau-off-white confirm-card-enter" aria-labelledby="booking-ref-heading">
        <p id="booking-ref-heading" className="text-sm text-bau-gray text-uppercase font-semibold mb-md">Booking Reference</p>
        <p className="text-2xl font-mono font-bold text-bau-black mb-lg confirm-ref-typein">{bookingRef}</p>
        <p className="text-sm text-bau-gray">
          A confirmation email has been sent to <span className="font-bold">{email}</span>
        </p>
      </Card>

      {photoUrl && (
        <Card className="border-4 border-bau-yellow bg-bau-off-white confirm-card-enter" aria-labelledby="license-uploaded-heading">
          <p id="license-uploaded-heading" className="text-sm text-bau-gray text-uppercase font-semibold mb-md"><Image size={16} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> License Photo Uploaded</p>
          <img
            src={photoUrl}
            alt="Uploaded driver's license photo"
            style={{ maxHeight: '200px', borderRadius: '8px', border: '2px solid var(--color-yellow)', display: 'block', margin: '0 auto' }}
          />
          <p className="text-xs text-bau-gray mt-sm">Securely stored for your booking record</p>
        </Card>
      )}
      
      <div className="bg-bau-light-gray border-2 border-bau-black p-lg rounded-lg confirm-card-enter">
        <p className="text-sm text-bau-gray mb-md"><Mail size={16} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Check your email for:</p>
        <ul className="text-left space-y-sm text-sm">
          <li><Check size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Booking confirmation details</li>
          <li><Check size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Vehicle pickup instructions</li>
          <li><Check size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Terms &amp; conditions</li>
          <li><Check size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Insurance information</li>
        </ul>
      </div>

      <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: '#666' }}>
        By booking, you agree to our{' '}
        <a href="/terms" target="_blank" style={{ color: '#0f3460', textDecoration: 'underline' }}>Terms &amp; Conditions</a>
        {' '}and{' '}
        <a href="/privacy" target="_blank" style={{ color: '#0f3460', textDecoration: 'underline' }}>Privacy Policy</a>.
      </div>
    </div>
  );
}
