import type { BookingData, Vehicle, BookingStep, PricingPackage } from './types';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, Routes, Route, useNavigate } from 'react-router-dom';
import { api } from './services/api';
import {
  Button,
  Input,
  Spinner,
  Alert,
  ChatWidget,
} from './components/index';
import { DrivingStepper } from './components/DrivingStepper';
import { DrivingLoader } from './components/DrivingLoader';
import { VehicleCard, PricingBreakdown, PricingPackages, PRICING_PACKAGES } from './components/VehicleCard';
import { PersonalInfoForm, LicenseVerificationForm } from './components/Forms';
import { BookingSummary, BookingConfirmation } from './components/Summary';
import { AvailabilityCalendar } from './components/AvailabilityCalendar';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import { AdminDashboard } from './pages/AdminDashboard';
import { LandingPage } from './pages/LandingPage';
import { useStepTransition } from './hooks/useAnimations';
import { Check, X, AlertTriangle, MessageSquare, Calendar, Car, Zap, ArrowLeft, ArrowRight, CircleCheck } from 'lucide-react';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

let _toastId = 0;

function App() {
  const navigate = useNavigate();
  const [step, setStep] = useState<BookingStep>(1);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingRef, setBookingRef] = useState('');
  const [capturedImageData, setCapturedImageData] = useState<string | null>(null);
  const [capturedPhotoPreview, setCapturedPhotoPreview] = useState<string | null>(null);
  const [scanningLicense, setScanningLicense] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const [dateAvailability, setDateAvailability] = useState<{ available: boolean; loading: boolean; message: string }>({ available: true, loading: false, message: '' });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string; googleId: string } | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // Step transition refs for GSAP animations
  const step1Ref = useStepTransition(`step-1-${step}`);
  const step2Ref = useStepTransition(`step-2-${step}`);
  const step3Ref = useStepTransition(`step-3-${step}`);
  const step4Ref = useStepTransition(`step-4-${step}`);
  const step5Ref = useStepTransition(`step-5-${step}`);
  const confirmRef = useStepTransition(`confirm-${bookingRef}`);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const [booking, setBooking] = useState<BookingData>({
    step: 1,
    pickupTime: '09:00',
    returnTime: '17:00',
    dropoffLocation: 'Airport',
    totalDays: 1,
    totalCost: 0,
  });

  const handlePackageSelect = (pkg: PricingPackage) => {
    const today = new Date();
    const pickup = new Date(today);
    pickup.setDate(pickup.getDate() + 1);
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

  const handleLicenseScan = async (imageData: string) => {
    setCapturedImageData(imageData);
    setCapturedPhotoPreview(imageData);
    setScanningLicense(true);

    try {
      const extracted = await api.scanLicense(imageData);

      // Only auto-fill fields that exist on a driver's license
      // (name, address, license number, expiry, issuer, class)
      const hasLicenseData =
        extracted.customerName ||
        extracted.customerAddress ||
        extracted.licenseNumber ||
        extracted.licenseExpiry ||
        extracted.licenseIssuer ||
        extracted.licenseClass;

      if (hasLicenseData) {
        setBooking((prev) => ({
          ...prev,
          customerName: extracted.customerName || prev.customerName,
          customerAddress: extracted.customerAddress || prev.customerAddress,
          licenseNumber: extracted.licenseNumber || prev.licenseNumber,
          licenseExpiry: extracted.licenseExpiry || prev.licenseExpiry,
          licenseIssuer: extracted.licenseIssuer || prev.licenseIssuer,
          licenseClass: extracted.licenseClass || prev.licenseClass,
          licensePhotoUrl: imageData || prev.licensePhotoUrl,
        }));
        addToast('success', 'License scanned — details auto-filled');
      } else {
        setBooking((prev) => ({
          ...prev,
          licensePhotoUrl: imageData || prev.licensePhotoUrl,
        }));
        addToast('warning', 'Could not extract details from license — please enter manually');
      }
    } catch {
      addToast('error', 'License scan failed — please enter details manually');
    } finally {
      setScanningLicense(false);
    }
  };

  // Google Sign-In initialization
  useEffect(() => {
    const initGoogleSignIn = () => {
      if (typeof window.google === 'undefined') return;

      window.google.accounts.id.initialize({
        client_id: '450188951493-kb2oaaugj0esli53sa5hroag335ahkt6.apps.googleusercontent.com',
        callback: handleGoogleSignIn,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
    };

    // Wait for GIS script to load
    const timer = setTimeout(initGoogleSignIn, 500);
    return () => clearTimeout(timer);
  }, []);

  // Load user profile on mount if logged in
  useEffect(() => {
    const savedUser = localStorage.getItem('donsrental_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        // Pre-fill booking form with profile data
        loadProfileIntoBooking(parsed.email);
      } catch { /* ignore */ }
    }
  }, []);

  const handleGoogleSignIn = async (response: any) => {
    try {
      // Decode the JWT token to get user info
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      const userData = {
        email: payload.email,
        name: payload.name || '',
        googleId: payload.sub,
      };
      setUser(userData);
      localStorage.setItem('donsrental_user', JSON.stringify(userData));

      // Load existing profile to pre-fill booking
      await loadProfileIntoBooking(userData.email);
      addToast('success', `Welcome back, ${userData.name || userData.email}!`);
    } catch (err) {
      console.error('Google sign-in error:', err);
      addToast('error', 'Sign-in failed — please try again');
    }
  };

  const loadProfileIntoBooking = async (email: string) => {
    try {
      const { profile } = await api.getProfile(email);
      if (profile) {
        setBooking((prev) => ({
          ...prev,
          customerName: profile.name || prev.customerName,
          customerEmail: profile.email || prev.customerEmail,
          customerPhone: profile.phone || prev.customerPhone,
          customerAddress: profile.address || prev.customerAddress,
          licenseNumber: profile.licenseNumber || prev.licenseNumber,
          licenseExpiry: profile.licenseExpiry || prev.licenseExpiry,
          licenseIssuer: profile.licenseIssuer || prev.licenseIssuer,
          licenseClass: profile.licenseClass || prev.licenseClass,
          licensePhotoUrl: profile.licensePhotoUrl || prev.licensePhotoUrl,
        }));
      }
    } catch { /* profile not found — that's fine */ }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      await api.saveProfile({
        email: user.email,
        name: booking.customerName || user.name,
        phone: booking.customerPhone,
        address: booking.customerAddress,
        licenseNumber: booking.licenseNumber,
        licenseExpiry: booking.licenseExpiry,
        licenseIssuer: booking.licenseIssuer,
        licenseClass: booking.licenseClass,
        licensePhotoUrl: booking.licensePhotoUrl || '',
        googleId: user.googleId,
      });
      setProfileSaved(true);
      addToast('success', 'Profile saved! Next time your info will auto-fill.');
    } catch {
      addToast('error', 'Failed to save profile — please try again');
    }
  };

  const handleSignOut = () => {
    setUser(null);
    setProfileSaved(false);
    localStorage.removeItem('donsrental_user');
    if (typeof window.google !== 'undefined') {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  const handleRenderGoogleButton = (containerId: string) => {
    if (typeof window.google === 'undefined') return;
    const container = document.getElementById(containerId);
    if (container && container.childElementCount === 0) {
      window.google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 300,
      });
    }
  };

  // Render Google Sign-In button when confirmation page loads
  useEffect(() => {
    if (bookingRef && !user) {
      const timer = setTimeout(() => handleRenderGoogleButton('google-signin-button'), 300);
      return () => clearTimeout(timer);
    }
  }, [bookingRef, user]);

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

  useEffect(() => {
    if (stepHeadingRef.current) {
      stepHeadingRef.current.focus();
    }
  }, [step, bookingRef]);

  // Live availability check when dates change
  useEffect(() => {
    if (!booking.pickupDate || !booking.returnDate) {
      setDateAvailability({ available: true, loading: false, message: '' });
      return;
    }

    const pickup = new Date(booking.pickupDate);
    const returnDate = new Date(booking.returnDate);
    if (returnDate < pickup) {
      setDateAvailability({ available: false, loading: false, message: 'Return date must be after pickup date' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (pickup < today) {
      setDateAvailability({ available: false, loading: false, message: 'Pickup date cannot be in the past' });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setDateAvailability((prev) => ({ ...prev, loading: true }));
      try {
        const result = await api.checkAvailability(booking.pickupDate!, booking.returnDate!, booking.vehicleId || 'v1');
        if (!controller.signal.aborted) {
          if (result.available) {
            setDateAvailability({ available: true, loading: false, message: 'Dates are available' });
          } else {
            const conflict = result.conflicts?.[0];
            const msg = conflict
              ? `${conflict.summary || 'Booked'} — ${conflict.start || ''} to ${conflict.end || ''}`
              : 'These dates are not available';
            setDateAvailability({ available: false, loading: false, message: msg });
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setDateAvailability({ available: true, loading: false, message: 'Could not check availability — proceed with caution' });
        }
      }
    }, 500); // debounce 500ms

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [booking.pickupDate, booking.returnDate, booking.vehicleId]);

  const calculateTotalCost = () => {
    const selectedVehicle = vehicles.find((v) => v.id === booking.vehicleId);
    if (!booking.pickupDate || !booking.returnDate || !selectedVehicle) return 0;

    const pickup = new Date(booking.pickupDate);
    const returnDate = new Date(booking.returnDate);
    const days = Math.ceil((returnDate.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return days * selectedVehicle.rate;
  };

  const calculateTotalDays = () => {
    if (!booking.pickupDate || !booking.returnDate) return 1;
    const pickup = new Date(booking.pickupDate);
    const returnDate = new Date(booking.returnDate);
    return Math.ceil((returnDate.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleNextStep = async () => {
    setError('');

    if (step === 1 && !booking.vehicleId) {
      setError('Please select a vehicle');
      return;
    }
    if (step === 2) {
      if (!booking.pickupDate || !booking.returnDate) {
        setError('Please select both pickup and return dates');
        return;
      }
      const pickup = new Date(booking.pickupDate);
      const returnDate = new Date(booking.returnDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (pickup < today) {
        setError('Pickup date cannot be in the past');
        return;
      }
      if (returnDate < pickup) {
        setError('Return date must be after pickup date');
        return;
      }
      if (!dateAvailability.available) {
        setError('Selected dates are not available — please choose different dates');
        return;
      }
      if (!booking.pickupTime || !booking.returnTime) {
        setError('Please select pickup and return times');
        return;
      }
    }
    if (step === 5 && !termsAccepted) {
      setError('Please accept the Terms & Conditions to continue');
      return;
    }
    if (step === 3) {
      if (!capturedImageData && !booking.licensePhotoUrl) {
        setError('Please upload a photo of your driver\'s license to continue');
        return;
      }
      if (!booking.licenseNumber || !booking.licenseNumber.trim()) {
        setError('Please confirm your license number');
        return;
      }
      if (!booking.licenseExpiry || !booking.licenseExpiry.trim()) {
        setError('Please confirm your license expiry date');
        return;
      }
      const expiry = new Date(booking.licenseExpiry);
      if (expiry < new Date()) {
        setError('Your license appears to be expired');
        return;
      }
    }
    if (step === 4) {
      if (!booking.customerName || !booking.customerName.trim()) {
        setError('Please enter your full name');
        return;
      }
      if (!booking.customerEmail || !validateEmail(booking.customerEmail)) {
        setError('Please enter a valid email address');
        return;
      }
      if (!booking.customerPhone || !booking.customerPhone.trim()) {
        setError('Please enter your phone number');
        return;
      }
    }

    if (step < 5) {
      setStep((step + 1) as BookingStep);
      return;
    }

    // Step 5 → submit booking
    setLoading(true);
    try {
      // Check availability before submitting
      const availability = await api.checkAvailability(
        booking.pickupDate!,
        booking.returnDate!,
        booking.vehicleId || 'v1'
      );
      if (!availability.available) {
        const conflict = availability.conflicts[0];
        const detail = conflict?.type === 'calendar'
          ? `Dates blocked: ${conflict.summary || 'maintenance'}`
          : `Conflicts with existing booking ${conflict?.existingRef || ''}`;
        setError(`Vehicle not available for those dates. ${detail}`);
        return;
      }

      const bookingData = {
        ...booking,
        totalDays: calculateTotalDays(),
        totalCost: calculateTotalCost(),
      };

      const response = await api.createBooking(bookingData);
      if (response.success && response.bookingRef) {
        let photoUrl = booking.licensePhotoUrl || '';
        if (capturedImageData) {
          try {
            photoUrl = await api.uploadPhoto(capturedImageData, response.bookingRef);
            setBooking((prev) => ({ ...prev, licensePhotoUrl: photoUrl }));
          } catch {
            // Non-fatal: booking is already created
            addToast('warning', 'Booking confirmed but license photo upload failed. You can email a photo later.');
          }
        }
        setBookingRef(response.bookingRef);
        addToast('success', `Booking confirmed! Reference: ${response.bookingRef}`);

        // Auto-save profile for logged-in users
        if (user) {
          try {
            await api.saveProfile({
              email: user.email,
              name: booking.customerName || user.name,
              phone: booking.customerPhone,
              address: booking.customerAddress,
              licenseNumber: booking.licenseNumber,
              licenseExpiry: booking.licenseExpiry,
              licenseIssuer: booking.licenseIssuer,
              licenseClass: booking.licenseClass,
              licensePhotoUrl: photoUrl,
              googleId: user.googleId,
            });
            setProfileSaved(true);
          } catch { /* non-fatal */ }
        }
      } else {
        setError(response.error || 'Failed to create booking');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create booking';
      if (msg.includes('not available') || msg.includes('Conflict')) {
        setError(msg);
      } else {
        addToast('error', msg);
      }
    } finally {
      setLoading(false);
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

  const selectedVehicle = vehicles.find((v) => v.id === booking.vehicleId);

  return (
    <div className="app-container">
      {/* Skip to content link */}
      <a href="#main-content" style={{ position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }} onFocus={(e) => { e.currentTarget.style.position = 'static'; e.currentTarget.style.width = 'auto'; e.currentTarget.style.height = 'auto'; }} onBlur={(e) => { e.currentTarget.style.position = 'absolute'; e.currentTarget.style.left = '-10000px'; e.currentTarget.style.width = '1px'; e.currentTarget.style.height = '1px'; }}>
        Skip to main content
      </a>

      {/* Toast Container */}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-item toast-${t.type}`}
          >
            {t.type === 'success' && <Check size={16} aria-hidden="true" />}
            {t.type === 'error' && <X size={16} aria-hidden="true" />}
            {t.type === 'warning' && <AlertTriangle size={16} aria-hidden="true" />}
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="site-header">
        <div className="site-header-inner">
          <div>
            <h1 className="site-header-title">
              <Zap className="site-header-logo" aria-hidden="true" /> Don's Car Rental
            </h1>
            <p className="site-header-subtitle">Barbados car rental — book online, no calls needed</p>
          </div>
          {user && (
            <div className="site-header-user">
              <span>Hello, {user.name || user.email}</span>
              <button
                onClick={handleSignOut}
                className="site-header-signout"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="site-main" tabIndex={-1}>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/" element={
            <LandingPage
              onBookNow={() => navigate('/book')}
              user={user}
              onRenderGoogleButton={handleRenderGoogleButton}
            />
          } />
          <Route path="/book" element={
            <>
              <Link to="/" className="booking-back-link">
                <ArrowLeft size={16} aria-hidden="true" /> Back to Don's Rental
              </Link>

              {/* Driving Stepper */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <DrivingStepper
            steps={['Vehicle', 'Dates', 'License', 'Your Info', 'Review', 'Confirmed']}
            currentStep={bookingRef ? 6 : step}
          />
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Alert type="error" title="Error">
              <span id="error-message">{error}</span>
            </Alert>
          </div>
        )}

        {/* Chat Banner - Alternative booking method */}
        {!bookingRef && step === 1 && (
          <div className="chat-banner" style={{ 
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
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-2)' }}>
                <MessageSquare size={20} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} /> Prefer to chat?
              </h2>
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
          <div ref={step1Ref} className="step-container">
            <h2 ref={stepHeadingRef} tabIndex={-1} className="step-heading">Choose Your Vehicle</h2>
            {loading ? (
              <DrivingLoader message="Loading vehicles..." variant="compact" />
            ) : (
              <>
                {/* Calendar + Vehicle Selection */}
                <div className="step-section">
                  <div className="grid-responsive-2">
                    <div className="step-column">
                      <h3 className="step-column-title">
                        <Calendar size={20} /> Pick a date to start
                      </h3>
                      <p className="step-column-desc">
                        Tap any available date to jump straight to booking.
                      </p>
                      <AvailabilityCalendar
                        onDateSelect={(date) => {
                          handleBookingChange('pickupDate', date);
                          const ret = new Date(date);
                          ret.setDate(ret.getDate() + 1);
                          handleBookingChange('returnDate', ret.toISOString().split('T')[0]);
                          setStep(2);
                        }}
                        selectedPickup={booking.pickupDate}
                        selectedReturn={booking.returnDate}
                      />
                    </div>
                    <div className="step-column">
                      <h3 className="step-column-title">
                        <Car size={20} /> Or choose a vehicle first
                      </h3>
                      <p className="step-column-desc">
                        Select your car, then pick dates on the next step.
                      </p>
                      <div className="vehicle-list">
                        {vehicles.map((vehicle) => (
                          <VehicleCard
                            key={vehicle.id}
                            vehicle={vehicle}
                            isSelected={booking.vehicleId === vehicle.id}
                            onSelect={(v) => handleBookingChange('vehicleId', v.id)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <h3 className="section-heading">Quick Packages</h3>
                <p className="section-desc">
                  Select a preset package and we'll auto-set your dates. Or tap a calendar date above.
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
          <div ref={step2Ref} className="step-container">
            <h2 ref={stepHeadingRef} tabIndex={-1} className="step-heading">Select Dates & Pricing</h2>
            
            <div className="step-section">
              <div className="step-form-grid">
                <div className="step-form-fields">
                  <div className="form-row-2">
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
                
                <div className="step-calendar-section">
                  <h3 className="section-heading-sm">
                    <Calendar size={18} /> Availability
                  </h3>
                  <AvailabilityCalendar
                    onDateSelect={(date) => {
                      handleBookingChange('pickupDate', date);
                      const ret = new Date(date);
                      ret.setDate(ret.getDate() + 1);
                      handleBookingChange('returnDate', ret.toISOString().split('T')[0]);
                    }}
                    selectedPickup={booking.pickupDate}
                    selectedReturn={booking.returnDate}
                  />
                </div>
              </div>

              {/* Live availability status */}
              {booking.pickupDate && booking.returnDate && (
                <div
                  className={`availability-status ${dateAvailability.loading ? 'loading' : dateAvailability.available ? 'available' : 'unavailable'}`}
                  role="status"
                  aria-live="polite"
                >
                  {dateAvailability.loading ? (
                    <Spinner size="sm" />
                  ) : dateAvailability.available ? (
                    <CircleCheck size={20} aria-hidden="true" />
                  ) : (
                    <X size={20} aria-hidden="true" />
                  )}
                  <span>
                    {dateAvailability.loading ? 'Checking availability...' : dateAvailability.message}
                  </span>
                </div>
              )}
              
              {selectedVehicle && (
                <div className="step-section">
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

        {/* Step 3: License Verification */}
        {step === 3 && !bookingRef && (
          <div ref={step3Ref} className="step-container">
            <h2 ref={stepHeadingRef} tabIndex={-1} className="step-heading">Driver's License</h2>
            <p className="section-desc">
              Upload or take a photo of your license and we'll auto-fill your details. You can review and confirm on the final step.
            </p>
            {scanningLicense && (
              <div style={{ marginBottom: 'var(--space-4)' }} role="status" aria-live="polite">
                <Spinner message="Scanning license..." size="sm" />
              </div>
            )}
            <div className="step-form-fields" style={{ maxWidth: '600px' }}>
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

        {/* Step 4: Personal Information */}
        {step === 4 && !bookingRef && (
          <div ref={step4Ref} className="step-container">
            <h2 ref={stepHeadingRef} tabIndex={-1} className="step-heading">Your Information</h2>
            <p className="section-desc">
              Fields were auto-filled from your license scan. Review and correct if needed.
            </p>
            <div className="step-form-fields" style={{ maxWidth: '600px' }}>
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

        {/* Step 5: Review & Confirm */}
        {step === 5 && !bookingRef && (
          <div ref={step5Ref} className="step-container step-container-narrow">
            <h2 ref={stepHeadingRef} tabIndex={-1} className="step-heading">Review & Confirm</h2>
            <BookingSummary
              booking={{
                ...booking,
                totalDays: calculateTotalDays(),
                totalCost: calculateTotalCost(),
              }}
              vehicle={selectedVehicle}
              capturedPhotoPreview={capturedPhotoPreview}
            />

            {/* T&C Acceptance */}
            <div className="tc-acceptance">
              <label>
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  aria-required="true"
                />
                <span>
                  I have read and agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a>
                  {' '}and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                  I understand the rental agreement, cancellation policy, and liability terms.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Success State */}
        {bookingRef && (
          <div ref={confirmRef} className="step-container step-container-narrow">
            <BookingConfirmation
              bookingRef={bookingRef}
              email={booking.customerEmail || ''}
              photoUrl={booking.licensePhotoUrl || ''}
              headingRef={stepHeadingRef}
            />

            {/* Profile Creation Prompt */}
            {!user && !profileSaved && (
              <div className="profile-prompt profile-prompt-signin">
                <h3>Speed up your next booking?</h3>
                <p>Sign in with Google to save your info. Next time, your details will auto-fill — no typing required.</p>
                <div id="google-signin-button" style={{ display: 'inline-block' }}></div>
              </div>
            )}

            {user && !profileSaved && (
              <div className="profile-prompt profile-prompt-save">
                <h3>Save your info for next time?</h3>
                <p>We'll save your name, phone, and license details from this booking so you don't have to type them again.</p>
                <Button variant="primary" onClick={handleSaveProfile} style={{ marginRight: 'var(--space-3)' }}>
                  Save My Info
                </Button>
                <Button variant="outline" onClick={handleSignOut}>
                  Not now
                </Button>
              </div>
            )}

            {profileSaved && (
              <div className="profile-saved">
                <p>
                  <Check size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Profile saved! Your info will auto-fill on your next visit.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        {!bookingRef && (
          <div className="nav-buttons">
            <Button
              variant="outline"
              onClick={handlePrevStep}
              disabled={step === 1}
            >
              <ArrowLeft size={16} /> Back
            </Button>
            <Button
              variant="primary"
              onClick={handleNextStep}
              isLoading={loading}
            >
              {step === 5 ? <><Check size={16} /> Confirm Booking</> : <>Next <ArrowRight size={16} /></>}
            </Button>
          </div>
        )}

        {/* Booking submission loader */}
        {!bookingRef && loading && step === 5 && (
          <div style={{ marginTop: 'var(--space-6)' }}>
            <DrivingLoader message="Booking your rental..." />
          </div>
        )}

        {bookingRef && (
          <div className="post-confirmation-actions">
            <Button
              variant="primary"
              onClick={() => navigate('/book')}
              style={{ flex: 1 }}
            >
              Book Another Vehicle
            </Button>
          </div>
        )}
            </>
          } />
          <Route path="*" element={<LandingPage onBookNow={() => navigate('/book')} user={user} onRenderGoogleButton={handleRenderGoogleButton} />} />
        </Routes>
      </main>

      {/* Chat Widget */}
      <ChatWidget />

      {/* Footer */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <p className="site-footer-links">
            <a href="/terms">Terms &amp; Conditions</a>
            {' | '}
            <a href="/privacy">Privacy Policy</a>
            {' | '}
            <a href="mailto:bookings@donsrental.com">bookings@donsrental.com</a>
            {' | '}
            <a href="tel:+12462682842">+1 (246) 268-2842</a>
          </p>
          <p className="site-footer-copy">
            © 2026 Don's Car Rental — Barbados. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  );
}

export default App;
