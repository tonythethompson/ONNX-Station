export type Modality = 'audio' | 'text' | 'vision';

export const TASKS: Record<Modality, string[]> = {
  audio: [
    'automatic-speech-recognition',
    'audio-classification',
    'audio-frame-classification',
    'audio-xvector',
  ],
  text: [
    'causal-lm',
    'sequence-classification',
    'translation',
    'token-classification',
    'feature-extraction',
    'fill-mask',
    'question-answering',
  ],
  vision: [
    'image-classification',
    'image-segmentation',
    'depth-estimation',
    'object-detection',
  ],
};

export interface ExportConfig {
  modelSourceType: 'hub' | 'local';
  modelPath: string;
  modality: Modality;
  task: string;
  opset: number;
  device: 'cpu' | 'cuda';
  dtype: 'fp32' | 'fp16' | 'bf16';
  optimize: 'none' | 'O1' | 'O2' | 'O3' | 'O4';
  monolith: boolean;
  no_post_process: boolean;
  trust_remote_code: boolean;
  framework: 'pt' | 'tf';
  cache_dir: string;
  pad_token_id: string;
  atol: string;
  rtol: string;
  use_safetensors: boolean;
  force_split: boolean;

  // Shapes override depending on modality
  sequence_length: string;
  num_choices: string;
  batch_size: string;
  width: string;
  height: string;
  num_channels: string;
  feature_size: string;
  nb_max_frames: string;
  audio_sequence_length: string;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface CompiledModelOperator {
  opType: string;
  count: number;
  memoryMb: number;
  percentage: number;
  category: 'compute' | 'memory' | 'activation' | 'normalization' | 'shape';
}

export interface CompiledModelInfo {
  status: 'idle' | 'exporting' | 'completed';
  modelPath: string;
  modality: Modality;
  opset: number;
  optimize: 'none' | 'O1' | 'O2' | 'O3' | 'O4';
  dtype: 'fp32' | 'fp16' | 'bf16';
  operators: CompiledModelOperator[];
  totalOps: number;
  totalMemoryMb: number;
  isSimulated?: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}
