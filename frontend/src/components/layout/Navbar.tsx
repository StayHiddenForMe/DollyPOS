import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useSettingStore } from '../../store/settingStore';
import api from '../../utils/api';
import { 
  Store, 
  User as UserIcon, 
  LogOut, 
  Bell, 
  AlertTriangle, 
  IndianRupee, 
  Package, 
  X,
  Check,
  Database,
  Sun,
  Moon
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { formatINR } from '../../utils/formatters';

export const Navbar: React.FC = () => {
  const { user, logout, isOwner } = useAuthStore();
  const { settings } = useSettingStore();
  const { theme, toggleTheme } = useThemeStore();

  const [alerts, setAlerts] = useState<any>(null);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [isAnniversaryDismissed, setIsAnniversaryDismissed] = useState(false);

  // Dynamic Shop Anniversary Check from StoreSettings
  const anniversaryData = alerts?.anniversary;
  const isAnniversaryToday = Boolean(anniversaryData?.is_anniversary_today);
  const yearsPassed = anniversaryData?.years_passed || 24;
  const shopName = anniversaryData?.shop_name || settings?.shop_name || 'Dolly Toys & Kids Wear';
  const foundationDate = anniversaryData?.foundation_date || settings?.opening_date || '2002-01-01';

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 45000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isAlertsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsAlertsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAlertsOpen]);

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/alerts/summary');
      setAlerts(res.data);
    } catch (e) {
      // Ignored if offline
    }
  };

  const dismissAlert = (alertKey: string) => {
    setDismissedAlerts(prev => [...prev, alertKey]);
  };

  const dismissAll = () => {
    setDismissedAlerts(['low_stock', 'vendor_dues', 'dead_stock']);
  };

  const hasLowStock = alerts?.low_stock?.count > 0 && !dismissedAlerts.includes('low_stock');
  const hasVendorDues = alerts?.vendor_dues?.total_due_amount > 0 && !dismissedAlerts.includes('vendor_dues');
  const hasDeadStock = alerts?.dead_stock?.trapped_capital > 0 && !dismissedAlerts.includes('dead_stock');

  const visibleAlertCount = (isAnniversaryToday ? 1 : 0) + (hasLowStock ? 1 : 0) + (hasVendorDues ? 1 : 0) + (hasDeadStock ? 1 : 0);

  return (
    <>
      {/* Dynamic Store Anniversary Celebratory Notification Banner */}
      {isAnniversaryToday && !isAnniversaryDismissed && (
        <div className="bg-gradient-to-r from-amber-500 via-pink-600 to-purple-600 text-white px-4 py-1.5 flex items-center justify-between text-xs font-bold shadow-md select-none animate-in slide-in-from-top duration-300 shrink-0 z-40 relative">
          <div className="flex items-center space-x-2 mx-auto">
            <span className="text-base animate-bounce">🎂</span>
            <span>
              🎉 Happy {yearsPassed}th Shop Anniversary to {shopName}! Established {foundationDate} • Celebrating {yearsPassed} glorious years of trust, love & smiles! ✨
            </span>
          </div>
          <button 
            onClick={() => setIsAnniversaryDismissed(true)} 
            className="p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors ml-2"
            title="Close banner for today"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between select-none z-30 relative shrink-0">
      {/* Brand & Store Name */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base text-slate-800 dark:text-white leading-tight tracking-tight flex items-center gap-1.5">
            {settings?.shop_name || "Dolly Toys and Kids Wear"}
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300">
              Dhule
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            POS & Inventory System • Offline-First Architecture
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-3">
        {/* Light / Dark Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-180 duration-200" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600 animate-in spin-in-180 duration-200" />
          )}
        </button>

        {/* Live Alerts Bell */}
        <div className="relative">
          <button
            onClick={() => setIsAlertsOpen(!isAlertsOpen)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 relative transition-colors"
            title="System Alerts & Notifications"
          >
            <Bell className="w-4 h-4" />
            {visibleAlertCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse">
                {visibleAlertCount}
              </span>
            )}
          </button>

          {/* Alerts Dropdown Popover */}
          {isAlertsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 z-50 animate-in fade-in zoom-in duration-150">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Live Operational Alerts
                </span>
                <div className="flex items-center space-x-2">
                  {visibleAlertCount > 0 && (
                    <button
                      onClick={dismissAll}
                      className="text-[10px] text-slate-400 hover:text-pink-600 font-bold"
                    >
                      Dismiss All
                    </button>
                  )}
                  <button onClick={() => setIsAlertsOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                {isAnniversaryToday && (
                  <div className="p-3 bg-gradient-to-tr from-pink-500/15 via-amber-500/15 to-purple-500/15 dark:from-pink-950/40 dark:to-amber-950/40 rounded-xl border border-pink-300 dark:border-pink-800/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-pink-700 dark:text-pink-300 flex items-center gap-1.5">
                        🎂 {anniversaryData?.title || `${yearsPassed}th Shop Anniversary`}
                      </span>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300">
                        {yearsPassed} Years ({anniversaryData?.opening_year || 2002}–{new Date().getFullYear()})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                      {anniversaryData?.message || `Celebrating ${yearsPassed} glorious years since foundation on ${foundationDate}!`}
                    </p>
                  </div>
                )}

                {hasLowStock && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/40 relative group">
                    <button
                      onClick={() => dismissAlert('low_stock')}
                      className="absolute top-2 right-2 text-rose-400 hover:text-rose-700 text-xs"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                    <span className="font-bold text-rose-700 dark:text-rose-300 block">
                      ⚠️ {alerts.low_stock.count} Low Stock Products
                    </span>
                    <span className="text-[11px] text-rose-600/80">Reorder required soon for child garments/toys.</span>
                  </div>
                )}

                {hasVendorDues && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/40 relative group">
                    <button
                      onClick={() => dismissAlert('vendor_dues')}
                      className="absolute top-2 right-2 text-amber-400 hover:text-amber-700 text-xs"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                    <span className="font-bold text-amber-800 dark:text-amber-300 block">
                      💳 {formatINR(alerts.vendor_dues.total_due_amount)} Supplier Dues
                    </span>
                    <span className="text-[11px] text-amber-700/80">Pending payments for {alerts.vendor_dues.vendor_count} vendors.</span>
                  </div>
                )}

                {hasDeadStock && (
                  <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-900/40 relative group">
                    <button
                      onClick={() => dismissAlert('dead_stock')}
                      className="absolute top-2 right-2 text-purple-400 hover:text-purple-700 text-xs"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                    <span className="font-bold text-purple-800 dark:text-purple-300 block">
                      📦 {formatINR(alerts.dead_stock.trapped_capital)} Trapped in Dead Stock
                    </span>
                    <span className="text-[11px] text-purple-700/80">{alerts.dead_stock.item_count} stagnant items unsold in 1+ Year.</span>
                  </div>
                )}

                {visibleAlertCount === 0 && (
                  <div className="text-center py-4 text-slate-400 text-xs">
                    ✓ All inventory and supplier dues are in healthy status!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Badge */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium">
            <UserIcon className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-bold">{user?.full_name?.replace(/\s*\([^)]*\)/g, '').trim() || user?.full_name || user?.username}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              isOwner() 
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' 
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
            }`}>
              {user?.role}
            </span>
          </div>

          <button
            onClick={logout}
            title="Logout"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
    </>
  );
};
