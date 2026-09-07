import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useSettingStore } from './store/settingStore';

import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Statusbar } from './components/layout/Statusbar';

import { LoginPage } from './pages/LoginPage';
import { BillingPage } from './pages/BillingPage';
import { BillsPage } from './pages/BillsPage';
import { InventoryPage } from './pages/InventoryPage';
import { DefectiveStockPage } from './pages/DefectiveStockPage';
import { BarcodePage } from './pages/BarcodePage';
import { PurchasePage } from './pages/PurchasePage';
import { VendorPage } from './pages/VendorPage';
import { CustomerPage } from './pages/CustomerPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { ExpensePage } from './pages/ExpensePage';
import { ReportsPage } from './pages/ReportsPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { SmartAdvisorPage } from './pages/SmartAdvisorPage';
import { WhatsAppMarketingPage } from './pages/WhatsAppMarketingPage';
import { ProcurementPlannerPage } from './pages/ProcurementPlannerPage';

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, isCashier } = useAuthStore();
  const { fetchSettings } = useSettingStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
    }
  }, [isAuthenticated, fetchSettings]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Cashier restriction wrapper
  const cashierGuard = (element: React.ReactElement) => {
    return isCashier() ? <Navigate to="/" replace /> : element;
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      <Navbar />
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Routes>
            <Route path="/" element={<BillingPage />} />
            <Route path="/returns" element={<ReturnsPage />} />
            <Route path="/bills" element={cashierGuard(<BillsPage />)} />
            <Route path="/dashboard" element={cashierGuard(<DashboardPage />)} />
            <Route path="/smart-advisor" element={cashierGuard(<SmartAdvisorPage />)} />
            <Route path="/ai-advisor" element={<Navigate to="/smart-advisor" replace />} />
            <Route path="/inventory" element={cashierGuard(<InventoryPage />)} />
            <Route path="/damaged-stock" element={cashierGuard(<DefectiveStockPage />)} />
            <Route path="/procurement" element={cashierGuard(<ProcurementPlannerPage />)} />
            <Route path="/barcode" element={cashierGuard(<BarcodePage />)} />
            <Route path="/purchases" element={cashierGuard(<PurchasePage />)} />
            <Route path="/vendors" element={cashierGuard(<VendorPage />)} />
            <Route path="/customers" element={cashierGuard(<CustomerPage />)} />
            <Route path="/expenses" element={cashierGuard(<ExpensePage />)} />
            <Route path="/reports" element={cashierGuard(<ReportsPage />)} />
            <Route path="/whatsapp" element={cashierGuard(<WhatsAppMarketingPage />)} />
            <Route path="/settings" element={cashierGuard(<SettingsPage />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <Statusbar />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
