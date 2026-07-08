import type { Vehicle, PricingPackage } from '../types';
import { Card, Badge } from './index';

interface VehicleCardProps {
  vehicle: Vehicle;
  isSelected: boolean;
  onSelect: (vehicle: Vehicle) => void;
}

export function VehicleCard({ vehicle, isSelected, onSelect }: VehicleCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-fast hover:shadow-lg ${
        isSelected ? 'border-4 border-bau-yellow bg-bau-off-white' : ''
      }`}
      onClick={() => onSelect(vehicle)}
    >
      {vehicle.imageUrl && (
        <div
          className="w-full rounded-md mb-lg border-2 border-bau-black"
          style={{
            backgroundColor: 'var(--color-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '500px',
          }}
        >
          <img
            src={vehicle.imageUrl}
            alt={vehicle.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
      )}
      {vehicle.icon && (
        <div className="text-5xl text-center mb-lg">{vehicle.icon}</div>
      )}
      
      <h3 className="text-2xl font-bold mb-sm text-uppercase">{vehicle.name}</h3>
      
      <p className="text-2xl font-bold text-bau-yellow mb-lg">
        Bds${vehicle.rate}
        <span className="text-sm font-normal text-bau-gray">/day (BBD)</span>
      </p>
      
      <p className="text-base mb-lg text-bau-gray">{vehicle.description}</p>
      
      <div className="grid grid-cols-2 gap-md mb-lg">
        <div className="border-2 border-bau-black p-md">
          <p className="text-xs font-bold text-uppercase mb-xs">Seats</p>
          <p className="text-lg font-bold">{vehicle.seats}</p>
        </div>
        <div className="border-2 border-bau-black p-md">
          <p className="text-xs font-bold text-uppercase mb-xs">Transmission</p>
          <p className="text-sm font-semibold text-uppercase">{vehicle.transmission}</p>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-sm">
        {vehicle.features.map((feature, idx) => (
          <Badge key={idx} variant="secondary">{feature}</Badge>
        ))}
      </div>
      
      {isSelected && (
        <div className="mt-lg pt-lg border-t-2 border-bau-black">
          <p className="text-sm font-bold text-bau-yellow text-uppercase">✓ Selected</p>
        </div>
      )}
    </Card>
  );
}

interface PricingBreakdownProps {
  vehicleName: string;
  totalDays: number;
  dailyRate: number;
  totalCost: number;
}

export const PRICING_PACKAGES: PricingPackage[] = [
  { id: '2day', label: 'Weekend Getaway', days: 2, totalCost: 240, dailyRate: 120, description: '2 days — perfect for a weekend trip around Barbados' },
  { id: '5day', label: 'Island Explorer', days: 5, totalCost: 460, dailyRate: 92, description: '5 days — explore the whole island at your own pace' },
  { id: '7day', label: 'Weekly Special', days: 7, totalCost: 650, dailyRate: 93, description: '7 days — best value for a full week in paradise' },
];

interface PricingPackagesProps {
  packages: PricingPackage[];
  selectedId?: string;
  onSelect: (pkg: PricingPackage) => void;
}

export function PricingPackages({ packages, selectedId, onSelect }: PricingPackagesProps) {
  return (
    <div className="grid grid-cols-3 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
      {packages.map((pkg) => (
        <Card
          key={pkg.id}
          className={`cursor-pointer transition-fast hover:shadow-lg ${
            selectedId === pkg.id ? 'border-4 border-bau-yellow bg-bau-off-white' : ''
          }`}
          onClick={() => onSelect(pkg)}
          style={{ padding: 'var(--space-4)', textAlign: 'center' }}
        >
          <p className="text-sm font-bold text-uppercase mb-sm" style={{ letterSpacing: '0.05em' }}>{pkg.label}</p>
          <p className="text-3xl font-extrabold text-bau-yellow mb-sm">Bds${pkg.totalCost}</p>
          <p className="text-xs text-bau-gray mb-md">Bds${pkg.dailyRate}/day &middot; {pkg.days} days</p>
          <p className="text-xs text-bau-gray">{pkg.description}</p>
          {selectedId === pkg.id && (
            <div className="mt-md pt-md border-t-2 border-bau-black">
              <p className="text-sm font-bold text-bau-yellow text-uppercase">✓ Selected</p>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export function PricingBreakdown({
  vehicleName,
  totalDays,
  dailyRate,
  totalCost,
}: PricingBreakdownProps) {
  return (
    <Card className="bg-bau-off-white border-4 border-bau-yellow">
      <h4 className="text-lg font-bold text-uppercase mb-lg">Pricing Summary</h4>
      
      <div className="space-y-md mb-lg">
        <div className="flex justify-between text-base">
          <span className="font-semibold">Vehicle:</span>
          <span className="font-bold">{vehicleName}</span>
        </div>
        <div className="flex justify-between text-base">
          <span className="font-semibold">Days:</span>
          <span className="font-bold">{totalDays}</span>
        </div>
        <div className="flex justify-between text-base">
          <span className="font-semibold">Rate:</span>
          <span className="font-bold">Bds${dailyRate}/day</span>
        </div>
      </div>
      
      <hr className="divider" />
      
      <div className="flex justify-between text-xl">
        <span className="font-extrabold text-uppercase">Total:</span>
        <span className="font-extrabold text-bau-yellow text-2xl">Bds${totalCost}</span>
      </div>
    </Card>
  );
}
