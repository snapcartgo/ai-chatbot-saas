"use client";

import React, { useState, useEffect } from 'react';

interface WhatsAppSetupButtonProps {
  clientId: string;
}

const WhatsAppSetupButton: React.FC<WhatsAppSetupButtonProps> = ({ clientId }) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    // Check if SDK is already loaded on mount
    if ((window as any).FB) {
      setSdkReady(true);
    }

    // Set up a listener for when the SDK initializes
    const checkSdk = setInterval(() => {
      if ((window as any).FB) {
        setSdkReady(true);
        clearInterval(checkSdk);
      }
    }, 1000);

    return () => clearInterval(checkSdk);
  }, []);

  const launchWhatsAppSignup = () => {
    const fb = (window as any).FB;

    if (fb) {
      setIsInitializing(true);
      
      fb.login((response: any) => {
  if (response.authResponse) {
    console.log('Successfully authenticated with Meta', response);
  } else {
    console.warn('User cancelled login or did not fully authorize.');
  }

  setIsInitializing(false);

}, {
  config_id: '1561772279278060',
  response_type: 'code',
  override_default_response_type: true,
  extras: {
    feature: 'whatsapp_embedded_signup',
    setup: {}
  }
});
    } else {
      alert("WhatsApp setup is still initializing. Please try again in a moment.");
    }
  };

  return (
    <button
      onClick={launchWhatsAppSignup}
      disabled={isInitializing || (!sdkReady && !isInitializing)}
      className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all shadow-md ${
        isInitializing || !sdkReady
          ? "bg-gray-400 cursor-not-allowed opacity-70" 
          : "bg-[#25D366] hover:bg-[#128C7E] active:scale-[0.98] hover:shadow-lg"
      }`}
    >
      {isInitializing ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Connecting...
        </span>
      ) : (
        sdkReady ? "Connect WhatsApp" : "Initializing..."
      )}
    </button>
  );
};

export default WhatsAppSetupButton;