'use client';

import React from 'react';
import TerminalAgentUI from '@/components/TerminalAgentUI';

export default function TerminalPopoutPage() {
  return (
    <div className="h-screen w-screen bg-[#020617] overflow-hidden">
      <TerminalAgentUI isPopout={true} />
    </div>
  );
}
