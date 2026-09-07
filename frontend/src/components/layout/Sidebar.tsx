import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { 
  LayoutDashboard,
  ShoppingCart, 
  Receipt,
  Package, 
  Barcode, 
  ShieldCheck,
  RotateCcw, 
  AlertOctagon,
  Tag, 
  Wallet, 
  BarChart3, 
  Users, 
  MessageSquare,
  ClipboardList,
  Settings as SettingsIcon,
  Pin,
  PinOff
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { isOwner, isCashier } = useAuthStore();
  
  // Default to false (auto-collapse hover mode) as requested by user
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    const saved = localStorage.getItem('dolly_sidebar_pinned');
    return saved === 'true';
  });
  
  const [isHovered, setIsHovered] = useState(false);

  // Expanded if pinned OR if hovered
  const isExpanded = isPinned || isHovered;

  const togglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPinned(prev => {
      const next = !prev;
      localStorage.setItem('dolly_sidebar_pinned', String(next));
      return next;
    });
  };

  // Navigation Items in exact hierarchy
  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, ownerOnly: false },
    { to: '/', label: 'Billing / POS', icon: ShoppingCart, highlight: true },
    { to: '/bills', label: 'Bills & Invoices', icon: Receipt, ownerOnly: false },
    { to: '/inventory', label: 'Inventory', icon: Package, ownerOnly: false },
    { to: '/barcode', label: 'Barcode Studio', icon: Barcode, ownerOnly: false },
    { to: '/smart-advisor', label: 'Smart Advisor', icon: ShieldCheck, highlightSmart: true },
    { to: '/returns', label: 'Return & Exchange', icon: RotateCcw, ownerOnly: false },
    { to: '/damaged-stock', label: 'Damaged Stock', icon: AlertOctagon, ownerOnly: false },
    { to: '/procurement', label: 'Buying & Demand Planner', icon: ClipboardList, ownerOnly: false },
    { to: '/vendors', label: 'Vendors / Suppliers', icon: Tag, ownerOnly: false },
    { to: '/expenses', label: 'Daily Expenses', icon: Wallet, ownerOnly: false },
    { to: '/reports', label: 'Reports & P&L', icon: BarChart3, ownerOnly: false },
    { to: '/whatsapp', label: 'WhatsApp Marketing', icon: MessageSquare, highlightWA: true },
    { to: '/customers', label: 'Customers / Khata', icon: Users, ownerOnly: false },
    { to: '/settings', label: 'Store & Staff Settings', icon: SettingsIcon, ownerOnly: true },
  ];

  return (
    <div 
      className={`relative z-30 shrink-0 transition-all duration-200 ease-in-out ${
        isPinned ? 'w-60' : 'w-16'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <aside 
        className={`absolute top-0 left-0 bottom-0 bg-slate-900 text-slate-300 flex flex-col justify-between select-none border-r border-slate-800 transition-all duration-200 ease-in-out ${
          isExpanded 
            ? 'w-60 shadow-2xl shadow-black/60 bg-slate-900/98 backdrop-blur-md' 
            : 'w-16 shadow-none'
        }`}
      >
        {/* Sidebar Header with Pin/Collapse Toggle */}
        <div className={`py-2.5 border-b border-slate-800/80 flex items-center ${isExpanded ? 'justify-between px-3.5' : 'justify-center px-0'}`}>
          {isExpanded ? (
            <>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-200 tracking-wider font-mono">DOLLY POS</span>
              </div>
              <button
                onClick={togglePin}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title={isPinned ? "Unpin sidebar (Auto-collapse on mouse leave)" : "Pin sidebar permanently open"}
              >
                {isPinned ? <PinOff className="w-3.5 h-3.5 text-pink-400" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            </>
          ) : (
            <button
              onClick={togglePin}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Click to Pin Sidebar Open (Hover to expand)"
            >
              <Pin className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
            </button>
          )}
        </div>

        {/* Nav Links */}
        <div className="py-2 px-2 space-y-1 overflow-y-auto flex-1">
          {navItems.map((item) => {
            if (item.ownerOnly && !isOwner()) return null;
            if (isCashier() && item.to !== '/' && item.to !== '/returns') return null;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  if (!isPinned) {
                    setIsHovered(false);
                  }
                }}
                title={!isExpanded ? item.label : undefined}
                className={({ isActive }) => `
                  flex items-center rounded-xl text-xs font-medium transition-all duration-150 relative
                  ${isExpanded ? 'px-3 py-2 space-x-3' : 'px-0 py-2.5 justify-center'}
                  ${isActive 
                    ? item.highlight 
                      ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30 font-bold' 
                      : item.highlightWA
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-bold'
                        : item.highlightSmart
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold'
                          : 'bg-slate-800 text-white font-semibold'
                    : item.highlightWA
                      ? 'text-emerald-400 hover:bg-slate-800/80 font-semibold'
                      : item.highlightSmart
                        ? 'text-pink-400 hover:bg-slate-800/80 font-semibold'
                        : 'hover:bg-slate-800/60 hover:text-white text-slate-400'
                  }
                `}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {isExpanded && (
                  <>
                    <span className="truncate flex-1">{item.label}</span>
                    {item.highlight && (
                      <span className="ml-auto text-[9px] bg-pink-400/30 text-white px-1.5 py-0.2 rounded font-bold">
                        POS
                      </span>
                    )}
                    {item.highlightWA && (
                      <span className="ml-auto text-[9px] bg-emerald-400/30 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                        WA
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Footer shortcuts */}
        {isExpanded ? (
          <div className="p-3 m-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-400">
            <p className="font-semibold text-slate-300 mb-1 flex items-center gap-1">
              ⌨️ Quick Shortcuts
            </p>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div><kbd className="px-1 bg-slate-700 rounded text-slate-200">F1</kbd> Search</div>
              <div><kbd className="px-1 bg-slate-700 rounded text-slate-200">F2</kbd> Speed Dials</div>
              <div><kbd className="px-1 bg-slate-700 rounded text-slate-200">F3</kbd> Custom Item</div>
              <div><kbd className="px-1 bg-slate-700 rounded text-slate-200">F8</kbd> Cash Pay</div>
              <div><kbd className="px-1 bg-slate-700 rounded text-slate-200">F9</kbd> UPI QR</div>
              <div><kbd className="px-1 bg-slate-700 rounded text-slate-200">F5</kbd> Hold Bill</div>
            </div>
          </div>
        ) : (
          <div className="p-2.5 mb-1 flex justify-center text-slate-500" title="Shortcuts: F1-Search, F2-Speed Dials, F8-Cash, F9-UPI, F5-Hold">
            <span className="text-xs">⌨️</span>
          </div>
        )}
      </aside>
    </div>
  );
};
