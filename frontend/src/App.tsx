import type { BookingData, Vehicle, BookingStep, PricingPackage } from './types';
import { useState, useEffect } from 'react';
import { api } from './services/api';
import {
  ProgressStepper,
  Button,
  Input,
  Spinner,
  Alert,
  ChatWidget,
} from './components/index';
import { VehicleCard, PricingBreakdown, PricingPackages, PRICING_PACKAGES } from './components/VehicleCard';
import { PersonalInfoForm, LicenseVerificationForm } from './components/Forms';
import { BookingSummary, BookingConfirmation } from './components/Summary';

function App() {
  const [step, setStep] = useState<BookingStep>(1);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingRef, setBookingRef] = useState('');
  const [capturedImageData, setCapturedImageData] = useState<string | null>(null);
  const [capturedPhotoPreview, setCapturedPhotoPreview] = useState<string | null>(null);

  const [booking, setBooking] = useState<BookingData>({
    step: 1,
    pickupTime: '09:00',
    returnTime: '17:00',
    dropoffLocation: 'Airport',
    totalDays: 1,
    totalCost: 0,
  });

  // Handle selecting a pricing package → auto-fills dates & cost
  const handlePackageSelect = (pkg: PricingPackage) => {
    const today = new Date();
    const pickup = new Date(today);
    pickup.setDate(pickup.getDate() + 1); // tomorrow
    const ret = new Date(pickup);
    ret.setDate(ret.getDate() + pkg.days - 1);

    setBooking((prev) => ({
      ...prev,
      selectedPackage: pkg.id,
      pickupDate: pickup.toISOString().split('T')[0],
      returnDate: ret.toISOString().split('T')[0],
      totalDays: pkg.days,
      totalCost: pkg.totalCost,
      vehicleId: prev.vehicleId || 'v1',
    }));
  };

  // Auto-fill personal info from license scan (no upload yet — upload happens at Step 5)
  const handleLicenseScan = async (imageData: string) => {
    try {
      // Store raw image data for later upload (at Step 5)
      setCapturedImageData(imageData);
      setCapturedPhotoPreview(imageData);

      // Only scan the license — don't upload yet
      const extracted = await api.scanLicense(imageData);

      // Only auto-fill fields that exist on a driver's license
      // (name, address, license number, expiry, issuer, class)
      const hasLicenseData =
        extractedData.customerName ||
        extractedData.customerAddress ||
        extractedData.licenseNumber ||
        extractedData.licenseExpiry ||
        extractedData.licenseIssuer ||
        extractedData.licenseClass;

      if (hasLicenseData) {
        setBooking((prev) => ({
          ...prev,
          customerName: extractedData.customerName || prev.customerName,
          customerAddress: extractedData.customerAddress || prev.customerAddress,
          licenseNumber: extractedData.licenseNumber || prev.licenseNumber,
          licenseExpiry: extractedData.licenseExpiry || prev.licenseExpiry,
          licenseIssuer: extractedData.licenseIssuer || prev.licenseIssuer,
          licenseClass: extractedData.licenseClass || prev.licenseClass,
          licensePhotoUrl: photoUrl || prev.licensePhotoUrl,
        }));
      } else {
        setBooking((prev) => ({
          ...prev,
          licensePhotoUrl: photoUrl || prev.licensePhotoUrl,
        }));
      }
    } catch {
      // Silent fail — user can type manually on next step
    }
  };

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
      if (!booking.licenseNumber || !booking.licenseExpiry) {
        setError('Please provide license details');
        return;
      }
    }
    if (step === 4) {
      if (!booking.customerName || !booking.customerEmail || !booking.customerPhone) {
        setError('Please fill in required fields');
        return;
      }
    }

    if (step < 5) {
      setStep((step + 1) as BookingStep);
    } else {
      // Step 5 → submit booking, then upload photo with bookingRef
      setLoading(true);
      try {
        const bookingData = {
          ...booking,
          totalDays: calculateTotalDays(),
          totalCost: calculateTotalCost(),
        };

        const response = await api.createBooking(bookingData);
        if (response.success && response.bookingRef) {
          // Upload the captured license photo with the new bookingRef
          let photoUrl = booking.licensePhotoUrl || '';
          if (capturedImageData) {
            try {
              photoUrl = await api.uploadPhoto(capturedImageData, response.bookingRef);
              setBooking((prev) => ({ ...prev, licensePhotoUrl: photoUrl }));
            } catch (photoErr) {
              console.warn('Photo upload failed after booking:', photoErr);
              // Non-fatal — booking already created
            }
          }
          setBookingRef(response.bookingRef);
        } else {
          setError(response.error || 'Failed to create booking');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create booking');
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
            steps={['Vehicle', 'Dates', 'License', 'Your Info', 'Review', 'Confirmed']}
            currentStep={bookingRef ? 6 : step}
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

        {/* Chat Banner - Alternative booking method */}
        {!bookingRef && step === 1 && (
          <div style={{ 
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)', 
            color: 'white', 
            padding: 'var(--space-6)', 
            borderRadius: 'var(--radius-lg)', 
            marginBottom: 'var(--space-8)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-4)'
          }}>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-2)' }}>
                💬 Prefer to chat?
              </h3>
              <p style={{ opacity: 0.9, marginBottom: 0 }}>
                Talk to our AI booking assistant to book your rental naturally. Ask questions, get recommendations, and complete your booking through conversation.
              </p>
            </div>
            <Button variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ background: 'transparent', borderColor: 'white', color: 'white' }}>
              Open Chat Assistant
            </Button>
          </div>
        )}

        {/* Step 1: Vehicle + Pricing Packages */}
        {step === 1 && !bookingRef && (
          <div>
            <h2 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', marginBottom: 'var(--space-6)' }}>Choose Your Vehicle</h2>
            {loading ? (
              <Spinner message="Loading vehicles..." />
            ) : (
              <>
                {/* Vehicle card */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                  {vehicles.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      isSelected={booking.vehicleId === vehicle.id}
                      onSelect={(v) => handleBookingChange('vehicleId', v.id)}
                    />
                  ))}
                </div>

                {/* Pricing packages */}
                <h3 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', marginBottom: 'var(--space-4)' }}>Choose a Package</h3>
                <p style={{ marginBottom: 'var(--space-6)', color: 'var(--color-dark-gray)' }}>
                  Select a preset package and we'll auto-set your dates. Or tap Next to choose custom dates.
                </p>
                <PricingPackages
                  packages={PRICING_PACKAGES}
                  selectedId={booking.selectedPackage}
                  onSelect={handlePackageSelect}
                />
              </>
            )}
          </div>
        )}

        {/* Step 2: Dates & Pricing */}
        {step === 2 && !bookingRef && (
          <div>
            <h2 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', marginBottom: 'var(--space-6)' }}>Select Dates & Pricing</h2>
            
            <div className="dates-pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-6)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
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
                </div>
                
                <Input
                  label="Drop-off Location"
                  placeholder="Airport, Downtown, etc."
                  value={booking.dropoffLocation}
                  onChange={(e) => handleBookingChange('dropoffLocation', e.target.value)}
                />
              </div>
              
              {/* Calendar embed */}
              <div style={{ marginTop: 'var(--space-6)' }}>
                <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', marginBottom: 'var(--space-4)' }}>📅 Availability Calendar</h3>
                <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-dark-gray)' }}>
                  Check available dates before booking. Blocked dates show existing reservations and maintenance.
                </p>
                <iframe
                  src="https://calendar.google.com/calendar/embed?src=c_93b81d190fa2b719fee43b8f9e2335d20b29c0d2dc63dff3b96aa3f091d53450%40group.calendar.google.com&ctz=America%2FBarbados"
                  style={{ width: '100%', height: '400px', border: 0, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  frameBorder="0"
                  scrolling="no"
                />
              </div>
              
              {selectedVehicle && (
                <div style={{ marginTop: 'var(--space-6)' }}>
                  <PricingBreakdown
                    vehicleName={selectedVehicle.name}
                    totalDays={calculateTotalDays()}
                    dailyRate={selectedVehicle.rate}
                    totalCost={calculateTotalCost()}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: License Verification (auto-fills personal info) */}
        {step === 3 && !bookingRef && (
          <div>
            <h2 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', marginBottom: 'var(--space-6)' }}>Driver's License</h2>
            <p style={{ marginBottom: 'var(--space-6)', color: 'var(--color-dark-gray)' }}>
              Upload or take a photo of your license and we'll auto-fill your details. You can review and confirm on the final step.
            </p>
            <div style={{ maxWidth: '600px' }}>
              <LicenseVerificationForm
                data={{
                  licenseNumber: booking.licenseNumber || '',
                  licenseExpiry: booking.licenseExpiry || '',
                  licenseIssuer: booking.licenseIssuer || '',
                  licenseClass: booking.licenseClass || '',
                  photoUrl: capturedPhotoPreview || undefined,
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
                onPhotoCapture={(file) => {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const dataUrl = e.target?.result as string;
                    handleLicenseScan(dataUrl);
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </div>
          </div>
        )}

        {/* Step 4: Personal Information (pre-filled from license scan) */}
        {step === 4 && !bookingRef && (
          <div>
            <h2 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', marginBottom: 'var(--space-6)' }}>Your Information</h2>
            <p style={{ marginBottom: 'var(--space-6)', color: 'var(--color-dark-gray)' }}>
              Fields were auto-filled from your license scan. Review and correct if needed.
            </p>
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

        {/* Step 5: Confirmation — review + photo preview before submit */}
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
              capturedPhotoPreview={capturedPhotoPreview}
            />
          </div>
        )}

        {/* Success State */}
        {bookingRef && (
          <div style={{ maxWidth: '600px' }}>
            <BookingConfirmation
              bookingRef={bookingRef}
              email={booking.customerEmail || ''}
              photoUrl={booking.licensePhotoUrl || ''}
            />
          </div>
        )}

        {/* Navigation Buttons */}
        {!bookingRef && (
          <div className="nav-buttons" style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-12)', paddingTop: 'var(--space-6)', borderTop: 'var(--border-normal) solid var(--color-charcoal)' }}>
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

      {/* Chat Widget */}
      <ChatWidget />

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
