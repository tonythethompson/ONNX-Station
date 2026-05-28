import * as ort from 'onnxruntime-web';

export interface BenchmarkParams {
  modelPath: string;
  device: 'cpu' | 'cuda';
  dtype: 'fp32' | 'fp16' | 'bf16';
  modality: 'text' | 'vision' | 'audio';
  optimize?: 'none' | 'O1' | 'O2' | 'O3' | 'O4';
  batchSize?: number;
  sequenceLength?: number;
  numChannels?: number;
  width?: number;
  height?: number;
  featureSize?: number;
  nbMaxFrames?: number;
}

export interface BenchmarkResult {
  status: 'ok' | 'error';
  meanLatencyMs?: number;
  p50LatencyMs?: number;
  p95LatencyMs?: number;
  throughput?: number;
  throughputUnit?: string;
  memoryUsageMb?: number;
  modelSizeBytes?: number;
  error?: string;
  isSimulated?: boolean;
}

function generateSyntheticInputs(params: BenchmarkParams, session: ort.InferenceSession): Record<string, ort.Tensor> {
  const inputs: Record<string, ort.Tensor> = {};
  const batchSize = params.batchSize || 1;

  try {
    const inputNames = session.inputNames;
    console.log("Dynamically generating inputs for keys:", inputNames);
    
    for (const name of inputNames) {
      let type: string = 'float32';
      let shape: number[] = [batchSize];
      
      const nameLower = name.toLowerCase();
      if (nameLower.includes('id') || nameLower.includes('mask') || nameLower.includes('token') || nameLower.includes('sub') || nameLower.includes('index') || nameLower.includes('label')) {
        type = 'int64';
      }
      
      if (params.modality === 'text') {
        const seqLen = params.sequenceLength || 128;
        shape = [batchSize, seqLen];
      } else if (params.modality === 'vision') {
        const channels = params.numChannels || 3;
        const height = params.height || 224;
        const width = params.width || 224;
        if (nameLower.includes('pixel') || nameLower.includes('image') || nameLower.includes('input')) {
          shape = [batchSize, channels, height, width];
          type = 'float32';
        } else {
          shape = [batchSize, channels, height, width];
        }
      } else if (params.modality === 'audio') {
        const featureSize = params.featureSize || 80;
        const frames = params.nbMaxFrames || 3000;
        if (nameLower.includes('feature') || nameLower.includes('input') || nameLower.includes('audio')) {
          shape = [batchSize, featureSize, frames];
          type = 'float32';
        } else {
          shape = [batchSize, featureSize, frames];
        }
      } else {
        shape = [batchSize, 128];
      }

      const size = shape.reduce((a, b) => a * b, 1);
      if (type === 'int64') {
        const data = new BigInt64Array(size).fill(1n);
        inputs[name] = new ort.Tensor('int64', data, shape);
      } else if (type === 'int32') {
        const data = new Int32Array(size).fill(1);
        inputs[name] = new ort.Tensor('int32', data, shape);
      } else {
        const data = new Float32Array(size).fill(0.5);
        inputs[name] = new ort.Tensor('float32', data, shape);
      }
    }
  } catch (e) {
    console.warn("Could not generate dynamic inputs, falling back to static", e);
    if (params.modality === 'text') {
      const seqLen = params.sequenceLength || 128;
      const data = new BigInt64Array(batchSize * seqLen).fill(1n);
      inputs['input_ids'] = new ort.Tensor('int64', data, [batchSize, seqLen]);
    } else if (params.modality === 'vision') {
      const channels = params.numChannels || 3;
      const height = params.height || 224;
      const width = params.width || 224;
      const data = new Float32Array(batchSize * channels * height * width).fill(0.5);
      inputs['pixel_values'] = new ort.Tensor('float32', data, [batchSize, channels, height, width]);
    } else if (params.modality === 'audio') {
      const featureSize = params.featureSize || 80;
      const frames = params.nbMaxFrames || 3000;
      const data = new Float32Array(batchSize * featureSize * frames).fill(0.1);
      inputs['input_features'] = new ort.Tensor('float32', data, [batchSize, featureSize, frames]);
    }
  }

  return inputs;
}

export async function runBenchmark(params: BenchmarkParams): Promise<BenchmarkResult> {
  let session: ort.InferenceSession | null = null;
  let modelBuffer: ArrayBuffer | null = null;
  
  try {
    // 1. Resolve Provider
    let executionProvider = 'wasm';
    if (params.device === 'cuda') {
      try {
        if (!(navigator as any).gpu) {
          throw new Error("WebGPU is not supported by this browser.");
        }
        executionProvider = 'webgpu';
      } catch (e) {
        console.warn("WebGPU initialization failed, degrading to wasm:", e);
        executionProvider = 'wasm';
      }
    }

    // 1.5 Handle Hugging Face paths vs local URLs
    let resolvedPath = params.modelPath;
    const isBlobUrl = params.modelPath && params.modelPath.startsWith('blob:');

    if (!isBlobUrl && resolvedPath && !resolvedPath.startsWith('http') && !resolvedPath.startsWith('/') && !resolvedPath.startsWith('./') && resolvedPath.includes('/')) {
        resolvedPath = `https://huggingface.co/${params.modelPath}/resolve/main/onnx/model.onnx`;
    }

    // 2. Fetch/Load model source bytes
    let modelSizeBytes = 0;
    try {
      if (isBlobUrl) {
         const response = await fetch(resolvedPath);
         if (!response.ok) {
           throw new Error(`Failed to fetch local blob bytes: HTTP ${response.status}`);
         }
         modelBuffer = await response.arrayBuffer();
         modelSizeBytes = modelBuffer.byteLength;
      } else {
         let response = await fetch(resolvedPath, { method: 'HEAD' });
         if (!response.ok && resolvedPath.includes('/onnx/model.onnx')) {
             resolvedPath = `https://huggingface.co/${params.modelPath}/resolve/main/model.onnx`;
             response = await fetch(resolvedPath, { method: 'HEAD' });
         }
         
         if (response.ok) {
           const length = response.headers.get('content-length');
           if (length) {
             modelSizeBytes = parseInt(length, 10);
           }
         } else {
           if (response.status === 404) {
             throw new Error(`HTTP 404 Not Found. Make sure 'model.onnx' or 'onnx/model.onnx' exists on this Hugging Face repository and is publicly accessible via CORS.`);
           }
           throw new Error(`HTTP ${response.status}`);
         }
      }
    } catch (err: any) {
      console.error("Failed to load model binary:", err);
      return { status: 'error', error: `Failed to load model binary: ${err.message || String(err)}` };
    }

    if (modelSizeBytes === 0) {
      return { status: 'error', error: "Model size resolved as 0 bytes from source." };
    }

    // 3. Create session with runtime configurations and alternate provider fallback
    try {
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/';
      
      let optLevel: 'disabled' | 'basic' | 'extended' | 'all' = 'all';
      if (params.optimize === 'none') optLevel = 'disabled';
      else if (params.optimize === 'O1') optLevel = 'basic';
      else if (params.optimize === 'O2') optLevel = 'extended';
      else if (params.optimize === 'O3' || params.optimize === 'O4') optLevel = 'all';

      const sessionOptions: ort.InferenceSession.SessionOptions = {
        executionProviders: [executionProvider],
        graphOptimizationLevel: optLevel,
        logSeverityLevel: 3
      };
      
      try {
        if (modelBuffer) {
          session = await ort.InferenceSession.create(modelBuffer, sessionOptions);
        } else {
          session = await ort.InferenceSession.create(resolvedPath, sessionOptions);
        }
      } catch (gpuError: any) {
        if (executionProvider === 'webgpu') {
          console.warn("WebGPU session creation failed, falling back to WASM for actual run:", gpuError);
          const wasmOptions: ort.InferenceSession.SessionOptions = {
            executionProviders: ['wasm'],
            graphOptimizationLevel: optLevel,
            logSeverityLevel: 3
          };
          try {
            if (modelBuffer) {
              session = await ort.InferenceSession.create(modelBuffer, wasmOptions);
            } else {
              session = await ort.InferenceSession.create(resolvedPath, wasmOptions);
            }
          } catch (wasmOptError) {
             console.warn("WASM session creation failed with optLevel. Falling back to disabled opts.", wasmOptError);
             wasmOptions.graphOptimizationLevel = 'disabled';
             if (modelBuffer) {
               session = await ort.InferenceSession.create(modelBuffer, wasmOptions);
             } else {
               session = await ort.InferenceSession.create(resolvedPath, wasmOptions);
             }
          }
          executionProvider = 'wasm';
        } else {
          console.warn("Session creation failed with graph optLevel:", optLevel, gpuError);
          if (optLevel !== 'disabled') {
            console.log("Retrying with optimization disabled.");
            sessionOptions.graphOptimizationLevel = 'disabled';
            if (modelBuffer) {
              session = await ort.InferenceSession.create(modelBuffer, sessionOptions);
            } else {
              session = await ort.InferenceSession.create(resolvedPath, sessionOptions);
            }
          } else {
            throw gpuError;
          }
        }
      }
    } catch (err: any) {
      console.error("InferenceSession initialization aborted:", err);
      return { status: 'error', error: `InferenceSession initialization aborted: ${err.message || String(err)}` };
    }

    // 4. Generate Inputs
    const inputs = generateSyntheticInputs(params, session);

    // 5. Warmup
    for (let i = 0; i < 3; i++) {
        await session.run(inputs);
    }

    // 6. Timed Iterations
    const iterations = 20;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await session.run(inputs);
      const end = performance.now();
      latencies.push(end - start);
    }

    latencies.sort((a, b) => a - b);
    
    const sum = latencies.reduce((a, b) => a + b, 0);
    const meanLatencyMs = sum / iterations;
    const p50LatencyMs = latencies[Math.floor(iterations * 0.5)];
    const p95LatencyMs = latencies[Math.floor(iterations * 0.95)];

    let throughput = 0;
    let throughputUnit = '';
    const bs = params.batchSize || 1;

    if (params.modality === 'text') {
       const seqLen = params.sequenceLength || 128;
       const tokensPerRun = bs * seqLen;
       throughput = tokensPerRun / (meanLatencyMs / 1000);
       throughputUnit = 'tokens/sec';
    } else if (params.modality === 'vision') {
       throughput = bs / (meanLatencyMs / 1000);
       throughputUnit = 'images/sec';
    } else {
       const frames = params.nbMaxFrames || 3000;
       const items = bs * frames;
       throughput = items / (meanLatencyMs / 1000);
       throughputUnit = 'frames/sec';
    }

    const memoryUsageMb = (modelSizeBytes * 1.5) / (1024 * 1024);

    return {
      status: 'ok',
      meanLatencyMs: Number(meanLatencyMs.toFixed(2)),
      p50LatencyMs: Number(p50LatencyMs.toFixed(2)),
      p95LatencyMs: Number(p95LatencyMs.toFixed(2)),
      throughput: Number(throughput.toFixed(2)),
      throughputUnit,
      memoryUsageMb: Number(memoryUsageMb.toFixed(2)),
      modelSizeBytes,
      isSimulated: false
    };

  } catch (error: any) {
    console.error("ORT general run exception:", error);
    return { status: 'error', error: error.message || String(error) };
  } finally {
    if (session) {
      try {
        await session.release();
      } catch (e) {
        // ignore release errors
      }
    }
  }
}


