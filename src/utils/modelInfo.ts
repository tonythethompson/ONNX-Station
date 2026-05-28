import { ExportConfig, CompiledModelInfo, CompiledModelOperator } from '../types';

/**
 * Dynamically computes a high-fidelity simulated ONNX operator distribution
 * and layer-by-layer VRAM/memory allocation based on the Optimum compilation pipeline state.
 */
export function generateCompiledModelInfo(config: ExportConfig): CompiledModelInfo {
  const pathLower = (config.modelPath || '').toLowerCase();
  
  // 1. Determine base transformer layers based on model path
  let numLayers = 12; // default
  let modelBaseName = 'Model';
  
  if (pathLower.includes('whisper')) {
    modelBaseName = 'Whisper';
    if (pathLower.includes('large')) {
      numLayers = 24; // Multi-head encoder/decoder
    } else if (pathLower.includes('medium')) {
      numLayers = 24;
    } else if (pathLower.includes('small') || pathLower.includes('base')) {
      numLayers = 12;
    } else {
      numLayers = 6; // tiny
    }
  } else if (pathLower.includes('llama') || pathLower.includes('qwen') || pathLower.includes('7b') || pathLower.includes('8b')) {
    modelBaseName = 'LLaMA/Qwen';
    numLayers = 32;
  } else if (pathLower.includes('bert') || pathLower.includes('roberta')) {
    modelBaseName = 'BERT';
    if (pathLower.includes('large')) {
      numLayers = 24;
    } else {
      numLayers = 12;
    }
  } else if (pathLower.includes('vit') || pathLower.includes('sam')) {
    modelBaseName = 'VisionTransformer';
    numLayers = 12;
  } else if (pathLower.includes('resnet')) {
    modelBaseName = 'ResNet';
    numLayers = 18; // Residual groups
  }

  // 2. Adjust core factors based on dtype validation and optimizations
  let dtypeScale = 1.0;
  if (config.dtype === 'fp16') dtypeScale = 0.50; // FP16 yields 2x memory reduction
  if (config.dtype === 'bf16') dtypeScale = 0.52; // BF16 yields ~2x memory reduction

  let optOpCountMultiplier = 1.0;
  let optMemMultiplier = 1.0;
  
  switch (config.optimize) {
    case 'O1':
      optOpCountMultiplier = 0.90; // basic fusion
      optMemMultiplier = 0.95;
      break;
    case 'O2':
      optOpCountMultiplier = 0.80; // structural normalization fusions
      optMemMultiplier = 0.85;
      break;
    case 'O3':
      optOpCountMultiplier = 0.60; // complete attention block / kernel fusions
      optMemMultiplier = 0.70;
      break;
    case 'O4':
      optOpCountMultiplier = 1.25; // quantization adds Q/DQ scaling nodes (QuantizeLinear/DequantizeLinear)
      optMemMultiplier = 0.35;    // reduces weights memory footprint by 4x
      break;
    default:
      optOpCountMultiplier = 1.05; // expanded / raw graph carries auxiliary operations
      optMemMultiplier = 1.05;
  }

  const operators: CompiledModelOperator[] = [];

  // Helper inside to push structured operators
  const addOp = (
    opType: string,
    baseCount: number,
    baseMemMb: number,
    category: 'compute' | 'memory' | 'activation' | 'normalization' | 'shape'
  ) => {
    operators.push({
      opType,
      count: Math.max(1, Math.round(baseCount)),
      memoryMb: Number(Math.max(0.1, baseMemMb).toFixed(2)),
      percentage: 0, // Calculated later
      category
    });
  };

  // 3. Define operators based on modalities
  if (config.modality === 'text') {
    // Standard NLP Attention layers
    let matMulCount = numLayers * 6;
    let matMulMem = numLayers * 12.4 * dtypeScale * optMemMultiplier;

    if (config.optimize === 'O3' || config.optimize === 'O4') {
      // O3 / O4 merges linear layers and fuses QKV
      matMulCount = Math.round(numLayers * 3 * optOpCountMultiplier);
    }

    if (config.optimize === 'O4') {
      // Split into standard MatMul and Quantized counterpart to illustrate workbench
      addOp('QLinearMatMul', Math.round(matMulCount * 0.8), matMulMem * 0.2, 'compute');
      addOp('MatMul (De-quant)', Math.round(matMulCount * 0.2), matMulMem * 0.15, 'compute');
      addOp('QuantizeLinear', Math.round(numLayers * 8), numLayers * 0.1, 'memory');
      addOp('DequantizeLinear', Math.round(numLayers * 12), numLayers * 0.15, 'memory');
    } else {
      addOp('MatMul', matMulCount, matMulMem, 'compute');
    }

    addOp('Gather', 3, 42.0 * dtypeScale * optMemMultiplier, 'memory'); // Embeddings
    addOp('Add', Math.round(numLayers * 8 * optOpCountMultiplier), numLayers * 0.8 * dtypeScale, 'compute');
    addOp('Mul', Math.round(numLayers * 4 * optOpCountMultiplier), numLayers * 0.3 * dtypeScale, 'compute');
    
    if (config.optimize === 'O3') {
      addOp('MultiHeadAttention (Fused)', numLayers, numLayers * 6.0 * dtypeScale * optMemMultiplier, 'compute');
      addOp('Softmax (Remainder)', Math.round(numLayers * 0.2), numLayers * 0.4 * dtypeScale, 'activation');
    } else {
      addOp('Softmax', numLayers, numLayers * 1.8 * dtypeScale, 'activation');
    }

    if (config.optimize === 'O2' || config.optimize === 'O3' || config.optimize === 'O4') {
      addOp('LayerNormalization', numLayers * 2, numLayers * 0.6 * dtypeScale, 'normalization');
    } else {
      // Expanded node representation
      addOp('ReduceMean', numLayers * 2, numLayers * 0.2, 'normalization');
      addOp('Sub', numLayers * 2, numLayers * 0.2, 'normalization');
      addOp('Sqrt', numLayers * 2, numLayers * 0.1, 'normalization');
      addOp('Div', numLayers * 2, numLayers * 0.2, 'normalization');
    }

    addOp('Reshape', Math.round(numLayers * 4 * optOpCountMultiplier), numLayers * 0.08, 'shape');
    addOp('Transpose', Math.round(numLayers * 4 * optOpCountMultiplier), numLayers * 0.08, 'shape');
    addOp('Concat', Math.round(numLayers * 1.5), numLayers * 0.05, 'shape');
    
  } else if (config.modality === 'vision') {
    // Convolutional Networks / ViT
    const isViT = pathLower.includes('vit') || pathLower.includes('sam') || pathLower.includes('deit');
    
    if (isViT) {
      let matMulCount = numLayers * 6;
      let matMulMem = numLayers * 11.2 * dtypeScale * optMemMultiplier;

      if (config.optimize === 'O3' || config.optimize === 'O4') {
        matMulCount = Math.round(numLayers * 3 * optOpCountMultiplier);
      }

      if (config.optimize === 'O4') {
        addOp('QLinearMatMul', Math.round(matMulCount * 0.85), matMulMem * 0.22, 'compute');
        addOp('MatMul', Math.round(matMulCount * 0.15), matMulMem * 0.12, 'compute');
        addOp('QuantizeLinear', Math.round(numLayers * 6), numLayers * 0.08, 'memory');
        addOp('DequantizeLinear', Math.round(numLayers * 10), numLayers * 0.12, 'memory');
      } else {
        addOp('MatMul', matMulCount, matMulMem, 'compute');
      }

      addOp('Conv', 2, 8.5 * dtypeScale * optMemMultiplier, 'compute'); // patch projection
      addOp('Add', Math.round(numLayers * 7 * optOpCountMultiplier), numLayers * 0.7 * dtypeScale, 'compute');
      addOp('Softmax', numLayers, numLayers * 1.5 * dtypeScale, 'activation');
      addOp('LayerNormalization', numLayers * 2, numLayers * 0.5 * dtypeScale, 'normalization');
      addOp('Reshape', Math.round(numLayers * 4), numLayers * 0.1, 'shape');
      addOp('Transpose', Math.round(numLayers * 4), numLayers * 0.1, 'shape');
    } else {
      // Standard CNN (ResNet, MobileNet)
      addOp('Conv', Math.round(numLayers * 3 * optOpCountMultiplier), numLayers * 12.8 * dtypeScale * optMemMultiplier, 'compute');
      
      if (config.optimize === 'O4') {
        addOp('QLinearConv', Math.round(numLayers * 2 * optOpCountMultiplier), numLayers * 3.5 * dtypeScale, 'compute');
      }

      addOp('Add', Math.round(numLayers * 1.5 * optOpCountMultiplier), numLayers * 0.4 * dtypeScale, 'compute');
      addOp('BatchNormalization', Math.round(numLayers * 2 * optOpCountMultiplier), numLayers * 0.9 * dtypeScale, 'normalization');
      addOp('Relu', Math.round(numLayers * 1.5 * optOpCountMultiplier), numLayers * 1.1 * dtypeScale, 'activation');
      addOp('GlobalAveragePool', 1, 0.4, 'shape');
      addOp('Flatten', 1, 0.1, 'shape');
    }
  } else {
    // 4. Audio Modality (Conv encoder blocks + Transformer Encoder/Decoder stack, e.g. Whisper)
    // Feature extractor CNN front block
    addOp('Conv1D', 2, 14.5 * dtypeScale * optMemMultiplier, 'compute');
    addOp('Relu', 2, 1.5, 'activation');

    // Attention projections
    let matMulCount = numLayers * 12; // Encoder has N layers, Decoder has N layers
    let matMulMem = numLayers * 22.4 * dtypeScale * optMemMultiplier;

    if (config.optimize === 'O3' || config.optimize === 'O4') {
      matMulCount = Math.round(numLayers * 6 * optOpCountMultiplier);
    }

    if (config.optimize === 'O4') {
      addOp('QLinearMatMul', Math.round(matMulCount * 0.8), matMulMem * 0.22, 'compute');
      addOp('MatMul', Math.round(matMulCount * 0.2), matMulMem * 0.15, 'compute');
      addOp('QuantizeLinear', Math.round(numLayers * 12), numLayers * 0.12, 'memory');
      addOp('DequantizeLinear', Math.round(numLayers * 18), numLayers * 0.2, 'memory');
    } else {
      addOp('MatMul', matMulCount, matMulMem, 'compute');
    }

    addOp('Gather', 4, 34.0 * dtypeScale * optMemMultiplier, 'memory'); // Audio/decoder embeddings
    addOp('Add', Math.round(numLayers * 14 * optOpCountMultiplier), numLayers * 1.4 * dtypeScale, 'compute');
    
    if (config.optimize === 'O3') {
      addOp('FusedAttention', numLayers * 2, numLayers * 10.0 * dtypeScale * optMemMultiplier, 'compute');
    } else {
      addOp('Softmax', numLayers * 2, numLayers * 3.2 * dtypeScale, 'activation');
    }
    
    addOp('LayerNormalization', numLayers * 4, numLayers * 1.2 * dtypeScale, 'normalization');
    addOp('Transpose', Math.round(numLayers * 8 * optOpCountMultiplier), numLayers * 0.2, 'shape');
    addOp('Reshape', Math.round(numLayers * 8 * optOpCountMultiplier), numLayers * 0.2, 'shape');
  }

  // 4. Final aggregation & percentages calculation
  const totalOps = operators.reduce((sum, o) => sum + o.count, 0);
  const totalMemoryMb = Number(operators.reduce((sum, o) => sum + o.memoryMb, 0).toFixed(1));

  const finalOperators = operators.map(op => ({
    ...op,
    percentage: totalOps > 0 ? (op.count / totalOps) * 100 : 0
  })).sort((a, b) => b.count - a.count);

  return {
    status: 'completed',
    modelPath: config.modelPath,
    modality: config.modality,
    opset: config.opset,
    optimize: config.optimize,
    dtype: config.dtype,
    operators: finalOperators,
    totalOps,
    totalMemoryMb,
    isSimulated: true
  };
}
