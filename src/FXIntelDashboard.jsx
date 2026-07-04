import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity, Wifi, Cpu, Clock, Zap, Download,
  TrendingUp, TrendingDown, BarChart3, Target, ShieldCheck,
} from 'lucide-react';

/* ============================================================== */
/*  CONFIG + MOCK DATA ENGINE                                      */
/*  All "live" values in this dashboard are deterministic mock     */
/*  data generated client-side — there is no real market feed.     */
/* ============================================================== */

const PAIRS = {
  'EUR/USD': { decimals: 4, base: 1.0850, volatility: 0.0009 },
  'GBP/USD': { decimals: 4, base: 1.2680, volatility: 0.0012 },
  'USD/JPY': { decimals: 3, base: 156.240, volatility: 0.14 },
};
const PAIR_KEYS = Object.keys(PAIRS);

// Deterministic PRNG so each pair gets a stable-looking random walk
// instead of reshuffling on every re-render.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedFromString = (str) =>
  str.split('').reduce((acc, ch) => acc + ch.charCodeAt(0) * 31, 7);

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const fmt = (value, decimals) => value.toFixed(decimals);

/** Build a synthetic OHLC candle series and a handful of BUY/SELL
 *  signals placed at local price extremes, so the chart always looks
 *  "model annotated". */
function generateCandles(pairKey, count = 44) {
  const cfg = PAIRS[pairKey];
  const rand = mulberry32(seedFromString(pairKey));
  let price = cfg.base;
  const candles = [];

  for (let i = 0; i < count; i++) {
    const open = price;
    const drift = (rand() - 0.48) * cfg.volatility;
    const close = open + drift;
    const high = Math.max(open, close) + rand() * cfg.volatility * 0.7;
    const low = Math.min(open, close) - rand() * cfg.volatility * 0.7;
    candles.push({ open, high, low, close });
    price = close;
  }

  const signals = [];
  for (let i = 5; i < count - 3; i++) {
    const win = candles.slice(i - 4, i + 3).map((c) => c.close);
    const isLow = candles[i].close === Math.min(...win);
    const isHigh = candles[i].close === Math.max(...win);
    if (isLow && rand() > 0.62) signals.push({ index: i, type: 'BUY' });
    if (isHigh && rand() > 0.66) signals.push({ index: i, type: 'SELL' });
  }
  return { candles, signals: signals.slice(-6) };
}

/** Derive an internally-consistent set of ML/indicator readings from
 *  the actual generated trend, so RSI / MACD / confidence / the final
 *  recommendation all agree with the direction the chart is moving. */
function initIndicators(pairKey, candles) {
  const rand = mulberry32(seedFromString(pairKey + '::indicators'));
  const first = candles[0].open;
  const last = candles[candles.length - 1].close;
  const trendPct = (last - first) / first;
  const direction = trendPct >= 0 ? 'bullish' : 'bearish';
  const strength = clamp(Math.abs(trendPct) * 40, 0, 1);

  const atr = candles.slice(-14).reduce((s, c) => s + (c.high - c.low), 0) / 14;

  const rsiBase = direction === 'bullish' ? 50 + strength * 26 : 50 - strength * 26;
  const stochBase = direction === 'bullish' ? 52 + strength * 30 : 48 - strength * 30;
  const macdHist = (direction === 'bullish' ? 1 : -1) * (0.15 + strength * 0.7) * atr;
  const confidence = clamp(58 + strength * 34 + rand() * 4, 55, 93);

  const featBase = [
    { label: 'Moving Averages', value: 40 },
    { label: 'RSI', value: 25 },
    { label: 'MACD', value: 20 },
    { label: 'Fibonacci Levels', value: 15 },
  ];
  const jittered = featBase.map((f) => Math.max(4, f.value + (rand() - 0.5) * 8));
  const total = jittered.reduce((a, b) => a + b, 0);
  const featureImportance = featBase.map((f, i) => ({
    label: f.label,
    value: Math.round((jittered[i] / total) * 100),
  }));

  return {
    direction,
    atr,
    rsi: clamp(rsiBase, 5, 95),
    stochK: clamp(stochBase, 5, 95),
    macdHist,
    macdState: strength > 0.45 ? (direction === 'bullish' ? 'bullish_cross' : 'bearish_cross') : 'holding',
    confidence,
    featureImportance,
  };
}

function recommendationFor(confidence, direction) {
  if (direction === 'bullish') {
    if (confidence >= 78) return { label: 'STRONG BUY', tone: 'buy' };
    if (confidence >= 62) return { label: 'BUY', tone: 'buy' };
    return { label: 'WEAK BUY', tone: 'buy' };
  }
  if (confidence >= 78) return { label: 'STRONG SELL', tone: 'sell' };
  if (confidence >= 62) return { label: 'SELL', tone: 'sell' };
  return { label: 'WEAK SELL', tone: 'sell' };
}

/* ============================================================== */
/*  SMALL PRESENTATIONAL PRIMITIVES                                 */
/* ============================================================== */

const cx = (...parts) => parts.filter(Boolean).join(' ');

function StatusDot({ color }) {
  const solid = color === 'emerald' ? 'bg-emerald-400' : 'bg-cyan-400';
  return (
    <span className="relative flex h-2 w-2">
      <span className={cx('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', solid)} />
      <span className={cx('relative inline-flex rounded-full h-2 w-2', solid)} />
    </span>
  );
}

function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-slate-800 border-slate-700 text-slate-300',
    buy: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    sell: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    warn: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  };
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap', tones[tone])}>
      {children}
    </span>
  );
}

function ModelBadge({ icon: Icon, label, value }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-300">
      <Icon size={13} className="text-cyan-400" />
      {label}
      <span className="font-mono-custom font-semibold text-slate-100">{value}</span>
    </span>
  );
}

/* ============================================================== */
/*  CANDLESTICK CHART                                               */
/* ============================================================== */

function CandlestickChart({ candles, signals, direction }) {
  const width = 800;
  const height = 300;
  const marginTop = 26;
  const marginBottom = 26;
  const plotH = height - marginTop - marginBottom;

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const priceMax = Math.max(...highs);
  const priceMin = Math.min(...lows);
  const pad = (priceMax - priceMin) * 0.12 || priceMax * 0.001;
  const domainMax = priceMax + pad;
  const domainMin = priceMin - pad;

  const candleW = width / candles.length;
  const bodyW = Math.max(2, candleW * 0.55);
  const yScale = (price) =>
    marginTop + (1 - (price - domainMin) / (domainMax - domainMin)) * plotH;

  const lastClose = candles[candles.length - 1].close;
  const lastY = yScale(lastClose);
  const lastX = (candles.length - 1) * candleW + candleW / 2;
  const lineColor = direction === 'bullish' ? 'stroke-emerald-400' : 'stroke-rose-400';
  const dotColor = direction === 'bullish' ? 'fill-emerald-400' : 'fill-rose-400';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: '300px' }} preserveAspectRatio="none">
      {/* live price reference line */}
      <line x1="0" y1={lastY} x2={width} y2={lastY} strokeDasharray="4 4" strokeWidth="1" className={cx(lineColor, 'opacity-40')} />

      {/* candles */}
      {candles.map((c, i) => {
        const x = i * candleW + candleW / 2;
        const up = c.close >= c.open;
        const color = up ? 'fill-emerald-500 stroke-emerald-500' : 'fill-rose-500 stroke-rose-500';
        const bodyTop = yScale(Math.max(c.open, c.close));
        const bodyBottom = yScale(Math.min(c.open, c.close));
        const bodyH = Math.max(1.5, bodyBottom - bodyTop);
        return (
          <g key={i}>
            <line x1={x} y1={yScale(c.high)} x2={x} y2={yScale(c.low)} className={color} strokeWidth="1" />
            <rect x={x - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} className={color} />
          </g>
        );
      })}

      {/* ML signal markers */}
      {signals.map((s, idx) => {
        const c = candles[s.index];
        const x = s.index * candleW + candleW / 2;
        const isBuy = s.type === 'BUY';
        const y = isBuy ? yScale(c.low) + 15 : yScale(c.high) - 15;
        const points = isBuy
          ? `${x - 5},${y + 5} ${x + 5},${y + 5} ${x},${y - 5}`
          : `${x - 5},${y - 5} ${x + 5},${y - 5} ${x},${y + 5}`;
        return (
          <polygon key={`sig-${idx}`} points={points} className={isBuy ? 'fill-emerald-400' : 'fill-rose-400'} />
        );
      })}

      {/* live pulse on last candle */}
      <circle cx={lastX} cy={lastY} r="6" className={cx(dotColor, 'opacity-40 animate-ping')} />
      <circle cx={lastX} cy={lastY} r="3" className={dotColor} />
    </svg>
  );
}

/* ============================================================== */
/*  ML ANALYTICS PRIMITIVES                                         */
/* ============================================================== */

function ConfidenceGauge({ confidence, direction }) {
  const stroke = direction === 'bullish' ? 'stroke-emerald-400' : 'stroke-rose-400';
  const text = direction === 'bullish' ? 'text-emerald-400' : 'text-rose-400';
  const label = direction === 'bullish' ? 'Bullish Continuation' : 'Bearish Continuation';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full" style={{ maxWidth: '220px' }}>
        <svg viewBox="0 0 200 110" className="w-full">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" strokeWidth="14" strokeLinecap="round" pathLength="100" className="stroke-slate-800" />
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            strokeWidth="14"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${confidence} 100`}
            className={stroke}
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className={cx('font-mono-custom text-3xl font-bold', text)}>{Math.round(confidence)}%</span>
        </div>
      </div>
      <p className={cx('text-sm font-semibold mt-1', text)}>{label}</p>
      <p className="text-xs text-slate-500 tracking-wide uppercase">Directional Confidence</p>
    </div>
  );
}

function FeatureBar({ label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs text-slate-400">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${value}%`, transition: 'width 0.8s ease' }} />
      </div>
      <span className="w-9 text-right font-mono-custom text-xs text-slate-300">{value}%</span>
    </div>
  );
}

/* ============================================================== */
/*  INDICATOR TABLE ROW                                             */
/* ============================================================== */

function IndicatorRow({ name, sub, value, badge }) {
  return (
    <div className="grid grid-cols-12 items-center gap-2 px-5 py-3">
      <div className="col-span-5">
        <p className="text-sm font-medium text-slate-200">{name}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
      <div className="col-span-3 font-mono-custom text-sm text-slate-100">{value}</div>
      <div className="col-span-4 flex justify-end">{badge}</div>
    </div>
  );
}

/* ============================================================== */
/*  MAIN DASHBOARD                                                  */
/* ============================================================== */

export default function FXIntelDashboard() {
  const [activePair, setActivePair] = useState('EUR/USD');
  const [now, setNow] = useState(new Date());
  const [syncedAgo, setSyncedAgo] = useState(1);
  const [toast, setToast] = useState(null);

  // Seed initial candle + indicator state for all three pairs once.
  const initialChart = useMemo(() => {
    const map = {};
    PAIR_KEYS.forEach((k) => { map[k] = generateCandles(k); });
    return map;
  }, []);
  const initialIndicators = useMemo(() => {
    const map = {};
    PAIR_KEYS.forEach((k) => { map[k] = initIndicators(k, initialChart[k].candles); });
    return map;
  }, [initialChart]);

  const [chartByPair, setChartByPair] = useState(initialChart);
  const [indicatorsByPair, setIndicatorsByPair] = useState(initialIndicators);

  // Live-ticking clock.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Simulated data-feed sync counter (resyncs every few seconds).
  useEffect(() => {
    const id = setInterval(() => {
      setSyncedAgo((s) => (s >= 6 ? 0 : s + 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Live jitter: nudges the last candle + indicator readings so the
  // whole terminal feels like it's streaming, without ever flipping
  // the underlying directional call.
  useEffect(() => {
    const id = setInterval(() => {
      setChartByPair((prev) => {
        const next = { ...prev };
        PAIR_KEYS.forEach((k) => {
          const cfg = PAIRS[k];
          const candles = prev[k].candles;
          const last = candles[candles.length - 1];
          const delta = (Math.random() - 0.5) * cfg.volatility * 0.5;
          const newClose = last.close + delta;
          const newCandle = {
            open: last.open,
            close: newClose,
            high: Math.max(last.high, newClose),
            low: Math.min(last.low, newClose),
          };
          next[k] = { candles: [...candles.slice(0, -1), newCandle], signals: prev[k].signals };
        });
        return next;
      });

      setIndicatorsByPair((prev) => {
        const next = { ...prev };
        PAIR_KEYS.forEach((k) => {
          const cur = prev[k];
          next[k] = {
            ...cur,
            rsi: clamp(cur.rsi + (Math.random() - 0.5) * 2.2, 5, 95),
            stochK: clamp(cur.stochK + (Math.random() - 0.5) * 3, 5, 95),
            macdHist: cur.macdHist + (Math.random() - 0.5) * Math.abs(cur.macdHist) * 0.15,
            confidence: clamp(cur.confidence + (Math.random() - 0.5) * 1.6, 52, 96),
          };
        });
        return next;
      });
    }, 2400);
    return () => clearInterval(id);
  }, []);

  const fireToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const cfg = PAIRS[activePair];
  const { candles, signals } = chartByPair[activePair];
  const indicators = indicatorsByPair[activePair];

  const lastClose = candles[candles.length - 1].close;
  const prevClose = candles[candles.length - 2].close;
  const changeAbs = lastClose - prevClose;
  const changePct = (changeAbs / prevClose) * 100;
  const periodHigh = Math.max(...candles.map((c) => c.high));
  const periodLow = Math.min(...candles.map((c) => c.low));

  const recommendation = recommendationFor(indicators.confidence, indicators.direction);
  const isBullish = indicators.direction === 'bullish';

  const entry = lastClose;
  const stop = isBullish ? lastClose - indicators.atr * 1.5 : lastClose + indicators.atr * 1.5;
  const target = isBullish ? lastClose + indicators.atr * 2.5 : lastClose - indicators.atr * 2.5;
  const rr = Math.abs(target - entry) / Math.abs(entry - stop);

  const topFeature = [...indicators.featureImportance].sort((a, b) => b.value - a.value)[0];

  const rsiBadge =
    indicators.rsi < 30 ? { label: 'Oversold', tone: 'buy' }
    : indicators.rsi > 70 ? { label: 'Overbought', tone: 'sell' }
    : { label: 'Neutral', tone: 'neutral' };

  const stochBadge =
    indicators.stochK < 20 ? { label: 'Oversold', tone: 'buy' }
    : indicators.stochK > 80 ? { label: 'Overbought', tone: 'sell' }
    : { label: 'Neutral', tone: 'neutral' };

  const macdLabel =
    indicators.macdState === 'bullish_cross' ? 'Bullish Crossover'
    : indicators.macdState === 'bearish_cross' ? 'Bearish Crossover'
    : 'Holding Trend';
  const macdTone =
    indicators.macdState === 'bullish_cross' ? 'buy'
    : indicators.macdState === 'bearish_cross' ? 'sell'
    : 'neutral';

  const volState = indicators.atr > cfg.volatility * 1.15 ? { label: 'Expanding', tone: 'warn' } : { label: 'Stable', tone: 'neutral' };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans-custom relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        .font-sans-custom { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
        .font-mono-custom { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .grid-texture {
          background-image:
            linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px);
          background-size: 42px 42px;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="grid-texture absolute inset-0 pointer-events-none" />

      {/* ---------------------------------------------------------- */}
      {/*  HEADER                                                     */}
      {/* ---------------------------------------------------------- */}
      <header className="relative z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0">
        <div className="px-4 md:px-6 py-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/30">
                <Activity size={18} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 leading-none mb-1">Institutional Terminal</p>
                <h1 className="text-lg font-bold tracking-tight text-slate-50 leading-none">
                  FX-Intel <span className="text-slate-500 font-medium">| Decision Support System</span>{' '}
                  <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-xs font-mono-custom text-cyan-400 align-middle">v2.4</span>
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 md:gap-6 text-xs">
              <div className="flex items-center gap-2">
                <StatusDot color="emerald" />
                <Cpu size={14} className="text-slate-500" />
                <span className="text-slate-400">ML Core: <span className="text-emerald-400 font-semibold">Operational</span></span>
              </div>
              <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-4 md:pl-6">
                <StatusDot color="cyan" />
                <Wifi size={14} className="text-slate-500" />
                <span className="text-slate-400">Data Stream: <span className="text-cyan-400 font-semibold">Connected</span></span>
              </div>
              <div className="flex items-center gap-2 border-l border-slate-800 pl-4 md:pl-6">
                <Clock size={14} className="text-slate-500" />
                <span className="font-mono-custom text-slate-200">
                  {now.toLocaleTimeString([], { hour12: false })}
                </span>
                <span className="text-slate-600">{now.toLocaleDateString([], { month: 'short', day: '2-digit' })}</span>
              </div>
            </div>
          </div>

          {/* Currency pair selector */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {PAIR_KEYS.map((k) => {
              const active = k === activePair;
              const cfgK = PAIRS[k];
              const priceK = chartByPair[k].candles[chartByPair[k].candles.length - 1].close;
              return (
                <button
                  key={k}
                  onClick={() => setActivePair(k)}
                  className={cx(
                    'flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold shrink-0 transition-colors',
                    active
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  )}
                >
                  {k}
                  <span className="font-mono-custom text-xs text-slate-500">{fmt(priceK, cfgK.decimals)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- */}
      {/*  MAIN GRID                                                   */}
      {/* ---------------------------------------------------------- */}
      <main className="relative z-10 px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ---------- LEFT / MAIN COLUMN ---------- */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          {/* Price chart panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <h2 className="text-xl font-bold text-slate-50">{activePair}</h2>
                <span className="font-mono-custom text-2xl font-semibold text-slate-100">{fmt(lastClose, cfg.decimals)}</span>
                <span className={cx('inline-flex items-center gap-1 text-sm font-semibold', changeAbs >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                  {changeAbs >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {changeAbs >= 0 ? '+' : ''}{fmt(changeAbs, cfg.decimals)} ({changePct.toFixed(2)}%)
                </span>
              </div>
              <div className="flex gap-5 text-xs">
                <div>
                  <p className="text-slate-500">Period High</p>
                  <p className="font-mono-custom text-slate-200">{fmt(periodHigh, cfg.decimals)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Period Low</p>
                  <p className="font-mono-custom text-slate-200">{fmt(periodLow, cfg.decimals)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Range</p>
                  <p className="font-mono-custom text-slate-200">{fmt(periodHigh - periodLow, cfg.decimals)}</p>
                </div>
              </div>
            </div>

            <div className="p-4">
              <CandlestickChart candles={candles} signals={signals} direction={indicators.direction} />
            </div>

            <div className="px-5 py-3 border-t border-slate-800 flex flex-wrap gap-5 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <svg width="10" height="10"><polygon points="0,10 10,10 5,0" className="fill-emerald-400" /></svg>
                BUY signal
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="10" height="10"><polygon points="0,0 10,0 5,10" className="fill-rose-400" /></svg>
                SELL signal
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cx('inline-block w-3 border-t border-dashed', indicators.direction === 'bullish' ? 'border-emerald-400' : 'border-rose-400')} />
                Live price
              </span>
            </div>
          </div>

          {/* Live indicator stream */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-200">Live Indicator Stream</h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <StatusDot color="emerald" />
                Synced <span className="font-mono-custom text-slate-300">{syncedAgo}s</span> ago
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 px-5 py-2 text-xs uppercase tracking-wider text-slate-600">
              <div className="col-span-5">Indicator</div>
              <div className="col-span-3">Value</div>
              <div className="col-span-4 text-right">Status</div>
            </div>

            <div className="divide-y divide-slate-800">
              <IndicatorRow
                name="RSI (14)"
                sub="Relative Strength Index"
                value={indicators.rsi.toFixed(1)}
                badge={<Badge tone={rsiBadge.tone}>{rsiBadge.label}</Badge>}
              />
              <IndicatorRow
                name="MACD (12,26,9)"
                sub="Signal line crossover"
                value={(indicators.macdHist >= 0 ? '+' : '') + indicators.macdHist.toFixed(5)}
                badge={<Badge tone={macdTone}>{macdLabel}</Badge>}
              />
              <IndicatorRow
                name="Stochastic %K"
                sub="Momentum oscillator"
                value={indicators.stochK.toFixed(1)}
                badge={<Badge tone={stochBadge.tone}>{stochBadge.label}</Badge>}
              />
              <IndicatorRow
                name="ATR (14)"
                sub="Average true range"
                value={fmt(indicators.atr, cfg.decimals)}
                badge={<Badge tone={volState.tone}>{volState.label}</Badge>}
              />
              <IndicatorRow
                name="yfinance API Feed"
                sub="Live market data connector"
                value={`Synced ${syncedAgo}s ago`}
                badge={<Badge tone="buy">LIVE</Badge>}
              />
            </div>
          </div>
        </section>

        {/* ---------- RIGHT / ANALYTICS COLUMN ---------- */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          {/* ML analytics panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-cyan-400" />
              <div>
                <h3 className="text-sm font-semibold text-slate-200 leading-none">ML Analytics</h3>
                <p className="text-xs text-slate-500 leading-none mt-1">Predictive Signal Engine</p>
              </div>
            </div>

            <ConfidenceGauge confidence={indicators.confidence} direction={indicators.direction} />

            <div className="border-t border-slate-800 pt-5">
              <p className="text-sm font-semibold text-slate-300 mb-3">Feature Importance</p>
              <div className="flex flex-col gap-3">
                {indicators.featureImportance.map((f) => (
                  <FeatureBar key={f.label} label={f.label} value={f.value} />
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-5 flex flex-wrap gap-2">
              <ModelBadge icon={Target} label="Model:" value="Random Forest Classifier" />
              <ModelBadge icon={ShieldCheck} label="Accuracy:" value="84.2%" />
              <ModelBadge icon={BarChart3} label="Sharpe Ratio:" value="2.1" />
            </div>
          </div>

          {/* Executable decision card */}
          <div
            className={cx(
              'rounded-lg border p-5 flex flex-col gap-4',
              isBullish ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'
            )}
          >
            <p className="text-xs uppercase tracking-widest text-slate-500">System Recommendation</p>

            <div className={cx('flex items-center gap-2', isBullish ? 'text-emerald-400' : 'text-rose-400')}>
              {isBullish ? <TrendingUp size={26} /> : <TrendingDown size={26} />}
              <span className="text-3xl font-extrabold tracking-tight">{recommendation.label}</span>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed">
              Model confidence sits at <span className="font-mono-custom text-slate-200">{Math.round(indicators.confidence)}%</span> for
              a {indicators.direction} bias on {activePair}, driven primarily by {topFeature.label.toLowerCase()} signals.
            </p>

            <div className="grid grid-cols-3 gap-3 border-t border-slate-800/70 pt-4">
              <div>
                <p className="text-xs text-slate-500">Entry Zone</p>
                <p className="font-mono-custom text-sm font-semibold text-slate-100">{fmt(entry, cfg.decimals)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Stop Loss</p>
                <p className="font-mono-custom text-sm font-semibold text-slate-100">{fmt(stop, cfg.decimals)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Risk / Reward</p>
                <p className="font-mono-custom text-sm font-semibold text-slate-100">1 : {rr.toFixed(1)}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={() => fireToast(`Trade setup staged • ${activePair} • ${recommendation.label}`)}
                className={cx(
                  'flex-1 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90',
                  isBullish ? 'bg-emerald-400' : 'bg-rose-400'
                )}
              >
                <Zap size={15} /> Execute Trade Setup
              </button>
              <button
                onClick={() => fireToast('Backtest log exported (simulated)')}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <Download size={15} /> Export Backtest Logs
              </button>
            </div>
          </div>
        </aside>
      </main>

      <footer className="relative z-10 px-4 md:px-6 pb-6 text-xs text-slate-600">
        Simulated data for demonstration purposes only. Not investment advice.
      </footer>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-md border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-200 shadow-lg transition-opacity">
          {toast}
        </div>
      )}
    </div>
  );
}
