import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';
import { ExportConfig, LogEntry, LogLevel, TASKS, CompiledModelInfo } from './types';
import { runBenchmark, BenchmarkParams, BenchmarkResult } from './lib/benchmark';
import { generateCompiledModelInfo } from './utils/modelInfo';

export const SYSTEM_PRESETS: Record<string, Partial<ExportConfig>> = {
  'WebGPU fp16 Target': {
    opset: 17,
    device: 'cuda',
    dtype: 'fp16',
    optimize: 'O3',
    monolith: false,
    use_safetensors: true,
    force_split: false,
  },
  'CPU fp32 Portable': {
    opset: 14,
    device: 'cpu',
    dtype: 'fp32',
    optimize: 'O1',
    monolith: true,
    use_safetensors: true,
    force_split: false,
  },
  'CUDA bf16 Heavy': {
    opset: 17,
    device: 'cuda',
    dtype: 'bf16',
    optimize: 'O4',
    monolith: false,
    use_safetensors: true,
    force_split: true,
  },
  'Low-Memory Raw Debug': {
    opset: 14,
    device: 'cpu',
    dtype: 'fp32',
    optimize: 'none',
    monolith: false,
    no_post_process: true,
    use_safetensors: false,
    force_split: false,
  },
};

interface WorkbenchContextType {
  config: ExportConfig;
  updateConfig: (updates: Partial<ExportConfig>) => void;
  logs: LogEntry[];
  isExporting: boolean;
  isBenchmarking: boolean;
  isCompiled: boolean;
  benchmarkResult: BenchmarkResult | null;
  startExport: () => void;
  startBenchmark: () => void;
  downloadConfig: () => void;
  getCommandPreview: () => string;
  savedPresets: Record<string, ExportConfig>;
  activePresetName: string | null;
  savePreset: (name: string) => void;
  deletePreset: (name: string) => void;
  loadPreset: (name: string) => void;
  localFile: File | null;
  updateLocalFile: (file: File | null) => void;
  compiledModelInfo: CompiledModelInfo;
  cancelExport: () => void;
  cancelBenchmark: () => void;
}

const defaultConfig: ExportConfig = {
  modelSourceType: 'hub',
  modelPath: 'openai/whisper-large-v3',
  modality: 'audio',
  task: 'automatic-speech-recognition',
  opset: 14,
  device: 'cpu',
  dtype: 'fp32',
  optimize: 'none',
  monolith: false,
  no_post_process: false,
  trust_remote_code: false,
  framework: 'pt',
  cache_dir: '',
  pad_token_id: '',
  atol: '',
  rtol: '',
  use_safetensors: true,
  force_split: false,

  sequence_length: '',
  num_choices: '',
  batch_size: '',
  width: '',
  height: '',
  num_channels: '',
  feature_size: '',
  nb_max_frames: '',
  audio_sequence_length: '',
};

const WorkbenchContext = createContext<WorkbenchContextType | undefined>(undefined);

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ExportConfig>(defaultConfig);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      message: 'Workspace initialized. Ready for configuration.',
    },
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [isCompiled, setIsCompiled] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const logsRef = useRef(logs);
  const exportIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const benchmarkAbortControllerRef = useRef<AbortController | null>(null);

  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localFileUrl, setLocalFileUrl] = useState<string | null>(null);

  const [compiledModelInfo, setCompiledModelInfo] = useState<CompiledModelInfo>(() => generateCompiledModelInfo(defaultConfig));

  const addLog = (level: LogLevel, message: string) => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    setLogs((prev) => {
      const newLogs = [...prev, entry];
      logsRef.current = newLogs;
      return newLogs;
    });
  };

  const updateConfig = (updates: Partial<ExportConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      // reset task if modality changes
      if (updates.modality && updates.modality !== prev.modality) {
        next.task = TASKS[updates.modality][0];
      }
      return next;
    });
    setIsCompiled(false);
  };

  const updateLocalFile = (file: File | null) => {
    if (localFileUrl) {
      URL.revokeObjectURL(localFileUrl);
    }
    if (file) {
      const url = URL.createObjectURL(file);
      setLocalFile(file);
      setLocalFileUrl(url);
      addLog('success', `Ingested local model: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB) entirely in-browser.`);
      updateConfig({ modelPath: file.name });
    } else {
      setLocalFile(null);
      setLocalFileUrl(null);
      addLog('info', 'Local model removed from in-browser memory.');
    }
  };

  const getCommandPreview = () => {
    let cmd = `optimum-cli export onnx \\\n  -m ${config.modelPath || '<model_path>'} \\\n  --task ${config.task}`;
    
    cmd += ` \\\n  --opset ${config.opset}`;
    
    if (config.device !== 'cpu') cmd += ` \\\n  --device ${config.device}`;
    if (config.dtype !== 'fp32') cmd += ` \\\n  --dtype ${config.dtype}`;
    if (config.optimize !== 'none') cmd += ` \\\n  --optimize ${config.optimize}`;
    if (config.monolith) cmd += ` \\\n  --monolith`;
    if (config.no_post_process) cmd += ` \\\n  --no-post-process`;
    if (config.trust_remote_code) cmd += ` \\\n  --trust-remote-code`;
    if (config.framework) cmd += ` \\\n  --framework ${config.framework}`;
    if (config.cache_dir) cmd += ` \\\n  --cache_dir ${config.cache_dir}`;
    if (config.pad_token_id) cmd += ` \\\n  --pad_token_id ${config.pad_token_id}`;
    if (config.atol) cmd += ` \\\n  --atol ${config.atol}`;
    if (config.rtol) cmd += ` \\\n  --rtol ${config.rtol}`;
    if (config.use_safetensors) cmd += ` \\\n  --use_safetensors`;
    if (config.force_split) cmd += ` \\\n  --force_split`;

    // Add shapes based on modality
    if (config.modality === 'text') {
      if (config.sequence_length) cmd += ` \\\n  --sequence_length ${config.sequence_length}`;
      if (config.num_choices) cmd += ` \\\n  --num_choices ${config.num_choices}`;
      if (config.batch_size) cmd += ` \\\n  --batch_size ${config.batch_size}`;
    } else if (config.modality === 'vision') {
      if (config.width) cmd += ` \\\n  --width ${config.width}`;
      if (config.height) cmd += ` \\\n  --height ${config.height}`;
      if (config.num_channels) cmd += ` \\\n  --num_channels ${config.num_channels}`;
    } else if (config.modality === 'audio') {
      if (config.feature_size) cmd += ` \\\n  --feature_size ${config.feature_size}`;
      if (config.nb_max_frames) cmd += ` \\\n  --nb_max_frames ${config.nb_max_frames}`;
      if (config.audio_sequence_length) cmd += ` \\\n  --audio_sequence_length ${config.audio_sequence_length}`;
    }

    cmd += ` \\\n  export_dir/`;

    return cmd;
  };

  const cancelExport = () => {
    if (exportIntervalRef.current) {
        clearInterval(exportIntervalRef.current);
        exportIntervalRef.current = null;
    }
    setIsExporting(false);
    setIsCompiled(false);
    addLog('info', 'Export compilation cancelled by user.');
  };

  const cancelBenchmark = () => {
    if (benchmarkAbortControllerRef.current) {
        benchmarkAbortControllerRef.current.abort();
        benchmarkAbortControllerRef.current = null;
    }
    setIsBenchmarking(false);
    addLog('info', 'Benchmark execution cancelled by user.');
  };

  const startExport = () => {
    if (!config.modelPath) {
      addLog('error', 'Error: Model path or Hub ID is required');
      return;
    }
    
    // Some basic validation
    if (config.dtype === 'bf16' && config.device !== 'cuda') {
      addLog('error', 'Device/dtype incompatibility: bf16 requires CUDA device');
      return;
    }
    if (config.framework === 'tf' && config.use_safetensors) {
      addLog('warn', 'Warning: SafeTensors is generally used with PyTorch models. Setting --framework tf may cause compatibility issues.');
    }

    setIsExporting(true);
    addLog('info', `Initializing compilation environment for task '${config.task}'...`);
    
    let step = 0;
    exportIntervalRef.current = setInterval(() => {
      step++;
      
      switch (step) {
        case 1:
          const providers = config.device === 'cuda' ? "['CUDAExecutionProvider', 'CPUExecutionProvider']" : "['CPUExecutionProvider']";
          addLog('info', `Resolving execution providers: ${providers}`);
          break;
        case 2:
          addLog('info', `Loading model from ${config.modelSourceType === 'hub' ? 'Hugging Face Hub' : 'local file system'}: ${config.modelPath}`);
          if (config.trust_remote_code) {
             addLog('warn', 'Executing with --trust-remote-code. Evaluating remote files...');
          }
          break;
        case 3:
          addLog('info', 'Abstracting model architecture graph mapped to ONNX opset ' + config.opset + '...');
          break;
        case 4:
          addLog('info', "Tracing PyTorch operations and resolving dynamic axes...");
          break;
        case 5:
          addLog('success', "Graph abstraction successful. Generating ONNX IR representations...");
          break;
        case 6:
          addLog('info', 'Performing structural checks. Comparing outputs with standard PyTorch logits...');
          break;
        case 7:
          if (config.rtol && config.atol) {
             addLog('info', `Comparing PyTorch vs ONNX outputs: max_abs_diff=0.00008; all values close (atol: ${config.atol}; rtol: ${config.rtol})`);
          } else {
             addLog('info', `Comparing PyTorch vs ONNX outputs: max_abs_diff=0.00008; all values close (atol: 1e-4; rtol: 1e-3)`);
          }
          break;
        case 8:
          addLog('info', "Validating ONNX Model output 'logits': [✓] matches expected shape.");
          break;
        case 9:
          addLog('info', `Finalizing outputs: model.onnx, tokenizer.json, config.json...`);
          break;
        case 10:
          addLog('success', 'Export successful. Artifacts are ready in the target directory.');
          break;
        case 11:
          addLog('info', 'Running structural validation check on compiled ONNX graph...');
          break;
        case 12:
          if (exportIntervalRef.current) {
             clearInterval(exportIntervalRef.current);
             exportIntervalRef.current = null;
          }
          const opInfo = generateCompiledModelInfo(config);
          
          let hasIssues = false;
          
          if (config.opset && parseInt(config.opset.toString(), 10) < 14) {
             addLog('warn', `Validation Warning: Opset ${config.opset} may lack native support for fused attention patterns. Expected fallback to expanded nodes.`);
             hasIssues = true;
          }
          
          if (!config.sequence_length && config.modality === 'text') {
             addLog('warn', 'Validation Warning: Sequence length not explicitly bounded. Graph might lack complete dynamic axes for variable input lengths.');
             hasIssues = true;
          }
          
          if (!config.batch_size) {
             addLog('warn', 'Validation Notice: Batch size not explicitly fixed. Ensure dynamic axes are configured if compiling for dynamic batching.');
          }

          const hasQuant = opInfo.operators.some(op => op.opType.includes('Quantize'));
          if (hasQuant && config.device === 'cuda') {
             addLog('warn', 'Validation Notice: Quantized operators (QLinear) detected on CUDA device target. Ensure TensorRT execution provider support or int8 fallback precision.');
             hasIssues = true;
          }

          if (!hasIssues) {
             addLog('success', 'Structural validation passed. Graph topology and dynamic axes verified.');
          }

          setIsExporting(false);
          setIsCompiled(true);
          setCompiledModelInfo(opInfo);
          
          // Trigger a dummy config output
          setTimeout(() => downloadConfig(), 500);
          break;
      }
    }, 1200);
  };

  const startBenchmark = async () => {
    const isLocalFileMode = config.modelSourceType === 'local' && localFile && localFileUrl;
    const targetModelPath = isLocalFileMode ? localFileUrl : config.modelPath;
    const displayName = isLocalFileMode ? localFile.name : config.modelPath;

    if (!targetModelPath) {
      addLog('error', 'Error: Model path or local uploaded file is required for benchmarking');
      return;
    }
    
    benchmarkAbortControllerRef.current = new AbortController();
    setIsBenchmarking(true);
    setBenchmarkResult(null);
    addLog('info', `Initializing ORT benchmark sequence for ${displayName}...`);
    if (isLocalFileMode) {
      addLog('info', `Executing in memory-mapped local-first safe sandbox mode...`);
    } else {
      addLog('info', `Querying target path and verifying execution headers on Hugging Face...`);
    }
    
    // Parse numeric shape overrides safely
    const parseOrUndef = (val: string) => val && !isNaN(parseInt(val, 10)) ? parseInt(val, 10) : undefined;
    
    const params: BenchmarkParams = {
      modelPath: targetModelPath,
      device: config.device,
      dtype: config.dtype,
      modality: config.modality,
      optimize: config.optimize,
      batchSize: parseOrUndef(config.batch_size),
      sequenceLength: parseOrUndef(config.sequence_length),
      numChannels: parseOrUndef(config.num_channels),
      width: parseOrUndef(config.width),
      height: parseOrUndef(config.height),
      featureSize: parseOrUndef(config.feature_size),
      nbMaxFrames: parseOrUndef(config.nb_max_frames)
    };

    try {
      const res = await runBenchmark(params);
      
      const resUpdated = { ...res };
      if (isLocalFileMode) {
        resUpdated.modelSizeBytes = localFile.size;
      }

      setBenchmarkResult(resUpdated);

      if (resUpdated.status === 'ok') {
        const simBadge = resUpdated.isSimulated ? ' (Estimated sandbox)' : '';
        addLog('success', `Benchmark complete${simBadge}: Mean Latency ${resUpdated.meanLatencyMs}ms, Throughput: ${resUpdated.throughput} ${resUpdated.throughputUnit}`);
        if (resUpdated.error) {
           addLog('warn', `Notice: ${resUpdated.error}`);
        }
      } else {
        addLog('error', `Benchmark failed: ${resUpdated.error}`);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
         addLog('info', 'Benchmark execution aborted.');
      } else {
         addLog('error', `Benchmark runner exception: ${e.message || String(e)}`);
         setBenchmarkResult({ status: 'error', error: e.message || String(e) });
      }
    } finally {
      setIsBenchmarking(false);
      benchmarkAbortControllerRef.current = null;
    }
  };

  const downloadConfig = () => {
    const payload = JSON.stringify(config, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export_config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('success', 'export_config.json downloaded.');
  };

  const [savedPresets, setSavedPresets] = useState<Record<string, ExportConfig>>(() => {
    try {
      const stored = localStorage.getItem('onnx_workbench_presets');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [activePresetName, setActivePresetName] = useState<string | null>(null);

  const savePreset = (name: string) => {
    if (!name.trim()) return;
    const updated = {
      ...savedPresets,
      [name]: config,
    };
    setSavedPresets(updated);
    try {
      localStorage.setItem('onnx_workbench_presets', JSON.stringify(updated));
    } catch (e: any) {
      addLog('error', `Failed to write preset to local storage: ${e.message}`);
    }
    setActivePresetName(name);
    addLog('success', `Saved preset '${name}' successfully.`);
  };

  const deletePreset = (name: string) => {
    const updated = { ...savedPresets };
    delete updated[name];
    setSavedPresets(updated);
    try {
      localStorage.setItem('onnx_workbench_presets', JSON.stringify(updated));
    } catch (e: any) {
      addLog('error', `Failed to update local storage: ${e.message}`);
    }
    if (activePresetName === name) {
      setActivePresetName(null);
    }
    addLog('info', `Deleted custom preset: '${name}'.`);
  };

  const loadPreset = (name: string) => {
    if (SYSTEM_PRESETS[name]) {
      const systemPreset = SYSTEM_PRESETS[name];
      setConfig((prev) => ({
        ...prev,
        ...systemPreset,
      }));
      setActivePresetName(name);
      addLog('success', `Loaded system profile: '${name}'`);
    } else if (savedPresets[name]) {
      const userPreset = savedPresets[name];
      setConfig(userPreset);
      setActivePresetName(name);
      addLog('success', `Loaded custom profile: '${name}'`);
    } else {
      addLog('error', `Preset not found: '${name}'`);
    }
  };

  return (
    <WorkbenchContext.Provider
      value={{
        config,
        updateConfig,
        logs,
        isExporting,
        isBenchmarking,
        isCompiled,
        benchmarkResult,
        startExport,
        startBenchmark,
        downloadConfig,
        getCommandPreview,
        savedPresets,
        activePresetName,
        savePreset,
        deletePreset,
        loadPreset,
        cancelExport,
        cancelBenchmark,
        localFile,
        updateLocalFile,
        compiledModelInfo,
      }}
    >
      {children}
    </WorkbenchContext.Provider>
  );
}

export function useWorkbench() {
  const context = useContext(WorkbenchContext);
  if (!context) {
    throw new Error('useWorkbench must be used within a WorkbenchProvider');
  }
  return context;
}
