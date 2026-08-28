import React from 'react';

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-6">Last updated: {new Date().toLocaleDateString()}</p>
          
          <hr className="mb-8 border-gray-200" />
          
          <div className="space-y-8 text-gray-700">
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. Introduction</h2>
              <p>
                Welcome to FuelTracks. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our application and tell you about your privacy rights.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. Data We Collect</h2>
              <p className="mb-2">We may collect, use, store and transfer different kinds of personal data about you, including:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Identity Data:</strong> First name, last name, username or similar identifier.</li>
                <li><strong>Contact Data:</strong> Email address and telephone numbers.</li>
                <li><strong>Location Data:</strong> Background and foreground GPS location data to provide vehicle tracking and fleet management services.</li>
                <li><strong>Technical Data:</strong> Internet protocol (IP) address, your login data, browser type and version, time zone setting and location.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Your Data</h2>
              <p className="mb-2">We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>To provide live vehicle tracking and analytics.</li>
                <li>To manage your account and send important notifications (e.g., SOS, Theft, Geofence alerts).</li>
                <li>To improve our application, products/services, marketing, and customer relationships.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. Background Location Processing</h2>
              <p>
                FuelTracks utilizes background location services to continuously track fleet vehicles, even when the app is closed or not in use. This is a core feature of our fleet management system, ensuring that vehicle history, route playback, and geo-fencing alerts operate reliably at all times.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Security</h2>
              <p>
                We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed. Data is encrypted in transit and at rest.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Contact Us</h2>
              <p>
                If you have any questions about this privacy policy or our privacy practices, please contact our support team.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
