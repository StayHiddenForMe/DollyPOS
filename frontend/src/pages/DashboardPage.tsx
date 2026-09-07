import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  AlertTriangle, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock, 
  Zap, 
  Package, 
  Layers, 
  Banknote, 
  QrCode, 
  CreditCard, 
  RotateCw, 
  LineChart, 
  BarChart3, 
  Activity, 
  Compass, 
  HelpCircle,
  Calendar,
  CheckCircle2,
  PieChart
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

export const DashboardPage: React.FC = () => {
  const { user, isOwner } = useAuthStore();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRange, setSelectedRange] = useState<7 | 30 | 90 | 365>(30);
  const [chartMode, setChartMode] = useState<'TIMELINE' | '12M' | 'PROJECTION'>('TIMELINE');
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [projectionScenario, setProjectionScenario] = useState<'CONSERVATIVE' | 'TARGET' | 'FESTIVE'>('TARGET');

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetchDashboardMetrics(selectedRange);
    const interval = setInterval(() => fetchDashboardMetrics(selectedRange), 30000);
    return () => clearInterval(interval);
  }, [selectedRange]);

  const fetchDashboardMetrics = async (rangeDays: number = 30) => {
    setIsRefreshing(true);
    try {
      const res = await api.get(`/dashboard/metrics?days=${rangeDays}`);
      setMetrics(res.data);
    } catch (e) {
      console.error('Failed to load dashboard metrics', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const charts = metrics?.charts;
  const dailyTimeline = charts?.daily_timeline || [];
  const monthlyGrowth = charts?.monthly_growth || [];
  const futureProjections = charts?.future_projections;
  const financialRatios = charts?.financial_ratios;
  const cashFlow = charts?.cash_flow_summary;

  // Chart Rendering Variables - High-res coordinate space for full width
  const chartWidth = 1000;
  const chartHeight = 200;
  const maxRevenue = Math.max(1, ...dailyTimeline.map((d: any) => d.revenue));

  // Compute SVG Points for Daily Curve
  const chartPoints = dailyTimeline.map((d: any, idx: number) => {
    const x = (idx / Math.max(1, dailyTimeline.length - 1)) * chartWidth;
    const y = chartHeight - (d.revenue / maxRevenue) * (chartHeight - 40) - 20;
    return { ...d, x, y };
  });

  const polylineString = chartPoints.map((p: any) => `${p.x},${p.y}`).join(' ');
  const areaPolygonString = `${polylineString} ${chartWidth},${chartHeight} 0,${chartHeight}`;

  // Projection points
  const baseDailyRev = (futureProjections?.projected_next_30d_revenue || 100000) / 30.0;
  const multiplier = projectionScenario === 'CONSERVATIVE' ? 1.0 : (projectionScenario === 'TARGET' ? 1.15 : 1.35);
  const projDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    const rev = Math.round(baseDailyRev * multiplier * (1 + (i * 0.006)));
    const profit = Math.round(rev * 0.42);
    return {
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      full_date: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }),
      revenue: rev,
      net_profit: profit,
      cogs: rev - profit
    };
  });

  const maxProjRev = Math.max(1, ...projDays.map(p => p.revenue));
  const projPoints = projDays.map((p, idx) => {
    const x = (idx / Math.max(1, projDays.length - 1)) * chartWidth;
    const y = chartHeight - (p.revenue / maxProjRev) * (chartHeight - 40) - 20;
    return { ...p, x, y };
  });
  const polylineProjString = projPoints.map(p => `${p.x},${p.y}`).join(' ');
  const areaProjString = `${polylineProjString} ${chartWidth},${chartHeight} 0,${chartHeight}`;

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = (mouseX / rect.width) * chartWidth;

    const dataset = chartMode === 'PROJECTION' ? projPoints : chartPoints;
    if (dataset.length === 0) return;

    // Find closest point
    let closest = dataset[0];
    let minDiff = Math.abs(dataset[0].x - relativeX);
    for (const pt of dataset) {
      const diff = Math.abs(pt.x - relativeX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    }

    setHoveredPoint(closest);
    setHoverPos({ x: (closest.x / chartWidth) * rect.width, y: (closest.y / chartHeight) * rect.height });
  };

  const handleSvgMouseLeave = () => {
    setHoveredPoint(null);
    setHoverPos(null);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-y-auto space-y-4 select-none">
      {/* Top Welcome Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span>Welcome back, {user?.full_name || 'Owner'}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 font-bold">
              {isOwner() ? 'Store Owner' : 'Counter Cashier'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dolly Toys and Kids Wear • Live Retail Pulse, Stock Velocity & Growth Cockpit
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchDashboardMetrics(selectedRange)}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-pink-600 transition-all shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-pink-500' : ''}`} />
            <span>Refresh</span>
          </button>

          <div className="flex items-center space-x-1 text-xs font-mono bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5 text-pink-500" />
            <span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>
        </div>
      </div>

      {/* 17 Feb Shop Anniversary Celebration Hero Card */}
      {(() => {
        const today = new Date();
        const isFeb17 = (today.getMonth() === 1 && today.getDate() === 17);
        const yearsPassed = Math.max(0, today.getFullYear() - 2002);
        if (!isFeb17) return null;
        return (
          <div className="bg-gradient-to-r from-amber-500 via-pink-600 to-purple-600 text-white p-4 rounded-2xl shadow-lg border border-amber-300 flex items-center justify-between animate-in fade-in zoom-in duration-300">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
                🎂
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black tracking-tight">
                    Happy {yearsPassed}th Anniversary, Dolly Toys & Kids Wear! 🎉
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-white text-pink-700 text-[10px] font-black uppercase shadow-xs">
                    Est. 17 Feb 2002
                  </span>
                </div>
                <p className="text-xs text-pink-100 font-medium mt-0.5">
                  Celebrating {yearsPassed} glorious years of retail excellence, quality toys, trendy kids wear, and happy families in Dhule!
                </p>
              </div>
            </div>
            <div className="text-right font-mono hidden md:block">
              <span className="text-[10px] uppercase font-bold text-pink-200 block">Milestone</span>
              <span className="text-xl font-black">{yearsPassed} Years Completed</span>
            </div>
          </div>
        );
      })()}

      {/* Main KPI Row */}
      {metrics && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Sales</span>
              <div className="p-2 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatINR(metrics.today_sales)}
              </span>
              <span className="text-xs font-bold text-pink-600">
                {metrics.today_bills_count} bills
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>Avg Ticket: <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatINR(metrics.avg_bill_value)}</strong></span>
              <span className="text-emerald-600 font-bold font-mono">GP: {formatINR(metrics.today_gross_profit)}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly Revenue</span>
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatINR(metrics.month_sales)}
              </span>
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" /> +12.4% MoM
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>Mo Expenses: <strong className="text-rose-600 font-mono">{formatINR(metrics.month_expenses)}</strong></span>
              <span className="text-slate-400">Current Month</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Net Profit</span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className={`text-2xl font-black font-mono ${metrics.today_net_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatINR(metrics.today_net_profit)}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700">
                In-Hand Cash
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>Expenses: <strong className="text-rose-500 font-mono">{formatINR(metrics.today_expenses)}</strong></span>
              <span>Cash: <strong className="font-mono text-emerald-600">{formatINR(metrics.today_cash)}</strong></span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inventory Valuation</span>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatINR(metrics.inventory_valuation)}
              </span>
              <span className="text-xs font-bold text-amber-600">
                {metrics.low_stock_count} Low Stock
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>Wholesale Cost Basis</span>
              <span className="text-pink-600 font-bold font-mono">Live Sync ✓</span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Stock-Market Style Chart & Projections */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        {/* Controls & Mode Selector */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-gradient-to-tr from-pink-500 to-rose-600 rounded-xl text-white shadow-md shadow-pink-500/20">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>Revenue & Net Profit Velocity</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 font-bold">
                  {financialRatios?.velocity_rating || 'Bullish Growth 🚀'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Hover over the chart to inspect daily Revenue, COGS, Expenses & Net In-Hand Profit.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Range Selector */}
            {chartMode === 'TIMELINE' && (
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                {[
                  { days: 7, label: '7D' },
                  { days: 30, label: '30D' },
                  { days: 90, label: '90D' },
                  { days: 365, label: '1 Year' }
                ].map((item) => (
                  <button
                    key={item.days}
                    onClick={() => setSelectedRange(item.days as any)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      selectedRange === item.days
                        ? 'bg-white dark:bg-slate-700 text-pink-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {/* View Mode Switcher */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              {[
                { id: 'TIMELINE', label: '📈 Timeline Curve' },
                { id: '12M', label: '📊 12-Month Macro' },
                { id: 'PROJECTION', label: '🚀 30/90D Projection' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setChartMode(tab.id as any)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    chartMode === tab.id
                      ? 'bg-pink-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TIMELINE VIEW WITH INTERACTIVE HOVER */}
        {chartMode === 'TIMELINE' && (
          <div className="relative">
            {/* Live Hover HUD / Tooltip (Flicker-Free with pointer-events-none and smart side-docking) */}
            {hoveredPoint && (
              <div 
                className={`absolute top-2 z-20 pointer-events-none select-none bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl border border-slate-700 shadow-2xl space-y-1.5 text-xs font-mono transition-all duration-75 ${
                  hoveredPoint.x < chartWidth / 2 ? 'right-2' : 'left-2'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-700 pb-1 gap-4">
                  <span className="font-bold text-pink-400">{hoveredPoint.full_date || hoveredPoint.label}</span>
                  <span className="text-[10px] text-slate-400">{hoveredPoint.bills_count} bills</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <div>
                    <span className="text-slate-400">Revenue:</span>{' '}
                    <strong className="text-white font-bold">{formatINR(hoveredPoint.revenue)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">COGS (Cost):</span>{' '}
                    <strong className="text-slate-300 font-bold">{formatINR(hoveredPoint.cogs)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Gross Profit:</span>{' '}
                    <strong className="text-emerald-400 font-bold">{formatINR(hoveredPoint.gross_profit)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Expenses:</span>{' '}
                    <strong className="text-rose-400 font-bold">{formatINR(hoveredPoint.expenses)}</strong>
                  </div>
                </div>
                <div className="pt-1 border-t border-slate-700 flex items-center justify-between">
                  <span className="text-slate-400">🟢 Net In-Hand Profit:</span>
                  <strong className="text-emerald-400 text-sm font-black">{formatINR(hoveredPoint.net_profit)}</strong>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                  <span>Cash: {formatINR(hoveredPoint.cash)}</span>
                  <span>UPI: {formatINR(hoveredPoint.upi)}</span>
                  <span>Khata: {formatINR(hoveredPoint.credit)}</span>
                </div>
              </div>
            )}

            {/* SVG Chart */}
            <div className="h-56 w-full relative">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
                className="w-full h-full cursor-crosshair block"
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={handleSvgMouseLeave}
              >
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EC4899" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#EC4899" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {[0.25, 0.5, 0.75, 1.0].map((ratio) => {
                  const y = chartHeight - ratio * (chartHeight - 40) - 20;
                  return (
                    <g key={ratio}>
                      <line x1="0" y1={y} x2={chartWidth} y2={y} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeDasharray="3 3" />
                      <text x={chartWidth - 5} y={y - 3} textAnchor="end" className="text-[9px] font-mono fill-slate-400">
                        {formatINR(maxRevenue * ratio)}
                      </text>
                    </g>
                  );
                })}

                {/* Area Fill */}
                <polygon points={areaPolygonString} fill="url(#areaGradient)" />

                {/* Line Curve */}
                <polyline
                  fill="none"
                  stroke="#EC4899"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polylineString}
                />

                {/* Data Points */}
                {chartPoints.map((p: any, idx: number) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={hoveredPoint?.date === p.date ? 6 : 3}
                    className={`transition-all ${hoveredPoint?.date === p.date ? 'fill-pink-500 stroke-white stroke-2' : 'fill-pink-600'}`}
                  />
                ))}

                {/* Hover Vertical Guide Line */}
                {hoveredPoint && (
                  <line
                    x1={hoveredPoint.x}
                    y1={0}
                    x2={hoveredPoint.x}
                    y2={chartHeight}
                    stroke="#EC4899"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}
              </svg>
            </div>

            {/* Date axis labels */}
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2">
              <span>{dailyTimeline[0]?.label}</span>
              <span>{dailyTimeline[Math.floor(dailyTimeline.length / 2)]?.label}</span>
              <span>{dailyTimeline[dailyTimeline.length - 1]?.label}</span>
            </div>
          </div>
        )}

        {/* 12-MONTH MACRO VIEW */}
        {chartMode === '12M' && (
          <div className="grid grid-cols-6 gap-2.5">
            {monthlyGrowth.map((m: any, idx: number) => (
              <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 block uppercase">{m.label}</span>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                  {formatINR(m.revenue)}
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold font-mono">
                  <span className="text-emerald-600">GP: {formatINR(m.gross_profit)}</span>
                  <span className={`px-1.5 py-0.5 rounded ${m.mom_growth_percent >= 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800'}`}>
                    {m.mom_growth_percent > 0 ? '+' : ''}{m.mom_growth_percent}%
                  </span>
                </div>
                <div className="text-[9px] text-slate-400 font-mono">
                  {m.bills_count} bills • Margin: {m.margin_percent}%
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 30/90D PROJECTION VIEW & EXPLANATION */}
        {chartMode === 'PROJECTION' && (
          <div className="space-y-4">
            {/* Explanation Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-emerald-500/10 border border-purple-200 dark:border-purple-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  How 30 & 90-Day Predictive Forecasting Helps Your Business:
                </h3>
                <div className="flex items-center space-x-1 text-xs">
                  <span className="text-slate-500 font-bold">Simulator:</span>
                  {(['CONSERVATIVE', 'TARGET', 'FESTIVE'] as const).map((sc) => (
                    <button
                      key={sc}
                      onClick={() => setProjectionScenario(sc)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${projectionScenario === sc ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500'}`}
                    >
                      {sc === 'CONSERVATIVE' ? 'Normal (0%)' : (sc === 'TARGET' ? 'Expansion (+15%)' : 'Festive (+35%)')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">1. Working Capital Planning</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                    Projects your upcoming cash collections so you know exactly how much budget you can safely invest in buying new inventory.
                  </p>
                </div>
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">2. Expected 30-Day Inflow</span>
                  <div className="text-lg font-black font-mono text-purple-600 mt-0.5">
                    {formatINR(Math.round((futureProjections?.projected_next_30d_revenue || 100000) * multiplier))}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold">Estimated Net Profit: ~{formatINR(Math.round((futureProjections?.projected_next_30d_revenue || 100000) * multiplier * 0.42))}</span>
                </div>
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">3. Expected 90-Day Quarterly Target</span>
                  <div className="text-lg font-black font-mono text-pink-600 mt-0.5">
                    {formatINR(Math.round((futureProjections?.projected_next_90d_revenue || 300000) * (multiplier ** 1.3)))}
                  </div>
                  <span className="text-[10px] text-slate-400">Quarterly Target Turnover</span>
                </div>
              </div>
            </div>

            {/* Projection Curve */}
            <div className="h-52 w-full relative">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
                className="w-full h-full cursor-crosshair block"
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={handleSvgMouseLeave}
              >
                <defs>
                  <linearGradient id="projGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                <polygon points={areaProjString} fill="url(#projGradient)" />
                <polyline fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeDasharray="4 2" points={polylineProjString} />

                {projPoints.map((p, idx) => (
                  <circle key={idx} cx={p.x} cy={p.y} r={3} fill="#8B5CF6" />
                ))}
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Cash Flow & Business Liquidity Strip */}
      {cashFlow && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Inflow (Cash + UPI)</span>
            <div className="text-xl font-black font-mono text-emerald-600">
              {formatINR(cashFlow.total_cash_inflow + cashFlow.total_upi_inflow)}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t">
              <span>Cash: {formatINR(cashFlow.total_cash_inflow)}</span>
              <span>UPI: {formatINR(cashFlow.total_upi_inflow)}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Outflow (Shop Expenses)</span>
            <div className="text-xl font-black font-mono text-rose-600">
              {formatINR(cashFlow.total_expenses_outflow)}
            </div>
            <div className="text-[10px] text-slate-400 pt-1 border-t">
              Rent, Staff Salaries, Tea/Snacks, Electricity
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Liquidity Generated</span>
            <div className="text-xl font-black font-mono text-slate-900 dark:text-white">
              {formatINR(cashFlow.net_cash_flow)}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold pt-1 border-t">
              ✓ Ready for Reinvestment & Procurement
            </div>
          </div>
        </div>
      )}

      {/* RETAIL EXPANSION PILLARS: UPT Basket Multiplier & 50/30 Margin Balancing Rule */}
      <div className="grid grid-cols-2 gap-4">
        {/* PILLAR 1: Average Basket Size & Cross-Sell Multiplier (UPT) */}
        {charts?.basket_metrics && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-xl text-white shadow-md shadow-emerald-500/20">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                    Basket Multiplier & Units Per Transaction (UPT)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    How many products customers buy per visit & cross-sell velocity.
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] font-mono">
                {charts.basket_metrics.benchmark_rating}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border">
                <span className="text-[10px] text-slate-400 font-sans block">Avg Basket Size (UPT)</span>
                <div className="text-xl font-black text-emerald-600 mt-0.5">
                  {charts.basket_metrics.upt} <span className="text-xs font-bold text-slate-500">pcs/bill</span>
                </div>
                <span className="text-[9px] text-slate-400 font-sans">Target: &ge; 2.2 pcs</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border">
                <span className="text-[10px] text-slate-400 font-sans block">Multi-Item Bills</span>
                <div className="text-xl font-black text-pink-600 mt-0.5">
                  {charts.basket_metrics.multi_item_rate_percent}%
                </div>
                <span className="text-[9px] text-slate-400 font-sans">{charts.basket_metrics.multi_item_bills_count} of {charts.basket_metrics.total_bills_count} bills</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border">
                <span className="text-[10px] text-slate-400 font-sans block">Avg Basket Value</span>
                <div className="text-xl font-black text-slate-800 dark:text-white mt-0.5">
                  {formatINR(charts.basket_metrics.avg_basket_value)}
                </div>
                <span className="text-[9px] text-slate-400 font-sans">Revenue / Bill</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <Zap className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Counter Cross-Sell Tip:</strong> {charts.basket_metrics.coaching_tip}</span>
            </div>
          </div>
        )}

        {/* PILLAR 2: Category Profit Margin Balancing (The 50/30 Rule) */}
        {charts?.category_50_30_rule && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-gradient-to-tr from-purple-500 to-pink-600 rounded-xl text-white shadow-md shadow-purple-500/20">
                  <PieChart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                    Category Margin Balancing (The 50/30 Rule)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    50% Festive/Impulse Margin Zone vs 30% Core Volume Drivers.
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-[10px] font-mono">
                {charts.category_50_30_rule.status_badge}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* 50% High Margin Zone */}
              <div className="p-3 rounded-2xl bg-gradient-to-br from-pink-50/60 to-purple-50/60 dark:from-pink-950/20 dark:to-purple-950/20 border border-pink-200 dark:border-pink-900/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-pink-700 dark:text-pink-300 text-[11px]">💎 50% Impulse/Festive Zone</span>
                  <span className="text-[10px] font-mono font-bold text-pink-600">&ge; 45% Margin</span>
                </div>
                <div className="space-y-1 pt-1">
                  {charts.category_50_30_rule.high_margin_50_zone.slice(0, 3).map((c: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{c.name}</span>
                      <span className="font-mono font-bold text-emerald-600">{c.margin_percent}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 30% Volume Zone */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">⚡ 30% Core Volume Zone</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500">25-45% Margin</span>
                </div>
                <div className="space-y-1 pt-1">
                  {charts.category_50_30_rule.core_volume_30_zone.slice(0, 3).map((c: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{c.name}</span>
                      <span className="font-mono font-bold text-emerald-600">{c.margin_percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t text-[11px] font-mono">
              <span className="text-slate-500">Blended Store Margin: <strong className="text-emerald-600 font-bold">{charts.category_50_30_rule.blended_store_margin_percent}%</strong></span>
              <span className="text-slate-400">Retail Target: 45.0%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
