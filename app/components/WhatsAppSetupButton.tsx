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

const WhatsAppSetupButton: React.FC<WhatsAppSetupButtonProps> = ({
  clientId,
}) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
        cookie: true,
        xfbml: false,
        version: "v20.0",
      });

      console.log("Facebook SDK Initialized");
      setSdkReady(true);
    };

    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;

      document.body.appendChild(script);
    } else {
      setSdkReady(true);
    }
  }, []);

  const launchWhatsAppSignup = () => {
    if (!window.FB) {
      alert("Facebook SDK not loaded");
      return;
    }

    setIsInitializing(true);

    window.FB.login(
      async (response: any) => {
        console.log("Facebook Response:", response);

        if (response.authResponse) {
          try {
            const code = response.authResponse.code;

            console.log("Authorization Code:", code);

            // Send code to backend
            const res = await fetch("/api/whatsapp/exchange-token", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                code,
                clientId,
              }),
            });

            const data = await res.json();

            console.log("Backend Response:", data);

            if (data.success) {
              alert("WhatsApp connected successfully!");
            } else {
              alert(data.error || "Connection failed");
            }
          } catch (err) {
            console.error(err);
            alert("Something went wrong");
          }
        } else {
          console.warn("User cancelled login");
        }

        setIsInitializing(false);
      },
      {
        config_id: process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
        },
      }
    );
  };

  return (
    <button
      onClick={launchWhatsAppSignup}
      disabled={!sdkReady || isInitializing}
      className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all shadow-md ${
        !sdkReady || isInitializing
          ? "bg-gray-400 cursor-not-allowed opacity-70"
          : "bg-[#25D366] hover:bg-[#128C7E] active:scale-[0.98] hover:shadow-lg"
      }`}
    >
      {isInitializing
        ? "Connecting..."
        : sdkReady
        ? "Connect WhatsApp"
        : "Initializing..."}
    </button>
  );
};

export default WhatsAppSetupButton;