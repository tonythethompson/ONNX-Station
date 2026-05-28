import React, { useState } from 'react';
import { useWorkbench, SYSTEM_PRESETS } from '../WorkbenchContext';
import { Modality, TASKS } from '../types';
import { FolderOpen, Database, Target, ShieldAlert, Trash2, Bookmark } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

export function Sidebar() {
  const { 
    config, 
    updateConfig, 
    isExporting,
    isBenchmarking,
    savedPresets,
    activePresetName,
    savePreset,
    deletePreset,
    loadPreset,
    localFile,
    updateLocalFile
  } = useWorkbench();

  const [newPresetName, setNewPresetName] = useState('');

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPresetName.trim()) {
      savePreset(newPresetName.trim());
      setNewPresetName('');
    }
  };

  const isDisabled = isExporting || isBenchmarking;

  return (
    <div className="w-[320px] flex-shrink-0 border-r border-[#334155] bg-[#13161b] flex flex-col h-full relative z-40">
      <div className="p-4 flex flex-col gap-6 overflow-y-auto h-full">

      {/* Preset Optimization Profiles */}
      <section className="border-b border-[#334155]/60 pb-5 mb-1">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-sans">
            <Bookmark className="w-3.5 h-3.5 text-emerald-400" /> Optimization Profiles
          </span>
          <span className="text-[9px] text-[#cbd5e1]/50 font-mono font-normal lowercase select-none">profile</span>
        </h3>
        
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5 animate-fade-in">
             <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
                Active Profile <InfoTooltip position="bottom-left" text="Configures dynamic runtime execution targets. Standard presets match common compilation targets, while user profile configurations store complete local-first ONNX execution and dimension specifications." />
             </label>
             <div className="flex gap-1.5">
               <select
                 disabled={isDisabled}
                 value={activePresetName || ''}
                 onChange={(e) => {
                   if (e.target.value) {
                     loadPreset(e.target.value);
                   }
                 }}
                 className="flex-1 bg-[#0c0d10] border border-slate-700/80 rounded px-2.5 py-1.5 text-xs font-mono text-[#cbd5e1] focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:opacity-50"
               >
                 <option value="" disabled>-- Load Configuration --</option>
                 <optgroup label="System Benchmarks" className="bg-[#0c0d10] text-[#cbd5e1] font-mono select-none">
                   {Object.keys(SYSTEM_PRESETS).map((name) => (
                     <option key={name} value={name}>{name}</option>
                   ))}
                 </optgroup>
                 {Object.keys(savedPresets).length > 0 && (
                   <optgroup label="Custom Profiles" className="bg-[#0c0d10] text-emerald-400 font-mono select-none">
                     {Object.keys(savedPresets).map((name) => (
                       <option key={name} value={name} className="text-emerald-400 font-bold">{name}</option>
                     ))}
                   </optgroup>
                 )}
               </select>

               {activePresetName && !SYSTEM_PRESETS[activePresetName] && (
                 <button
                   onClick={() => deletePreset(activePresetName)}
                   className="px-2.5 py-1 border border-red-500/30 hover:border-red-500/80 bg-red-950/20 hover:bg-red-950/55 text-red-400 hover:text-red-300 rounded text-xs transition-all duration-150 flex items-center justify-center cursor-pointer shadow-sm"
                   title="Delete this custom preset"
                 >
                   <Trash2 className="w-3.5 h-3.5" />
                 </button>
               )}
             </div>
          </div>

          <form onSubmit={handleSavePreset} className="space-y-2 pt-1">
             <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  placeholder="New profile name... e.g. Whisper WebGPU"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="bg-[#0c0d10] border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-600"
                />
             </div>
             
             <button
               type="submit"
               disabled={!newPresetName.trim()}
               className="w-full text-center text-[10px] font-mono font-bold tracking-wider uppercase py-1.5 rounded transition-all duration-150 border border-emerald-500/30 enabled:hover:border-emerald-500/60 bg-emerald-500/10 enabled:hover:bg-emerald-500/25 text-emerald-400 enabled:hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md select-none"
             >
               Save Current Config as Preset
             </button>
          </form>
        </div>
      </section>

      <section>
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Model Source</h3>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
              Source Strategy <InfoTooltip position="bottom-left" text="Configures whether the model is downloaded dynamically from the Hugging Face Hub (requires network) or referenced from local workspace directories. Sets up the primary search pathway for configurations." />
            </label>
            <div className="flex gap-2">
              <button
                disabled={isDisabled}
                onClick={() => updateConfig({ modelSourceType: 'hub' })}
                className={`flex-1 text-[11px] font-mono py-1.5 rounded transition-colors ${
                  config.modelSourceType === 'hub' ? 'bg-slate-800 border border-emerald-500/30 text-white' : 'bg-transparent border border-slate-700 text-slate-400 opacity-50 hover:opacity-100'
                }`}
              >
                Hugging Face
              </button>
              <button
                disabled={isDisabled}
                onClick={() => updateConfig({ modelSourceType: 'local' })}
                className={`flex-1 text-[11px] font-mono py-1.5 rounded transition-colors ${
                  config.modelSourceType === 'local' ? 'bg-slate-800 border border-emerald-500/30 text-white' : 'bg-transparent border border-slate-700 text-slate-400 opacity-50 hover:opacity-100'
                }`}
              >
                Local Path
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
              <span className='flex items-center gap-1'>
                 {config.modelSourceType === 'hub' ? <Database className="w-3.5 h-3.5" /> : <FolderOpen className="w-3.5 h-3.5" />}
                 {config.modelSourceType === 'hub' ? 'Repository ID' : 'Directory Path'}
              </span>
              <InfoTooltip position="bottom-left" text="Represents the target model positional argument input. Use standard Hugging Face repository addresses (e.g., 'openai/whisper-large-v3') or absolute paths to on-disk directories containing Hugging Face checkpoints." />
            </label>
            <input
              type="text"
              disabled={isDisabled}
              value={config.modelPath}
              onChange={(e) => updateConfig({ modelPath: e.target.value })}
              placeholder={config.modelSourceType === 'hub' ? 'e.g., openai/whisper-base' : '/path/to/weights'}
              className="bg-[#0c0d10] border border-slate-700 rounded p-2 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-600 disabled:opacity-50"
            />
          </div>

          {config.modelSourceType === 'local' && (
             <div className="mt-1 animate-fade-in">
               <label className="text-[10px] font-mono text-slate-400 uppercase mb-1 flex items-center justify-between">
                 <span>Ingest Local Model (.onnx)</span>
                 <span className="text-emerald-400 font-bold">Local-First</span>
               </label>
               {localFile ? (
                 <div className="bg-[#0f1115] border border-emerald-500/40 rounded p-2.5 flex items-center justify-between shadow-sm">
                   <div className="overflow-hidden mr-2">
                     <div className="text-xs font-mono text-emerald-400 font-bold truncate" title={localFile.name}>
                       {localFile.name}
                     </div>
                     <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                       {(localFile.size / (1024 * 1024)).toFixed(2)} MB
                     </div>
                   </div>
                   <button
                     type="button"
                     onClick={() => updateLocalFile(null)}
                     className="text-slate-500 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors"
                     title="Remove ingested model"
                   >
                     <Trash2 className="w-3.5 h-3.5" />
                   </button>
                 </div>
               ) : (
                 <div
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={(e) => {
                     e.preventDefault();
                     if (isDisabled) return;
                     const file = e.dataTransfer.files?.[0];
                     if (file && (file.name.endsWith('.onnx') || file.name.endsWith('.bin') || file.name.endsWith('.pb') || file.name.endsWith('.onnx.xml'))) {
                       updateLocalFile(file);
                     }
                   }}
                   className={`border border-dashed border-slate-700 rounded p-4 text-center transition-all duration-150 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-emerald-500/50 cursor-pointer bg-[#08090b]/40 hover:bg-[#0c0d10]'}`}
                   onClick={() => {
                     if (isDisabled) return;
                     const input = document.createElement('input');
                     input.type = 'file';
                     input.accept = '.onnx,.bin,.pb';
                     input.onchange = (e: any) => {
                       const file = e.target.files?.[0];
                       if (file) updateLocalFile(file);
                     };
                     input.click();
                   }}
                 >
                   <FolderOpen className="w-5 h-5 mx-auto text-slate-600 mb-1.5" />
                   <div className="text-[10px] font-mono text-slate-400">
                     Drag & drop ONNX model
                   </div>
                   <div className="text-[9px] font-mono text-slate-600 mt-0.5">
                     Click to choose binary
                   </div>
                 </div>
               )}
             </div>
          )}

          <div className="flex items-start gap-2 pt-2 border-t border-[#334155]/50">
            <input
              type="checkbox"
              id="trust_remote_code"
              disabled={isDisabled}
              checked={config.trust_remote_code}
              onChange={(e) => updateConfig({ trust_remote_code: e.target.checked })}
              className="mt-0.5 bg-[#0c0d10] border-slate-700 rounded text-emerald-600 focus:ring-emerald-600"
            />
            <label htmlFor="trust_remote_code" className="text-[11px] font-mono text-slate-400 cursor-pointer w-full">
              <span className="font-bold flex items-center gap-1 mb-0.5 text-[#cbd5e1]">
                <ShieldAlert className="w-3 h-3" /> Trust Remote Code
              </span>
              Allow custom architectures.
            </label>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Task Definition</h3>
        
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
             <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
                Modality <InfoTooltip position="bottom-left" text="Controls input and pre-processing specifications. Directs Optimum to load the correct pipeline classes (e.g. text processors, audio processors, or visual processors) to format standard test inputs." />
             </label>
             <div className="grid grid-cols-3 gap-2">
               {(['audio', 'text', 'vision'] as Modality[]).map((m) => (
                 <button
                   key={m}
                   disabled={isDisabled}
                   onClick={() => updateConfig({ modality: m })}
                   className={`text-[11px] font-mono py-1.5 rounded border capitalize transition-colors ${
                     config.modality === m ? 'bg-slate-800 border-emerald-500/30 text-white' : 'bg-transparent border-slate-700 text-slate-400 opacity-50 hover:opacity-100'
                   }`}
                 >
                   {m}
                 </button>
               ))}
             </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
               ONNX Task Map <InfoTooltip position="bottom-left" text="Tied directly to the `--task` flag. Guides the configuration mapping class (e.g. OnnxSeq2SeqConfigWithPast vs OnnxConfig) to specify exact model structural inputs/outputs for the selected model graph." />
            </label>
            <select
              disabled={isDisabled}
              value={config.task}
              onChange={(e) => updateConfig({ task: e.target.value })}
              className="bg-[#0c0d10] border border-slate-700 rounded p-2 text-xs font-mono text-[#cbd5e1] focus:outline-none focus:border-emerald-600 disabled:opacity-50"
            >
              {TASKS[config.modality].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
         <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Model Ingestion Parameters</h3>
         
         <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
               <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
                  Source Framework <InfoTooltip position="top-left" text="Tied to the `--framework` argument. Explicitly forces a weight loader engine framework (PyTorch `pt` or TensorFlow `tf`) to initialize weights on python run before exporting to ONNX format." />
               </label>
               <div className="flex gap-2">
                  <button
                     disabled={isDisabled}
                     onClick={() => updateConfig({ framework: 'pt' })}
                     className={`flex-1 text-[11px] font-mono py-1.5 rounded border transition-colors ${
                     config.framework === 'pt' ? 'bg-slate-800 border-emerald-500/30 text-white' : 'bg-transparent border-slate-700 text-slate-400 opacity-50 hover:opacity-100'
                     }`}
                  >
                     PyTorch
                  </button>
                  <button
                     disabled={isDisabled}
                     onClick={() => updateConfig({ framework: 'tf' })}
                     className={`flex-1 text-[11px] font-mono py-1.5 rounded border transition-colors ${
                     config.framework === 'tf' ? 'bg-slate-800 border-emerald-500/30 text-white' : 'bg-transparent border-slate-700 text-slate-400 opacity-50 hover:opacity-100'
                     }`}
                  >
                     TensorFlow
                  </button>
               </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-[#334155]/50">
               <input
                  type="checkbox"
                  id="safetensors"
                  disabled={isDisabled}
                  checked={config.use_safetensors}
                  onChange={(e) => updateConfig({ use_safetensors: e.target.checked })}
                  className="bg-[#0c0d10] border-slate-700 rounded text-emerald-600 focus:ring-emerald-600"
               />
               <label htmlFor="safetensors" className="text-[11px] font-mono text-slate-400 cursor-pointer w-full font-bold text-[#cbd5e1] flex items-center justify-between">
                 Prefer Safetensors <InfoTooltip position="top-left" text="Restricts weights discovery logic to load secure memory-mapped `.safetensors` files, eliminating arbitrary pickled code execution vector hazards." />
               </label>
            </div>
            
            <div className="flex flex-col gap-1.5 pt-2 border-t border-[#334155]/50">
               <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
                  Cache Directory <InfoTooltip position="top-left" text="Corresponds to `--cache_dir`. Specifying an absolute folder isolated local-path avoids downloading duplicate Hugging Face weights across multiple workspace export sessions." />
               </label>
               <input
                  type="text"
                  disabled={isDisabled}
                  value={config.cache_dir}
                  onChange={(e) => updateConfig({ cache_dir: e.target.value })}
                  placeholder="~/.cache/huggingface"
                  className="bg-[#0c0d10] border border-slate-700 rounded p-2 text-xs font-mono text-[#cbd5e1] focus:outline-none focus:border-emerald-600 disabled:opacity-50"
               />
            </div>
         </div>
      </section>

      </div>
    </div>
  );
}
