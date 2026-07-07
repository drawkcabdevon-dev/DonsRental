import type { BookingData, Vehicle, BookingStep } from './types';
import { useState, useEffect } from 'react';
import { api } from './services/api';
import {
  ProgressStepper,
  Button,
  Input,
  Spinner,
  Alert,
} from './components/index';
import { VehicleCard, PricingBreakdown } from './components/VehicleCard';
import { PersonalInfoForm, LicenseVerificationForm } from './components/Forms';
import { BookingSummary, BookingConfirmation } from './components/Summary';

function App() {
  const [step, setStep] = useState<BookingStep>(1);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingRef, setBookingRef] = useState('');

  const [booking, setBooking] = useState<BookingData>({
    step: 1,
    pickupTime: '09:00',
    returnTime: '17:00',
    dropoffLocation: 'Airport',
    totalDays: 1,
    totalCost: 0,
  });

  // Load vehicles on mount
  useEffect(() => {
    const loadVehicles = async () => {
      setLoading(true);
      try {
        const data = await api.getVehicles();
        setVehicles(data);
      } catch (err) {
        setError('Failed to load vehicles');
      } finally {
        setLoading(false);
      }
    };
    loadVehicles();
  }, []);

  // Set default dates
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    setBooking((prev) => ({
      ...prev,
      pickupDate: tomorrow.toISOString().split('T')[0],
      returnDate: dayAfter.toISOString().split('T')[0],
    }));
  }, []);

  // Calculate total cost
  const calculateTotalCost = () => {
    const selectedVehicle = vehicles.find((v) => v.id === booking.vehicleId);
    if (!booking.pickupDate || !booking.returnDate || !selectedVehicle) return 0;

    const pickup = new Date(booking.pickupDate);
    const returnDate = new Date(booking.returnDate);
    const days = Math.ceil((returnDate.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return days * selectedVehicle.rate;
  };

  const handleNextStep = async () => {
    setError('');

    // Validation
    if (step === 1 && !booking.vehicleId) {
      setError('Please select a vehicle');
      return;
    }
    if (step === 2 && (!booking.pickupDate || !booking.returnDate)) {
      setError('Please select dates');
      return;
    }
    if (step === 3) {
      if (!booking.customerName || !booking.customerEmail || !booking.customerPhone) {
        setError('Please fill in required fields');
        return;
      }
    }
    if (step === 4) {
      if (!booking.licenseNumber || !booking.licenseExpiry) {
        setError('Please provide license details');
        return;
      }
    }

    if (step < 5) {
      setStep((step + 1) as BookingStep);
    } else {
      // Submit booking
      setLoading(true);
      try {
        const bookingData = {
          ...booking,
          totalDays: calculateTotalDays(),
          totalCost: calculateTotalCost(),
        };

        const response = await api.createBooking(bookingData);
        if (response.success && response.bookingRef) {
          setBookingRef(response.bookingRef);
          setStep(5);
        } else {
          setError(response.error || 'Failed to create booking');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep((step - 1) as BookingStep);
      setError('');
    }
  };

  const handleBookingChange = (field: string, value: any) => {
    setBooking((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const calculateTotalDays = () => {
    if (!booking.pickupDate || !booking.returnDate) return 1;
    const pickup = new Date(booking.pickupDate);
    const returnDate = new Date(booking.returnDate);
    return Math.ceil((returnDate.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const selectedVehicle = vehicles.find((v) => v.id === booking.vehicleId);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-background)' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'var(--color-black)', color: 'var(--color-white)', padding: 'var(--space-8) 0', borderBottom: 'var(--border-thick) solid var(--color-yellow)' }}>
        <div style={{ maxWidth: 'var(--max-width-container)', marginLeft: 'auto', marginRight: 'auto', paddingLeft: 'var(--space-6)', paddingRight: 'var(--space-6)' }}>
          <h1 style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 'var(--font-weight-extrabold)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
            🏎️ Don's Car Rental
          </h1>
          <p style={{ fontSize: 'var(--font-size-lg)', opacity: 0.75 }}>Barbados car rental — book online, no calls needed</p>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, maxWidth: 'var(--max-width-container)', margin: '0 auto', width: '100%', padding: `var(--space-8) var(--space-6)` }}>
        {/* Progress Stepper */}
        <div style={{ marginBottom: 'var(--space-12)' }}>
          <ProgressStepper
            steps={['Vehicle', 'Dates', 'Your Info', 'License', 'Confirm']}
            currentStep={bookingRef ? 5 : step}
          />
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Alert type="error" title="Error">
              {error}
            </Alert>
          </div>
        )}

        {/* Step 1: Vehicle Selection */}
        {step === 1 && !bookingRef && (
          <div>
            <h2 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', marginBottom: 'var(--space-6)' }}>Choose Your Vehicle</h2>
            {loading ? (
              <Spinner message="Loading vehicles..." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-12)' }}>
                {vehicles.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    isSelected={booking.vehicleId === vehicle.id}
                    onSelect={(v) => handleBookingChange('vehicleId', v.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Dates & Pricing */}
        {step === 2 && !bookingRef && (
          <div>
            <h2 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', marginBottom: 'var(--space-6)' }}>Select Dates & Pricing</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <Input
                  label="Pick-up Date *"
                  variant="date"
                  value={booking.pickupDate}
                  onChange={(e) => handleBookingChange('pickupDate', e.target.value)}
                />
                
                <Input
                  label="Pick-up Time *"
                  variant="time"
                  value={booking.pickupTime}
                  onChange={(e) => handleBookingChange('pickupTime', e.target.value)}
                />
                
                <Input
                  label="Return Date *"
                  variant="date"
                  value={booking.returnDate}
                  onChange={(e) => handleBookingChange('returnDate', e.target.value)}
                />
                
                <Input
                  label="Return Time *"
                  variant="time"
                  value={booking.returnTime}
                  onChange={(e) => handleBookingChange('returnTime', e.target.value)}
                />
                
                <Input
                  label="Drop-off Location"
                  placeholder="Airport, Downtown, etc."
                  value={booking.dropoffLocation}
                  onChange={(e) => handleBookingChange('dropoffLocation', e.target.value)}
                />
              </div>
              
              <div>
                {selectedVehicle && (
                  <PricingBreakdown
                    vehicleName={selectedVehicle.name}
                    totalDays={calculateTotalDays()}
                    dailyRate={selectedVehicle.rate}
                    totalCost={calculateTotalCost()}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Personal Information */}
        {step === 3 && !bookingRef && (
          <div>
            <h2 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', marginBottom: 'var(--space-6)' }}>Your Information</h2>
            <div style={{ maxWidth: '600px' }}>
              <PersonalInfoForm
                data={{
                  name: booking.customerName || '',
                  email: booking.customerEmail || '',
                  phone: booking.customerPhone || '',
                  address: booking.customerAddress || '',
                }}
                onChange={(field, value) => {
                  const fieldMap: Record<string, string> = {
                    name: 'customerName',
                    email: 'customerEmail',
                    phone: 'customerPhone',
                    address: 'customerAddress',
                  };
                  handleBookingChange(fieldMap[field], value);
                }}
              />
            </div>
          </div>
        )}

        {/* Step 4: License Verification */}
        {step === 4 && !bookingRef && (
          <div>
            <h2 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', marginBottom: 'var(--space-6)' }}>Driver's License</h2>
            <div style={{ maxWidth: '600px' }}>
              <LicenseVerificationForm
                data={{
                  licenseNumber: booking.licenseNumber || '',
                  licenseExpiry: booking.licenseExpiry || '',
                  licenseIssuer: booking.licenseIssuer || '',
                  licenseClass: booking.licenseClass || '',
                }}
                onChange={(field, value) => {
                  const fieldMap: Record<string, string> = {
                    licenseNumber: 'licenseNumber',
                    licenseExpiry: 'licenseExpiry',
                    licenseIssuer: 'licenseIssuer',
                    licenseClass: 'licenseClass',
                  };
                  handleBookingChange(fieldMap[field], value);
                }}
              />
            </div>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && !bookingRef && (
          <div style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', marginBottom: 'var(--space-6)' }}>Review & Confirm</h2>
            <BookingSummary
              booking={{
                ...booking,
                totalDays: calculateTotalDays(),
                totalCost: calculateTotalCost(),
              }}
              vehicle={selectedVehicle}
            />
          </div>
        )}

        {/* Success State */}
        {bookingRef && (
          <div style={{ maxWidth: '600px' }}>
            <BookingConfirmation bookingRef={bookingRef} email={booking.customerEmail || ''} />
          </div>
        )}

        {/* Navigation Buttons */}
        {!bookingRef && (
          <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-12)', paddingTop: 'var(--space-6)', borderTop: 'var(--border-normal) solid var(--color-charcoal)' }}>
            <Button
              variant="outline"
              onClick={handlePrevStep}
              disabled={step === 1}
              style={{ flex: 1 }}
            >
              ← Back
            </Button>
            <Button
              variant="primary"
              onClick={handleNextStep}
              isLoading={loading}
              style={{ flex: 1 }}
            >
              {step === 5 ? '✓ Confirm Booking' : 'Next →'}
            </Button>
          </div>
        )}

        {bookingRef && (
          <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-12)', paddingTop: 'var(--space-6)', borderTop: 'var(--border-normal) solid var(--color-charcoal)' }}>
            <Button
              variant="primary"
              onClick={() => window.location.href = '/'}
              style={{ flex: 1 }}
            >
              Book Another Vehicle
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: 'var(--color-black)', color: 'var(--color-white)', padding: 'var(--space-6) 0', borderTop: 'var(--border-thick) solid var(--color-yellow)', marginTop: 'var(--space-16)' }}>
        <div style={{ maxWidth: 'var(--max-width-container)', marginLeft: 'auto', marginRight: 'auto', paddingLeft: 'var(--space-6)', paddingRight: 'var(--space-6)', textAlign: 'center', fontSize: 'var(--font-size-sm)' }}>
          <p style={{ opacity: 0.75 }}>
            © 2024 Don's Car Rental — Barbados. All rights reserved. | Powered by Vertex AI Agent Engine
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
