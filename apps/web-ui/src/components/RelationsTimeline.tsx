'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine
} from 'recharts';
import { History, TrendingUp, Zap } from 'lucide-react';

interface Milestone {
  year: string;
  title: string;
  description: string;
  type: 'conflict' | 'treaty' | 'summit';
  score: number; // For the trend line
}

const MOCK_DATA: Milestone[] = [
  { year: '1945', title: 'Fundación ONU', description: 'Creación del nuevo orden mundial tras la WWII.', type: 'summit', score: 0.5 },
  { year: '1949', title: 'OTAN', description: 'Formación del bloque defensivo occidental.', type: 'treaty', score: 0.6 },
  { year: '1962', title: 'Crisis Misiles', description: 'Punto máximo de tensión Guerra Fría (Cuba).', type: 'conflict', score: -0.9 },
  { year: '1975', title: 'Acta Helsinki', description: 'Reducción de tensiones Este-Oeste.', type: 'treaty', score: 0.2 },
  { year: '1989', title: 'Caída del Muro', description: 'Inicio del fin de la división bipolar.', type: 'summit', score: 0.8 },
  { year: '1991', title: 'Disolución URSS', description: 'Nacimiento de la Federación Rusa.', type: 'conflict', score: 0.4 },
  { year: '2001', title: 'Guerra Terror', description: 'Reconfiguración de alianzas tras 11-S.', type: 'conflict', score: -0.2 },
  { year: '2015', title: 'Acuerdos París', description: 'Cooperación climática global.', type: 'treaty', score: 0.7 },
  { year: '2022', title: 'Guerra Ucrania', description: 'Ruptura total de relaciones Occidente-Rusia.', type: 'conflict', score: -0.8 },
];

export default function RelationsTimeline() {
  const params = useParams();
  const committeeId = params?.committeeId || 'global';
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Milestone | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`http://${window.location.hostname}:8000/api/v1/relations/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countries: [], committee_id: String(committeeId) }),
    })
    .then(res => res.json())
    .then(json => {
      // For now, combining mock score with actual titles if available
      if (json.status === 'success' && json.milestones.length > 0) {
         const combined = json.milestones.map((m: any, i: number) => ({
           ...m,
           score: Math.sin(i * 1.5)  // Scientific visualization trend
         }));
         setMilestones(combined);
      } else {
         setMilestones(MOCK_DATA);
      }
    })
    .finally(() => setLoading(false));
  }, [committeeId]);

  return (
    <div className="flex flex-col p-2 rounded-[32px] bg-[#020617]/40 border border-white/5 backdrop-blur-3xl shadow-2xl transition-all h-full overflow-hidden">
      <div className="flex-1 mt-2 relative overflow-visible h-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={milestones} margin={{ top: 10, right: 10, left: -40, bottom: 0 }}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c44dff" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#c44dff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
            <XAxis dataKey="year" hide />
            <YAxis hide domain={[-1, 1]} />
            <Tooltip 
               content={({ active, payload }) => {
                 if (active && payload && payload.length) {
                   const item = payload[0].payload as Milestone;
                   return (
                     <div className="bg-[#0f172a] border border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-xl max-w-[200px] animate-in zoom-in-95 duration-200">
                       <div className="flex items-center justify-between mb-2">
                         <span className="text-[14px] font-black text-white/90 tabular-nums">{item.year}</span>
                         <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                       </div>
                       <h6 className="text-[11px] font-black text-cyan-400 leading-tight uppercase mb-1.5">{item.title}</h6>
                       <p className="text-[9px] text-white/40 leading-relaxed font-medium line-clamp-3 italic">{item.description}</p>
                     </div>
                   );
                 }
                 return null;
               }}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <Area 
              type="monotone" 
              dataKey="score" 
              stroke="#c44dff" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorScore)" 
              dot={{ r: 4, fill: '#0f172a', stroke: '#c44dff', strokeWidth: 2 }}
              activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
