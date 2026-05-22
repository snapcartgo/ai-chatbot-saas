"use client";

import React, { useState, useEffect } from "react";

interface WhatsAppSetupButtonProps {
  clientId: string;
}

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

const WhatsAppSetupButton: React.FC<WhatsAppSetupButtonProps> = ({ clientId }) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    // Load Facebook SDK
    window.fbAsyncInit = function () {
      window.FB.init({
  appId      : '4331141513783156',
  cookie     : true,
  xfbml      : true,
  version    : 'v20.0' // <-- Change to v20.0
});

      setSdkReady(true);
      console.log("Facebook SDK initialized");
    };

    // Inject SDK script if not already loaded
    if (!document.getElementById("facebook-jssdk")) {
      const js = document.createElement("script");
      js.id = "facebook-jssdk";
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      js.async = true;
      js.defer = true;

      document.body.appendChild(js);
    } else {
      setSdkReady(true);
    }
  }, []);

  const launchWhatsAppSignup = () => {
    const fb = window.FB;

    if (!fb) {
      alert("Facebook SDK not loaded yet.");
      return;
    }

    setIsInitializing(true);

    fb.login(
      (response: any) => {
        console.log("FB Login Response:", response);

        if (response.authResponse) {
          console.log("Successfully authenticated with Meta");

          // Authorization code returned here
          const code = response.authResponse.code;
          console.log("Authorization Code:", code);

          // TODO:
          // Send this code to your backend API
          // Exchange for access token
        } else {
          console.warn("User cancelled login or authorization failed.");
        }

        setIsInitializing(false);
      },
      {
        config_id: "1561772279278060",
        response_type: "code",
        override_default_response_type: true,
      }
    );
  };

  return (
    <button
      onClick={launchWhatsAppSignup}
      disabled={isInitializing || !sdkReady}
      className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all shadow-md ${
        isInitializing || !sdkReady
          ? "bg-gray-400 cursor-not-allowed opacity-70"
          : "bg-[#25D366] hover:bg-[#128C7E] active:scale-[0.98] hover:shadow-lg"
      }`}
    >
      {isInitializing ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>

            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 
              0 0 5.373 0 12h4zm2 
              5.291A7.962 7.962 0 
              014 12H0c0 3.042 
              1.135 5.824 3 
              7.938l3-2.647z"
            ></path>
          </svg>

          Connecting...
        </span>
      ) : sdkReady ? (
        "Connect WhatsApp"
      ) : (
        "Initializing..."
      )}
    </button>
  );
};

export default WhatsAppSetupButton;