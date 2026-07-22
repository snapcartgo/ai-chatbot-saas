'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. Declare google globally so TypeScript doesn't throw errors
declare global {
  interface Window {
    google: any;
  }
}

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function GoogleLoginButton() {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google) {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        callback: handleGoogleSignIn,
      });

      const btnContainer = document.getElementById('googleSignInBtn');
      if (btnContainer) {
        window.google.accounts.id.renderButton(btnContainer, {
          theme: 'outline',
          size: 'large',
          width: '100%',
        });
      }
    }
  }, []);

  const handleGoogleSignIn = async (response: any) => {
    // Pass Google ID token straight to Supabase
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.credential,
    });

    if (error) {
      console.error('Login Error:', error.message);
    } else {
      console.log('Login Success:', data);
      window.location.href = '/dashboard'; // Redirect on success
    }
  };

  return <div id="googleSignInBtn" className="w-full my-2"></div>;
}