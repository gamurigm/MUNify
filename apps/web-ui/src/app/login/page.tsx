'use client';


import { Suspense } from 'react';

export default function LoginPage() {
  const handleGoogleLogin = () => {
    // Direct call to the backend OAuth2 endpoint
    window.location.href = 'http://localhost:8080/oauth2/authorization/google';
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center md:justify-end overflow-hidden px-4 md:px-24 bg-[#020813]">
      {/* Background Image with elegant dark overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="/munify_login_v6.png"
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-[#00f5ff]/10"></div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-[#040d21]/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,245,255,0.1)] p-10 flex flex-col items-center relative overflow-hidden">
          
          {/* Decorative glowing orb behind the content */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#c44dff]/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[#00f5ff]/20 rounded-full blur-3xl"></div>

          {/* Logo */}
          <div className="mb-8 p-5 bg-white/5 rounded-full border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)] relative z-10">
            <img
              src="/images/logo.png"
              alt="MUNify Logo"
              width={90}
              height={90}
              className="object-contain drop-shadow-lg"
            />
          </div>

          <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tighter relative z-10 drop-shadow-md">
            MUN<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f5ff] to-[#c44dff]">ify</span>
          </h1>
          <p className="text-white/60 mb-10 text-center font-medium uppercase tracking-[0.2em] text-xs relative z-10">
            Global Diplomatic Platform
          </p>

          <button
            onClick={handleGoogleLogin}
            className="group relative w-full flex items-center justify-center gap-4 bg-white/5 text-white font-bold py-4 px-6 rounded-2xl shadow-xl transition-all duration-300 hover:bg-white/10 border border-white/10 hover:border-[#00f5ff]/50 z-10 overflow-hidden"
          >
            {/* Hover gradient effect inside button */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#00f5ff]/0 via-[#00f5ff]/10 to-[#c44dff]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span className="text-sm tracking-wide relative z-10">Access with Google</span>
          </button>

          <div className="mt-10 flex items-center justify-center gap-4 w-full relative z-10">
             <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/20"></div>
             <span className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-bold">Secure Gateway</span>
             <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/20"></div>
          </div>
        </div>

        <p className="mt-8 text-center text-white/30 text-xs font-medium tracking-wider">
          &copy; {new Date().getFullYear()} MUNIFY. FUTURE DIPLOMATS.
        </p>
      </div>
    </div>
  );
}

