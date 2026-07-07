import type { BookingData, Vehicle } from '../types';
import { Card } from './index';

interface BookingSummaryProps {
  booking: BookingData;
  vehicle?: Vehicle;
}

export function BookingSummary({ booking, vehicle }: BookingSummaryProps) {
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
      <Card className="border-4 border-bau-yellow">
        <h3 className="text-2xl font-bold text-uppercase mb-lg">Booking Summary</h3>
        
        <div className="space-y-md">
          {reviewItems.map((item, idx) => (
            item.value && (
              <div key={idx} className="flex justify-between items-start border-b-2 border-bau-light-gray pb-md">
                <span className="font-semibold text-bau-black text-uppercase">{item.label}</span>
                <span className="font-bold text-right">{item.value}</span>
              </div>
            )
          ))}
        </div>
      </Card>
      
      <Card className="bg-bau-black text-white p-2xl border-4 border-bau-yellow">
        <p className="text-sm text-uppercase opacity-75 mb-sm">Total Cost (BBD)</p>
        <p className="text-4xl font-extrabold text-bau-yellow">Bds${booking.totalCost}</p>
      </Card>
    </div>
  );
}

interface BookingConfirmationProps {
  bookingRef: string;
  email: string;
}

export function BookingConfirmation({ bookingRef, email }: BookingConfirmationProps) {
  return (
    <div className="text-center space-y-lg">
      <div className="text-6xl">✓</div>
      <h2 className="text-3xl font-extrabold text-uppercase">Booking Confirmed</h2>
      
      <Card className="border-4 border-bau-yellow bg-bau-off-white">
        <p className="text-sm text-bau-gray text-uppercase font-semibold mb-md">Booking Reference</p>
        <p className="text-2xl font-mono font-bold text-bau-black mb-lg">{bookingRef}</p>
        <p className="text-sm text-bau-gray">
          A confirmation email has been sent to <span className="font-bold">{email}</span>
        </p>
      </Card>
      
      <div className="bg-bau-light-gray border-2 border-bau-black p-lg rounded-lg">
        <p className="text-sm text-bau-gray mb-md">📧 Check your email for:</p>
        <ul className="text-left space-y-sm text-sm">
          <li>✓ Booking confirmation details</li>
          <li>✓ Vehicle pickup instructions</li>
          <li>✓ Terms &amp; conditions</li>
          <li>✓ Insurance information</li>
        </ul>
      </div>
    </div>
  );
}
