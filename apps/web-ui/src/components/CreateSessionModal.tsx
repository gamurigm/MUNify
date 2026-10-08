'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToken: string;
  onCreated: (session: any) => void;
}

const COMMITTEES = [
  { id: 'GA', name: 'Asamblea General' },
  { id: 'SC', name: 'Consejo de Seguridad' },
  { id: 'EC', name: 'ECOSOC' },
  { id: 'DC', name: 'DISEC' },
  { id: 'SH', name: 'SOCHUM' },
  { id: 'CJ', name: 'Corte Internacional' },
  { id: 'AC', name: 'ACNUR' },
  { id: 'UF', name: 'UNICEF' },
  { id: 'G2', name: 'G20' },
  { id: 'US', name: 'UNESCO' },
  { id: 'UD', name: 'UNODC' },
  { id: 'OT', name: 'OTAN' },
  { id: 'UC', name: 'UNCTAD' },
  { id: 'OM', name: 'ONU Mujeres' },
];

export default function CreateSessionModal({ isOpen, onClose, userToken, onCreated }: CreateSessionModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [formData, setFormData] = useState({
    mun_name: '',
    committee_id: 'GA',
    country_assigned: '',
    topic: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const committeeInfo = COMMITTEES.find(c => c.id === formData.committee_id);

    try {
      const res = await fetch('http://localhost:8080/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          ...formData,
          committee_name: committeeInfo?.name || formData.committee_id,
          country_code: 'xx', // Simplified
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.error || `Error del servidor (${res.status}).`);
        return;
      }

      const data = await res.json();
      onCreated(data);
      router.push(`/sessions/${data.id}`);
      onClose();
    } catch {
      setErrorMsg('No se pudo conectar con el Gateway. Verifica que esté activo (puerto 8080).');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#040d21] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden">
        {/* Glow behind */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-[#00f5ff]/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-[#c44dff]/20 blur-3xl" />

        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Nueva Sesión MUN</h2>
              <p className="text-white/40 text-sm mt-1">Ingresa los datos del modelo</p>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white transition">✕</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Nombre del Modelo</label>
              <input
                required
                type="text"
                placeholder="Ej: HNMUN 2026, AndinaMUN"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#00f5ff]/50 outline-none transition"
                value={formData.mun_name}
                onChange={(e) => setFormData({ ...formData, mun_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Comité</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#00f5ff]/50 outline-none transition appearance-none text-white/90"
                  value={formData.committee_id}
                  onChange={(e) => setFormData({ ...formData, committee_id: e.target.value })}
                >
                  {COMMITTEES.map(type => (
                    <option key={type.id} value={type.id} className="bg-[#040d21]">{type.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">País / Delegación</label>
                <input
                  required
                  type="text"
                  placeholder="Ej: Francia"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#00f5ff]/50 outline-none transition"
                  value={formData.country_assigned}
                  onChange={(e) => setFormData({ ...formData, country_assigned: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Tema de Discusión</label>
              <textarea
                rows={2}
                placeholder="Tema central de la agenda..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#00f5ff]/50 outline-none transition resize-none"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                ⚠ {errorMsg}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(0,245,255,0.2)] hover:scale-[1.02] flex items-center justify-center min-w-[140px]"
                style={{ background: 'linear-gradient(135deg, #00f5ff, #c44dff)', color: '#040d21' }}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#040d21]/30 border-t-[#040d21] rounded-full animate-spin" />
                ) : (
                  'Crear Sesión'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
