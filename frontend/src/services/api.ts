import type { Vehicle, BookingData, ApiResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export const api = {
  // Get available vehicles
  async getVehicles(): Promise<Vehicle[]> {
    try {
      const response = await fetch(`${API_BASE}/vehicles`);
      if (!response.ok) throw new Error('Failed to fetch vehicles');
      const data = await response.json();
      return data.vehicles || [];
    } catch (error) {
      console.error('API Error:', error);
      // Return fallback vehicle from poster
      return [
        {
          id: 'v1',
          name: 'Standard Rental Car',
          rate: 120,
          seats: 5,
          transmission: 'automatic',
          fuelType: 'petrol',
          description: 'Clean, reliable car for getting around Barbados. 2-day minimum. Weekend & weekly specials available.',
          imageUrl: '/vehicle.png',
          features: ['Air Conditioning', '2-Day Minimum', 'Weekend Specials', 'Free Drop-off'],
        },
      ];
    }
  },

  // Submit booking
  async createBooking(booking: BookingData): Promise<ApiResponse<{ bookingId: string }>> {
    const response = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Booking failed' }));
      throw new Error(error.detail || error.message || 'Booking failed');
    }

    const data = await response.json();
    return {
      success: true,
      data,
      bookingRef: data.bookingId || 'BK-' + Date.now(),
    };
  },

  // Check availability
  async checkAvailability(pickupDate: string, returnDate: string, vehicleId: string = 'v1'): Promise<{ available: boolean; conflicts: any[] }> {
    const response = await fetch(`${API_BASE}/check-availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickupDate, returnDate, vehicleId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Availability check failed' }));
      throw new Error(error.detail || 'Availability check failed');
    }
    return await response.json();
  },

  // Scan and verify license
  async scanLicense(imageData: string): Promise<Partial<BookingData>> {
    const response = await fetch(`${API_BASE}/scan-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'License scan failed' }));
      throw new Error(error.detail || 'License scan failed');
    }
    return await response.json();
  },

  // Upload license photo to GCS
  async uploadPhoto(imageData: string, bookingRef?: string): Promise<string> {
    const response = await fetch(`${API_BASE}/upload-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, bookingRef: bookingRef || '' }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Photo upload failed' }));
      throw new Error(error.detail || 'Photo upload failed');
    }
    const data = await response.json();
    return data.url || '';
  },

  // Chat with the booking agent
  async chat(message: string): Promise<{ response: string; bookingRef: string }> {
    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) throw new Error('Chat failed');
      return await response.json();
    } catch (error) {
      console.error('Chat error:', error);
      return { response: 'Sorry, I\'m having trouble connecting. Please try again.', bookingRef: '' };
    }
  },

  // Profile management
  async getProfile(email: string): Promise<{ profile: Record<string, string> | null }> {
    try {
      const response = await fetch(`${API_BASE}/profiles/${encodeURIComponent(email)}`);
      if (response.status === 404) return { profile: null };
      if (!response.ok) throw new Error('Failed to fetch profile');
      const data = await response.json();
      const raw = data.profile || {};
      // Sheet returns lowercase headers — normalize to camelCase
      const profile: Record<string, string> = {
        email: raw.email || '',
        name: raw.name || '',
        phone: raw.phone || '',
        address: raw.address || '',
        licenseNumber: raw.licensenumber || raw.licenseNumber || '',
        licenseExpiry: raw.licenseexpiry || raw.licenseExpiry || '',
        licenseIssuer: raw.licenseissuer || raw.licenseIssuer || '',
        licenseClass: raw.licenseclass || raw.licenseClass || '',
      };
      return { profile };
    } catch {
      return { profile: null };
    }
  },

  async saveProfile(profile: {
    email: string;
    name?: string;
    phone?: string;
    address?: string;
    licenseNumber?: string;
    licenseExpiry?: string;
    licenseIssuer?: string;
    licenseClass?: string;
    googleId?: string;
  }): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!response.ok) throw new Error('Failed to save profile');
    return await response.json();
  },

  // Bookings for a specific customer
  async getMyBookings(email: string): Promise<Record<string, string>[]> {
    try {
      const response = await fetch(`${API_BASE}/my-bookings/${encodeURIComponent(email)}`);
      if (!response.ok) throw new Error('Failed to fetch bookings');
      const data = await response.json();
      return data.bookings || [];
    } catch {
      return [];
    }
  },
};
