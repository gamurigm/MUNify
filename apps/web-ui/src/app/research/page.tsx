'use client';

import React, { useState } from 'react';

interface Source {
  url: string;
  title: string;
  snippet: string;
  domain: string;
  source_name: string;
  emoji: string;
  category: string;
}

interface RoundResult {
  round: number;
  query_count: number;
  source_count: number;
  sources: Source[];
}

const CATEGORY_COLORS: Record<string, string> = {
  legal: '#00e5ff',
  ong: '#ff9800',
  periodismo: '#8bc34a',
  think_tank: '#7c4dff',
  academico: '#e91e63',
  datos: '#ffd600',
  web: '#78909c',
};

const CATEGORY_LABELS: Record<string, string> = {
  legal: 'Derecho Internacional',
  ong: 'ONG',
  periodismo: 'Periodismo',
  think_tank: 'Think Tank',
  academico: 'Académico',
  datos: 'Datos Abiertos',
  web: 'Web',
};

export default function ResearchPage() {
  const [topic, setTopic] = useState('Derechos Humanos en el Ártico');
  const [country, setCountry] = useState('Norway');
  const [context, setContext] = useState('');
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);

  const runRound = async (roundNum: number) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/deep-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, country, round: roundNum, context }),
      });
      if (res.ok) {
        const data: RoundResult = await res.json();
        setRounds(prev => [...prev, data]);
        setCurrentRound(roundNum);
      }
    } catch (err) {
      console.error('Error en deep research:', err);
    }
    setLoading(false);
  };

  const startResearch = async () => {
    setRounds([]);
    setCurrentRound(0);
    // Run 3 rounds sequentially
    for (let i = 1; i <= 3; i++) {
      await runRound(i);
    }
  };

  const allSources = rounds.flatMap(r => r.sources);
  const totalSources = allSources.length;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a12 0%, #0d1117 50%, #0a0a12 100%)',
      color: '#e0e0e0',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: 0,
      margin: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 40px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 900,
            margin: 0,
            background: 'linear-gradient(90deg, #00e5ff, #7c4dff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px',
          }}>
            MUNify Deep Research
          </h1>
          <p style={{ fontSize: 11, color: '#666', fontFamily: 'monospace', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            Motor de Investigación Profunda con Fuentes Verificadas
          </p>
        </div>
        {totalSources > 0 && (
          <div style={{
            background: 'rgba(0,229,255,0.08)',
            border: '1px solid rgba(0,229,255,0.2)',
            borderRadius: 8,
            padding: '8px 16px',
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#00e5ff',
          }}>
            {totalSources} fuentes recolectadas • {currentRound} rondas
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div style={{ padding: '32px 40px 16px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          gap: 12,
          marginBottom: 12,
        }}>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Tema de investigación..."
            style={{
              flex: 2,
              padding: '14px 20px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 15,
              outline: 'none',
              fontFamily: 'inherit',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'rgba(0,229,255,0.4)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="País..."
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 15,
              outline: 'none',
            }}
          />
        </div>

        {/* Custom Context Textarea */}
        <div style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="[Opcional] Reglas o contexto histórico (Ej: Límite de fecha 1989, Guerra Fría, ignorar eventos posteriores)"
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'monospace',
              minHeight: '80px',
              resize: 'vertical',
            }}
            onFocus={(e) => e.target.style.borderColor = 'rgba(124,77,255,0.4)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
          <button
            onClick={startResearch}
            disabled={loading}
            style={{
              padding: '0 28px',
              borderRadius: 12,
              border: 'none',
              background: loading
                ? 'rgba(124,77,255,0.3)'
                : 'linear-gradient(135deg, #00e5ff, #7c4dff)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? '⟳ Investigando...' : '🔍 Investigar'}
          </button>
        </div>

        {/* Progress Indicator */}
        {loading && (
          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '12px 20px',
            background: 'rgba(0,229,255,0.05)',
            border: '1px solid rgba(0,229,255,0.15)',
            borderRadius: 10,
            marginBottom: 20,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#00e5ff',
              animation: 'pulse 1.5s infinite',
            }} />
            <span style={{ fontSize: 13, color: '#00e5ff', fontFamily: 'monospace' }}>
              Buscando en fuentes confiables (Ronda {currentRound + 1}/3)...
            </span>
          </div>
        )}

        {/* Category Legend */}
        {totalSources > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => {
              const count = allSources.filter(s => s.category === cat).length;
              if (count === 0) return null;
              return (
                <div key={cat} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: `${color}10`,
                  border: `1px solid ${color}30`,
                  fontSize: 11,
                  color: color,
                  fontFamily: 'monospace',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                  {CATEGORY_LABELS[cat]} ({count})
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Results by Round */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 40px 60px' }}>
        {rounds.map((round, ri) => (
          <div key={ri} style={{ marginBottom: 32 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 16,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, #00e5ff, #7c4dff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800, color: '#000',
              }}>
                {round.round}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Ronda {round.round} — {round.source_count} fuentes encontradas
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {round.sources.map((source, si) => {
                const catColor = CATEGORY_COLORS[source.category] || '#78909c';
                return (
                  <a
                    key={si}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      textDecoration: 'none',
                      display: 'block',
                      padding: '16px 20px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                      (e.currentTarget as HTMLElement).style.borderColor = `${catColor}40`;
                      (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                    }}
                  >
                    {/* Source Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{source.emoji}</span>
                      <span style={{
                        fontSize: 12,
                        color: catColor,
                        fontWeight: 600,
                        fontFamily: 'monospace',
                      }}>
                        {source.source_name}
                      </span>
                      <span style={{
                        fontSize: 10,
                        color: '#555',
                        fontFamily: 'monospace',
                      }}>
                        {source.domain}
                      </span>
                      <span style={{
                        marginLeft: 'auto',
                        fontSize: 9,
                        color: catColor,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: `${catColor}15`,
                        border: `1px solid ${catColor}25`,
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                      }}>
                        {CATEGORY_LABELS[source.category] || source.category}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#e8e8e8',
                      margin: '0 0 6px 0',
                      lineHeight: 1.3,
                    }}>
                      {source.title}
                    </h3>

                    {/* Snippet */}
                    <p style={{
                      fontSize: 13,
                      color: '#888',
                      margin: 0,
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {source.snippet}
                    </p>
                  </a>
                );
              })}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {rounds.length === 0 && !loading && (
          <div style={{
            textAlign: 'center',
            padding: '80px 0',
            color: '#444',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#555' }}>
              Ingresa un tema y un país para iniciar la investigación profunda
            </p>
            <p style={{ fontSize: 12, color: '#444', fontFamily: 'monospace', marginTop: 8 }}>
              El sistema buscará en ONU, Amnistía Internacional, Reuters, SIPRI, y más
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
