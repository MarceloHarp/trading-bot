import {
  CandlestickSeries,
  ColorType,
  createChart,
  IChartApi,
  ISeriesApi,
  Time,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import { useStore } from '../store';

export function Chart() {
  const { symbol, timeframe } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // crear el chart 1 sola vez
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0e1a' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1a2236' },
        horzLines: { color: '#1a2236' },
      },
      width: containerRef.current.clientWidth,
      height: 480,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#1a2236',
      },
      rightPriceScale: { borderColor: '#1a2236' },
      crosshair: { mode: 1 },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // cargar datos cuando cambia symbol o timeframe
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const candles = await apiService.getCandles(symbol, timeframe, 300);
        if (cancelled || !seriesRef.current) return;
        seriesRef.current.setData(
          candles.map((c) => ({
            time: (c.openTime / 1000) as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
        chartRef.current?.timeScale().fitContent();
      } catch (err) {
        console.error('Chart load error', err);
      }
    }

    load();
    interval = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [symbol, timeframe]);

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <span>
          {symbol} · {timeframe}
        </span>
        <span className="text-xs text-gray-500">auto-refresh 10s</span>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
