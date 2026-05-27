import { ColorType, createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';
import { useStore } from '../store';

interface IndicatorData {
  ema20:  { time: number; value: number }[];
  sma200: { time: number; value: number }[];
  ma50:   { time: number; value: number }[];
  ma100:  { time: number; value: number }[];
  ma150:  { time: number; value: number }[];
  bbUpper: { time: number; value: number }[];
  bbMid:   { time: number; value: number }[];
  bbLower: { time: number; value: number }[];
  vwap:   { time: number; value: number }[];
  liquidityZones: { price: number; touches: number; type: string }[];
}

interface SignalMarker {
  id: string;
  time: number;
  direction: 'BUY' | 'SELL';
  strategy: string;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
  confidence: number;
  reason: string;
}

const TF_LIMIT: Record<string,number> = {
  '1m':500,'5m':500,'15m':500,'30m':500,
  '1h':500,'4h':700,'1d':1000,'1w':1000,'1M':500
};
const TF_SPACING: Record<string,number> = {
  '1m':4,'5m':5,'15m':6,'30m':7,
  '1h':8,'4h':10,'1d':12,'1w':16,'1M':24
};

const INDS = [
  {key:'ema20',   label:'EMA 20',   color:'#f59e0b', width:1, dash:0, show:true,  group:'Bot'},
  {key:'bbUpper', label:'BB Upper', color:'#3b82f6', width:1, dash:2, show:true,  group:'Bot'},
  {key:'bbMid',   label:'BB Mid',   color:'#6366f1', width:1, dash:2, show:false, group:'Bot'},
  {key:'bbLower', label:'BB Lower', color:'#3b82f6', width:1, dash:2, show:true,  group:'Bot'},
  {key:'vwap',    label:'VWAP',     color:'#10b981', width:2, dash:0, show:true,  group:'Bot'},
  {key:'ma50',    label:'MA 50',    color:'#fbbf24', width:1, dash:0, show:true,  group:'Dru'},
  {key:'ma100',   label:'MA 100',   color:'#60a5fa', width:1, dash:0, show:true,  group:'Dru'},
  {key:'ma150',   label:'MA 150',   color:'#a78bfa', width:1, dash:0, show:true,  group:'Dru'},
  {key:'sma200',  label:'MA 200',   color:'#ef4444', width:2, dash:0, show:true,  group:'Dru'},
];

export function Chart({ height = 380, flexible = false }: { height?: number; flexible?: boolean }) {
  const { symbol, timeframe, botOffline } = useStore();
  const outerRef     = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const candleRef    = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineRefs     = useRef<Record<string,ISeriesApi<'Line'>>>({});
  const [active, setActive] = useState<Record<string,boolean>>(
    Object.fromEntries(INDS.map(i => [i.key, i.show]))
  );
  const [indicators, setIndicators] = useState<IndicatorData | null>(null);
  const [showLiq, setShowLiq]       = useState(true);
  const [useRealData, setUseRealData] = useState(true);
  const [signals, setSignals]       = useState<SignalMarker[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<SignalMarker | null>(null);
  const [popupPos, setPopupPos]     = useState<{x:number;y:number} | null>(null);
  const signalsRef = useRef<SignalMarker[]>([]);

  // Crear chart UNA SOLA VEZ al montar
  useEffect(() => {
    const el = containerRef.current;
    const outer = outerRef.current;
    if (!el || !outer) return;

    const w = Math.max(300, outer.getBoundingClientRect().width || 780);
    const chart = createChart(el, {
      layout: { background: { type: ColorType.Solid, color: '#0a0e1a' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#1a2236' }, horzLines: { color: '#1a2236' } },
      width: w, height,
      timeScale: { timeVisible:true, secondsVisible:false, borderColor:'#1a2236', barSpacing:TF_SPACING[timeframe]??8, minBarSpacing:1, rightOffset:8 },
      rightPriceScale: { borderColor: '#1a2236' },
      crosshair: { mode: 1 },
    });

    const candles = chart.addCandlestickSeries({
      upColor:'#10b981', downColor:'#ef4444',
      borderUpColor:'#10b981', borderDownColor:'#ef4444',
      wickUpColor:'#10b981', wickDownColor:'#ef4444',
    });

    const lns: Record<string,ISeriesApi<'Line'>> = {};
    for (const ind of INDS) {
      lns[ind.key] = chart.addLineSeries({
        color:ind.color, lineWidth:ind.width as 1|2|3|4,
        lineStyle:ind.dash, priceLineVisible:false,
        lastValueVisible:true, title:ind.label, visible:ind.show,
      });
    }
    chartRef.current = chart;
    candleRef.current = candles;
    lineRefs.current = lns;

    // Click en el chart para detectar flechas de señales
    chart.subscribeClick((param) => {
      if (!param.time || !param.point) return;
      const clickTime = Number(param.time);
      const clickPrice = param.seriesData.get(candles);
      if (!clickPrice) return;

      const sig = signalsRef.current.find(s => {
        const tfSec2 = 3600;
        const sRounded = Math.floor(s.time / 1000 / tfSec2) * tfSec2;
        return Math.abs(sRounded - clickTime) < tfSec2;
      });
      if (sig) {
        setSelectedSignal(sig);
        setPopupPos({ x: param.point.x, y: param.point.y });
      } else {
        setSelectedSignal(null);
        setPopupPos(null);
      }
    });

    const onResize = () => {
      const nw = Math.max(300, outerRef.current?.getBoundingClientRect().width ?? 780);
      chartRef.current?.applyOptions({ width: nw });
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current=null; candleRef.current=null; lineRefs.current={};
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ResizeObserver separado — se activa/desactiva cuando cambia flexible
  useEffect(() => {
    const el = containerRef.current;
    if (!flexible || !el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const h = Math.floor(entry.contentRect.height);
        if (h > 50) chartRef.current?.applyOptions({ height: h });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [flexible]);

  useEffect(() => {
    chartRef.current?.applyOptions({ timeScale: { barSpacing: TF_SPACING[timeframe]??8 } });
  }, [timeframe]);

  // Aplicar height cuando cambia la prop o cuando se vuelve al modo normal (flexible→false)
  useEffect(() => {
    if (!flexible) {
      chartRef.current?.applyOptions({ height });
    }
  }, [height, flexible]);

  useEffect(() => {
    for (const [k,v] of Object.entries(active)) lineRefs.current[k]?.applyOptions({ visible: v });
  }, [active]);

  // Cargar velas, indicadores y signals
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const limit = TF_LIMIT[timeframe] ?? 500;

    async function load() {
      if (!candleRef.current || !chartRef.current) return;
      try {
        const candleUrl = useRealData
          ? `/api/candles-public?symbol=${symbol}&interval=${timeframe}&limit=${limit}`
          : `/api/candles?symbol=${symbol}&interval=${timeframe}&limit=${limit}`;

        const [candles, ind, recentSignals] = await Promise.all([
          fetch(candleUrl).then(r => r.json()),
          fetch(`/api/indicators?symbol=${symbol}&interval=${timeframe}&limit=${limit}`).then(r=>r.json() as Promise<IndicatorData>),
          fetch(`/api/signals?limit=50`).then(r=>r.json()),
        ]);
        if (cancelled || !candleRef.current || !chartRef.current) return;

        candleRef.current.setData(
          (candles as {openTime:number;open:number;high:number;low:number;close:number}[])
            .map(c => ({ time:(c.openTime/1000) as Time, open:c.open, high:c.high, low:c.low, close:c.close }))
        );

        const toS = (a:{time:number;value:number}[]=[]) => a.map(p=>({ time:p.time as Time, value:p.value }));
        lineRefs.current['ema20']?.setData(toS(ind.ema20));
        lineRefs.current['sma200']?.setData(toS(ind.sma200));
        lineRefs.current['ma50']?.setData(toS(ind.ma50));
        lineRefs.current['ma100']?.setData(toS(ind.ma100));
        lineRefs.current['ma150']?.setData(toS(ind.ma150));
        lineRefs.current['bbUpper']?.setData(toS(ind.bbUpper));
        lineRefs.current['bbMid']?.setData(toS(ind.bbMid));
        lineRefs.current['bbLower']?.setData(toS(ind.bbLower));
        lineRefs.current['vwap']?.setData(toS(ind.vwap));
        setIndicators(ind);

        // Markers de signals en el chart (flechas)
        const sigs: SignalMarker[] = (recentSignals as {
          id:string; createdAt:string; direction:'BUY'|'SELL'; strategy:string;
          entryPrice:number; stopLoss:number; targetPrice:number; confidence:number; reason:string; symbol:string; timeframe:string;
        }[])
          .filter(s => s.symbol === symbol && s.timeframe === timeframe)
          .map(s => ({
            id: s.id,
            time: new Date(s.createdAt).getTime(),
            direction: s.direction,
            strategy: s.strategy,
            entryPrice: s.entryPrice,
            stopLoss: s.stopLoss,
            targetPrice: s.targetPrice,
            confidence: s.confidence,
            reason: s.reason,
          }));

        signalsRef.current = sigs;
        setSignals(sigs);

        // Setear markers — redondear al inicio de la vela segun timeframe
        const tfSeconds: Record<string,number> = {
          '1m':60,'5m':300,'15m':900,'30m':1800,
          '1h':3600,'4h':14400,'1d':86400,'1w':604800,'1M':2592000
        };
        const tfSec = tfSeconds[timeframe] ?? 3600;
        const roundToCandle = (ms: number) => Math.floor(ms / 1000 / tfSec) * tfSec;

        const markerMap = new Map<number, typeof sigs[0]>();
        for (const s of sigs) {
          const t = roundToCandle(s.time);
          // Si ya hay uno en esa vela, quedarse con el mas reciente
          if (!markerMap.has(t) || s.time > markerMap.get(t)!.time) {
            markerMap.set(t, s);
          }
        }

        candleRef.current.setMarkers(
          Array.from(markerMap.entries())
            .sort((a,b) => a[0] - b[0])
            .map(([t, s]) => ({
              time: t as Time,
              position: s.direction === 'BUY' ? 'belowBar' : 'aboveBar',
              color: s.direction === 'BUY' ? '#10b981' : '#ef4444',
              shape: s.direction === 'BUY' ? 'arrowUp' : 'arrowDown',
              size: 2,
              text: s.strategy,
            }))
        );

        chartRef.current.timeScale().scrollToRealTime();
      } catch(e) { console.error('Chart', e); }
    }

    const t0 = setTimeout(() => { load(); timer = setInterval(load, 15000); }, 300);
    return () => { cancelled=true; clearTimeout(t0); if(timer) clearInterval(timer); };
  }, [symbol, timeframe, useRealData]);

  const lastPrice = indicators?.vwap?.slice(-1)[0]?.value ?? 0;
  const botInds = INDS.filter(i => i.group === 'Bot');
  const druInds = INDS.filter(i => i.group === 'Dru');

  return (
    <div className={`card${flexible ? ' h-full flex flex-col' : ''}`} ref={outerRef}>
      {/* Header */}
      <div className='card-header flex items-center gap-2 flex-wrap shrink-0'>
        <span className='font-semibold'>{symbol} · {timeframe}</span>

        <button onClick={() => setUseRealData(p=>!p)}
          className='px-2 py-0.5 rounded text-[11px] font-medium border transition-all'
          style={useRealData ? {borderColor:'#10b981',color:'#10b981',backgroundColor:'#10b98111'} : {borderColor:'#374151',color:'#6b7280',backgroundColor:'transparent'}}
        >{useRealData ? '🌐 Real' : '🧪 Testnet'}</button>

        <span className='text-gray-700 text-[11px]'>Bot:</span>
        <div className='flex items-center gap-1'>
          {botInds.map(ind => (
            <button key={ind.key} onClick={()=>setActive(p=>({...p,[ind.key]:!p[ind.key]}))}
              className='px-2 py-0.5 rounded text-[11px] font-medium border transition-all'
              style={active[ind.key] ? {backgroundColor:ind.color+'22',borderColor:ind.color,color:ind.color} : {borderColor:'#374151',color:'#6b7280',backgroundColor:'transparent'}}
            >{ind.label}</button>
          ))}
        </div>

        <span className='text-gray-700 text-[11px]'>Dru:</span>
        <div className='flex items-center gap-1'>
          {druInds.map(ind => (
            <button key={ind.key} onClick={()=>setActive(p=>({...p,[ind.key]:!p[ind.key]}))}
              className='px-2 py-0.5 rounded text-[11px] font-medium border transition-all'
              style={active[ind.key] ? {backgroundColor:ind.color+'22',borderColor:ind.color,color:ind.color} : {borderColor:'#374151',color:'#6b7280',backgroundColor:'transparent'}}
            >{ind.label}</button>
          ))}
        </div>

        <button onClick={() => setShowLiq(p=>!p)}
          className='px-2 py-0.5 rounded text-[11px] font-medium border transition-all'
          style={showLiq ? {borderColor:'#f97316',color:'#fb923c',backgroundColor:'#f9731611'} : {borderColor:'#374151',color:'#6b7280',backgroundColor:'transparent'}}
        >Liquidez</button>

        {botOffline && (
          <span className='text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded'>
            👁 Solo señales
          </span>
        )}

        <span className='ml-auto text-[11px] text-gray-500'>{TF_LIMIT[timeframe]??500} velas · auto 15s</span>
      </div>

      {/* Gráfico con popup de señal */}
      <div className={`relative${flexible ? ' flex-1 min-h-0' : ''}`}>
        <div ref={containerRef} className='w-full' style={flexible ? { height: '100%' } : { height: `${height}px` }} />

        {/* Popup de señal al hacer click en flecha */}
        {selectedSignal && popupPos && (
          <div
            className='absolute z-50 bg-bg-panel border border-bg-subtle rounded-lg shadow-xl p-3 w-64 text-xs'
            style={{
              left: Math.min(popupPos.x + 10, (outerRef.current?.clientWidth ?? 800) - 280),
              top: Math.max(popupPos.y - 10, 10),
            }}
          >
            <div className='flex items-center justify-between mb-2'>
              <span className={`font-semibold ${selectedSignal.direction === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                {selectedSignal.direction === 'BUY' ? '▲ LONG' : '▼ SHORT'} — {selectedSignal.strategy}
              </span>
              <button onClick={() => { setSelectedSignal(null); setPopupPos(null); }} className='text-gray-500 hover:text-gray-300 text-base leading-none'>×</button>
            </div>
            <div className='space-y-1 font-mono text-gray-300'>
              <div className='flex justify-between'><span className='text-gray-500'>Entry</span><span>{selectedSignal.entryPrice.toFixed(2)}</span></div>
              <div className='flex justify-between'><span className='text-gray-500'>Stop Loss</span><span className='text-red-400'>{selectedSignal.stopLoss.toFixed(2)}</span></div>
              <div className='flex justify-between'><span className='text-gray-500'>Target</span><span className='text-green-400'>{selectedSignal.targetPrice.toFixed(2)}</span></div>
              <div className='flex justify-between'><span className='text-gray-500'>R:R</span>
                <span>{selectedSignal.direction === 'BUY'
                  ? ((selectedSignal.targetPrice - selectedSignal.entryPrice) / (selectedSignal.entryPrice - selectedSignal.stopLoss)).toFixed(1)
                  : ((selectedSignal.entryPrice - selectedSignal.targetPrice) / (selectedSignal.stopLoss - selectedSignal.entryPrice)).toFixed(1)
                }:1</span>
              </div>
              <div className='flex justify-between'><span className='text-gray-500'>Confianza</span><span>{(selectedSignal.confidence * 100).toFixed(0)}%</span></div>
            </div>
            <div className='mt-2 text-gray-500 text-[10px] border-t border-bg-subtle pt-2 leading-relaxed'>
              {selectedSignal.reason}
            </div>
          </div>
        )}
      </div>

      {/* Zonas de liquidez */}
      {showLiq && indicators && indicators.liquidityZones.length > 0 && (
        <div className='mt-2 flex flex-wrap gap-1.5 items-center'>
          <span className='text-[11px] text-gray-500'>Liquidez:</span>
          {indicators.liquidityZones.slice(0,10).map((z,i) => {
            const dist = lastPrice>0 ? ((z.price-lastPrice)/lastPrice*100) : 0;
            const isR = z.type==='resistance';
            return (
              <span key={i} className='text-[11px] font-mono px-1.5 py-0.5 rounded cursor-default'
                style={isR?{backgroundColor:'#ef444422',color:'#f87171'}:{backgroundColor:'#10b98122',color:'#34d399'}}>
                {isR?'R':'S'} {z.price.toFixed(z.price>100?0:4)}
                <span style={{color:'#6b7280',marginLeft:3}}>{dist>0?'+':''}{dist.toFixed(1)}% x{z.touches}</span>
              </span>
            );
          })}
          <span className='text-[10px] text-gray-600 ml-1'>R=resist S=soporte xN=veces testeado</span>
        </div>
      )}
    </div>
  );
}
