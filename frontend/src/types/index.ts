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

// ── Admin Dashboard Types ─────────────────────────────

export interface DashboardProfile {
  email: string;
  name: string;
  phone: string;
  address: string;
  licenseNumber: string;
  licenseExpiry: string;
  licenseIssuer: string;
  licenseClass: string;
  licensePhotoUrl: string;
}

export interface DashboardBooking {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleId: string;
  vehicleName: string;
  pickupDate: string;
  returnDate: string;
  totalDays: number;
  totalCost: number;
  created: string;
  licensePhotoUrl: string;
  profile: DashboardProfile;
}

export interface DashboardMonthBucket {
  month: string; // YYYY-MM
  revenue: number;
  count: number;
}

export interface DashboardVehicleBucket {
  vehicleId: string;
  vehicleName: string;
  revenue: number;
  count: number;
}

export interface DashboardData {
  totalRevenue: number;
  totalBookings: number;
  currentBookings: number;
  recentBookings: DashboardBooking[];
  bookingsByMonth: DashboardMonthBucket[];
  bookingsByVehicle: DashboardVehicleBucket[];
}

export interface CustomerProfile {
  email: string;
  name: string;
  phone: string;
  address: string;
  licenseNumber: string;
  licenseExpiry: string;
  licenseIssuer: string;
  licenseClass: string;
  licensePhotoUrl: string;
  googleId?: string;
}
