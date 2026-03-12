'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      // Save token to localStorage
      localStorage.setItem('munify_token', token);
      console.log('Authentication successful, token stored.');
      
      // Redirect to dashboard (or home for now)
      router.push('/');
    } else {
      console.error('No token found in callback URL');
      router.push('/login');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#001f3f]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-silver-400 border-t-white rounded-full animate-spin"></div>
        <p className="text-white font-medium animate-pulse">Finalizando autenticación diplomática...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#001f3f]">
        <div className="w-12 h-12 border-4 border-silver-400 border-t-white rounded-full animate-spin"></div>
      </div>
    }>
      <AuthHandler />
    </Suspense>
  );
}
