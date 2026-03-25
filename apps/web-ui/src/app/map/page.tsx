'use client';

import React, { useEffect, useState } from 'react';
import RelationsGraph from '../../components/RelationsGraph';

// Mock data to ensure it works even if backend is not yet restarted
const FALLBACK_DATA = {
  nodes: [
    { id: "NOR", name: "Noruega 🇳🇴", group: 1, val: 35 },
    { id: "USA", name: "Estados Unidos 🇺🇸", group: 2, val: 40 },
    { id: "GBR", name: "Reino Unido 🇬🇧", group: 2, val: 30 },
    { id: "RUS", name: "Rusia 🇷🇺", group: 3, val: 38 },
    { id: "CHN", name: "China 🇨🇳", group: 3, val: 35 },
    { id: "FRA", name: "Francia 🇫🇷", group: 4, val: 28 },
    { id: "DEU", name: "Alemania 🇩🇪", group: 4, val: 30 },
    { id: "SWE", name: "Suecia 🇸🇪", group: 1, val: 25 },
    { id: "FIN", name: "Finlandia 🇫🇮", group: 1, val: 22 },
  ],
  links: [
    { source: "NOR", target: "SWE", type: "Alliance", color: "#00e5ff" },
    { source: "NOR", target: "USA", type: "Treaty", color: "#0088ff" },
    { source: "USA", target: "RUS", type: "Tension", color: "#ff0000" },
    { source: "RUS", target: "CHN", type: "Alliance", color: "#ff4081" },
    { source: "FRA", target: "DEU", type: "Alliance", color: "#d500f9" },
    { source: "NOR", target: "GBR", type: "Treaty", color: "#0088ff" },
    { source: "SWE", target: "FIN", type: "Alliance", color: "#00e5ff" },
  ]
};

export default function NodeMapPage() {
  const [data, setData] = useState(FALLBACK_DATA);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/relations?country=NOR');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.warn("Backend not available, using fallback data.");
      }
    };
    fetchData();
  }, []);

  return (
    <div className="flex flex-col w-screen h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Header Area */}
      <div className="flex items-center justify-between px-8 py-4 bg-black/40 border-b border-white/5 backdrop-blur-md z-10">
        <div>
          <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600 tracking-tighter">
            MUNify IntelMap <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400/50 ml-2">v2.0 Neural</span>
          </h1>
          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-[0.2em] mt-1 italic">
            Visualizador de Redes de Inteligencia Geopolítica
          </p>
        </div>
        <div className="flex gap-4">
          <div className="px-3 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-400 font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span> SYSTEM ACTIVE
          </div>
        </div>
      </div>

      <div className="flex flex-1 relative">
        {/* Left Control Panel */}
        <div className="absolute top-8 left-8 w-64 p-6 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl z-20 shadow-2xl overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <span className="w-1 h-4 bg-cyan-500 rounded-full"></span> Leyenda Táctica
          </h3>
          
          <div className="space-y-5 relative">
            <div className="flex items-center gap-4 group/item">
              <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
              <span className="text-xs text-gray-300 group-hover/item:text-cyan-400 transition-colors">Alianza Estratégica</span>
            </div>
            <div className="flex items-center gap-4 group/item">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
              <span className="text-xs text-gray-300 group-hover/item:text-blue-400 transition-colors">Tratados Bilaterales</span>
            </div>
            <div className="flex items-center gap-4 group/item">
              <div className="w-3 h-3 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)] animate-pulse"></div>
              <span className="text-xs text-gray-300 group-hover/item:text-red-400 transition-colors">Tensión Diplomática</span>
            </div>
            <div className="mt-8 p-4 bg-white/5 rounded-lg border border-white/5">
              <p className="text-[9px] leading-relaxed text-gray-500 font-mono">
                [DATA SOURCE]: <span className="text-gray-300">FastAPI Agent Framework</span><br/>
                [ENGINE]: <span className="text-gray-300">Three.js WebGL</span><br/>
                [STATUS]: <span className="text-green-500 font-bold uppercase">Ready</span>
              </p>
            </div>
          </div>
        </div>

        {/* The Graph Canvas Area - This is where the react-force-graph lives */}
        <div className="flex-1 relative">
          <RelationsGraph data={data} />
        </div>
      </div>
    </div>
  );
}

