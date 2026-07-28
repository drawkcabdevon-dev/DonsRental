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
};
