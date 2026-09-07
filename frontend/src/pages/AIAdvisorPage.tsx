import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { 
  Sparkles, 
  TrendingUp, 
  Package, 
  Users, 
  Calendar, 
  Share2, 
  AlertTriangle, 
  ArrowUpRight, 
  Layers, 
  Zap, 
  BadgePercent,
  Send,
  Bot,
  User,
  DollarSign,
  PieChart,
  HelpCircle,
  Clock,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export const AIAdvisorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'COPILOT' | 'REORDER' | 'PRICING' | 'CUSTOMERS' | 'CATEGORIES' | 'SUPPLIERS' | 'BASKET' | 'SEASONAL'>('COPILOT');
  
  // Data States
  const [reorders, setReorders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [crossSells, setCrossSells] = useState<any[]>([]);
  const [customerSegments, setCustomerSegments] = useState<any>(null);
  const [pricingSuggestions, setPricingSuggestions] = useState<any[]>([]);
  const [categoryMatrix, setCategoryMatrix] = useState<any[]>([]);
  const [seasonalAdvisory, setSeasonalAdvisory] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Chat Copilot State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "### 👋 Hello Somesh! I am your AI Retail Copilot for Dolly Toys and Kids Wear.\n\nI have real-time access to your 20,500+ products, sales transactions, customer Khata ledgers, and operating expenses.\n\nAsk me anything! For example:\n• *'What is our total stock valuation in the store?'*\n• *'How much profit did we make this month?'*\n• *'Which products are bestsellers?'*\n• *'Who owes the most Khata credit?'*\n• *'How much capital is trapped in dead stock?'*",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isAsking, setIsAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'COPILOT') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'REORDER') {
        const res = await api.get('/ai/reorder-recommendations');
        setReorders(res.data);
      } else if (activeTab === 'PRICING') {
        const res = await api.get('/ai/pricing-suggestions');
        setPricingSuggestions(res.data);
      } else if (activeTab === 'CUSTOMERS') {
        const res = await api.get('/ai/customer-segments');
        setCustomerSegments(res.data);
      } else if (activeTab === 'CATEGORIES') {
        const res = await api.get('/ai/category-matrix');
        setCategoryMatrix(res.data);
      } else if (activeTab === 'SUPPLIERS') {
        const res = await api.get('/ai/supplier-performance');
        setSuppliers(res.data);
      } else if (activeTab === 'BASKET') {
        const res = await api.get('/ai/cross-sell-insights');
        setCrossSells(res.data);
      } else if (activeTab === 'SEASONAL') {
        const res = await api.get('/ai/seasonal-advisory');
        setSeasonalAdvisory(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch AI Advisor data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (customQuery?: string) => {
    const textToSend = customQuery || chatInput.trim();
    if (!textToSend || isAsking) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!customQuery) setChatInput('');
    setIsAsking(true);

    try {
      const res = await api.post('/ai/chat', { query: textToSend });
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: res.data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: "I encountered an error retrieving data. Please check connection and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAsking(false);
    }
  };

  const quickPrompts = [
    "Compare Raincoat sales this year vs last year",
    "Which category boomed this month?",
    "What is our total stock valuation?",
    "How much profit did we make this month?",
    "Show top 5 bestsellers",
    "Who owes the highest Khata credit?",
    "What is our Ganesh Chaturthi & Diwali stocking plan?"
  ];

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden space-y-3 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-500" />
            AI Smart Retail Advisor & Interactive Copilot
          </h1>
          <p className="text-xs text-slate-500">
            Real-time Conversational AI Copilot, 30-Day Reorder Engine, Dynamic Pricing, and RFM Customer Segments.
          </p>
        </div>

        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-200 dark:border-pink-800 text-xs font-bold text-pink-600 dark:text-pink-300">
          <Zap className="w-3.5 h-3.5 text-pink-500" />
          <span>Autonomous AI Engine Active</span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit text-xs font-bold overflow-x-auto max-w-full">
        {[
          { id: 'COPILOT', label: '💬 AI Business Copilot', icon: Bot, isNew: true },
          { id: 'REORDER', label: '📦 Reorder Predictions', icon: Package },
          { id: 'PRICING', label: '🏷️ Price Optimization', icon: DollarSign },
          { id: 'CUSTOMERS', label: '👥 Customer VIP Segments', icon: Users },
          { id: 'CATEGORIES', label: '📊 Category Profitability', icon: PieChart },
          { id: 'SUPPLIERS', label: '🏭 Supplier Margins', icon: BadgePercent },
          { id: 'BASKET', label: '🧺 Market Basket', icon: Layers },
          { id: 'SEASONAL', label: '🎉 Festival Forecast', icon: Calendar },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col p-4">
        {/* 1. Interactive AI Copilot Tab */}
        {activeTab === 'COPILOT' && (
          <div className="h-full flex flex-col justify-between space-y-3">
            {/* Quick Prompts Carousel */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-pink-500" />
                Ask AI:
              </span>
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(prompt)}
                  className="px-2.5 py-1 rounded-xl bg-pink-50 hover:bg-pink-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-slate-700 text-[11px] font-semibold whitespace-nowrap transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Chat History Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 border rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950/40">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 text-xs leading-relaxed ${
                    msg.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.sender === 'ai' && (
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-pink-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-2xl p-3.5 rounded-2xl shadow-xs ${
                      msg.sender === 'user'
                        ? 'bg-pink-600 text-white rounded-tr-none font-medium'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="prose prose-xs dark:prose-invert max-w-none whitespace-pre-wrap">
                      {msg.text}
                    </div>
                    <span className={`text-[9px] block mt-1.5 text-right ${msg.sender === 'user' ? 'text-pink-200' : 'text-slate-400'}`}>
                      {msg.timestamp}
                    </span>
                  </div>

                  {msg.sender === 'user' && (
                    <div className="w-7 h-7 rounded-xl bg-slate-700 flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {isAsking && (
                <div className="flex items-center space-x-2 text-xs text-slate-400 p-2">
                  <Bot className="w-4 h-4 text-pink-500 animate-spin" />
                  <span>AI Copilot is querying live database metrics...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask anything about your store... (e.g. Which size sold the most? Who owes Khata? What is our monthly profit?)"
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:border-pink-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isAsking}
                className="px-5 py-2.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-pink-600/30 transition-all active:scale-95 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask Copilot</span>
              </button>
            </form>
          </div>
        )}

        {/* 2. Reorder Predictions Tab */}
        {activeTab === 'REORDER' && (
          <div className="flex-1 overflow-y-auto space-y-3 text-xs">
            <div className="p-3 bg-pink-50/50 dark:bg-pink-950/30 rounded-xl border border-pink-100 dark:border-pink-900/40 text-pink-900 dark:text-pink-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-500 shrink-0" />
              <span>The AI calculates 30-day velocity and suggests reorder quantities before items run out of stock.</span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-400 uppercase sticky top-0">
                <tr>
                  <th className="py-2 px-3">Product Name</th>
                  <th className="py-2 px-3">Barcode</th>
                  <th className="py-2 px-3 text-center">Current Stock</th>
                  <th className="py-2 px-3 text-center">Daily Velocity</th>
                  <th className="py-2 px-3 text-center">Stock Exhaustion</th>
                  <th className="py-2 px-3 text-right">Suggested Reorder</th>
                  <th className="py-2 px-3 text-center">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reorders.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-white">{r.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{r.barcode}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-rose-600">{r.current_stock} pcs</td>
                    <td className="py-2.5 px-3 text-center font-mono">{r.daily_velocity} / day</td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      {r.days_stock_remaining > 90 ? '> 90 days' : `${r.days_stock_remaining} days left`}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-pink-600 font-mono">
                      +{r.suggested_reorder_qty} pcs (~{formatINR(r.estimated_reorder_cost)})
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        r.urgency === 'CRITICAL' ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {r.urgency}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Price & Margin Optimization Tab */}
        {activeTab === 'PRICING' && (
          <div className="flex-1 overflow-y-auto space-y-3 text-xs">
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>AI Dynamic Pricing identifies clearance markdown opportunities to unlock trapped cash, and margin-boost opportunities on under-priced high demand items.</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {pricingSuggestions.map((p, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl border bg-slate-50 dark:bg-slate-800/60 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-white line-clamp-1">{p.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.action_type === 'MARKDOWN_PROMOTION' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {p.badge}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">{p.rationale}</p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Current Selling:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{formatINR(p.current_price)}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">AI Recommended:</span>
                      <span className="font-black text-pink-600">{formatINR(p.recommended_price)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Customer RFM Segmentation Tab */}
        {activeTab === 'CUSTOMERS' && customerSegments && (
          <div className="flex-1 overflow-y-auto space-y-4 text-xs">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200">
                <span className="font-bold text-amber-800 text-[11px]">VIP Champions</span>
                <div className="text-xl font-black text-amber-600 font-mono">{customerSegments.counts.champions}</div>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200">
                <span className="font-bold text-emerald-800 text-[11px]">Loyal Repeat Shoppers</span>
                <div className="text-xl font-black text-emerald-600 font-mono">{customerSegments.counts.loyal}</div>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200">
                <span className="font-bold text-rose-800 text-[11px]">At-Risk (Inactive 45+d)</span>
                <div className="text-xl font-black text-rose-600 font-mono">{customerSegments.counts.at_risk}</div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200">
                <span className="font-bold text-blue-800 text-[11px]">Khata Outstanding</span>
                <div className="text-xl font-black text-blue-600 font-mono">{customerSegments.counts.khata_due}</div>
              </div>
            </div>

            {/* List of At-Risk / VIP Customers */}
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white mb-2">High-Value At-Risk Customers (Reactivate via WhatsApp):</h3>
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-400 uppercase sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Customer Name</th>
                    <th className="py-2 px-3">Phone</th>
                    <th className="py-2 px-3 text-right">Lifetime Spend</th>
                    <th className="py-2 px-3 text-center">Days Inactive</th>
                    <th className="py-2 px-3 text-center">WhatsApp Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {customerSegments.at_risk.map((c: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-white">{c.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{c.phone}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">{formatINR(c.total_spend)}</td>
                      <td className="py-2.5 px-3 text-center text-rose-600 font-bold">{c.days_since_last_visit} days ago</td>
                      <td className="py-2.5 px-3 text-center">
                        <a
                          href={c.whatsapp_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition-colors"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>Send Festive Offer</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. Category Profitability Matrix Tab */}
        {activeTab === 'CATEGORIES' && (
          <div className="flex-1 overflow-y-auto space-y-3 text-xs">
            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 text-blue-900 dark:text-blue-200">
              Category Matrix analyzes stock valuation, unit volume, and average margin across each retail department.
            </div>

            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-400 uppercase sticky top-0">
                <tr>
                  <th className="py-2 px-3">Category Name</th>
                  <th className="py-2 px-3 text-center">Unique SKUs</th>
                  <th className="py-2 px-3 text-center">Physical Units</th>
                  <th className="py-2 px-3 text-right">Stock Valuation (Cost)</th>
                  <th className="py-2 px-3 text-center">Avg Margin %</th>
                  <th className="py-2 px-3 text-center">Health Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {categoryMatrix.map((cat, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-white">{cat.category_name}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{cat.product_count} SKUs</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">{cat.total_stock_units} pcs</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-pink-600">{formatINR(cat.stock_valuation)}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">{cat.average_margin}%</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                        {cat.health_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. Supplier Margins Tab */}
        {activeTab === 'SUPPLIERS' && (
          <div className="flex-1 overflow-y-auto space-y-3 text-xs">
            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 text-blue-900 dark:text-blue-200">
              Ranks your suppliers by gross margin percentage generated in Dolly Toys and Kids Wear.
            </div>

            <div className="grid grid-cols-2 gap-3">
              {suppliers.map((s, idx) => (
                <div key={idx} className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-pink-600 text-white font-bold flex items-center justify-center text-xs">
                        #{idx + 1}
                      </span>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-white">{s.vendor_name}</h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{s.company_name} • {s.city}</p>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-black font-mono text-emerald-600">
                      {s.average_margin_percent}%
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {s.rating}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Market Basket Tab */}
        {activeTab === 'BASKET' && (
          <div className="flex-1 overflow-y-auto space-y-3 text-xs">
            <div className="p-3 bg-purple-50/50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/40 text-purple-900 dark:text-purple-200">
              Market Basket Association Rules: Discover what parents and kids buy together for shelf placement and cashier speed dials.
            </div>

            {crossSells.length === 0 ? (
              <div className="text-center py-12 text-slate-400">Add more diverse bills to see high-confidence product pair insights.</div>
            ) : (
              <div className="space-y-2">
                {crossSells.map((cs, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span>{cs.item_a}</span>
                        <span className="text-pink-500 font-bold">+</span>
                        <span>{cs.item_b}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">{cs.recommendation}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-mono font-bold text-[10px]">
                      {cs.co_occurrence_count} times co-billed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 8. Seasonal Advisory Tab */}
        {activeTab === 'SEASONAL' && seasonalAdvisory && (
          <div className="flex-1 overflow-y-auto space-y-4 text-xs">
            <div className="p-4 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-2xl shadow-md">
              <span className="text-[10px] uppercase tracking-wider font-bold text-pink-200">Active Retail Season</span>
              <h3 className="text-xl font-black mt-0.5">{seasonalAdvisory.active_season}</h3>
              <p className="text-xs text-pink-100 mt-1">{seasonalAdvisory.stocking_strategy}</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">Top Recommended Categories to Stock Now:</h4>
              <div className="grid grid-cols-2 gap-3">
                {seasonalAdvisory.recommended_focus.map((item: string, i: number) => (
                  <div key={i} className="p-3 rounded-xl border bg-slate-50 dark:bg-slate-800 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-pink-500 shrink-0" />
                    <span className="font-bold text-slate-700 dark:text-slate-200">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
