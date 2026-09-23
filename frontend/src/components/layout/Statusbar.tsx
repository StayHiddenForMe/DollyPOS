import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useSettingStore } from '../../store/settingStore';
import axios from 'axios';
import { Database, ShieldCheck, Wifi, WifiOff, Clock, User as UserIcon, Store } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { user } = useAuthStore();
  const { settings } = useSettingStore();
  const [isConnected, setIsConnected] = useState(true);
  const [dbStatus, setDbStatus] = useState<string>('PostgreSQL Live');
  const [latency, setLatency] = useState<number>(2);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

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
          <span>{settings?.shop_name || 'Dolly Toys and Kids Wear, Dhule'}</span>
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

        <span className="text-[10px] text-slate-500">v1.2.4 (Offline-First)</span>
      </div>
    </footer>
  );
};

export const Statusbar = StatusBar;

