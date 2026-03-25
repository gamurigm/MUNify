'use client';

import dynamic from 'next/dynamic';
import React, { Suspense } from 'react';

// Require react-force-graph dynamically to avoid SSR "window is not defined" issues
const RelationsGraphInternal = dynamic(() => import('./RelationsGraphInternal'), { 
    ssr: false, 
    loading: () => (
        <div className="flex items-center justify-center w-full h-[600px] bg-[#0a0a0f]">
            <div className="text-xl font-bold text-[#00e5ff] animate-pulse">Cargando Red de Relaciones Internacionales...</div>
        </div>
    ) 
});

interface GraphData {
    nodes: any[];
    links: any[];
}

interface RelationsGraphProps {
  data: GraphData;
}

const RelationsGraph: React.FC<RelationsGraphProps> = ({ data }) => {
  return (
    <Suspense fallback={<div className="text-white">Cargando 3D Engine...</div>}>
      <RelationsGraphInternal data={data} />
    </Suspense>
  );
};

export default RelationsGraph;
