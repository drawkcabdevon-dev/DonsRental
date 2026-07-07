import type { Vehicle, BookingData, ApiResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

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
          imageUrl: '/dons-car.png',
          features: ['Air Conditioning', '2-Day Minimum', 'Weekend Specials', 'Free Drop-off'],
        },
      ];
    }
  },

  // Submit booking
  async createBooking(booking: BookingData): Promise<ApiResponse<{ bookingId: string }>> {
    try {
      const response = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Booking failed');
      }

      const data = await response.json();
      return {
        success: true,
        data,
        bookingRef: data.bookingId || 'BK-' + Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Booking failed',
      };
    }
  },

  // Scan and verify license
  async scanLicense(imageData: string): Promise<Partial<BookingData>> {
    try {
      const response = await fetch(`${API_BASE}/scan-license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      });

      if (!response.ok) throw new Error('License scan failed');
      return await response.json();
    } catch (error) {
      console.error('License scan error:', error);
      return {};
    }
  },
};
