import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Button, Input, Alert, Spinner } from '../components';
import { User, Car, FileText, ArrowLeft, Check, Calendar, Shield } from 'lucide-react';

const ADMIN_EMAIL = 'devon@onlineverywhere.com';

interface ProfileUser {
  email: string;
  name: string;
  googleId: string;
}

const DEFAULT_FORM = {
  email: '',
  name: '',
  phone: '',
  address: '',
  licenseNumber: '',
  licenseExpiry: '',
  licenseIssuer: '',
  licenseClass: '',
};

export function ProfilePage({ user, onSignOut }: { user: ProfileUser | null; onSignOut: () => void }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [bookings, setBookings] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { profile } = await api.getProfile(user.email);
        if (profile) {
          setForm({
            email: profile.email || user.email,
            name: profile.name || user.name || '',
            phone: profile.phone || '',
            address: profile.address || '',
            licenseNumber: profile.licenseNumber || '',
            licenseExpiry: profile.licenseExpiry || '',
            licenseIssuer: profile.licenseIssuer || '',
            licenseClass: profile.licenseClass || '',
          });
        } else {
          setForm((prev) => ({ ...prev, email: user.email, name: user.name || '' }));
        }
      } catch {
        setForm((prev) => ({ ...prev, email: user.email, name: user.name || '' }));
      } finally {
        setLoading(false);
      }

      setLoadingBookings(true);
      const mine = await api.getMyBookings(user.email);
      setBookings(mine);
      setLoadingBookings(false);
    };
    load();
  }, [user]);

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-empty-state">
          <Alert type="info" title="Not signed in">
            <p>Please sign in to view and manage your profile.</p>
            <p style={{ marginTop: 'var(--space-3)' }}>
              <Link to="/" style={{ color: 'var(--color-yellow)', fontWeight: 600 }}>← Back to booking</Link>
            </p>
          </Alert>
        </div>
      </div>
    );
  }

  const handleChange = (field: keyof typeof DEFAULT_FORM) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      await api.saveProfile({
        email: user.email,
        name: form.name,
        phone: form.phone,
        address: form.address,
        licenseNumber: form.licenseNumber,
        licenseExpiry: form.licenseExpiry,
        licenseIssuer: form.licenseIssuer,
        licenseClass: form.licenseClass,
        googleId: user.googleId,
      });
      setSaved(true);
    } catch {
      setError('Failed to save profile — please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const statusOf = (b: Record<string, string>) => {
    const pickup = b.pickupDate || b.pickupdate || '';
    const ret = b.returnDate || b.returndate || '';
    const today = new Date().toISOString().split('T')[0];
    if (ret && ret < today) return { label: 'Completed', color: 'var(--color-success)' };
    if (pickup && pickup <= today) return { label: 'Active', color: 'var(--color-info)' };
    return { label: 'Upcoming', color: 'var(--color-warning)' };
  };

  const initials = (form.name || user.email || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="profile-page">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-header-inner">
          <Link to="/" className="profile-back-link">
            <ArrowLeft size={18} /> Book a car
          </Link>
          <div className="profile-user-block">
            <div className="profile-avatar">{initials}</div>
            <div>
              <h1 className="profile-name">{form.name || 'Your Profile'}</h1>
              <p className="profile-email">{user.email}</p>
            </div>
          </div>
          <button onClick={onSignOut} className="profile-signout-btn">Sign out</button>
        </div>
      </div>

      <div className="profile-content">
        {user?.email === ADMIN_EMAIL && (
          <Link to="/admin" className="profile-admin-link" style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-yellow)', color: 'var(--color-black)',
            fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase',
            fontSize: 'var(--font-size-sm)', textDecoration: 'none',
            border: '3px solid var(--color-charcoal)', marginBottom: 'var(--space-6)',
          }}>
            <Shield size={16} />
            Owner Dashboard
          </Link>
        )}
        {error && (
          <div className="profile-alert">
            <Alert type="error" title="Error"><p>{error}</p></Alert>
          </div>
        )}

        {saved && (
          <div className="profile-alert">
            <Alert type="success" title="Profile saved">
              <p>Your info has been updated. It will auto-fill on your next booking.</p>
            </Alert>
          </div>
        )}

        {/* Personal Information Card */}
        <section className="profile-card">
          <div className="profile-card-header">
            <User size={20} />
            <h2>Personal Information</h2>
          </div>
          {loading ? (
            <Spinner size="md" message="Loading profile..." />
          ) : (
            <>
              <div className="profile-fields">
                <Input label="Email" type="email" value={form.email} disabled />
                <Input label="Full Name *" value={form.name} onChange={handleChange('name')} />
                <Input label="Phone *" variant="tel" value={form.phone} onChange={handleChange('phone')} />
                <Input label="Address" value={form.address} onChange={handleChange('address')} />
              </div>

              <div className="profile-card-header" style={{ marginTop: 'var(--space-8)' }}>
                <FileText size={20} />
                <h2>Driver's License</h2>
              </div>
              <div className="profile-fields">
                <Input label="License Number" value={form.licenseNumber} onChange={handleChange('licenseNumber')} />
                <Input label="License Expiry" variant="date" value={form.licenseExpiry} onChange={handleChange('licenseExpiry')} />
                <Input label="Issuing Authority" value={form.licenseIssuer} onChange={handleChange('licenseIssuer')} />
                <Input label="License Class" value={form.licenseClass} onChange={handleChange('licenseClass')} />
              </div>

              <div className="profile-save-row">
                <Button variant="primary" onClick={handleSave} isLoading={saving}>
                  Save Changes
                </Button>
                {saved && (
                  <span className="profile-saved-inline">
                    <Check size={14} /> Saved
                  </span>
                )}
              </div>
            </>
          )}
        </section>

        {/* Bookings Card */}
        <section className="profile-card">
          <div className="profile-card-header">
            <Car size={20} />
            <h2>My Bookings</h2>
          </div>
          {loadingBookings ? (
            <Spinner size="md" message="Loading bookings..." />
          ) : bookings.length === 0 ? (
            <div className="profile-empty-bookings">
              <Calendar size={40} />
              <p>No bookings yet</p>
              <Link to="/" className="btn btn-primary" style={{ marginTop: 'var(--space-4)', textDecoration: 'none' }}>
                Book Your First Rental
              </Link>
            </div>
          ) : (
            <div className="profile-bookings-list">
              {bookings.map((b) => {
                const ref = b.bookingId || b.bookingid || '';
                const st = statusOf(b);
                return (
                  <div key={ref} className="profile-booking-row">
                    <div className="profile-booking-main">
                      <div className="profile-booking-ref">
                        <strong>{ref}</strong>
                        <span className="profile-status-badge" style={{ backgroundColor: st.color }}>{st.label}</span>
                      </div>
                      <div className="profile-booking-dates">
                        <Calendar size={14} />
                        {formatDate(b.pickupDate || b.pickupdate)} → {formatDate(b.returnDate || b.returndate)}
                        <span className="profile-booking-vehicle">{b.vehicleId || b.vehicleid || 'Car'}</span>
                      </div>
                    </div>
                    <div className="profile-booking-price">
                      <span className="profile-booking-amount">Bds${Number(b.totalAmount || b.totalCost || 0).toLocaleString()}</span>
                      <span className="profile-booking-date">{formatDate(b.createdAt || b.createdat)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
