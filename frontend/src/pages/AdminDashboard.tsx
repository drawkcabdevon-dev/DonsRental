import { useState, useEffect } from 'react';
import { Button, Input, Alert, Spinner } from '../components/index';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

interface Booking {
  bookingId: string;
  vehicleId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  licenseNumber: string;
  totalDays: number;
  totalCost: number;
  created: string;
}

export function AdminDashboard() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('adminApiKey') || '');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  const fetchBookings = async () => {
    if (!apiKey) {
      setError('API key required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/bookings`, {
        headers: { 'X-API-Key': apiKey },
      });
      if (response.status === 401) {
        setError('Invalid API key');
        setAuthenticated(false);
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch bookings');
      const data = await response.json();
      setBookings(data.bookings || []);
      setAuthenticated(true);
      localStorage.setItem('adminApiKey', apiKey);
    } catch {
      setError('Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiKey) fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = () => {
    fetchBookings();
  };

  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-background)' }}>
        <div style={{ maxWidth: '400px', width: '100%', padding: 'var(--space-8)' }}>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            Owner Dashboard
          </h1>
          <p style={{ textAlign: 'center', marginBottom: 'var(--space-6)', color: 'var(--color-dark-gray)' }}>
            Enter your API key to view bookings.
          </p>
          {error && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <Alert type="error">{error}</Alert>
            </div>
          )}
          <Input
            label="API Key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
          />
          <Button
            variant="primary"
            onClick={handleLogin}
            isLoading={loading}
            style={{ width: '100%', marginTop: 'var(--space-4)' }}
          >
            View Bookings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-background)' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'var(--color-black)', color: 'var(--color-white)', padding: 'var(--space-6) 0', borderBottom: 'var(--border-thick) solid var(--color-yellow)' }}>
        <div style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', padding: '0 var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>
            Owner Dashboard
          </h1>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <Button variant="outline" onClick={fetchBookings} isLoading={loading}>
              Refresh
            </Button>
            <Button variant="outline" onClick={() => { setAuthenticated(false); setBookings([]); }}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
          <div style={{ backgroundColor: 'var(--color-white)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', border: 'var(--border-normal) solid var(--color-charcoal)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-dark-gray)', marginBottom: 'var(--space-2)' }}>Total Bookings</p>
            <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)' }}>{bookings.length}</p>
          </div>
          <div style={{ backgroundColor: 'var(--color-white)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', border: 'var(--border-normal) solid var(--color-charcoal)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-dark-gray)', marginBottom: 'var(--space-2)' }}>Total Revenue</p>
            <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)' }}>
              Bds${bookings.reduce((sum, b) => sum + (Number(b.totalCost) || 0), 0).toFixed(2)}
            </p>
          </div>
          <div style={{ backgroundColor: 'var(--color-white)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', border: 'var(--border-normal) solid var(--color-charcoal)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-dark-gray)', marginBottom: 'var(--space-2)' }}>Upcoming</p>
            <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)' }}>
              {bookings.filter(b => {
                const rd = b.returnDate ? new Date(b.returnDate) : null;
                return rd && rd >= new Date();
              }).length}
            </p>
          </div>
        </div>

        {/* Bookings Table */}
        <div style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-lg)', border: 'var(--border-normal) solid var(--color-charcoal)', overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-6)', borderBottom: 'var(--border-normal) solid var(--color-charcoal)' }}>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>All Bookings</h2>
          </div>
          {loading ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <Spinner message="Loading bookings..." />
            </div>
          ) : bookings.length === 0 ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-dark-gray)' }}>
              No bookings found.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-background)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 'var(--font-weight-semibold)' }}>Ref</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 'var(--font-weight-semibold)' }}>Customer</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 'var(--font-weight-semibold)' }}>Vehicle</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 'var(--font-weight-semibold)' }}>Pickup</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontWeight: 'var(--font-weight-semibold)' }}>Return</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>Days</th>
                    <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking, i) => (
                    <tr key={booking.bookingId || i} style={{ borderTop: 'var(--border-normal) solid var(--color-charcoal)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace', fontWeight: 'var(--font-weight-semibold)' }}>
                        {booking.bookingId}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div>{booking.customerName}</div>
                        <div style={{ color: 'var(--color-dark-gray)', fontSize: 'var(--font-size-xs)' }}>{booking.customerEmail}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>{booking.vehicleId}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div>{booking.pickupDate}</div>
                        <div style={{ color: 'var(--color-dark-gray)' }}>{booking.pickupTime}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div>{booking.returnDate}</div>
                        <div style={{ color: 'var(--color-dark-gray)' }}>{booking.returnTime}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>{booking.totalDays}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 'var(--font-weight-semibold)' }}>
                        Bds${Number(booking.totalCost).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
