'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  ZAxis, 
  Tooltip, 
  ScatterChart, 
  Scatter, 
  Cell,
  Label
} from 'recharts';
import { Info, AlertTriangle, ShieldCheck } from 'lucide-react';

interface HeatmapRelationsProps {
  participants: string[];
  countries: { code: string; name: string }[];
}

export default function HeatmapRelations({ participants, countries }: HeatmapRelationsProps) {
  const params = useParams();
  const committeeId = params?.committeeId || 'global';
  const selectedCountries = countries.filter(c => participants.includes(c.code));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedCountries.length >= 2) {
      setLoading(true);
      fetch(`http://${window.location.hostname}:8000/api/v1/relations/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          countries: selectedCountries.map(c => c.code),
          committee_id: String(committeeId)
        }),
      })
      .then(res => res.json())
      .then(json => {
        if (json.status === 'success') {
           // Flatten matrix for Recharts ScatterChart (Heatmap style)
           const heatmapData: any[] = [];
           json.heatmap.forEach((row: any[], i: number) => {
             row.forEach((cell: any, j: number) => {
               heatmapData.push({
                 x: j,
                 y: i,
                 score: cell.score,
                 source: cell.source,
                 target: cell.target,
                 sourceName: selectedCountries[i]?.name,
                 targetName: selectedCountries[j]?.name
               });
             });
           });
           setData(heatmapData);
        }
      })
      .finally(() => setLoading(false));
    }
  }, [participants, committeeId]);

  const getColor = (score: number) => {
    if (score > 0.7) return 'bg-emerald-500/40 border-emerald-500/20'; // Strategic Ally
    if (score > 0.3) return 'bg-blue-500/30 border-blue-500/20';    // Cooperation
    if (score < -0.7) return 'bg-red-500/40 border-red-500/20';      // Conflict
    if (score < -0.3) return 'bg-orange-500/30 border-orange-500/20'; // Friction
    return 'bg-slate-500/10 border-white/5';                        // Neutral
   score > 0 ? `text-emerald-400` : score < 0 ? `text-red-400` : `text-white/40`;
  };

  const getTextColor = (score: number) => {
    if (score > 0.3) return 'text-emerald-400';
    if (score < -0.3) return 'text-red-400';
    return 'text-white/40';
  };

  if (selectedCountries.length < 2) {
    return (
      <div className="h-full flex flex-col items-center justify-center border border-white/5 rounded-[32px] bg-white/[0.01] transition-all p-12">
        <Info className="w-12 h-12 text-white/5 mb-4" />
        <span className="text-xs text-white/20 uppercase tracking-[0.4em] font-black">Análisis Diplomático</span>
        <p className="text-[10px] text-white/10 mt-2 uppercase font-bold">Selecciona 2 o más países para generar la matriz de inteligencia</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-cyan-400 mb-1">Scientific Heatmap Matrix</span>
          <div className="flex items-center gap-3">
             <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">Bilateral Affinity Index</span>
             <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse" />
             <span className="text-[8px] font-bold text-white/10 uppercase tracking-widest">v4.0.1 Stable</span>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm bg-emerald-500/40 border border-emerald-500/20" />
            <span className="text-[8px] font-black text-white/30 uppercase">Ally</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm bg-red-500/40 border border-red-500/20" />
            <span className="text-[8px] font-black text-white/30 uppercase">Conflict</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col relative">
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#020617]/40 backdrop-blur-md rounded-[32px]">
            <div className="flex flex-col items-center gap-4">
               <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
               <span className="text-[8px] font-black text-cyan-500 uppercase tracking-[0.4em]">Querying Intelligence Layer...</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto custom-scrollbar p-2">
          <div 
            className="grid gap-1.5"
            style={{ 
              gridTemplateColumns: `repeat(${selectedCountries.length + 1}, minmax(80px, 1fr))`,
            }}
          >
            {/* Header Row */}
            <div className="h-12 bg-transparent" />
            {selectedCountries.map(c => (
              <div key={`h-${c.code}`} className="h-12 flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-xl px-2">
                <img src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`} className="w-5 h-3.5 rounded-sm object-cover opacity-60 mb-1" alt="" />
                <span className="text-[9px] font-black text-white/40 uppercase">{c.code}</span>
              </div>
            ))}

            {/* Matrix Rows */}
            {selectedCountries.map((c1, i) => (
              <React.Fragment key={`row-${c1.code}`}>
                {/* Y-Axis Label */}
                <div className="h-16 flex items-center gap-3 px-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <img src={`https://flagcdn.com/w40/${c1.code.toLowerCase()}.png`} className="w-5 h-3.5 rounded-sm shrink-0 opacity-60" alt="" />
                  <span className="text-[9px] font-black text-white/40 uppercase truncate">{c1.name}</span>
                </div>

                {/* Data Cells */}
                {selectedCountries.map((c2, j) => {
                  const cell = data.find(d => d.source === c1.code && d.target === c2.code);
                  const score = cell?.score ?? 0;
                  const isSelf = c1.code === c2.code;

                  return (
                    <div 
                      key={`${c1.code}-${c2.code}`}
                      className={`group h-16 rounded-xl border flex flex-col items-center justify-center transition-all duration-300 relative ${isSelf ? 'bg-white/5 border-white/10 opacity-20' : getColor(score)} hover:scale-[1.02] hover:z-10 cursor-pointer shadow-lg hover:shadow-cyan-500/10`}
                    >
                      {!isSelf && (
                        <>
                          <span className={`text-[13px] font-black tabular-nums transition-transform group-hover:scale-110 ${getTextColor(score)}`}>
                            {Math.abs(score * 100).toFixed(0)}%
                          </span>
                          <span className="text-[7px] font-bold text-white/20 uppercase tracking-tighter mt-1">
                            {score > 0 ? 'Affinity' : score < 0 ? 'Tension' : 'Neutral'}
                          </span>
                        </>
                      )}
                      {isSelf && <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                      
                      {/* Detailed Tooltip Overlay on Hover */}
                      <div className="absolute opacity-0 group-hover:opacity-100 pointer-events-none -top-2 left-1/2 -translate-x-1/2 -translate-y-full px-3 py-2 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl z-[60] transition-all duration-300 w-48 text-center backdrop-blur-xl">
                        <div className="flex items-center justify-center gap-2 mb-1.5">
                          <span className="text-[9px] font-black text-white uppercase">{c1.name}</span>
                          <span className="text-[7px] text-white/20">VS</span>
                          <span className="text-[9px] font-black text-white uppercase">{c2.name}</span>
                        </div>
                        <div className="h-px bg-white/5 mb-1.5" />
                        <p className="text-[8px] text-white/60 leading-relaxed font-medium italic">
                          Análisis basado en tratados bilaterales, historial de votación ONU y alianzas estratégicas vigentes.
                        </p>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-white/5 shrink-0 opacity-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white">Live Knowledge Base</span>
          </div>
          <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest px-2 py-0.5 border border-white/10 rounded">RT-STREAM</span>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.3em]">Deep Research Protocol v4.22</span>
        </div>
      </div>
    </div>
  );
}
