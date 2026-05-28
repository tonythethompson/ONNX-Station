import { Info } from 'lucide-react';
import React, { useState, useRef } from 'react';

interface InfoTooltipProps {
  text: string;
  position?: 'right' | 'left' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center' | 'top-left' | 'top-right';
}

export const InfoTooltip = ({ text, position = 'bottom-left' }: InfoTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 400); // 400ms hover delay
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  let posClass = 'left-full ml-2 top-0'; // default
  if (position === 'bottom-left') {
    posClass = 'right-0 top-full mt-2';
  } else if (position === 'left') {
    posClass = 'right-full mr-2 top-0';
  } else if (position === 'bottom-center') {
    posClass = 'left-1/2 -translate-x-1/2 top-full mt-2';
  } else if (position === 'top-center') {
    posClass = 'left-1/2 -translate-x-1/2 bottom-full mb-2';
  } else if (position === 'bottom-right') {
    posClass = 'left-0 top-full mt-2';
  } else if (position === 'top-left') {
    posClass = 'right-0 bottom-full mb-2';
  } else if (position === 'top-right') {
    posClass = 'left-0 bottom-full mb-2';
  }

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Info className={`w-3.5 h-3.5 ${isVisible ? 'text-emerald-500' : 'text-slate-500'} cursor-help transition-all duration-150`} />
      {isVisible && (
        <div 
          className={`absolute ${posClass} w-64 bg-[#1a1d23]/95 backdrop-blur-sm text-slate-300 p-3 rounded-md shadow-2xl border border-slate-700/80 z-[9999] pointer-events-none animate-fade-in`}
        >
          <div className="font-sans text-[11px] leading-relaxed normal-case tracking-normal font-normal text-left select-none">
            <div className="text-[9px] font-mono font-bold text-emerald-500 border-b border-slate-700/50 pb-1 mb-1.5 tracking-wider uppercase">
              Cli Flag Reference
            </div>
            {text}
          </div>
        </div>
      )}
    </div>
  );
};
