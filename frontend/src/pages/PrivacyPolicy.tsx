const PrivacyPolicy = () => {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-8) var(--space-4)', fontFamily: 'var(--font-family-base)' }}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-6)', color: '#1a1a1a' }}>
        Privacy Policy
      </h1>
      <p style={{ color: '#666', marginBottom: 'var(--space-6)' }}>Last updated: July 27, 2026</p>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', color: '#1a1a1a' }}>1. Data Controller</h2>
        <p style={{ lineHeight: '1.7', color: '#333' }}>
          Don's Rental ("we," "us," or "our") is the data controller responsible for your personal data. We are based in Barbados and operate vehicle rental services.
        </p>
        <p style={{ lineHeight: '1.7', color: '#333', marginTop: 'var(--space-3)' }}>
          Contact for privacy matters: devon@onlineverywhere.com
        </p>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', color: '#1a1a1a' }}>2. What Data We Collect</h2>
        <p style={{ lineHeight: '1.7', color: '#333' }}>When you make a booking, we collect:</p>
        <ul style={{ lineHeight: '1.7', color: '#333', paddingLeft: 'var(--space-6)', marginTop: 'var(--space-3)' }}>
          <li><strong>Identity data:</strong> Full name, date of birth (from license)</li>
          <li><strong>Contact data:</strong> Email address, phone number, address</li>
          <li><strong>License data:</strong> Driver's license number, expiry date, issuing authority, license class</li>
          <li><strong>License photo:</strong> Image of your driver's license for verification purposes</li>
          <li><strong>Booking data:</strong> Rental dates, vehicle selection, drop-off location</li>
          <li><strong>Payment data:</strong> Processed at pickup — we do not store card details online</li>
        </ul>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', color: '#1a1a1a' }}>3. How We Use Your Data</h2>
        <p style={{ lineHeight: '1.7', color: '#333' }}>We use your personal data to:</p>
        <ul style={{ lineHeight: '1.7', color: '#333', paddingLeft: 'var(--space-6)', marginTop: 'var(--space-3)' }}>
          <li>Process and confirm your booking</li>
          <li>Communicate booking details and confirmations via email</li>
          <li>Verify your identity and driving eligibility at pickup</li>
          <li>Manage the rental agreement and vehicle handover</li>
          <li>Send service-related communications (booking confirmations, reminders)</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', color: '#1a1a1a' }}>4. Data Storage & Security</h2>
        <p style={{ lineHeight: '1.7', color: '#333' }}>
          Your data is stored securely using Google Cloud services (Google Sheets, Google Cloud Storage). We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. License photos are stored in a private, access-controlled cloud storage bucket.
        </p>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', color: '#1a1a1a' }}>5. Third-Party Sharing</h2>
        <p style={{ lineHeight: '1.7', color: '#333' }}>
          We do not sell your personal data. We only share your data with:
        </p>
        <ul style={{ lineHeight: '1.7', color: '#333', paddingLeft: 'var(--space-6)', marginTop: 'var(--space-3)' }}>
          <li><strong>Google services:</strong> For email delivery (Gmail), calendar management, and data storage</li>
          <li><strong>Google Gemini AI:</strong> For license verification and data extraction (processed securely, not stored by Google)</li>
          <li><strong>Law enforcement:</strong> When required by law or to protect our legal rights</li>
        </ul>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', color: '#1a1a1a' }}>6. Cookies & Tracking</h2>
        <p style={{ lineHeight: '1.7', color: '#333' }}>
          Our website uses essential cookies for basic functionality. We do not use advertising cookies or third-party tracking scripts. We do not sell advertising space or participate in ad networks.
        </p>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', color: '#1a1a1a' }}>7. Data Retention</h2>
        <p style={{ lineHeight: '1.7', color: '#333' }}>
          We retain your booking data for 2 years for record-keeping and dispute resolution. License photos are retained for 6 months after the rental period and then deleted. You may request earlier deletion by contacting us.
        </p>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', color: '#1a1a1a' }}>8. Your Rights</h2>
        <p style={{ lineHeight: '1.7', color: '#333' }}>You have the right to:</p>
        <ul style={{ lineHeight: '1.7', color: '#333', paddingLeft: 'var(--space-6)', marginTop: 'var(--space-3)' }}>
          <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
          <li><strong>Correction:</strong> Request correction of inaccurate data</li>
          <li><strong>Deletion:</strong> Request deletion of your personal data</li>
          <li><strong>Objection:</strong> Object to processing of your personal data</li>
          <li><strong>Portability:</strong> Request transfer of your data in a structured format</li>
        </ul>
        <p style={{ lineHeight: '1.7', color: '#333', marginTop: 'var(--space-3)' }}>
          To exercise any of these rights, contact us at devon@onlineverywhere.com.
        </p>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', color: '#1a1a1a' }}>9. Barbados Data Protection</h2>
        <p style={{ lineHeight: '1.7', color: '#333' }}>
          We comply with the Barbados Data Protection Act. If you have concerns about how we handle your data, you may contact the Office of the Information Commissioner of Barbados.
        </p>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', color: '#1a1a1a' }}>10. Changes to This Policy</h2>
        <p style={{ lineHeight: '1.7', color: '#333' }}>
          We may update this privacy policy from time to time. Changes will be posted on this page with an updated date. Continued use of our services after changes constitutes acceptance of the updated policy.
        </p>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', color: '#1a1a1a' }}>11. Contact Us</h2>
        <p style={{ lineHeight: '1.7', color: '#333' }}>
          For privacy inquiries or to exercise your data rights:<br />
          Email: devon@onlineverywhere.com<br />
          Phone: +1 (246) 268-2842
        </p>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
