import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button, Alert, Spinner } from '../components/index';
import { Zap, Car, DollarSign, Calendar, Search, ArrowUpDown, Trash2, ChevronUp, ChevronDown, LogOut, X, User, Mail, Phone, MapPin, CreditCard, FileText } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const GOOGLE_CLIENT_ID = '450188951493-kb2oaaugj0esli53sa5hroag335ahkt6.apps.googleusercontent.com';

interface Booking {
  bookingId: string;
  vehicleId: string;
  vehicleName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  licenseNumber: string;
  licenseExpiry: string;
  licenseIssuer: string;
  licenseClass: string;
  paymentMethod: string;
  totalDays: number;
  totalCost: number;
  created: string;
  status: string;
}

type SortKey = 'bookingId' | 'customerName' | 'vehicleId' | 'pickupDate' | 'returnDate' | 'totalDays' | 'totalCost';

export function AdminDashboard() {
  const [adminEmail, setAdminEmail] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('pickupDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleGoogleCredential = useCallback(async (response: { credential?: string }) => {
    if (!response.credential) {
      setError('Google sign-in failed — no credential received');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Not authorized — admin access denied');
        setAuthenticated(false);
        return;
      }
      setAdminEmail(data.email);
      setAuthenticated(true);
    } catch {
      setError('Failed to verify credentials with server');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize Google Sign-In for admin
  useEffect(() => {
    const initGoogle = () => {
      if (typeof window.google === 'undefined') return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      if (googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 300,
        });
      }
    };
    const timer = setTimeout(initGoogle, 500);
    return () => clearTimeout(timer);
  }, [handleGoogleCredential, authenticated]);

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/bookings`, {
        credentials: 'include',
      });
      if (response.status === 401) {
        setError('Session expired — please sign in again');
        setAuthenticated(false);
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch bookings');
      const data = await response.json();
      setBookings(data.bookings || []);
      setAuthenticated(true);
    } catch {
      setError('Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  // Try loading bookings on mount (cookie may still be valid)
  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = async (bookingId: string) => {
    setCancelling(bookingId);
    setConfirmCancel(null);
    try {
      const response = await fetch(`${API_BASE}/bookings/${bookingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to cancel booking');
      setBookings((prev) => prev.filter((b) => b.bookingId !== bookingId));
      setSelectedBooking(null);
    } catch {
      setError('Failed to cancel booking');
    } finally {
      setCancelling(null);
    }
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setBookings([]);
    setAdminEmail('');
    if (typeof window.google !== 'undefined') {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = bookings.filter((b) =>
      !q ||
      b.bookingId?.toLowerCase().includes(q) ||
      b.customerName?.toLowerCase().includes(q) ||
      b.customerEmail?.toLowerCase().includes(q) ||
      b.vehicleId?.toLowerCase().includes(q)
    );
    result.sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [bookings, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalRevenue = bookings.reduce((sum, b) => sum + (Number(b.totalCost) || 0), 0);
  const upcoming = bookings.filter((b) => {
    const rd = b.returnDate ? new Date(b.returnDate) : null;
    return rd && rd >= today;
  }).length;
  const past = bookings.length - upcoming;

  // Login screen
  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-background)' }}>
        <div style={{ maxWidth: '420px', width: '100%', padding: 'var(--space-8)', backgroundColor: 'var(--color-surface)', border: '4px solid var(--color-charcoal)', borderRadius: 'var(--radius-3)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <Zap size={40} style={{ color: 'var(--color-yellow)', margin: '0 auto var(--space-3)' }} fill="var(--color-yellow)" />
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-extrabold)', textTransform: 'uppercase', margin: 0 }}>
              Owner Dashboard
            </h1>
            <p style={{ color: 'var(--color-dark-gray)', marginTop: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
              Sign in with your Google account to manage bookings.
            </p>
          </div>
          {error && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <Alert type="error">{error}</Alert>
            </div>
          )}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
              <Spinner message="Verifying credentials..." />
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div ref={googleBtnRef} />
            </div>
          )}
          <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 'var(--font-size-xs)', color: 'var(--color-medium-gray)' }}>
            Only authorized admin accounts can access this dashboard.
          </p>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-background)' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'var(--color-black)', color: 'var(--color-white)', padding: 'var(--space-6) 0', borderBottom: '4px solid var(--color-yellow)' }}>
        <div style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', padding: '0 var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Zap size={24} style={{ color: 'var(--color-yellow)' }} fill="var(--color-yellow)" />
            <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-extrabold)', textTransform: 'uppercase', margin: 0 }}>
              Owner Dashboard
            </h1>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-medium-gray)', marginLeft: 'var(--space-2)' }}>{adminEmail}</span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button variant="outline" onClick={fetchBookings} isLoading={loading} style={{ borderColor: 'var(--color-yellow)', color: 'var(--color-yellow)' }}>
              Refresh
            </Button>
            <Button variant="outline" onClick={handleLogout} style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>
              <LogOut size={14} style={{ marginRight: 6 }} /> Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 'var(--max-width-container)', margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
        {error && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <Alert type="error">{error}</Alert>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          {[
            { icon: Car, label: 'Total Bookings', value: bookings.length, color: 'var(--color-charcoal)' },
            { icon: DollarSign, label: 'Total Revenue', value: `Bds$${totalRevenue.toFixed(2)}`, color: 'var(--color-yellow)' },
            { icon: Calendar, label: 'Upcoming', value: upcoming, color: 'var(--color-success)' },
            { icon: Calendar, label: 'Past', value: past, color: 'var(--color-medium-gray)' },
          ].map((stat) => (
            <div key={stat.label} style={{ backgroundColor: 'var(--color-surface)', padding: 'var(--space-5)', border: '3px solid var(--color-charcoal)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', backgroundColor: stat.color }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <stat.icon size={16} style={{ color: stat.color }} />
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-dark-gray)' }}>{stat.label}</span>
              </div>
              <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, fontFamily: stat.label === 'Total Revenue' ? 'var(--font-mono)' : undefined }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Bookings Table */}
        <div style={{ backgroundColor: 'var(--color-surface)', border: '3px solid var(--color-charcoal)', overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '3px solid var(--color-charcoal)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', margin: 0 }}>
              All Bookings ({filtered.length})
            </h2>
            <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-medium-gray)' }} />
              <input
                type="text"
                placeholder="Search by name, email, ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', padding: 'var(--space-2) var(--space-3) var(--space-2) 36px', fontFamily: 'var(--font-sans)', fontSize: 'var(--font-size-sm)', border: '2px solid var(--color-charcoal)', borderRadius: 'var(--radius-2)', backgroundColor: 'var(--color-background)', outline: 'none' }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <Spinner message="Loading bookings..." />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-dark-gray)' }}>
              {bookings.length === 0 ? 'No bookings found.' : 'No bookings match your search.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-black)', color: 'var(--color-white)' }}>
                    {([
                      ['bookingId', 'Ref'],
                      ['customerName', 'Customer'],
                      ['vehicleId', 'Vehicle'],
                      ['pickupDate', 'Pickup'],
                      ['returnDate', 'Return'],
                      ['totalDays', 'Days'],
                      ['totalCost', 'Cost'],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => toggleSort(key)}
                        style={{ padding: 'var(--space-3) var(--space-4)', textAlign: key === 'totalCost' || key === 'totalDays' ? 'right' : 'left', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', fontSize: 'var(--font-size-xs)', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{label} <SortIcon col={key} /></span>
                      </th>
                    ))}
                    <th style={{ padding: 'var(--space-3) var(--space-4)', width: 48 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((booking, i) => (
                    <tr
                      key={booking.bookingId || i}
                      style={{ borderTop: '2px solid var(--color-charcoal)', backgroundColor: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-background)', cursor: 'pointer' }}
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-xs)', color: 'var(--color-yellow)' }}>
                        {booking.bookingId}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{booking.customerName}</div>
                        <div style={{ color: 'var(--color-dark-gray)', fontSize: 'var(--font-size-xs)' }}>{booking.customerEmail}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textTransform: 'uppercase', fontWeight: 'var(--font-weight-semibold)' }}>{booking.vehicleId}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div>{booking.pickupDate}</div>
                        <div style={{ color: 'var(--color-dark-gray)', fontSize: 'var(--font-size-xs)' }}>{booking.pickupTime}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div>{booking.returnDate}</div>
                        <div style={{ color: 'var(--color-dark-gray)', fontSize: 'var(--font-size-xs)' }}>{booking.returnTime}</div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 'var(--font-weight-bold)' }}>{booking.totalDays}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-mono)', color: 'var(--color-yellow)' }}>
                        Bds${Number(booking.totalCost).toFixed(2)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                        {confirmCancel === booking.bookingId ? (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleCancel(booking.bookingId)}
                              disabled={cancelling === booking.bookingId}
                              style={{ background: 'var(--color-error)', color: 'white', border: 'none', padding: '4px 8px', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', cursor: 'pointer', textTransform: 'uppercase' }}
                            >
                              {cancelling === booking.bookingId ? '...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmCancel(null)}
                              style={{ background: 'var(--color-charcoal)', color: 'white', border: 'none', padding: '4px 8px', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', cursor: 'pointer', textTransform: 'uppercase' }}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmCancel(booking.bookingId); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-dark-gray)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Cancel booking"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedBooking && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--space-4)' }}
          onClick={() => setSelectedBooking(null)}
        >
          <div
            style={{ backgroundColor: 'var(--color-surface)', border: '4px solid var(--color-charcoal)', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '3px solid var(--color-charcoal)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-extrabold)', textTransform: 'uppercase', margin: 0 }}>
                  {selectedBooking.customerName}
                </h3>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', color: 'var(--color-yellow)', fontWeight: 'var(--font-weight-bold)', margin: 'var(--space-1) 0 0' }}>
                  {selectedBooking.bookingId}
                </p>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-dark-gray)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 'var(--space-6)' }}>
              {/* Status Badge */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <span style={{
                  display: 'inline-block',
                  padding: 'var(--space-1) var(--space-3)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-bold)',
                  textTransform: 'uppercase',
                  border: '2px solid',
                  borderColor: 'var(--color-success)',
                  color: 'var(--color-success)',
                }}>
                  {selectedBooking.status || 'Confirmed'}
                </span>
              </div>

              {/* Customer Info */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-dark-gray)', marginBottom: 'var(--space-3)' }}>Customer</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <User size={14} style={{ color: 'var(--color-medium-gray)' }} />
                    <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{selectedBooking.customerName}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Mail size={14} style={{ color: 'var(--color-medium-gray)' }} />
                    <span>{selectedBooking.customerEmail}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Phone size={14} style={{ color: 'var(--color-medium-gray)' }} />
                    <span>{selectedBooking.customerPhone || '—'}</span>
                  </div>
                  {selectedBooking.customerAddress && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <MapPin size={14} style={{ color: 'var(--color-medium-gray)' }} />
                      <span>{selectedBooking.customerAddress}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rental Details */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-dark-gray)', marginBottom: 'var(--space-3)' }}>Rental</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-dark-gray)', marginBottom: 2 }}>Pickup</div>
                    <div style={{ fontWeight: 'var(--font-weight-bold)' }}>{selectedBooking.pickupDate}</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-dark-gray)' }}>{selectedBooking.pickupTime}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-dark-gray)', marginBottom: 2 }}>Return</div>
                    <div style={{ fontWeight: 'var(--font-weight-bold)' }}>{selectedBooking.returnDate}</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-dark-gray)' }}>{selectedBooking.returnTime}</div>
                  </div>
                </div>
              </div>

              {/* Vehicle & Cost */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-dark-gray)', marginBottom: 'var(--space-3)' }}>Vehicle & Cost</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-dark-gray)', marginBottom: 2 }}>Vehicle</div>
                    <div style={{ fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase' }}>{selectedBooking.vehicleName || selectedBooking.vehicleId}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-dark-gray)', marginBottom: 2 }}>Duration</div>
                    <div style={{ fontWeight: 'var(--font-weight-bold)' }}>{selectedBooking.totalDays} day{selectedBooking.totalDays !== 1 ? 's' : ''}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-dark-gray)', marginBottom: 2 }}>Total Cost</div>
                    <div style={{ fontWeight: 'var(--font-weight-extrabold)', fontFamily: 'var(--font-mono)', color: 'var(--color-yellow)', fontSize: 'var(--font-size-lg)' }}>Bds${Number(selectedBooking.totalCost).toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-dark-gray)', marginBottom: 2 }}>Payment</div>
                    <div style={{ fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase' }}>{selectedBooking.paymentMethod || 'Pay on Pickup'}</div>
                  </div>
                </div>
              </div>

              {/* License */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-dark-gray)', marginBottom: 'var(--space-3)' }}>License</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <CreditCard size={14} style={{ color: 'var(--color-medium-gray)' }} />
                    <span>{selectedBooking.licenseNumber || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <FileText size={14} style={{ color: 'var(--color-medium-gray)' }} />
                    <span>Expires: {selectedBooking.licenseExpiry || '—'}</span>
                  </div>
                  {selectedBooking.licenseIssuer && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <FileText size={14} style={{ color: 'var(--color-medium-gray)' }} />
                      <span>{selectedBooking.licenseIssuer}</span>
                    </div>
                  )}
                  {selectedBooking.licenseClass && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <FileText size={14} style={{ color: 'var(--color-medium-gray)' }} />
                      <span>Class: {selectedBooking.licenseClass}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Booked */}
              {selectedBooking.created && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-medium-gray)', borderTop: '2px solid var(--color-charcoal)', paddingTop: 'var(--space-3)' }}>
                  Booked: {new Date(selectedBooking.created).toLocaleString()}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '3px solid var(--color-charcoal)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <Button variant="outline" onClick={() => setSelectedBooking(null)} style={{ borderColor: 'var(--color-charcoal)' }}>
                Close
              </Button>
              {confirmCancel === selectedBooking.bookingId ? (
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button
                    variant="danger"
                    onClick={() => handleCancel(selectedBooking.bookingId)}
                    isLoading={cancelling === selectedBooking.bookingId}
                  >
                    Confirm Cancel
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmCancel(null)} style={{ borderColor: 'var(--color-charcoal)' }}>
                    Nevermind
                  </Button>
                </div>
              ) : (
                <Button variant="danger" onClick={() => setConfirmCancel(selectedBooking.bookingId)}>
                  Cancel Booking
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
