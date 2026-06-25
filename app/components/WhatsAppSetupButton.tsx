"use client";

import React, { useEffect, useRef, useState } from "react";

// Explicitly defined props interface
export interface WhatsAppSetupButtonProps {
  clientId: string;
}

declare global {
  interface Window {
    FB: {
      init: (options: Record<string, unknown>) => void;
      login: (
        callback: (response: any) => void,
        options?: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit: () => void;
  }
}

const FACEBOOK_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";
const WHATSAPP_CONFIG_ID = process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID || "";

function isTrustedMetaOrigin(origin: string) {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();

    return (
      hostname === "facebook.com" ||
      hostname.endsWith(".facebook.com") ||
      hostname === "fb.com" ||
      hostname.endsWith(".fb.com")
    );
  } catch {
    return false;
  }
}

export const WhatsAppSetupButton: React.FC<WhatsAppSetupButtonProps> = ({ clientId }) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!FACEBOOK_APP_ID || !WHATSAPP_CONFIG_ID) {
      console.error("Missing Meta env values:", {
        FACEBOOK_APP_ID,
        WHATSAPP_CONFIG_ID,
      });
      return;
    }

    const initializeSdk = () => {
      if (!window.FB || hasInitializedRef.current) return;

      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: true, 
        version: "v20.0",
      });

      hasInitializedRef.current = true;
      setSdkReady(true);
      console.log("Facebook SDK initialized");
    };

    const handleEmbeddedMessage = async (event: MessageEvent) => {
      if (!isTrustedMetaOrigin(event.origin)) return;

      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (!data) return;

        console.log("Meta postMessage:", data);

        if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") {
          const payload = {
            client_id: clientId,
            waba_id: data.data?.waba_id || null,
            phone_number_id: data.data?.phone_number_id || null,
            business_id: data.data?.business_id || null,
          };

          const res = await fetch("/api/whatsapp/onboard", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const result = await res.json();

          if (!res.ok) {
            console.error("Onboard save failed:", result);
            alert(result.error || "Failed to save WhatsApp onboarding data.");
            setIsInitializing(false);
            return;
          }

          alert("WhatsApp onboarding completed successfully.");
          setIsInitializing(false);
        }

        if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "CANCEL") {
          console.warn("WhatsApp Embedded Signup canceled:", data);
          setIsInitializing(false);
        }

        if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "ERROR") {
          console.error("WhatsApp Embedded Signup error:", data);
          alert(
            data.data?.error_message ||
              "Meta onboarding failed. Please check Meta configuration."
          );
          setIsInitializing(false);
        }
      } catch {
        // ignore non-json messages
      }
    };

    window.addEventListener("message", handleEmbeddedMessage);

    if (window.FB && !hasInitializedRef.current) {
      initializeSdk();
    } else {
      window.fbAsyncInit = initializeSdk;

      if (!document.getElementById("facebook-jssdk")) {
        const js = document.createElement("script");
        js.id = "facebook-jssdk";
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        js.async = true;
        js.defer = true;
        document.body.appendChild(js);
      }
    }

    return () => {
      window.removeEventListener("message", handleEmbeddedMessage);
    };
  }, [clientId]);

  const launchWhatsAppSignup = () => {
    if (!window.FB) {
      alert("Facebook SDK not loaded yet.");
      return;
    }

    if (!FACEBOOK_APP_ID || !WHATSAPP_CONFIG_ID) {
      alert("Meta App ID or WhatsApp Config ID is missing.");
      return;
    }

    console.log("Launching WhatsApp signup with:", {
      FACEBOOK_APP_ID,
      WHATSAPP_CONFIG_ID,
    });

    setIsInitializing(true);

    window.FB.login(
  (response: any) => {
    console.log(
  "FB login response:",
  JSON.stringify(response, null, 2)
);

    if (!response?.authResponse) {
      console.warn("User cancelled or Meta authorization failed.");
      setIsInitializing(false);
      return;
    }

    const accessToken = response.authResponse.accessToken;

    console.log("Access Token:", accessToken);

    console.log("Meta auth success");
  },
  {
    config_id: WHATSAPP_CONFIG_ID,
    response_type: "code",
    override_default_response_type: true,
    extras: JSON.stringify({
      feature: "whatsapp_embedded_signup",
      sessionInfoVersion: "3",
    }),
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
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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