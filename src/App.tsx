/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { WorkbenchProvider } from './WorkbenchContext';
import { Sidebar } from './components/Sidebar';
import { CenterCanvas } from './components/CenterCanvas';
import { Console } from './components/Console';

export default function App() {
  return (
    <WorkbenchProvider>
      <div className="flex flex-col h-screen w-screen bg-[#0c0d10] text-[#cbd5e1] font-sans overflow-hidden border-[6px] border-[#1e293b] antialiased selection:bg-[#334155] selection:text-white">
        {/* Main Work Area */}
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <CenterCanvas />
        </div>
        {/* Bottom Console Panel */}
        <Console />
      </div>
    </WorkbenchProvider>
  );
}
