'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CreateSessionModal from '@/components/CreateSessionModal'; // We'll create this next
import HelpAndChat from '@/components/HelpAndChat';

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [token, setToken] = useState<string>('');
  const [activeNav, setActiveNav] = useState('Sessions');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('munify_token');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);
    
    try {
      const payload = JSON.parse(atob(storedToken.split('.')[1]));
      setUser({ name: payload.sub || 'Delegate' });
    } catch {
      setUser({ name: 'Delegate' });
    }

    const fetchSessions = async () => {
      try {
        const res = await fetch('http://localhost:8080/api/sessions', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions || []);
        } else {
          // Si el token es inválido (ej. firma incorrecta), limpiar y forzar login
          localStorage.removeItem('munify_token');
          router.push('/login');
        }
      } catch (e) {
        console.error('Failed to fetch sessions', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('munify_token');
    router.push('/login');
  };

  const handleSessionCreated = (newSession: any) => {
    setSessions([newSession, ...sessions]);
  };

  return (
    <div className="min-h-screen text-white overflow-hidden relative bg-[#020813]">
      <div className="absolute inset-0 z-0 opacity-80 mix-blend-screen pointer-events-none">
        <img
          src="/modern_login_bg.png"
          alt="Home Background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#040d21]/60 via-[#040d21]/80 to-[#040d21]"></div>
      </div>

      <div className="fixed inset-0 z-0 pointer-events-none mix-blend-screen">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full opacity-20 blur-[120px]" style={{ background: '#00f5ff' }} />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full opacity-15 blur-[140px]" style={{ background: '#c44dff' }} />
      </div>

      <header className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-white/10" style={{ background: 'rgba(4,13,33,0.8)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-3">
          <img src="/images/logo.png" alt="MUNify" width={36} height={36} className="object-contain" />
          <span className="text-xl font-bold tracking-tight">
            MUN<span style={{ color: '#00f5ff' }}>ify</span>
            <span className="ml-2 text-xs text-[#00f5ff] uppercase border border-[#00f5ff]/30 px-1.5 py-0.5 rounded-full">v3</span>
          </span>
        </div>

        <nav className="flex items-center gap-2 px-2 py-2 rounded-2xl border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {['Sessions', 'Global Intel'].map((item) => (
            <button
              key={item}
              onClick={() => setActiveNav(item)}
              className="relative px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                background: activeNav === item ? 'rgba(0,245,255,0.12)' : 'transparent',
                color: activeNav === item ? '#00f5ff' : 'rgba(255,255,255,0.5)',
                border: activeNav === item ? '1px solid rgba(0,245,255,0.3)' : '1px solid transparent',
              }}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button className="text-white/40 hover:text-white transition-colors text-sm">
            ⚙ Config
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg, #00f5ff, #c44dff)' }}>
              {user?.name?.[0]?.toUpperCase() ?? 'D'}
            </div>
            <span className="text-sm text-white/70">{user?.name ?? '...'}</span>
          </div>
          <button onClick={handleLogout} className="text-white/30 hover:text-red-400 transition text-sm">
            Salir
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-8 py-10">
        <div className="relative w-full h-52 rounded-3xl overflow-hidden mb-10 border border-white/10">
          <img src="/images/bg.png" alt="Banner" className="absolute inset-0 w-full h-full object-cover object-top" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(4,13,33,0.9) 0%, rgba(4,13,33,0.2) 100%)' }} />
          <div className="absolute inset-0 flex flex-col justify-center px-10">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00f5ff' }}>Diplomatic Platform</p>
            <h1 className="text-4xl font-extrabold tracking-tight">
              Tus Sesiones Modelo ONU
            </h1>
            <p className="mt-1 text-white/50 text-sm">Multi-Session Environment · {user?.name ?? 'Delegate'}</p>
          </div>
        </div>

        {activeNav === 'Sessions' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="flex justify-between items-end">
                <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#00f5ff' }}>Historias & Activas</h2>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(0,245,255,0.2)] hover:scale-[1.02] flex items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #00f5ff, #c44dff)', color: '#040d21' }}
                >
                  <span className="text-lg leading-none">+</span> Nueva Sesión
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center p-20 border border-white/5 rounded-2xl bg-white/[0.02]">
                  <div className="w-8 h-8 rounded-full border-2 border-[#00f5ff] border-t-transparent animate-spin"></div>
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 border border-white/5 rounded-2xl bg-white/[0.02] text-center">
                  <span className="text-5xl mb-4 opacity-50">🌍</span>
                  <h3 className="text-xl font-bold text-white/80 mb-2">Sin Sesiones Activas</h3>
                  <p className="text-white/40 text-sm max-w-sm mb-6">Inicia tu primera sesión MUN para organizar tus documentos, bloques y apuntes de forma aislada.</p>
                  <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition">Crear Sesión</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => router.push(`/sessions/${s.id}`)}
                      className="group text-left p-6 rounded-2xl border transition-all duration-300 hover:scale-[1.02] relative overflow-hidden"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        borderColor: s.is_current ? 'rgba(0,245,255,0.3)' : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      {s.is_current && <div className="absolute top-0 right-0 px-3 py-1 bg-[#00f5ff]/20 text-[#00f5ff] text-[9px] font-black uppercase rounded-bl-xl">Activa</div>}
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg shadow-lg relative overflow-hidden bg-[#0a1530] border border-white/10 group-hover:border-[#00f5ff]/40 transition-colors">
                           {s.country_assigned.substring(0,2).toUpperCase()}
                        </div>
                      </div>
                      <h3 className="font-bold text-white text-lg mb-1">{s.mun_name}</h3>
                      <div className="text-white/60 text-xs mb-3 space-y-1">
                         <p><strong>Comité:</strong> {s.committee_name || s.committee_id}</p>
                         <p><strong>País:</strong> {s.country_assigned}</p>
                      </div>
                      <p className="text-white/30 text-[10px] uppercase truncate">Tema: {s.topic || 'Sin especificar'}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: '#00f5ff' }}>Soporte & Guía</h2>
                <HelpAndChat />
              </div>
            </div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <CreateSessionModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          userToken={token}
          onCreated={handleSessionCreated}
        />
      )}
    </div>
  );
}
