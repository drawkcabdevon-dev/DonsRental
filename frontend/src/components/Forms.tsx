import { Input, Textarea } from './index';

interface PersonalInfoFormProps {
  data: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  onChange: (field: string, value: string) => void;
  errors?: Record<string, string>;
}

export function PersonalInfoForm({ data, onChange, errors = {} }: PersonalInfoFormProps) {
  return (
    <div className="space-y-lg">
      <Input
        label="Full Name *"
        placeholder="e.g., John Smith"
        value={data.name}
        onChange={(e) => onChange('name', e.target.value)}
        error={errors.name}
      />
      
      <Input
        label="Email Address *"
        variant="email"
        placeholder="you@example.com"
        value={data.email}
        onChange={(e) => onChange('email', e.target.value)}
        error={errors.email}
      />
      
      <Input
        label="Phone Number *"
        variant="tel"
        placeholder="+1 (246) 123-4567"
        value={data.phone}
        onChange={(e) => onChange('phone', e.target.value)}
        error={errors.phone}
      />
      
      <Textarea
        label="Address"
        placeholder="123 Main Street, Barbados"
        value={data.address}
        onChange={(e) => onChange('address', e.target.value)}
        rows={3}
      />
    </div>
  );
}

interface LicenseVerificationFormProps {
  data: {
    licenseNumber: string;
    licenseExpiry: string;
    licenseIssuer: string;
    licenseClass: string;
    photoUrl?: string;
  };
  onChange: (field: string, value: string) => void;
  errors?: Record<string, string>;
  onPhotoCapture?: (file: File) => void;
}

export function LicenseVerificationForm({
  data,
  onChange,
  errors = {},
  onPhotoCapture,
}: LicenseVerificationFormProps) {
  return (
    <div className="space-y-lg">
      <div className="border-4 border-dashed border-bau-black rounded-lg p-2xl text-center">
        <p className="text-lg font-bold text-uppercase mb-lg">📷 License Photo Capture</p>
        <p className="text-sm text-bau-gray mb-lg">
          Upload or take a photo of your driver's license for automatic scanning.
        </p>
        
        <div className="flex gap-md flex-wrap justify-center">
          <button
            type="button"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file && onPhotoCapture) {
                  onPhotoCapture(file);
                  onChange('photoUrl', URL.createObjectURL(file));
                }
              };
              input.click();
            }}
            className="btn btn-outline btn-lg"
          >
            📁 Upload Photo
          </button>
          
          <button
            type="button"
            onClick={() => {
              // Camera capture logic would go here
              alert('Camera capture coming soon. For now, use Upload Photo.');
            }}
            className="btn btn-outline btn-lg"
          >
            📷 Take Photo
          </button>
        </div>
        
        {data.photoUrl && (
          <div className="mt-lg">
            <img src={data.photoUrl} alt="License" className="max-h-48 rounded-lg mx-auto border-2 border-bau-yellow" />
          </div>
        )}
      </div>
      
      <hr className="divider-dashed" />
      
      <p className="text-sm font-semibold text-uppercase text-bau-gray">Or enter manually:</p>
      
      <Input
        label="License Number *"
        placeholder="e.g., ABC123456"
        value={data.licenseNumber}
        onChange={(e) => onChange('licenseNumber', e.target.value)}
        error={errors.licenseNumber}
      />
      
      <Input
        label="License Expiry *"
        variant="date"
        value={data.licenseExpiry}
        onChange={(e) => onChange('licenseExpiry', e.target.value)}
        error={errors.licenseExpiry}
      />
      
      <Input
        label="Issuing Authority *"
        placeholder="e.g., DMV"
        value={data.licenseIssuer}
        onChange={(e) => onChange('licenseIssuer', e.target.value)}
        error={errors.licenseIssuer}
      />
      
      <Input
        label="License Class"
        placeholder="e.g., B"
        value={data.licenseClass}
        onChange={(e) => onChange('licenseClass', e.target.value)}
      />
    </div>
  );
}
