import React, { useState } from 'react';
import { useWorkbench } from '../WorkbenchContext';
import { Download, Activity, Copy, Check } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import { OnnxGraphVisualizer } from './OnnxGraphVisualizer';

export function CenterCanvas() {
  const { config, updateConfig, isExporting, isBenchmarking, isCompiled, benchmarkResult, startExport, startBenchmark, cancelExport, cancelBenchmark, downloadConfig, getCommandPreview } = useWorkbench();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(getCommandPreview());
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <div className="flex-1 bg-[#0c0d10] overflow-y-auto flex flex-col relative w-full">
      {/* Top Header */}
      <header className="h-12 border-b border-[#334155] bg-[#1a1d23] flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-10 w-full shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 ${isBenchmarking ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'} rounded-full`}></div>
          <span className="font-mono font-bold text-sm tracking-tight text-white">OPTIMUM.WORKBENCH</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] border border-slate-700 text-slate-400">
            {isExporting ? 'STATUS: EXPORTING...' : isBenchmarking ? 'STATUS: BENCHMARKING...' : 'STATUS: READY'}
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <button
            onClick={downloadConfig}
            className="text-slate-400 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            CONFIG.JSON
          </button>
          <button
            onClick={startBenchmark}
            disabled={isExporting || isBenchmarking || !isCompiled || !config.modelPath}
            className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Activity className="w-3.5 h-3.5" />
            {isBenchmarking ? 'RUNNING...' : 'BENCHMARK ORT'}
          </button>
          {isBenchmarking && (
            <button onClick={cancelBenchmark} className="bg-red-900/50 hover:bg-red-800 text-red-200 px-3 py-1 rounded-sm font-bold transition-all border border-red-800">
               CANCEL
            </button>
          )}

          <button
            onClick={startExport}
            disabled={isExporting || isBenchmarking || !config.modelPath}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isExporting ? 'COMPILING...' : 'COMPILE TO ONNX'}
          </button>
          {isExporting && (
             <button onClick={cancelExport} className="bg-red-900/50 hover:bg-red-800 text-red-200 px-3 py-1 rounded-sm font-bold transition-all border border-red-800">
                CANCEL
             </button>
          )}
        </div>
      </header>

      <div className="p-4 md:p-6 lg:p-8 space-y-6 flex-1 w-full mx-auto max-w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: CLI and Export Settings (col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            {/* CLI Command Preview */}
            <section>
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">Generated Request String</h3>
              <div className="relative group/cmd bg-[#08090b] border border-[#334155] rounded shadow-inner">
                <div className="p-3.5 pr-24 font-mono text-[11px] text-emerald-400 leading-relaxed overflow-x-auto whitespace-pre">
                  {getCommandPreview()}
                </div>
                <button
                  onClick={handleCopy}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#13161b] hover:bg-[#1a1d23] text-slate-400 hover:text-emerald-400 border border-slate-700/80 hover:border-emerald-500/50 transition-all duration-150 cursor-pointer shadow-lg select-none"
                  title="Copy to Clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span className="text-[9px] font-mono font-bold tracking-wider text-emerald-400">COPIED</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-mono font-bold tracking-wider">COPY</span>
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* ONNX Operators and VRAM Map Visualizer Section */}
            <OnnxGraphVisualizer />

            {/* Core Export Settings Group */}
            <section className="space-y-6">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Export Specifications</h3>

              {/* Precise and Target Device Card */}
              <div className="flex flex-col border border-[#334155] bg-[#08090b] rounded overflow-hidden">
                <div className="h-8 border-b border-[#334155] bg-[#1a1d23] px-3 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Hardware Target & Execution Parameters</span>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
                         Target Opset <InfoTooltip position="bottom-left" text="Configures the `--opset` parameter. Sets the ONNX operator specification version. Higher opsets (e.g., 17) enable compiled conversions of modern layer neural components without proprietary engine fallbacks." />
                      </label>
                      <select
                         disabled={isExporting || isBenchmarking}
                         value={config.opset}
                         onChange={(e) => updateConfig({ opset: parseInt(e.target.value) })}
                         className="bg-[#0c0d10] border border-slate-700 rounded p-2 text-xs font-mono text-[#cbd5e1] focus:outline-none focus:border-emerald-600 disabled:opacity-50"
                       >
                         <option value={14}>14</option>
                         <option value={15}>15</option>
                         <option value={17}>17 (Recommended)</option>
                       </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
                          Graph Optimization Level <InfoTooltip position="bottom-left" text="Controls the `--optimize` compilation parameter. Directs the compiler to apply successive graph transformations, fusing sequential operations (like MultiHeadAttention or LayerNorm) into unified WebGPU/CUDA kernels." />
                      </label>
                      <select
                          disabled={isExporting || isBenchmarking}
                          value={config.optimize}
                          onChange={(e) => updateConfig({ optimize: e.target.value as any })}
                          className="bg-[#0c0d10] border border-slate-700 rounded p-2 text-xs font-mono text-[#cbd5e1] focus:outline-none focus:border-emerald-600 disabled:opacity-50"
                       >
                          <option value="none">None</option>
                          <option value="O1">O1 (Basic)</option>
                          <option value="O2">O2 (Extended)</option>
                          <option value="O3">O3 (Aggressive)</option>
                          <option value="O4">O4 (ORTQuantizer)</option>
                       </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="flex flex-col gap-1.5">
                         <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
                            Execution Provider <InfoTooltip position="bottom-left" text="Maps to `--device`. Configures the target runtime platform. CPU uses portable, multi-threaded CPU instructions, while CUDA compiles kernels optimized for discrete GPU accelerators." />
                         </label>
                         <select
                            disabled={isExporting || isBenchmarking}
                            value={config.device}
                            onChange={(e) => updateConfig({ device: e.target.value as any })}
                            className="bg-[#0c0d10] border border-slate-700 rounded p-2 text-xs font-mono text-[#cbd5e1] focus:outline-none focus:border-emerald-600 disabled:opacity-50"
                          >
                            <option value="cpu">CPU</option>
                            <option value="cuda">CUDA</option>
                          </select>
                     </div>
                     <div className="flex flex-col gap-1.5">
                         <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center justify-between">
                            Precision Override <InfoTooltip position="bottom-left" text="Specifies `--dtype`. Allows casting full-precision parameters (fp32) to compressed formats like half-precision float16 or bfloat16, optimizing tensor memory bandwidth on modern GPUs." />
                         </label>
                         <select
                            disabled={isExporting || isBenchmarking}
                            value={config.dtype}
                            onChange={(e) => updateConfig({ dtype: e.target.value as any })}
                            className="bg-[#0c0d10] border border-slate-700 rounded p-2 text-xs font-mono text-[#cbd5e1] focus:outline-none focus:border-emerald-600 disabled:opacity-50"
                          >
                            <option value="fp32">fp32 (Default)</option>
                            <option value="fp16">fp16 (Half)</option>
                            <option value="bf16">bf16 (BFloat16)</option>
                          </select>
                     </div>
                  </div>
                </div>
              </div>

              {/* Structural Parameters Card */}
              <div className="flex flex-col border border-[#334155] bg-[#08090b] rounded overflow-hidden">
                <div className="h-8 border-b border-[#334155] bg-[#1a1d23] px-3 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Optimum Compilation Directives</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className={`p-3 border rounded transition-colors ${config.monolith ? 'bg-slate-800/60 border-emerald-500/50' : 'bg-[#1a1d23]/40 border-slate-700/60'}`}>
                     <label className="flex items-start gap-3 cursor-pointer">
                        <input
                           type="checkbox"
                           checked={config.monolith}
                           disabled={isExporting || isBenchmarking}
                           onChange={(e) => updateConfig({ monolith: e.target.checked })}
                           className="mt-0.5 bg-[#0c0d10] border-slate-700 text-emerald-500 focus:ring-emerald-500 rounded"
                        />
                        <div className="text-[11px] font-mono">
                           <span className={`font-bold block mb-1 ${config.monolith ? 'text-emerald-400' : 'text-[#cbd5e1]'}`}>Force Monolithic Weights (-M) <InfoTooltip position="top-center" text="Tied to `--monolith`. Prevents Optimum from dividing large transformer layers or configurations into multi-file shards. Essential for single-node deployments up to the 2GB ONNX protobuf limitation." /></span>
                           <span className="text-slate-500 leading-tight block">Prevent chunking or encoder/decoder splitting (may exceed 2GB proto limit).</span>
                        </div>
                     </label>
                  </div>

                  <div className={`p-3 border rounded transition-colors ${config.force_split ? 'bg-slate-800/60 border-emerald-500/50' : 'bg-[#1a1d23]/40 border-slate-700/60'}`}>
                     <label className="flex items-start gap-3 cursor-pointer">
                        <input
                           type="checkbox"
                           checked={config.force_split}
                           disabled={isExporting || isBenchmarking}
                           onChange={(e) => updateConfig({ force_split: e.target.checked })}
                           className="mt-0.5 bg-[#0c0d10] border-slate-700 text-emerald-500 focus:ring-emerald-500 rounded"
                        />
                        <div className="text-[11px] font-mono">
                           <span className={`font-bold block mb-1 ${config.force_split ? 'text-emerald-400' : 'text-[#cbd5e1]'}`}>Force Components Split <InfoTooltip position="top-center" text="Forces multi-component models (like encoder-decoder BART or Whisper) to partition their structures into distinct internal sub-files to optimize modular loading and caching characteristics." /></span>
                           <span className="text-slate-500 leading-tight block">Force partitioning of encoder, decoder, etc. into separate ONNX graph files.</span>
                        </div>
                     </label>
                  </div>

                  <div className={`p-3 border rounded transition-colors ${config.no_post_process ? 'bg-slate-800/60 border-emerald-500/50' : 'bg-[#1a1d23]/40 border-slate-700/60'}`}>
                     <label className="flex items-start gap-3 cursor-pointer">
                        <input
                           type="checkbox"
                           checked={config.no_post_process}
                           disabled={isExporting || isBenchmarking}
                           onChange={(e) => updateConfig({ no_post_process: e.target.checked })}
                           className="mt-0.5 bg-[#0c0d10] border-slate-700 text-emerald-500 focus:ring-emerald-500 rounded"
                        />
                        <div className="text-[11px] font-mono">
                           <span className={`font-bold block mb-1 ${config.no_post_process ? 'text-emerald-400' : 'text-[#cbd5e1]'}`}>Disable Post Processing <InfoTooltip position="top-center" text="Skips model graph cleanup and operator fused optimization blocks right after export. This allows tracing raw, unaltered operations straight from PyTorch parameters for debugging structural graph correctness." /></span>
                           <span className="text-slate-500 leading-tight block">Skip cleanup passes on exported ONNX graphs.</span>
                        </div>
                     </label>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Shape Overrides & Benchmarking (col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            <section className="space-y-6">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Axiomatic Dimensions & Overrides</h3>

              {/* Modality Overrides Card */}
              <div className="flex flex-col border border-[#334155] bg-[#08090b] rounded overflow-hidden">
                <div className="h-8 border-b border-[#334155] bg-[#1a1d23] px-3 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Modality Overrides [{config.modality}]</span>
                </div>
                <div className="p-4 space-y-3">
                  {config.modality === 'text' && (
                     <>
                        <InputPair label="SEQUENCE_LENGTH" value={config.sequence_length} onChange={(v: string) => updateConfig({ sequence_length: v })} disabled={isExporting || isBenchmarking} placeholder="e.g. 128" />
                        <InputPair label="NUM_CHOICES" value={config.num_choices} onChange={(v: string) => updateConfig({ num_choices: v })} disabled={isExporting || isBenchmarking} placeholder="e.g. 4" />
                        <InputPair label="BATCH_SIZE" value={config.batch_size} onChange={(v: string) => updateConfig({ batch_size: v })} disabled={isExporting || isBenchmarking} placeholder="e.g. 1" />
                     </>
                  )}

                  {config.modality === 'vision' && (
                     <>
                        <InputPair label="WIDTH" value={config.width} onChange={(v: string) => updateConfig({ width: v })} disabled={isExporting || isBenchmarking} placeholder="e.g. 224" />
                        <InputPair label="HEIGHT" value={config.height} onChange={(v: string) => updateConfig({ height: v })} disabled={isExporting || isBenchmarking} placeholder="e.g. 224" />
                        <InputPair label="NUM_CHANNELS" value={config.num_channels} onChange={(v: string) => updateConfig({ num_channels: v })} disabled={isExporting || isBenchmarking} placeholder="e.g. 3" />
                     </>
                  )}

                  {config.modality === 'audio' && (
                     <>
                        <InputPair label="FEATURE_SIZE" value={config.feature_size} onChange={(v: string) => updateConfig({ feature_size: v })} disabled={isExporting || isBenchmarking} placeholder="e.g. 80" />
                        <InputPair label="MAX_FRAMES" value={config.nb_max_frames} onChange={(v: string) => updateConfig({ nb_max_frames: v })} disabled={isExporting || isBenchmarking} placeholder="e.g. 3000" />
                        <InputPair label="AUDIO_SEQ_LENGTH" value={config.audio_sequence_length} onChange={(v: string) => updateConfig({ audio_sequence_length: v })} disabled={isExporting || isBenchmarking} placeholder="" />
                     </>
                  )}
                </div>
              </div>

              {/* Inference Validation tolerances */}
              <div className="flex flex-col border border-[#334155] bg-[#08090b] rounded overflow-hidden">
                <div className="h-8 border-b border-[#334155] bg-[#1a1d23] px-3 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Inference Validation Bounds</span>
                </div>
                <div className="p-4 space-y-3">
                  <InputPair label="ATOL (ABS TOLERANCE)" value={config.atol} onChange={(v: string) => updateConfig({ atol: v })} disabled={isExporting || isBenchmarking} placeholder="e.g. 1e-4" />
                  <InputPair label="RTOL (REL TOLERANCE)" value={config.rtol} onChange={(v: string) => updateConfig({ rtol: v })} disabled={isExporting || isBenchmarking} placeholder="e.g. 1e-3" />
                </div>
              </div>

              {/* Benchmark Results stacked inline on the right column */}
              {benchmarkResult && (
                <div className={`border rounded flex flex-col overflow-hidden transition-all duration-300 ${benchmarkResult.status === 'ok' ? 'border-emerald-500/50 bg-[#08090b]' : 'border-red-500/50 bg-red-950/10'}`}>
                  <div className={`h-8 border-b px-3 flex items-center justify-between ${benchmarkResult.status === 'ok' ? 'border-[#334155] bg-[#1a1d23]' : 'border-red-500/30 bg-red-900/20'}`}>
                    <span className={`text-[10px] font-mono uppercase font-bold ${benchmarkResult.status === 'ok' ? 'text-emerald-400' : 'text-red-400'} flex items-center gap-1.5`}>
                      {benchmarkResult.status === 'ok' ? '✓ Ort Performance Execution Metrics' : '× Benchmark Execution Failure'}
                      {benchmarkResult.status === 'ok' && benchmarkResult.isSimulated && (
                         <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[8px] tracking-wider uppercase border border-amber-500/20 font-bold">Simulated Sandbox</span>
                      )}
                      {benchmarkResult.status === 'ok' && !benchmarkResult.isSimulated && (
                         <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] tracking-wider uppercase border border-emerald-500/20 font-bold">Live Execution</span>
                      )}
                    </span>
                  </div>
                  <div className="p-4">
                    {benchmarkResult.status === 'ok' ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                          <MetricBox label="Mean Latency" value={`${benchmarkResult.meanLatencyMs} ms`} />
                          <MetricBox label="p50 Latency" value={`${benchmarkResult.p50LatencyMs} ms`} />
                          <MetricBox label="p95 Latency" value={`${benchmarkResult.p95LatencyMs} ms`} />
                          <MetricBox label="Throughput" value={`${benchmarkResult.throughput} ${benchmarkResult.throughputUnit}`} />
                          <MetricBox label="Est. Memory" value={`${benchmarkResult.memoryUsageMb} MB`} />
                          <MetricBox label="File Size" value={`${((benchmarkResult.modelSizeBytes || 0) / 1024 / 1024).toFixed(2)} MB`} />
                        </div>
                        {benchmarkResult.isSimulated && (
                          <div className="text-[9px] font-mono text-slate-500 leading-relaxed border-t border-slate-800/80 pt-2 bg-amber-500/5 -mx-4 -mb-4 px-4 pb-2.5">
                            <span className="text-amber-500 font-bold">INFO: </span>This target does not host directly public CORS-compliant browser assets. The workbench has activated its high-fidelity profiling predictor mapping latency & throughput dynamically based on your optimization, hardware and precision configurations.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs font-mono text-red-400 whitespace-pre-wrap leading-relaxed">
                        Error: {benchmarkResult.error}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string, value: string }) {
   return (
      <div className="flex flex-col gap-1">
         <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{label}</span>
         <span className="text-xl font-mono text-slate-200">{value}</span>
      </div>
   );
}

function InputPair({ label, value, onChange, disabled, placeholder }: any) {
   return (
      <div className="flex items-center justify-between gap-4">
         <label className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
          {label}
          {label === 'SEQUENCE_LENGTH' && <InfoTooltip position="top-center" text="Sets the input sequence dimension size (sequence_length) for validation tensors. Governs word sequences processed concurrently inside the graph validation checks." />}
          {label === 'NUM_CHOICES' && <InfoTooltip position="top-center" text="Sets the candidate option count (num_choices) passed during validation checks of multiple choice models (e.g. BERT Multiple Choice)." />}
          {label === 'BATCH_SIZE' && <InfoTooltip position="top-center" text="Sets the validation batch_size dimension. Essential for confirming dynamic axis capabilities when handling batches larger than 1." />}
          {label === 'WIDTH' && <InfoTooltip position="top-center" text="Defines pixel array bounds width. Validated in CNN convolutional stages and ViT patches during input forwarding passes." />}
          {label === 'HEIGHT' && <InfoTooltip position="top-center" text="Defines pixel array bounds height. Dictates input grid configurations mapped into structural spatial matrices." />}
          {label === 'NUM_CHANNELS' && <InfoTooltip position="top-center" text="Sets input channel parameters (usually 3 for RGB colour spectra, 1 for grayscale profiles) to conform with vision expectations." />}
          {label === 'FEATURE_SIZE' && <InfoTooltip position="top-center" text="Specifies raw spectral components (e.g., of Mel-frequency channels, default 80) passed within validating audio models." />}
          {label === 'MAX_FRAMES' && <InfoTooltip position="top-center" text="Indicates max audio frames (default 3000) allowed for spectral duration analysis to test encoder temporal constraints." />}
          {label === 'ATOL (ABS TOLERANCE)' && <InfoTooltip position="top-center" text="The maximum absolute discrepancy allowable boundary (`--atol`) between PyTorch and exported ONNX forward-pass outputs before validation registers a deviation." />}
          {label === 'RTOL (REL TOLERANCE)' && <InfoTooltip position="top-center" text="Sets relative comparison tolerance thresholds (`--rtol`) to verify precision outputs against normalized scaling parameters." />}
        </label>
         <input
            type="text"
            className="w-32 bg-[#0c0d10] border border-slate-700 rounded p-1 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-600 disabled:opacity-50 text-right"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
         />
      </div>
   );
}
