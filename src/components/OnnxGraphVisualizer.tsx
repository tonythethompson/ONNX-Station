import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useWorkbench } from '../WorkbenchContext';
import { Cpu, Database, HelpCircle, HardDrive, Layers, RefreshCw } from 'lucide-react';
import { CompiledModelOperator } from '../types';

export function OnnxGraphVisualizer() {
  const { compiledModelInfo, isExporting, config, startExport } = useWorkbench();
  const barChartRef = useRef<SVGSVGElement | null>(null);
  const donutChartRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoveredOp, setHoveredOp] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 400, height: 260 });

  // Handle responsiveness of SVG canvases
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      const nextWidth = Math.max(300, Math.floor(width));
      setSize((prev) => {
        if (prev.width === nextWidth) {
          return prev;
        }
        return {
          width: nextWidth,
          height: 280
        };
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const d3OpData = compiledModelInfo?.operators || [];
  const maxMemoryOp = d3OpData.length > 0 ? d3OpData.reduce((prev, current) => (prev.memoryMb > current.memoryMb) ? prev : current) : null;

  const categoryColors: Record<string, string> = {
    compute: '#10b981',      // Emerald
    memory: '#a855f7',       // Purple
    activation: '#f59e0b',   // Amber
    normalization: '#38bdf8',// Sky
    shape: '#64748b'        // Slate
  };

  const getMemColor = (op: CompiledModelOperator, isHovered: boolean) => {
    const isMaxMem = maxMemoryOp && op.opType === maxMemoryOp.opType;
    if (isMaxMem) {
      return isHovered ? '#ef4444' : '#f97316'; // Vivid red-orange for heavy bottleneck
    }
    if (op.memoryMb > 15) {
      return isHovered ? '#eab308' : '#eab308cc'; // Warning yellow
    }
    if (op.category === 'compute') {
      return isHovered ? '#34d399' : '#10b98199'; // Emerald
    }
    if (op.category === 'memory') {
      return isHovered ? '#c084fc' : '#8b5cf699'; // Purple
    }
    return isHovered ? '#64748b' : '#334155'; // Muted slates for structural layers
  };

  // Render D3 Horizontal Bar Chart (Operator Counts) - runs ONLY when data or canvas dimensions change
  useEffect(() => {
    if (!barChartRef.current || d3OpData.length === 0 || isExporting) return;

    // Clear previous elements
    const svgEl = d3.select(barChartRef.current);
    svgEl.selectAll('*').remove();

    const margin = { top: 15, right: 25, bottom: 30, left: 110 };
    const panelWidth = Math.floor(size.width * 0.55) - margin.left - margin.right;
    const panelHeight = size.height - margin.top - margin.bottom;

    if (panelWidth <= 0) return;

    const svg = svgEl
      .attr('width', panelWidth + margin.left + margin.right)
      .attr('height', panelHeight + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X axis: Count of operators
    const maxVal = d3.max(d3OpData, (d: CompiledModelOperator) => d.count) || 10;
    const x = d3.scaleLinear()
      .domain([0, maxVal])
      .range([0, panelWidth]);

    svg.append('g')
      .attr('transform', `translate(0, ${panelHeight})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(-panelHeight).tickFormat(d3.format('d')))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line')
        .attr('stroke', '#1e293b')
        .attr('stroke-dasharray', '2,2')
      )
      .call(g => g.selectAll('.tick text')
        .attr('fill', '#64748b')
        .attr('font-size', '9px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas')
      );

    // Y axis: Operator types
    const y = d3.scaleBand()
      .range([0, panelHeight])
      .domain(d3OpData.map(d => d.opType))
      .padding(0.25);

    svg.append('g')
      .call(d3.axisLeft(y).tickSize(0))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas')
        .attr('dx', '-8px')
      );

    // Draw bars
    svg.selectAll('rect.op-bar')
      .data(d3OpData)
      .enter()
      .append('rect')
      .attr('class', 'op-bar')
      .attr('x', 0)
      .attr('y', d => y((d as CompiledModelOperator).opType) || 0)
      .attr('height', y.bandwidth())
      .attr('rx', 3)
      .attr('fill', d => {
        const item = d as CompiledModelOperator;
        const color = categoryColors[item.category] || '#475569';
        return d3.color(color)?.darker(0.35).toString() || color;
      })
      .attr('stroke', d => {
        const item = d as CompiledModelOperator;
        const color = categoryColors[item.category] || '#475569';
        return color;
      })
      .attr('stroke-width', 0.8)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        setHoveredOp((d as CompiledModelOperator).opType);
      })
      .on('mouseleave', () => {
        setHoveredOp(null);
      })
      // Animate transition starting width from 0
      .attr('width', 0)
      .transition()
      .duration(800)
      .delay((_d, i) => i * 35)
      .attr('width', d => x((d as CompiledModelOperator).count));

    // Draw value labels next to bars
    svg.selectAll('text.value-lbl')
      .data(d3OpData)
      .enter()
      .append('text')
      .attr('class', 'value-lbl')
      .attr('x', d => x((d as CompiledModelOperator).count) + 5)
      .attr('y', d => (y((d as CompiledModelOperator).opType) || 0) + y.bandwidth()/2 + 3)
      .attr('fill', '#64748b')
      .attr('font-size', '9px')
      .attr('font-family', 'font-sans, system-ui')
      .attr('font-weight', '400')
      .text(d => (d as CompiledModelOperator).count);

  }, [d3OpData, size, isExporting]);

  // Dynamic Hover Style Updates for Bar Chart - triggers on hoveredOp updates
  useEffect(() => {
    if (!barChartRef.current || d3OpData.length === 0 || isExporting) return;
    const svg = d3.select(barChartRef.current);

    svg.selectAll('rect.op-bar')
      .data(d3OpData)
      .transition()
      .duration(150)
      .attr('fill', d => {
        const item = d as CompiledModelOperator;
        const isHovered = hoveredOp === item.opType;
        const color = categoryColors[item.category] || '#475569';
        return isHovered ? color : d3.color(color)?.darker(0.35).toString() || color;
      })
      .attr('stroke', d => {
        const item = d as CompiledModelOperator;
        const isHovered = hoveredOp === item.opType;
        const color = categoryColors[item.category] || '#475569';
        return isHovered ? '#ffffff' : color;
      })
      .attr('stroke-width', d => hoveredOp === (d as CompiledModelOperator).opType ? 1.5 : 0.8);

    svg.selectAll('text.value-lbl')
      .data(d3OpData)
      .transition()
      .duration(150)
      .attr('fill', d => hoveredOp === (d as CompiledModelOperator).opType ? '#f8fafc' : '#64748b')
      .attr('font-weight', d => hoveredOp === (d as CompiledModelOperator).opType ? '700' : '400');
  }, [hoveredOp, d3OpData, isExporting]);

  // Render D3 Donut Chart Structure - runs ONLY when data or canvas dimensions change
  useEffect(() => {
    if (!donutChartRef.current || d3OpData.length === 0 || isExporting) return;

    const svgEl = d3.select(donutChartRef.current);
    svgEl.selectAll('*').remove();

    const panelWidth = Math.floor(size.width * 0.45);
    const panelHeight = size.height;
    const radius = Math.min(panelWidth, panelHeight) / 2 - 20;

    if (panelWidth <= 0 || radius <= 0) return;

    const svg = svgEl
      .attr('width', panelWidth)
      .attr('height', panelHeight)
      .append('g')
      .attr('transform', `translate(${panelWidth / 2}, ${panelHeight / 2})`);

    // Prepare pie generator
    const pie = d3.pie<CompiledModelOperator>()
      .value(d => d.memoryMb)
      .sort(null); // keep sorted order from props

    const arc = d3.arc<d3.PieArcDatum<CompiledModelOperator>>()
      .innerRadius(radius * 0.58)
      .outerRadius(radius)
      .cornerRadius(2);

    const arcs = svg.selectAll('g.slice')
      .data(pie(d3OpData))
      .enter()
      .append('g')
      .attr('class', 'slice');

    arcs.append('path')
      .attr('class', 'slice-path')
      .attr('d', arc)
      .attr('fill', d => getMemColor(d.data, false))
      .attr('stroke', '#08090b')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        setHoveredOp(d.data.opType);
      })
      .on('mouseleave', () => {
        setHoveredOp(null);
      })
      .style('opacity', 0)
      .transition()
      .duration(700)
      .style('opacity', 1);

    // Inner center metrics container
    const centerGroup = svg.append('g')
      .attr('class', 'center-metrics')
      .attr('text-anchor', 'middle');

    centerGroup.append('text')
      .attr('class', 'center-title')
      .attr('y', -6)
      .attr('fill', '#94a3b8')
      .attr('font-size', '8px')
      .attr('font-family', 'font-sans, system-ui')
      .attr('font-weight', '600')
      .attr('letter-spacing', '0.05em')
      .text('TOTAL EST.');

    centerGroup.append('text')
      .attr('class', 'center-value')
      .attr('y', 8)
      .attr('fill', '#cbd5e1')
      .attr('font-size', '14px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas')
      .attr('font-weight', 'bold')
      .text(`${compiledModelInfo?.totalMemoryMb || 120} MB`);

    centerGroup.append('text')
      .attr('class', 'center-subtitle')
      .attr('y', 19)
      .attr('fill', '#475569')
      .attr('font-size', '7px')
      .attr('letter-spacing', '0.02em')
      .text('INTERMEDIATES');

  }, [d3OpData, size, isExporting, maxMemoryOp, compiledModelInfo?.totalMemoryMb]);

  // Dynamic Hover Updates for Donut Chart Slices & Text
  useEffect(() => {
    if (!donutChartRef.current || d3OpData.length === 0 || isExporting) return;

    const panelWidth = Math.floor(size.width * 0.45);
    const panelHeight = size.height;
    const radius = Math.min(panelWidth, panelHeight) / 2 - 20;

    if (panelWidth <= 0 || radius <= 0) return;

    const svg = d3.select(donutChartRef.current);

    const arc = d3.arc<d3.PieArcDatum<CompiledModelOperator>>()
      .innerRadius(radius * 0.58)
      .outerRadius(d => {
        return hoveredOp === d.data.opType ? radius * 1.08 : radius;
      })
      .cornerRadius(2);

    svg.selectAll('path.slice-path')
      .transition()
      .duration(200)
      .attr('d', arc as any)
      .attr('fill', d => getMemColor((d as any).data, hoveredOp === (d as any).data.opType));

    const centerTitle = svg.select('text.center-title');
    const centerValue = svg.select('text.center-value');
    const centerSubtitle = svg.select('text.center-subtitle');

    if (hoveredOp) {
      const activeOpData = d3OpData.find(o => o.opType === hoveredOp);
      if (activeOpData) {
        centerTitle
          .attr('y', -4)
          .attr('fill', '#f1f5f9')
          .attr('font-size', '10px')
          .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas')
          .attr('font-weight', '700')
          .text(activeOpData.opType.length > 10 ? activeOpData.opType.slice(0, 9) + '..' : activeOpData.opType);

        centerValue
          .attr('y', 10)
          .attr('fill', '#ea580c')
          .attr('font-size', '11px')
          .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas')
          .attr('font-weight', 'bold')
          .text(`${activeOpData.memoryMb} MB`);

        centerSubtitle
          .attr('y', 21)
          .attr('fill', '#64748b')
          .attr('font-size', '8px')
          .attr('font-family', 'font-sans, system-ui')
          .attr('font-weight', '400')
          .attr('letter-spacing', 'normal')
          .text('Allocated VRAM');
      }
    } else {
      // Default: Total Memory footprint
      centerTitle
        .attr('y', -6)
        .attr('fill', '#94a3b8')
        .attr('font-size', '8px')
        .attr('font-family', 'font-sans, system-ui')
        .attr('font-weight', '600')
        .attr('letter-spacing', '0.05em')
        .text('TOTAL EST.');

      centerValue
        .attr('y', 8)
        .attr('fill', '#cbd5e1')
        .attr('font-size', '14px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas')
        .attr('font-weight', 'bold')
        .text(`${compiledModelInfo?.totalMemoryMb || 120} MB`);

      centerSubtitle
        .attr('y', 19)
        .attr('fill', '#475569')
        .attr('font-size', '7px')
        .attr('font-family', 'font-sans, system-ui')
        .attr('font-weight', '400')
        .attr('letter-spacing', '0.02em')
        .text('INTERMEDIATES');
    }
  }, [hoveredOp, d3OpData, size, isExporting, maxMemoryOp, compiledModelInfo?.totalMemoryMb]);

  return (
    <div className="flex flex-col border border-[#334155] bg-[#08090b] rounded overflow-hidden shadow-md">
      {/* Visualizer header */}
      <div className="h-8 border-b border-[#334155] bg-[#1a1d23] px-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
            ONNX Operator Distribution & VRAM Map
          </span>
        </div>
        <span className="text-[8px] font-mono text-slate-500 bg-[#0f1115] px-2 py-0.5 rounded border border-slate-800/80">
          OPSET {compiledModelInfo?.opset || config.opset} • {config.dtype}
        </span>
      </div>

      {/* Compiler pipeline log tracker / loading state */}
      <div className="relative p-4 bg-[#0a0c0f]" ref={containerRef}>
        {isExporting ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/10 border-t-emerald-400 animate-spin"></div>
              <Cpu className="w-5 h-5 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="space-y-1.5 animate-pulse max-w-sm">
              <div className="text-[11px] font-mono text-emerald-400 uppercase font-bold tracking-wider">
                Intercepting ONNX Operator Streams...
              </div>
              <div className="text-[9px] font-mono text-slate-500 leading-relaxed">
                Tracing dynamic weight variables and compiling graph transformations to optimize intermediate tensor allocations.
              </div>
            </div>
          </div>
        ) : d3OpData.length === 0 ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-center p-6 space-y-3.5">
            <HardDrive className="w-8 h-8 text-slate-600 animate-bounce" />
            <div className="space-y-1">
              <div className="text-xs font-mono font-bold text-slate-400">GRAPH UNCOMPILED</div>
              <div className="text-[10px] font-mono text-slate-600 max-w-xs leading-normal">
                No active ONNX operator database is loaded in model memory. Trigger the compiler build above.
              </div>
            </div>
            <button
              onClick={startExport}
              className="text-[10px] font-mono bg-slate-800 hover:bg-slate-700 hover:text-emerald-400 text-slate-300 border border-slate-700 hover:border-emerald-500/40 px-3 py-1.5 rounded transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              COMPILE NOW
            </button>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Counts Visualization Bar Chart column */}
            <div className="flex-1 flex flex-col items-center select-none">
              <div className="text-[9px] font-mono font-600 text-slate-400 mb-1 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-emerald-400" />
                OPERATOR INSTANCE COUNTS (FREQUENCY)
              </div>
              <svg ref={barChartRef} className="overflow-visible" />
            </div>

            {/* VRAM Donut highlighting heavy sections */}
            <div className="flex-shrink-0 flex flex-col items-center justify-center relative select-none">
              <div className="text-[9px] font-mono font-600 text-slate-400 mb-1 flex items-center gap-1">
                <Database className="w-3 h-3 text-orange-400" />
                ESTIMATED VRAM HIGHLIGHT (MB)
              </div>
              <svg ref={donutChartRef} className="overflow-visible" />
            </div>
          </div>
        )}
      </div>

      {/* Analysis Footer */}
      {!isExporting && d3OpData.length > 0 && (
        <div className="border-t border-[#334155]/60 bg-[#0c0d10] p-3 text-[10px] font-mono text-slate-500 leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-3 divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
          <div className="flex items-start gap-2.5">
            <Cpu className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-300 font-bold block">Operator Node Profiling</span>
              The model maps <span className="text-slate-200 font-bold">{compiledModelInfo.totalOps}</span> standard and fused operations inside the runtime workspace. Higher graph optimization levels reduce node frequency via unified sub-graph kernels.
            </div>
          </div>
          <div className="flex items-start gap-2.5 pt-2 md:pt-0 md:pl-3">
            <HardDrive className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-300 font-bold block">Peak VRAM Memory Allocation</span>
              {maxMemoryOp ? (
                <>
                  Heavyweight layer weights block <span className="text-red-400 font-bold">{maxMemoryOp.opType}</span> as the main bottleneck, demanding <span className="text-orange-400 font-extrabold">{maxMemoryOp.memoryMb} MB</span>. Reducing memory format (`--dtype fp16`) mitigates memory bandwidth bottlenecks.
                </>
              ) : (
                'Memory layouts are fully optimized with minimal intermediate copy instructions.'
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
