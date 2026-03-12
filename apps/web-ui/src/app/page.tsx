'use client';


import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GenerateModal from '@/components/GenerateModal';
import HelpAndChat from '@/components/HelpAndChat';

const committees = [
  { id: 'GA', name: 'Asamblea General', sub: 'General Assembly', color: '#00f5ff', icon: 'https://w1.pngwing.com/pngs/828/854/png-transparent-school-black-and-white-singapore-model-united-nations-united-nations-headquarters-holm-model-united-nations-international-united-nations-general-assembly-first-committee-asiapacific.png' },
  { id: 'SC', name: 'Consejo de Seguridad', sub: 'Security Council', color: '#c44dff', icon: 'https://lh6.googleusercontent.com/proxy/jwAorRuPsSHkiWQblcpV9oC8ttJBs0KXopUeCy_Gp0gr7Av4VWoZCXpubL8b67J9cKH_Wj6_9IvKwx_PumPaV4v6Kphs4vqbPnbLaR_bp5nX0l3K' },
  { id: 'EC', name: 'Consejo Económico y Social', sub: 'ECOSOC', color: '#00f5ff', icon: 'https://e7.pngegg.com/pngimages/741/522/png-clipart-united-nations-office-at-nairobi-united-nations-economic-and-social-commission-for-western-asia-flag-of-the-united-nations-model-united-nations-united-states-text-logo-thumbnail.png' },
  { id: 'DC', name: 'Comité de Desarme', sub: 'DISEC', color: '#c44dff', icon: 'https://images.squarespace-cdn.com/content/v1/60cad55aac824c1fa4ba0730/1629259838677-DI4ELJKWJX06ZLSFARP2/DISEC.png' },
  { id: 'SH', name: 'SOCHUM', sub: 'Social, Cultural y Humanitario', color: '#00f5ff', icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRY8D4nS1-OtrjwdUW5JwWV_qW6xBlS09uzBw&s' },
  { id: 'CJ', name: 'Corte Internacional', sub: 'CIJ / ICJ', color: '#c44dff', icon: 'https://w7.pngwing.com/pngs/958/600/png-transparent-peace-palace-international-court-of-justice-judge-criminal-miscellaneous-furniture-logo-thumbnail.png' },
  { id: 'AC', name: 'ACNUR', sub: 'Alto Comisionado para los Refugiados', color: '#00f5ff', icon: 'https://e7.pngegg.com/pngimages/911/150/png-clipart-united-nations-high-commissioner-for-refugees-world-refugee-day-office-of-the-united-nations-high-commissioner-for-human-rights-refugees-text-logo.png' },
  { id: 'UF', name: 'UNICEF', sub: 'Fondo para la Infancia', color: '#c44dff', icon: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQqAsHFr6CvzxXLO5Zn0HhW9frt3DkGvkeIiw&s' },
  { id: 'G2', name: 'G20', sub: 'Grupo de los Veinte', color: '#00f5ff', icon: 'https://datosmacro.expansion.com/sites/default/files/varios/art/2015/06/G-20-transp.png' },
  { id: 'US', name: 'UNESCO', sub: 'Educación, Ciencia y Cultura', color: '#c44dff', icon: 'https://w7.pngwing.com/pngs/782/217/png-transparent-unesco-hd-logo-thumbnail.png' },
  { id: 'UD', name: 'UNODC', sub: 'Droga y Delito', color: '#00f5ff', icon: 'https://www.vhv.rs/dpng/d/252-2528444_logo-of-the-united-nations-office-on-drugs.png' },
  { id: 'OT', name: 'OTAN', sub: 'Organización del Tratado del Atlántico Norte', color: '#c44dff', icon: 'https://e7.pngegg.com/pngimages/79/599/png-clipart-the-north-atlantic-treaty-organization-nato-headquarters-nato-summit-german-cooperation-logo-miscellaneous-blue-thumbnail.png' },
  { id: 'UC', name: 'UNCTAD', sub: 'Comercio y Desarrollo', color: '#00f5ff', icon: 'https://hub.unido.org/sites/default/files/logos/unctad.png' },
  { id: 'OM', name: 'ONU Mujeres', sub: 'Igualdad de Género', color: '#c44dff', icon: 'https://w1.pngwing.com/pngs/502/665/png-transparent-background-womens-day-united-nations-womens-federation-for-world-peace-united-nations-headquarters-organization-international-humanitarian-aid-unicef.png' },
];

const navItems = ['Documents', 'Notes', 'AI Tools'];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [token, setToken] = useState<string>('');
  const [activeNav, setActiveNav] = useState('Documents');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCommittee, setSelectedCommittee] = useState<string>('');
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    const storedToken = localStorage.getItem('munify_token');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);
    // Decode token payload (basic JWT decode, no validation)
    try {
      const payload = JSON.parse(atob(storedToken.split('.')[1]));
      setUser({ name: payload.sub || 'Delegate' });
    } catch {
      setUser({ name: 'Delegate' });
    }

    // Fetch user documents (graceful — backend may be offline)
    const fetchDocuments = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('http://localhost:8080/api/documents/my', {
          headers: { Authorization: `Bearer ${storedToken}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          setDocuments(data);
        }
      } catch {
        // Backend offline or CORS — silently ignore, dashboard still works
      }
    };
    // Delay slightly so page renders first
    const t = setTimeout(fetchDocuments, 500);
    return () => clearTimeout(t);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('munify_token');
    router.push('/login');
  };

  return (
    <div className="min-h-screen text-white overflow-hidden relative bg-[#020813]">
      {/* Home Background Image */}
      <div className="absolute inset-0 z-0 opacity-80 mix-blend-screen pointer-events-none">
        <img
          src="/modern_login_bg.png"
          alt="Home Background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#040d21]/60 via-[#040d21]/80 to-[#040d21]"></div>
      </div>

      {/* Ambient glow effects */}
      <div className="fixed inset-0 z-0 pointer-events-none mix-blend-screen">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full opacity-20 blur-[120px]" style={{ background: '#00f5ff' }} />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full opacity-15 blur-[140px]" style={{ background: '#c44dff' }} />
      </div>

      {/* Top Nav */}
      <header className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-white/10" style={{ background: 'rgba(4,13,33,0.8)', backdropFilter: 'blur(20px)' }}>
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src="/images/logo.png" alt="MUNify" width={36} height={36} className="object-contain" />
          <span className="text-xl font-bold tracking-tight">
            MUN<span style={{ color: '#00f5ff' }}>ify</span>
          </span>
        </div>

        {/* Center tabs */}
        <nav className="flex items-center gap-2 px-2 py-2 rounded-2xl border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {navItems.map((item) => (
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

        {/* Right actions */}
        <div className="flex items-center gap-4">
          <button className="text-white/40 hover:text-white transition-colors text-sm">
            ⚙ Configuración
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

      {/* Main content */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 py-10">
        {/* Hero banner */}
        <div className="relative w-full h-52 rounded-3xl overflow-hidden mb-10 border border-white/10">
          <img src="/images/bg.png" alt="Banner" className="absolute inset-0 w-full h-full object-cover object-top" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(4,13,33,0.9) 0%, rgba(4,13,33,0.2) 100%)' }} />
          <div className="absolute inset-0 flex flex-col justify-center px-10">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00f5ff' }}>Organización de las Naciones Unidas</p>
            <h1 className="text-4xl font-extrabold tracking-tight">
              AI Document Generator
            </h1>
            <p className="mt-1 text-white/50 text-sm">For MUN Simulations · {user?.name ?? 'Delegate'}</p>
          </div>
        </div>

        {activeNav === 'Documents' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Committees and Documents */}
            <div className="lg:col-span-2 space-y-10">


              {/* Committees section */}
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: '#00f5ff' }}>Comités Disponibles</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {committees.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCommittee(c.name);
                        setIsModalOpen(true);
                      }}
                      className="group text-left p-5 rounded-2xl border transition-all duration-300 hover:scale-[1.02] relative overflow-hidden"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        borderColor: 'rgba(255,255,255,0.08)',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = c.color + '55';
                        (e.currentTarget as HTMLButtonElement).style.background = c.color + '10';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                      }}
                    >
                      <div 
                        className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center relative transition-all duration-500 group-hover:scale-110" 
                        style={{ 
                          background: `linear-gradient(135deg, ${c.color}22, rgba(255,255,255,0.05))`,
                          border: `1px solid ${c.color}44`,
                          boxShadow: `0 0 20px ${c.color}11, inset 0 0 10px ${c.color}22`,
                          backdropFilter: 'blur(8px)'
                        }}
                      >
                        {/* Internal Glow Orbit */}
                        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ boxShadow: `0 0 30px ${c.color}44` }}></div>
                        
                        {c.icon ? (
                          <img 
                            src={c.icon} 
                            alt={c.name} 
                            className="w-9 h-9 object-contain relative z-10 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-transform duration-500 group-hover:rotate-3" 
                          />
                        ) : (
                          <span className="text-sm font-black relative z-10 tracking-tighter" style={{ color: c.color }}>{c.id}</span>
                        )}
                      </div>
                      <p className="font-bold text-white/95 text-sm group-hover:text-white transition-colors">{c.name}</p>
                      <p className="text-white/30 text-[11px] mt-1 uppercase tracking-widest">{c.sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Help & Support + Documents */}
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: '#00f5ff' }}>Soporte & Guía</h2>
                <HelpAndChat />
              </div>

              {/* My Documents Section (Moved here) */}
              {documents.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: '#00f5ff' }}>Mis Documentos</h2>
                  <div 
                    className="space-y-3 pr-2 overflow-y-auto" 
                    style={{ 
                      maxHeight: '380px', 
                      scrollbarWidth: 'thin', 
                      scrollbarColor: 'rgba(0,245,255,0.2) transparent'
                    }}
                  >
                    {documents.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => router.push(`/documents/${doc.id}`)}
                        className="w-full group text-left p-4 rounded-xl border transition-all duration-300 hover:bg-white/5 flex items-center gap-4"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          borderColor: 'rgba(255,255,255,0.06)',
                        }}
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 shadow-lg" style={{ background: 'rgba(0,245,255,0.1)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.2)' }}>
                          DOC
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white/90 text-xs truncate">{doc.title || 'Documento sin título'}</p>
                          <p className="text-white/30 text-[10px] truncate">{doc.committee || 'Sin comité'} • {doc.country || 'Sin país'}</p>
                        </div>
                        <div className="text-[9px] uppercase px-1.5 py-0.5 rounded border border-white/10 text-white/30 shrink-0">
                          {doc.status || 'DRAFT'}
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-white/20 mt-3 text-center uppercase tracking-tighter">Fin de los archivos</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes View Placeholder */}
        {activeNav === 'Notes' && (
          <div className="flex flex-col items-center justify-center p-20 border border-white/10 rounded-3xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-5xl mb-4 opacity-50">🗒️</div>
            <h2 className="text-2xl font-bold text-white/80 mb-2">Notas Personales</h2>
            <p className="text-white/40 text-center max-w-md">
              Pronto podrás tomar notas cifradas y sincronizadas en la nube para preparar tus discursos sin cambiar de pestaña.
            </p>
            <button className="mt-8 px-6 py-2 rounded-full border border-white/20 text-sm font-medium hover:bg-white/5 disabled:opacity-50" disabled>
              Próximamente
            </button>
          </div>
        )}

        {/* AI Tools View Placeholder */}
        {activeNav === 'AI Tools' && (
          <div className="flex flex-col items-center justify-center p-20 border border-white/10 rounded-3xl relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
            {/* Glowing background hint */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-20 blur-[100px] bg-[#c44dff]"></div>

            <div className="text-5xl mb-4 opacity-80 drop-shadow-[0_0_15px_rgba(196,77,255,0.5)]">🤖</div>
            <h2 className="text-2xl font-bold text-white/80 mb-2 relative z-10">Agentes Diplomáticos MUNify</h2>
            <p className="text-white/40 text-center max-w-md relative z-10">
              Analiza resoluciones, verifica coherencia jurídica y genera discursos con NotebookLM RAG.
            </p>
            <button className="mt-8 px-6 py-2 rounded-full border border-[#c44dff]/40 text-[#c44dff] text-sm font-bold shadow-[0_0_15px_rgba(196,77,255,0.2)] hover:bg-[#c44dff]/10 relative z-10 disabled:opacity-50" disabled>
              Acceso Restringido (Fase Beta)
            </button>
          </div>
        )}
      </main>

      <GenerateModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        userToken={token} 
        initialCommittee={selectedCommittee}
      />
    </div>
  );
}
