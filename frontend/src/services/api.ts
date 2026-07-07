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
      // Return fallback vehicles for demo
      return [
        {
          id: 'v1',
          name: 'Compact Sedan',
          rate: 45,
          seats: 5,
          transmission: 'automatic',
          fuelType: 'petrol',
          description: 'Fuel-efficient and easy to park',
          icon: '🚗',
          features: ['Air Conditioning', 'USB Charging', 'Bluetooth'],
        },
        {
          id: 'v2',
          name: 'Mid-Size SUV',
          rate: 65,
          seats: 7,
          transmission: 'automatic',
          fuelType: 'petrol',
          description: 'Spacious and comfortable for families',
          icon: '🚙',
          features: ['All-Wheel Drive', 'Backup Camera', 'Navigation'],
        },
        {
          id: 'v3',
          name: 'Premium Sedan',
          rate: 95,
          seats: 5,
          transmission: 'automatic',
          fuelType: 'petrol',
          description: 'Luxury and style for special occasions',
          icon: '🚘',
          features: ['Leather Seats', 'Sunroof', 'Premium Audio'],
        },
        {
          id: 'v4',
          name: 'Pickup Truck',
          rate: 75,
          seats: 5,
          transmission: 'automatic',
          fuelType: 'diesel',
          description: 'Perfect for cargo and rugged terrain',
          icon: '🛻',
          features: ['4WD', 'Towing Package', 'Bed Liner'],
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
