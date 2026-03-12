'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface GenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToken: string;
  initialCommittee?: string;
}

const DOCUMENT_TYPES = [
  { id: 'POSITION_PAPER', label: 'Position Paper' },
  { id: 'RESOLUTION', label: 'Resolución' },
  { id: 'DECLARATION', label: 'Declaración' },
  { id: 'WORKING_PAPER', label: 'Working Paper' },
];

export default function GenerateModal({ isOpen, onClose, userToken, initialCommittee }: GenerateModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [creationMode, setCreationMode] = useState<'BLANK' | 'AI' | null>(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    topic: '',
    country: '',
    committee: 'Asamblea General',
    documentType: 'POSITION_PAPER',
  });
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCreationMode(null);
      if (initialCommittee) {
        setFormData((prev) => ({ ...prev, committee: initialCommittee }));
      }
    }
  }, [isOpen, initialCommittee]);

  if (!isOpen) return null;

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleCreate = async (mode: 'BLANK' | 'AI') => {
    setCreationMode(mode);
    setLoading(true);
    setErrorMsg('');

    try {
      const endpoint = mode === 'AI' ? '/api/documents/generate-full' : '/api/documents';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // Increased to 120s for AI workflows
      const res = await fetch(`http://localhost:8080${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify(formData),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        setErrorMsg(`Error del servidor (${res.status}). Verifica tu sesión.`);
        return;
      }

      const data = await res.json();
      if (data && data.id) {
        router.push(`/documents/${data.id}`);
      }
    } catch {
      setErrorMsg('No se pudo conectar con el backend. Verifica que esté activo.');
    } finally {
      setLoading(false);
      setCreationMode(null);
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
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {step === 1 ? 'Detalles de la Delegación' : 'Método de Creación'}
              </h2>
              <p className="text-white/40 text-sm mt-1">
                {step === 1 ? `Comité: ${formData.committee}` : 'Selecciona cómo deseas empezar'}
              </p>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white transition">✕</button>
          </div>

          {step === 1 ? (
            <form onSubmit={handleNextStep} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Título del Documento</label>
                <input
                  required
                  type="text"
                  placeholder="Ej: Posición de Francia sobre el Cambio Climático"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#00f5ff]/50 outline-none transition"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">País Representado</label>
                  <input
                    required
                    type="text"
                    placeholder="Ej: Francia"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#00f5ff]/50 outline-none transition"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Tipo de Documento</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#00f5ff]/50 outline-none transition appearance-none text-white/90"
                    value={formData.documentType}
                    onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                  >
                    {DOCUMENT_TYPES.map(type => (
                      <option key={type.id} value={type.id} className="bg-[#040d21]">{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Tema de Discusión</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe brevemente el tema central y los puntos clave..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#00f5ff]/50 outline-none transition resize-none"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(0,245,255,0.2)] hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg, #00f5ff, #c44dff)', color: '#040d21' }}
                >
                  Continuar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div
                onClick={() => !loading && handleCreate('AI')}
                className={`p-6 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${loading && creationMode !== 'AI' ? 'opacity-50 pointer-events-none' : ''}`}
                style={{ background: 'linear-gradient(135deg, rgba(0,245,255,0.08), rgba(196,77,255,0.05))', borderColor: 'rgba(0,245,255,0.15)' }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#00f5ff]/0 to-[#c44dff]/0 group-hover:from-[#00f5ff]/10 group-hover:to-[#c44dff]/10 transition-all duration-500"></div>
                <div className="flex items-start gap-4 relative z-10">
                  <div className="text-4xl drop-shadow-[0_0_8px_rgba(0,245,255,0.5)]">⚡</div>
                  <div>
                    <h3 className="font-bold text-white text-lg mb-1">Generar con Agentes IA</h3>
                    <p className="text-white/50 text-sm">
                      Nuestros modelos (Nvidia NIM, Mistral, Llama 3) prepararán un borrador diplomático en formato LaTeX listo para que lo edites.
                    </p>
                  </div>
                </div>
                {loading && creationMode === 'AI' && (
                  <div className="absolute right-6 top-1/2 -translate-y-1/2">
                    <div className="w-6 h-6 border-2 border-[#00f5ff]/30 border-t-[#00f5ff] rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <div
                onClick={() => !loading && handleCreate('BLANK')}
                className={`p-6 rounded-2xl border transition-all cursor-pointer hover:bg-white/5 ${loading && creationMode !== 'BLANK' ? 'opacity-50 pointer-events-none' : ''}`}
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">📄</div>
                  <div>
                    <h3 className="font-bold text-white text-lg mb-1">Documento en Blanco</h3>
                    <p className="text-white/50 text-sm">
                      Comienza a escribir desde cero en el editor colaborativo sin asistencia de IA.
                    </p>
                  </div>
                </div>
                {loading && creationMode === 'BLANK' && (
                  <div className="absolute right-6 top-1/2 -translate-y-1/2">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  ⚠ {errorMsg}
                </div>
              )}

              <div className="pt-2">
                <button
                  disabled={loading}
                  onClick={() => setStep(1)}
                  className="text-white/40 hover:text-white text-sm"
                >
                  ← Volver a detalles
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
