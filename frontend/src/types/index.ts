// Booking Types
export type BookingStep = 1 | 2 | 3 | 4 | 5;

export interface Vehicle {
  id: string;
  name: string;
  rate: number;
  seats: number;
  transmission: 'manual' | 'automatic';
  fuelType: 'petrol' | 'diesel' | 'hybrid';
  description: string;
  imageUrl?: string;
  icon?: string;
  features: string[];
}

export interface PricingPackage {
  id: string;
  label: string;
  days: number;
  totalCost: number;
  dailyRate: number;
  description: string;
}

export interface BookingData {
  step: BookingStep;
  
  // Step 1: Vehicle
  vehicleId?: string;
  selectedPackage?: string; // '2day' | '5day' | '7day'
  
  // Step 2: Dates & Logistics
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  dropoffLocation?: string;
  
  // Step 3: Personal Info
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  
  // Step 4: License
  licenseNumber?: string;
  licenseExpiry?: string;
  licenseIssuer?: string;
  licenseClass?: string;
  licensePhotoUrl?: string;
  
  // Computed
  totalDays?: number;
  totalCost?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  bookingRef?: string;
}
