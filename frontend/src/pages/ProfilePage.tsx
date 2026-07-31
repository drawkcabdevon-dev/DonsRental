import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Button, Input, Alert, Spinner } from '../components';

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
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
        <Alert type="info" title="Not signed in">
          <p>Please sign in to view and manage your profile.</p>
          <p style={{ marginTop: 'var(--space-3)' }}>
            <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>← Back to booking</Link>
          </p>
        </Alert>
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
    if (ret && ret < today) return { label: 'Completed', color: '#059669' };
    if (pickup && pickup <= today) return { label: 'Active', color: '#2563eb' };
    return { label: 'Upcoming', color: '#d97706' };
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-8) var(--space-4)', fontFamily: 'var(--font-family-base)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: '#1a1a1a' }}>
          My Profile
        </h1>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>← Book a car</Link>
          <Button variant="outline" size="sm" onClick={onSignOut}>Sign out</Button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Alert type="error" title="Error">
            <p>{error}</p>
          </Alert>
        </div>
      )}

      {saved && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Alert type="success" title="Profile saved">
            <p>Your info has been updated. It will auto-fill on your next booking.</p>
          </Alert>
        </div>
      )}

      {/* Personal Info */}
      <section style={{ background: '#fff', border: '2px solid #e0e0e0', borderRadius: '12px', padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-4)', color: '#1a1a1a' }}>
          Personal Information
        </h2>
        {loading ? (
          <Spinner size="md" message="Loading profile..." />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
              <Input label="Email" type="email" value={form.email} disabled />
              <Input label="Full Name *" value={form.name} onChange={handleChange('name')} />
              <Input label="Phone *" variant="tel" value={form.phone} onChange={handleChange('phone')} />
              <Input label="Address" value={form.address} onChange={handleChange('address')} />
            </div>

            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', margin: 'var(--space-6) 0 var(--space-4)', color: '#1a1a1a' }}>
              Driver's License
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
              <Input label="License Number" value={form.licenseNumber} onChange={handleChange('licenseNumber')} />
              <Input label="License Expiry" variant="date" value={form.licenseExpiry} onChange={handleChange('licenseExpiry')} />
              <Input label="Issuing Authority" value={form.licenseIssuer} onChange={handleChange('licenseIssuer')} />
              <Input label="License Class" value={form.licenseClass} onChange={handleChange('licenseClass')} />
            </div>

            <div style={{ marginTop: 'var(--space-6)' }}>
              <Button variant="primary" onClick={handleSave} isLoading={saving}>
                Save Changes
              </Button>
            </div>
          </>
        )}
      </section>

      {/* Previous Bookings */}
      <section style={{ background: '#fff', border: '2px solid #e0e0e0', borderRadius: '12px', padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-4)', color: '#1a1a1a' }}>
          My Bookings
        </h2>
        {loadingBookings ? (
          <Spinner size="md" message="Loading bookings..." />
        ) : bookings.length === 0 ? (
          <Alert type="info" title="No bookings yet">
            <p>You haven't made any bookings with this account yet.</p>
          </Alert>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {bookings.map((b) => {
              const ref = b.bookingId || b.bookingid || '';
              const st = statusOf(b);
              return (
                <div key={ref} style={{ border: '1px solid #e0e0e0', borderRadius: '10px', padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                      <strong style={{ color: '#1a1a1a' }}>{ref}</strong>
                      <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 10px', borderRadius: '999px', color: '#fff', background: st.color }}>
                        {st.label}
                      </span>
                    </div>
                    <p style={{ color: '#666', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                      {formatDate(b.pickupDate || b.pickupdate)} → {formatDate(b.returnDate || b.returndate)}
                      {' · '}{b.vehicleId || b.vehicleid || 'Car'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 'var(--font-weight-bold)', color: '#1a1a1a' }}>
                      Bds${Number(b.totalAmount || b.totalCost || 0).toLocaleString()}
                    </p>
                    <p style={{ color: '#999', fontSize: 'var(--font-size-xs)' }}>
                      {formatDate(b.createdAt || b.createdat)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
