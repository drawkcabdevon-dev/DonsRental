import { Input, Textarea } from './index';
import { Camera, Upload } from 'lucide-react';

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
        <p className="text-lg font-bold text-uppercase mb-lg"><Camera size={20} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} /> License Photo Capture</p>
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
              input.setAttribute('aria-label', 'Upload a photo of your driver\'s license');
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
            <Upload size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Upload Photo
          </button>
          
          <button
            type="button"
            onClick={async () => {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                const video = document.createElement('video');
                video.srcObject = stream;
                video.playsInline = true;
                video.autoplay = true;
                video.style.position = 'fixed';
                video.style.top = '0';
                video.style.left = '0';
                video.style.width = '100%';
                video.style.height = '100%';
                video.style.objectFit = 'cover';
                video.style.zIndex = '9999';
                video.style.backgroundColor = 'black';
                video.setAttribute('aria-label', 'Camera viewfinder for license photo');
                document.body.appendChild(video);

                const captureBtn = document.createElement('button');
                captureBtn.textContent = 'Capture';
                captureBtn.className = 'btn btn-primary btn-lg camera-capture-btn';
                captureBtn.style.position = 'fixed';
                captureBtn.style.bottom = '40px';
                captureBtn.style.left = '50%';
                captureBtn.style.transform = 'translateX(-50%)';
                captureBtn.style.zIndex = '10000';
                captureBtn.setAttribute('aria-label', 'Capture photo from camera');
                document.body.appendChild(captureBtn);

                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Cancel';
                cancelBtn.className = 'btn btn-outline btn-lg camera-cancel-btn';
                cancelBtn.style.position = 'fixed';
                cancelBtn.style.bottom = '100px';
                cancelBtn.style.left = '50%';
                cancelBtn.style.transform = 'translateX(-50%)';
                cancelBtn.style.zIndex = '10000';
                cancelBtn.setAttribute('aria-label', 'Cancel camera capture');
                document.body.appendChild(cancelBtn);

                captureBtn.focus();

                const cleanup = () => {
                  stream.getTracks().forEach(t => t.stop());
                  video.remove();
                  captureBtn.remove();
                  cancelBtn.remove();
                };

                const handleEscape = (e: KeyboardEvent) => {
                  if (e.key === 'Escape') {
                    cleanup();
                    document.removeEventListener('keydown', handleEscape);
                  }
                };
                document.addEventListener('keydown', handleEscape);

                captureBtn.onclick = () => {
                  const canvas = document.createElement('canvas');
                  canvas.width = video.videoWidth;
                  canvas.height = video.videoHeight;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) { cleanup(); document.removeEventListener('keydown', handleEscape); return; }
                  ctx.drawImage(video, 0, 0);
                  canvas.toBlob((blob) => {
                    if (blob) {
                      const file = new File([blob], 'license.jpg', { type: 'image/jpeg' });
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        const dataUrl = e.target?.result as string;
                        onChange('photoUrl', dataUrl);
                        onPhotoCapture?.(file);
                      };
                      reader.readAsDataURL(file);
                    }
                    cleanup();
                    document.removeEventListener('keydown', handleEscape);
                  }, 'image/jpeg');
                };

                cancelBtn.onclick = () => {
                  cleanup();
                  document.removeEventListener('keydown', handleEscape);
                };
              } catch (err) {
                console.warn('Camera access failed:', err);
              }
            }}
            className="btn btn-outline btn-lg"
          >
            <Camera size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Take Photo
          </button>
        </div>
        
        {data.photoUrl && (
          <div className="mt-lg">
            <img src={data.photoUrl} alt="Uploaded driver's license photo" className="max-h-48 rounded-lg mx-auto border-2 border-bau-yellow" />
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
