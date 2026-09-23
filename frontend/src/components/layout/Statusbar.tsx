import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useSettingStore } from '../../store/settingStore';
import { APP_VERSION, RELEASE_DATE, VERSION_HISTORY } from '../../config/version';
import axios from 'axios';
import { Database, ShieldCheck, Wifi, WifiOff, Clock, User as UserIcon, Store, Info, X, Tag, Sparkles, CheckCircle2 } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { user } = useAuthStore();
  const { settings } = useSettingStore();
  const [isConnected, setIsConnected] = useState(true);
  const [dbStatus, setDbStatus] = useState<string>('PostgreSQL Live');
  const [latency, setLatency] = useState<number>(2);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => {
    // Clock tick
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    // Heartbeat check every 10s via unauthenticated health endpoint
    const checkConnection = async () => {
      const start = Date.now();
      try {
        const res = await axios.get('http://127.0.0.1:8000/health', { timeout: 3000 });
        setLatency(Math.max(1, Date.now() - start));
        setIsConnected(true);
        if (res.data?.database) {
          setDbStatus(res.data.database);
        }
      } catch (e) {
        setIsConnected(false);
      }
    };

    checkConnection();
    const heartbeat = setInterval(checkConnection, 10000);

    return () => {
      clearInterval(timer);
      clearInterval(heartbeat);
    };
  }, []);

  return (
    <>
      <footer className="h-6 bg-slate-900 text-slate-400 border-t border-slate-800 px-3 flex items-center justify-between text-[11px] select-none z-30 font-mono">
        {/* Left: Backend & Database Connection Health */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className={`font-bold ${isConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isConnected ? `${dbStatus} (${latency}ms)` : 'Backend Disconnected (Offline)'}
            </span>
          </div>

          <span className="text-slate-600">|</span>

          <div className="flex items-center space-x-1 text-slate-300">
            <Store className="w-3 h-3 text-pink-500" />
            <span>{settings?.shop_name || 'Dolly Toys & Kids Wear'}</span>
          </div>
        </div>

        {/* Right: Cashier / User & Clock */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 text-slate-300">
            <UserIcon className="w-3 h-3 text-purple-400" />
            <span>{user?.full_name?.replace(/\s*\([^)]*\)/g, '').trim() || 'Somesh Bang'} • <strong className="text-purple-300">{user?.role || 'OWNER'}</strong></span>
          </div>

          <span className="text-slate-600">|</span>

          <div className="flex items-center space-x-1 text-slate-300">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{currentTime}</span>
          </div>

          <span className="text-slate-600">|</span>

          <button
            onClick={() => setShowChangelog(true)}
            title="Click to view Version History & What's New"
            className="flex items-center space-x-1 text-[10px] text-purple-300 hover:text-purple-200 bg-purple-950/60 hover:bg-purple-900/80 px-2 py-0.5 rounded border border-purple-800/50 transition cursor-pointer"
          >
            <Sparkles className="w-2.5 h-2.5 text-yellow-400" />
            <span className="font-bold">{APP_VERSION}</span>
          </button>
        </div>
      </footer>

      {/* Version History & Changelog Modal */}
      {showChangelog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-gradient-to-r from-purple-900/60 to-pink-900/60 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Tag className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">System Version & Release History</h3>
              </div>
              <button
                onClick={() => setShowChangelog(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-5 divide-y divide-slate-800">
              {VERSION_HISTORY.map((rel, idx) => (
                <div key={rel.version} className={idx > 0 ? 'pt-4' : ''}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${idx === 0 ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-800 text-slate-300'}`}>
                        {rel.version}
                      </span>
                      {idx === 0 && <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider">Current</span>}
                    </div>
                    <span className="text-xs text-slate-400 font-mono">{rel.date}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-2">{rel.title}</h4>
                  <ul className="space-y-1 text-xs text-slate-300 pl-1">
                    {rel.highlights.map((h, i) => (
                      <li key={i} className="flex items-start space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <span>Installed Version: <strong className="text-purple-300">{APP_VERSION}</strong> ({RELEASE_DATE})</span>
              <button
                onClick={() => setShowChangelog(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const Statusbar = StatusBar;
