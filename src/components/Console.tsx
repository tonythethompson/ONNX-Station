import React, { useEffect, useRef, useState } from 'react';
import { useWorkbench } from '../WorkbenchContext';

export function Console() {
  const { logs } = useWorkbench();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [memoryUsage, setMemoryUsage] = useState<number>(0);
  const [peakMemory, setPeakMemory] = useState<number>(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [logs]);

  useEffect(() => {
    const interval = setInterval(() => {
      if ((performance as any).memory) {
        const used = (performance as any).memory.usedJSHeapSize;
        setMemoryUsage(used);
        setPeakMemory(prev => Math.max(prev, used));
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;
  const successCount = logs.filter(l => l.level === 'success').length;

  return (
    <footer className="h-56 border-t border-[#334155] bg-[#0c0d10] flex flex-col flex-shrink-0">
      <div className="h-7 bg-[#1a1d23] border-b border-[#334155] px-4 flex items-center justify-between">
         <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Terminal / Orchestration Log</span>
         <div className="flex gap-4 text-[10px] font-mono">
            {memoryUsage > 0 && (
              <span className="text-slate-500">
                MEM: {(memoryUsage / 1024 / 1024).toFixed(1)} MB <span className="text-slate-600 opacity-70 ml-1">/ PEAK: {(peakMemory / 1024 / 1024).toFixed(1)} MB</span>
              </span>
            )}
            <span className="text-emerald-500">SUCCESS: {successCount}</span>
            <span className="text-amber-500">WARNINGS: {warnCount}</span>
            <span className="text-red-500">ERRORS: {errorCount}</span>
         </div>
      </div>
      <div className="flex-1 p-3 font-mono text-[11px] overflow-y-auto leading-relaxed text-slate-400 bg-[#08090b]">
        {logs.map((log) => {
           let textColor = 'text-slate-400';
           let iconIndicator = '[INFO]';

           if (log.level === 'warn') {
              textColor = 'text-amber-400';
              iconIndicator = '[WARN]';
           } else if (log.level === 'error') {
              textColor = 'text-red-500';
              iconIndicator = '[ERR!]';
           } else if (log.level === 'success') {
              textColor = 'text-emerald-500';
              iconIndicator = '[ OK ]';
           }

           const isCommand = log.message.startsWith('optimum-cli') || log.message.startsWith('$');
           if(isCommand) {
              textColor = 'text-emerald-400 font-bold mt-2';
              iconIndicator = '$';
           }

           return (
              <div key={log.id} className="flex items-start gap-2 py-0.5 group hover:bg-[#0c0d10] px-1 rounded-sm">
                <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                {!isCommand && <span className={`font-bold ${textColor} w-10 shrink-0`}>{iconIndicator}</span>}
                {isCommand && <span className={`font-bold ${textColor} w-10 shrink-0`}>{iconIndicator}</span>}
                <span className={`${textColor} break-words break-all`}>
                  {log.message}
                </span>
              </div>
           );
        })}
        <div ref={bottomRef} className="h-1 text-transparent">EOF</div>
      </div>
    </footer>
  );
}
