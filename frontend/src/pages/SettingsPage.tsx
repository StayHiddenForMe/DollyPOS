import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { StoreSettings, User, Category, Subcategory } from '../types';
import { useAuthStore } from '../store/authStore';
import { useSettingStore } from '../store/settingStore';
import { 
  Settings, 
  Save, 
  Database, 
  Printer, 
  Store, 
  Check, 
  AlertCircle, 
  Layers, 
  ShieldCheck, 
  Zap,
  Users,
  FolderPlus,
  KeyRound,
  Trash2,
  Plus,
  Edit3,
  X,
  Tag,
  Download,
  Upload,
  HardDrive,
  Info,
  Eye,
  EyeOff,
  FileKey,
  Lock
} from 'lucide-react';
import { formatINR } from '../utils/formatters';
import { ThermalReceiptView } from '../components/billing/ThermalReceiptView';
import { printBarcodeStickers, PrintStickerItem } from '../utils/printBarcode';

export const SettingsPage: React.FC = () => {
  const { isOwner } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'STORE' | 'STAFF' | 'CATEGORIES' | 'PRINTERS' | 'DATABASE' | 'BACKUP' | 'CLEANUP'>('STORE');

  const [settings, setSettings] = useState<Partial<StoreSettings>>({
    shop_name: 'Dolly Toys and Kids Wear',
    tag_line: 'Exclusive Kids Wear & Quality Toys',
    address: 'Agra Road, Near Mahatma Gandhi Statue, Dhule',
    mobile: '7972558842',
    gstin: '',
    show_gst_on_bill: false,
    upi_id: '7972558842@upi',
    bill_header: 'Tax Invoice / Retail Bill',
    bill_footer: 'Thank you for shopping at Dolly Toys! No exchange without original bill.',
    terms_and_conditions: '1. Goods once sold can be exchanged within 7 days with original tag and bill intact.\n2. No cash refund.',
    show_terms_on_bill: true,
    instagram_handle: '@dollytoys_dhule',
    show_instagram_on_bill: true,
    facebook_handle: '',
    show_facebook_on_bill: false,
    custom_social_label: '',
    custom_social_handle: '',
    show_custom_social_on_bill: false,
    thermal_width: '80mm',
    barcode_label_size: '50x25mm',
    theme_mode: 'light'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Data Purge / Cleanup State
  const [purgeType, setPurgeType] = useState<'INVOICES' | 'EXPENSES' | 'BOTH'>('INVOICES');
  const [purgeStartDate, setPurgeStartDate] = useState('2020-01-01');
  const [purgeEndDate, setPurgeEndDate] = useState('2023-12-31');
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);

  // Staff Management State
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({ username: '', full_name: '', password: '', role: 'CASHIER' });
  const [resetPwUserId, setResetPwUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<{ [userId: number]: boolean }>({});
  const [isEditStaffOpen, setIsEditStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<{ id: number; username: string; full_name: string; role: string; is_active: boolean } | null>(null);

  // 21-Word Security Factory Purge State
  const [isGeneratingPurgeKey, setIsGeneratingPurgeKey] = useState(false);
  const [purgeKeyFile, setPurgeKeyFile] = useState<File | null>(null);
  const [purgeKeyTextPreview, setPurgeKeyTextPreview] = useState<string | null>(null);
  const [isWipingTestData, setIsWipingTestData] = useState(false);
  const [factoryPurgeResult, setFactoryPurgeResult] = useState<string | null>(null);
  const purgeFileInputRef = useRef<HTMLInputElement>(null);

  // Category Management State
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newSubcatName, setNewSubcatName] = useState('');
  const [selectedCatIdForSubcat, setSelectedCatIdForSubcat] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ id: number; name: string } | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<{ id: number; name: string } | null>(null);

  // Hardware Printer Test Suite State
  const [testReceiptData, setTestReceiptData] = useState<any | null>(null);
  const [isGeneratingTestBarcode, setIsGeneratingTestBarcode] = useState(false);

  // Longevity & Database Optimization
  const [longevityAudit, setLongevityAudit] = useState<any>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeMsg, setOptimizeMsg] = useState<string | null>(null);

  // Backup & Disaster Recovery State
  const [existingBackups, setExistingBackups] = useState<any[]>([]);
  const [backupConfig, setBackupConfig] = useState({
    backup_path: 'C:\\DollyPos_Backups',
    auto_backup: true,
    backup_frequency: 'MONTHLY'
  });
  const [backupStatus, setBackupStatus] = useState<any>(null);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isSavingBackupPath, setIsSavingBackupPath] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    if (isOwner()) {
      fetchStaffUsers();
      fetchCategories();
      fetchLongevityAudit();
      fetchBackupStatus();
    }
  }, []);

  // Close active modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddStaffOpen) {
          e.preventDefault();
          setIsAddStaffOpen(false);
        } else if (resetPwUserId) {
          e.preventDefault();
          setResetPwUserId(null);
        } else if (selectedCatIdForSubcat) {
          e.preventDefault();
          setSelectedCatIdForSubcat(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddStaffOpen, resetPwUserId, selectedCatIdForSubcat]);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
      if (res.data.backup_path) {
        setBackupConfig(prev => ({
          ...prev,
          backup_path: res.data.backup_path,
          auto_backup: res.data.auto_backup ?? true
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStaffUsers = async () => {
    try {
      const res = await api.get('/auth/users');
      setStaffUsers(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLongevityAudit = async () => {
    try {
      const res = await api.get('/ai/longevity-audit');
      setLongevityAudit(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBackupStatus = async () => {
    try {
      const res = await api.get('/backup/status');
      setBackupStatus(res.data);
      setExistingBackups(res.data.backups || []);
      if (res.data.backup_directory) {
        setBackupConfig(prev => ({
          ...prev,
          backup_path: res.data.backup_directory,
          auto_backup: res.data.auto_backup_enabled ?? true
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await api.put('/settings', settings);
      setSettings(res.data);
      useSettingStore.getState().fetchSettings();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/users', newStaff);
      setIsAddStaffOpen(false);
      setNewStaff({ username: '', full_name: '', password: '', role: 'STAFF' });
      fetchStaffUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create staff account');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwUserId || !newPassword) return;
    try {
      await api.post('/auth/users/reset-password', {
        user_id: resetPwUserId,
        new_password: newPassword
      });
      alert('Password updated successfully!');
      setResetPwUserId(null);
      setNewPassword('');
      fetchStaffUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to reset password');
    }
  };

  const handleTogglePasswordVisibility = (userId: number) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleOpenEditStaff = (u: User) => {
    setEditingStaff({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      role: u.role,
      is_active: u.is_active
    });
    setIsEditStaffOpen(true);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      await api.put(`/auth/users/${editingStaff.id}`, {
        username: editingStaff.username,
        full_name: editingStaff.full_name,
        role: editingStaff.role,
        is_active: editingStaff.is_active
      });
      alert('Staff details updated successfully!');
      setIsEditStaffOpen(false);
      setEditingStaff(null);
      fetchStaffUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update staff account');
    }
  };

  const handleDeactivateStaff = async (userId: number, name: string) => {
    if (!window.confirm(`Deactivate staff user "${name}"?`)) return;
    try {
      await api.delete(`/auth/users/${userId}`);
      fetchStaffUsers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to deactivate user');
    }
  };

  // 21-Word Security Purge Handlers
  const handleGeneratePurgeKey = async () => {
    setIsGeneratingPurgeKey(true);
    setFactoryPurgeResult(null);
    try {
      const res = await api.get('/settings/generate-purge-key');
      const blob = new Blob([res.data.file_content], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', res.data.filename || 'dolly-pos-master-purge-key.txt');
      document.body.appendChild(link);
      link.click();
      link.remove();
      alert('21-Word Security Authorization Key downloaded successfully!\n\nTo wipe test data, upload this .txt file in Step 2 below.');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to generate security authorization key');
    } finally {
      setIsGeneratingPurgeKey(false);
    }
  };

  const handlePurgeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPurgeKeyFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPurgeKeyTextPreview(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleFactoryPurgeWipe = async () => {
    if (!purgeKeyTextPreview || !purgeKeyTextPreview.trim()) {
      alert('Please upload the downloaded 21-word key file (.txt) first.');
      return;
    }

    if (!window.confirm('CRITICAL FINAL CONFIRMATION:\n\nThis will permanently wipe all test data (inventory products, sales bills, purchases, expenses, customers, barcodes, damaged stock, whatsapp logs).\n\nYour Admin account and Store Settings will be preserved.\n\nAre you 100% sure you want to perform a factory reset?')) {
      return;
    }

    setIsWipingTestData(true);
    setFactoryPurgeResult(null);
    try {
      const res = await api.post('/settings/purge-all-test-data', {
        key_content: purgeKeyTextPreview
      });
      setFactoryPurgeResult(res.data.message);
      setPurgeKeyFile(null);
      setPurgeKeyTextPreview(null);
      if (purgeFileInputRef.current) {
        purgeFileInputRef.current.value = '';
      }
      alert(res.data.message);
      fetchSettings();
      fetchStaffUsers();
      fetchCategories();
      fetchLongevityAudit();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to execute factory reset purge');
    } finally {
      setIsWipingTestData(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.post('/categories', { name: newCatName.trim() });
      setNewCatName('');
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add category');
    }
  };

  const handleAddSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatIdForSubcat || !newSubcatName.trim()) return;
    try {
      await api.post('/categories/subcategories', {
        category_id: selectedCatIdForSubcat,
        name: newSubcatName.trim()
      });
      setNewSubcatName('');
      setSelectedCatIdForSubcat(null);
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add subcategory');
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) return;
    try {
      await api.put(`/categories/${editingCategory.id}`, { name: editingCategory.name.trim() });
      setEditingCategory(null);
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (catId: number, catName: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete Category "${catName}"? All its subcategories will also be deleted.`);
    if (!confirmDelete) return;
    try {
      await api.delete(`/categories/${catId}`);
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete category');
    }
  };

  const handleUpdateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubcategory || !editingSubcategory.name.trim()) return;
    try {
      await api.put(`/categories/subcategories/${editingSubcategory.id}`, { name: editingSubcategory.name.trim() });
      setEditingSubcategory(null);
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update subcategory');
    }
  };

  const handleDeleteSubcategory = async (subcatId: number, subcatName: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete Subcategory "${subcatName}"?`);
    if (!confirmDelete) return;
    try {
      await api.delete(`/categories/subcategories/${subcatId}`);
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete subcategory');
    }
  };

  // Hardware Printer Test Handlers
  const handleTestPrintReceipt = () => {
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    
    const mockBill = {
      bill_number: 'TEST-0001',
      bill_date: formattedDate,
      customer_name: 'Test Customer (Hardware Check)',
      customer_phone: '9876543210',
      shop_name: settings.shop_name || 'Dolly Toys & Kids Wear',
      tag_line: settings.tag_line || 'Exclusive Kids Wear & Quality Toys',
      is_tagline_bold: settings.is_tagline_bold || false,
      address: settings.address || 'Agra Road, Near Mahatma Gandhi Statue, Dhule',
      mobile: settings.mobile || '7972558842',
      gstin: settings.gstin || '',
      show_gst_on_bill: settings.show_gst_on_bill || false,
      upi_id: settings.upi_id || '7972558842@upi',
      bill_header: settings.bill_header || 'Tax Invoice / Retail Bill',
      bill_footer: settings.bill_footer || 'Thank you for shopping with Dolly Toys! Visit Again.',
      footer_font_size: settings.footer_font_size || '10px',
      is_footer_bold: settings.is_footer_bold || false,
      power_footer_font_size: settings.power_footer_font_size || '9px',
      is_power_footer_bold: settings.is_power_footer_bold || false,
      terms_and_conditions: settings.terms_and_conditions || '1. Goods once sold can be exchanged within 7 days with original tag and bill intact.\n2. No cash refund.',
      show_terms_on_bill: settings.show_terms_on_bill !== false,
      instagram_handle: settings.instagram_handle || '@dollytoys_dhule',
      show_instagram_on_bill: settings.show_instagram_on_bill !== false,
      items: [
        {
          item_name: 'Kids Cotton Party Shirt',
          size: '26',
          color: 'Sky Blue',
          quantity: 2,
          unit_price: 349.00,
          total_price: 698.00
        },
        {
          item_name: 'Plush Musical Teddy Bear',
          size: 'Medium',
          color: 'Brown',
          quantity: 1,
          unit_price: 499.00,
          total_price: 499.00
        }
      ],
      subtotal: 1197.00,
      discount_amount: 97.00,
      tax_amount: settings.show_gst_on_bill ? 55.00 : 0.00,
      grand_total: 1100.00,
      paid_amount: 1100.00,
      due_amount: 0.00,
      payment_mode: 'UPI',
      payment_status: 'PAID'
    };
    setTestReceiptData(mockBill);
  };

  const handleTestPrintBarcode = async (mode: '1UP_50x25' | '2UP_50x25' | 'A4_SHEET') => {
    setIsGeneratingTestBarcode(true);
    try {
      const res1 = await api.get('/barcode/generate/TEST-880011');
      const res2 = await api.get('/barcode/generate/TEST-880012');
      const img1 = res1.data.image_data_url || res1.data.barcode_base64;
      const img2 = res2.data.image_data_url || res2.data.barcode_base64;

      const sampleItems: PrintStickerItem[] = [
        {
          productName: 'Kids Denim Jeans (Test Label)',
          size: '26',
          color: 'Dark Blue',
          barcode: 'TEST-880011',
          mrp: 799.00,
          barcodeImage: img1
        },
        {
          productName: 'Remote Stunt Car (Test Label)',
          size: 'Std',
          color: 'Racing Red',
          barcode: 'TEST-880012',
          mrp: 599.00,
          barcodeImage: img2
        }
      ];

      if (mode === 'A4_SHEET') {
        const fullSheet: PrintStickerItem[] = [];
        for (let i = 0; i < 12; i++) {
          fullSheet.push(sampleItems[0]);
          fullSheet.push(sampleItems[1]);
        }
        printBarcodeStickers(fullSheet, 'A4_SHEET', 'left');
      } else if (mode === '2UP_50x25') {
        printBarcodeStickers(sampleItems, '2UP_50x25', 'left');
      } else {
        printBarcodeStickers([sampleItems[0]], '1UP_50x25', 'left');
      }
    } catch (err) {
      alert('Failed to generate test barcode stickers. Please ensure backend is running.');
    } finally {
      setIsGeneratingTestBarcode(false);
    }
  };

  const handleOptimizeDatabase = async () => {
    setIsOptimizing(true);
    setOptimizeMsg(null);
    try {
      const res = await api.post('/ai/optimize-indexes');
      setOptimizeMsg(res.data.message);
      fetchLongevityAudit();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to optimize indexes');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Backup & Restore Handlers
  const handleSaveBackupPath = async () => {
    setIsSavingBackupPath(true);
    setBackupMsg(null);
    try {
      const res = await api.post('/backup/save-config', {
        backup_path: backupConfig.backup_path,
        auto_backup: backupConfig.auto_backup,
        backup_frequency: 'MONTHLY'
      });
      // Also run instant test backup to verify folder works
      const backupRes = await api.post('/backup/create');
      setBackupMsg(`✓ Saved! Target folder set to: ${res.data.backup_path}. Verified with test backup: ${backupRes.data.file_name}`);
      fetchBackupStatus();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save backup path');
    } finally {
      setIsSavingBackupPath(false);
    }
  };

  const handleExportFullJsonBackup = async () => {
    try {
      const res = await api.get('/backup/export-full-json', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DollyToys_CompleteDatabaseBackup_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to export full database backup');
    }
  };

  const handleCreateInstantBackup = async () => {
    setIsCreatingBackup(true);
    setBackupMsg(null);
    try {
      const res = await api.post('/backup/create');
      setBackupMsg(res.data.message || 'Full database backup created successfully in folder!');
      fetchBackupStatus();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create backup snapshot');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleDownloadBackupFile = async (filename: string) => {
    try {
      const res = await api.get(`/backup/download/${filename}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to download backup file');
    }
  };

  const handleImportJsonBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmRestore = window.confirm(`WARNING: Are you sure you want to restore database from "${file.name}"? This will import all products, barcodes, vendors, and customers.`);
    if (!confirmRestore) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsRestoring(true);
    setRestoreMsg(null);
    try {
      const res = await api.post('/backup/import-full-json', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setRestoreMsg(res.data.message);
      alert(res.data.message);
      fetchLongevityAudit();
    } catch (err: any) {
      setRestoreMsg(err.response?.data?.detail || 'Failed to restore database from backup file.');
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 dark:bg-slate-950 overflow-y-auto select-none p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-white">
              Store, Staff, Hardware & Backup Studio
            </h1>
            <p className="text-xs text-slate-400">
              Manage shop identity, GSTIN display, staff accounts & passwords, categories, hardware printers, and 1-Click database backup & restore.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('STORE')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'STORE' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500'}`}
          >
            Store Identity
          </button>
          <button
            onClick={() => setActiveTab('STAFF')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'STAFF' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500'}`}
          >
            Staff & Passwords
          </button>
          <button
            onClick={() => setActiveTab('CATEGORIES')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'CATEGORIES' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500'}`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('PRINTERS')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'PRINTERS' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500'}`}
          >
            Printers
          </button>
          <button
            onClick={() => setActiveTab('BACKUP')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1 ${activeTab === 'BACKUP' ? 'bg-white dark:bg-slate-700 text-pink-600 dark:text-pink-400 shadow-xs' : 'text-slate-500'}`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Backup & Restore</span>
          </button>
          <button
            onClick={() => setActiveTab('DATABASE')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'DATABASE' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500'}`}
          >
            50-Yr Scale
          </button>
          <button
            onClick={() => setActiveTab('CLEANUP')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1 ${activeTab === 'CLEANUP' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-xs' : 'text-slate-500'}`}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Data Purge</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Store settings updated successfully! All receipts and POS modules refreshed.</span>
        </div>
      )}

      {/* TAB 1: STORE IDENTITY & GST */}
      {activeTab === 'STORE' && (
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h2 className="font-bold text-sm text-slate-800 dark:text-white border-b pb-2">
              Store Information & Tax Configuration
            </h2>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Shop Name
                </label>
                <input
                  type="text"
                  value={settings.shop_name}
                  onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Tagline / Subtitle
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.is_tagline_bold || false}
                      onChange={(e) => setSettings({ ...settings, is_tagline_bold: e.target.checked })}
                      className="w-3.5 h-3.5 text-pink-600 rounded border-slate-300 focus:ring-pink-500"
                    />
                    <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400">Bold on Bill</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={settings.tag_line || ''}
                  onChange={(e) => setSettings({ ...settings, tag_line: e.target.value })}
                  placeholder="e.g. Exclusive Kids Wear & Quality Toys"
                  className={`w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl ${settings.is_tagline_bold ? 'font-black' : ''}`}
                />
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Store Address
                </label>
                <input
                  type="text"
                  value={settings.address || ''}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Mobile Number
                </label>
                <input
                  type="text"
                  value={settings.mobile || ''}
                  onChange={(e) => setSettings({ ...settings, mobile: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  UPI ID (For Dynamic Billing QR)
                </label>
                <input
                  type="text"
                  value={settings.upi_id || ''}
                  onChange={(e) => setSettings({ ...settings, upi_id: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-pink-600 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Shop Opening / Established Date
                </label>
                <input
                  type="date"
                  value={settings.opening_date || '2002-01-01'}
                  onChange={(e) => setSettings({ ...settings, opening_date: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold text-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* GST Settings Box */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">
                GSTIN & Bill Tax Compliance (Optional)
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    GST Number (GSTIN)
                  </label>
                  <input
                    type="text"
                    value={settings.gstin || ''}
                    onChange={(e) => setSettings({ ...settings, gstin: e.target.value.toUpperCase() })}
                    placeholder="e.g. 27AABCU9603R1ZM (Leave blank if not registered)"
                    className="w-full px-3.5 py-2 uppercase bg-white dark:bg-slate-700 border rounded-xl font-mono font-bold"
                  />
                </div>

                <div className="flex items-center space-x-3 pt-6">
                  <input
                    type="checkbox"
                    id="show_gst"
                    checked={settings.show_gst_on_bill || false}
                    onChange={(e) => setSettings({ ...settings, show_gst_on_bill: e.target.checked })}
                    className="w-4 h-4 text-pink-600 rounded border-slate-300 focus:ring-pink-500"
                  />
                  <label htmlFor="show_gst" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Show GST Number & Tax Breakup on Printed Thermal Bills
                  </label>
                </div>
              </div>
            </div>

            {/* Receipt Footers & Branding Configuration */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">
                Receipt Footers & Branding Customization
              </h3>

              {/* Footer 1: Customer Greeting / Policy Line */}
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs">
                    Footer 1: Customer Greeting / Policy Line
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.is_footer_bold || false}
                      onChange={(e) => setSettings({ ...settings, is_footer_bold: e.target.checked })}
                      className="w-3.5 h-3.5 text-pink-600 rounded border-slate-300 focus:ring-pink-500"
                    />
                    <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400">Bold Text</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={settings.bill_footer || ''}
                      onChange={(e) => setSettings({ ...settings, bill_footer: e.target.value })}
                      placeholder="e.g. Thank you for shopping with us! Visit again!"
                      className={`w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border rounded-xl ${settings.is_footer_bold ? 'font-black' : 'font-semibold'}`}
                    />
                  </div>

                  <div>
                    <select
                      value={settings.footer_font_size || '10px'}
                      onChange={(e) => setSettings({ ...settings, footer_font_size: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border rounded-xl font-bold"
                    >
                      <option value="8px">8px — Ultra Compact</option>
                      <option value="9px">9px — Compact (Single Line Fit)</option>
                      <option value="10px">10px — Standard Default</option>
                      <option value="11px">11px — Medium</option>
                      <option value="12px">12px — Large</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Footer 2: Powered by Dolly POS Line */}
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300 text-xs block">
                      Footer 2: Software Powered By & Since Line
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      "Software powered by Dolly POS© | Since 2002"
                    </span>
                  </div>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.is_power_footer_bold || false}
                      onChange={(e) => setSettings({ ...settings, is_power_footer_bold: e.target.checked })}
                      className="w-3.5 h-3.5 text-pink-600 rounded border-slate-300 focus:ring-pink-500"
                    />
                    <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400">Bold Text</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="md:col-span-2">
                    <div className={`w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-900/60 border rounded-xl text-slate-600 dark:text-slate-300 text-xs ${settings.is_power_footer_bold ? 'font-black' : 'font-medium'}`}>
                      Software powered by Dolly POS© | Since 2002
                    </div>
                  </div>

                  <div>
                    <select
                      value={settings.power_footer_font_size || '9px'}
                      onChange={(e) => setSettings({ ...settings, power_footer_font_size: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border rounded-xl font-bold"
                    >
                      <option value="8px">8px — Ultra Compact</option>
                      <option value="9px">9px — Compact (Default)</option>
                      <option value="10px">10px — Standard</option>
                      <option value="11px">11px — Medium</option>
                      <option value="12px">12px — Large</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media Branding Box (Point 3: Extended handles) */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div>
                <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">
                  Social Media & Online Presence (Printed on Bill Footer)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Configure Instagram, Facebook, Threads, Website, and up to 5 custom handles printed in the bill's "Follow Us" section.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                {/* 1. Instagram */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Instagram Handle
                  </label>
                  <input
                    type="text"
                    value={settings.instagram_handle || ''}
                    onChange={(e) => setSettings({ ...settings, instagram_handle: e.target.value })}
                    placeholder="e.g. @dollytoys_dhule"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium"
                  />
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="show_insta"
                      checked={settings.show_instagram_on_bill || false}
                      onChange={(e) => setSettings({ ...settings, show_instagram_on_bill: e.target.checked })}
                      className="w-4 h-4 text-pink-600 rounded"
                    />
                    <label htmlFor="show_insta" className="text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                      Show Instagram on bill
                    </label>
                  </div>
                </div>

                {/* 2. Facebook */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Facebook Page / Username
                  </label>
                  <input
                    type="text"
                    value={settings.facebook_handle || ''}
                    onChange={(e) => setSettings({ ...settings, facebook_handle: e.target.value })}
                    placeholder="e.g. dollytoysdhule"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium"
                  />
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="show_fb"
                      checked={settings.show_facebook_on_bill || false}
                      onChange={(e) => setSettings({ ...settings, show_facebook_on_bill: e.target.checked })}
                      className="w-4 h-4 text-pink-600 rounded"
                    />
                    <label htmlFor="show_fb" className="text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                      Show Facebook on bill
                    </label>
                  </div>
                </div>

                {/* 3. Threads */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Threads Handle
                  </label>
                  <input
                    type="text"
                    value={settings.threads_handle || ''}
                    onChange={(e) => setSettings({ ...settings, threads_handle: e.target.value })}
                    placeholder="e.g. @dollytoys_dhule"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium"
                  />
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="show_threads"
                      checked={settings.show_threads_on_bill || false}
                      onChange={(e) => setSettings({ ...settings, show_threads_on_bill: e.target.checked })}
                      className="w-4 h-4 text-pink-600 rounded"
                    />
                    <label htmlFor="show_threads" className="text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                      Show Threads on bill
                    </label>
                  </div>
                </div>

                {/* 4. Website */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Website URL
                  </label>
                  <input
                    type="text"
                    value={settings.website_url || ''}
                    onChange={(e) => setSettings({ ...settings, website_url: e.target.value })}
                    placeholder="e.g. www.dollytoys.com"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium"
                  />
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="show_web"
                      checked={settings.show_website_on_bill || false}
                      onChange={(e) => setSettings({ ...settings, show_website_on_bill: e.target.checked })}
                      className="w-4 h-4 text-pink-600 rounded"
                    />
                    <label htmlFor="show_web" className="text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                      Show Website on bill
                    </label>
                  </div>
                </div>
              </div>

              {/* Custom Handles 1 to 5 */}
              <div className="border-t pt-3 space-y-3">
                <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Custom Handles & Channels (Up to 5)
                </span>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Custom 1 */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Label 1</label>
                        <input
                          type="text"
                          value={settings.custom_social_label || ''}
                          onChange={(e) => setSettings({ ...settings, custom_social_label: e.target.value })}
                          placeholder="e.g. YouTube / WhatsApp"
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Handle / Link 1</label>
                        <input
                          type="text"
                          value={settings.custom_social_handle || ''}
                          onChange={(e) => setSettings({ ...settings, custom_social_handle: e.target.value })}
                          placeholder="e.g. @dollytoysvlog"
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="show_custom1"
                        checked={settings.show_custom_social_on_bill || false}
                        onChange={(e) => setSettings({ ...settings, show_custom_social_on_bill: e.target.checked })}
                        className="w-4 h-4 text-pink-600 rounded"
                      />
                      <label htmlFor="show_custom1" className="text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                        Show Custom 1 on bill
                      </label>
                    </div>
                  </div>

                  {/* Custom 2 */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Label 2</label>
                        <input
                          type="text"
                          value={settings.custom_social_label2 || ''}
                          onChange={(e) => setSettings({ ...settings, custom_social_label2: e.target.value })}
                          placeholder="e.g. Pinterest / Catalog"
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Handle / Link 2</label>
                        <input
                          type="text"
                          value={settings.custom_social_handle2 || ''}
                          onChange={(e) => setSettings({ ...settings, custom_social_handle2: e.target.value })}
                          placeholder="e.g. wa.me/c/..."
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="show_custom2"
                        checked={settings.show_custom_social_on_bill2 || false}
                        onChange={(e) => setSettings({ ...settings, show_custom_social_on_bill2: e.target.checked })}
                        className="w-4 h-4 text-pink-600 rounded"
                      />
                      <label htmlFor="show_custom2" className="text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                        Show Custom 2 on bill
                      </label>
                    </div>
                  </div>

                  {/* Custom 3 */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Label 3</label>
                        <input
                          type="text"
                          value={settings.custom_social_label3 || ''}
                          onChange={(e) => setSettings({ ...settings, custom_social_label3: e.target.value })}
                          placeholder="e.g. Telegram / Channel"
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Handle / Link 3</label>
                        <input
                          type="text"
                          value={settings.custom_social_handle3 || ''}
                          onChange={(e) => setSettings({ ...settings, custom_social_handle3: e.target.value })}
                          placeholder="e.g. t.me/dollytoys"
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="show_custom3"
                        checked={settings.show_custom_social_on_bill3 || false}
                        onChange={(e) => setSettings({ ...settings, show_custom_social_on_bill3: e.target.checked })}
                        className="w-4 h-4 text-pink-600 rounded"
                      />
                      <label htmlFor="show_custom3" className="text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                        Show Custom 3 on bill
                      </label>
                    </div>
                  </div>

                  {/* Custom 4 */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Label 4</label>
                        <input
                          type="text"
                          value={settings.custom_social_label4 || ''}
                          onChange={(e) => setSettings({ ...settings, custom_social_label4: e.target.value })}
                          placeholder="e.g. Google Review"
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Handle / Link 4</label>
                        <input
                          type="text"
                          value={settings.custom_social_handle4 || ''}
                          onChange={(e) => setSettings({ ...settings, custom_social_handle4: e.target.value })}
                          placeholder="e.g. g.page/r/..."
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="show_custom4"
                        checked={settings.show_custom_social_on_bill4 || false}
                        onChange={(e) => setSettings({ ...settings, show_custom_social_on_bill4: e.target.checked })}
                        className="w-4 h-4 text-pink-600 rounded"
                      />
                      <label htmlFor="show_custom4" className="text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                        Show Custom 4 on bill
                      </label>
                    </div>
                  </div>

                  {/* Custom 5 */}
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Label 5</label>
                        <input
                          type="text"
                          value={settings.custom_social_label5 || ''}
                          onChange={(e) => setSettings({ ...settings, custom_social_label5: e.target.value })}
                          placeholder="e.g. Support Helpline"
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Handle / Link 5</label>
                        <input
                          type="text"
                          value={settings.custom_social_handle5 || ''}
                          onChange={(e) => setSettings({ ...settings, custom_social_handle5: e.target.value })}
                          placeholder="e.g. support@dollytoys.com"
                          className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-700 border rounded-lg font-medium text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="show_custom5"
                        checked={settings.show_custom_social_on_bill5 || false}
                        onChange={(e) => setSettings({ ...settings, show_custom_social_on_bill5: e.target.checked })}
                        className="w-4 h-4 text-pink-600 rounded"
                      />
                      <label htmlFor="show_custom5" className="text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                        Show Custom 5 on bill
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms and Conditions Box */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">
                  Store Terms & Conditions (Printed on Bill)
                </h3>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="show_terms"
                    checked={settings.show_terms_on_bill ?? true}
                    onChange={(e) => setSettings({ ...settings, show_terms_on_bill: e.target.checked })}
                    className="w-4 h-4 text-pink-600 rounded border-slate-300 focus:ring-pink-500"
                  />
                  <label htmlFor="show_terms" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    Print Terms on Thermal Bill
                  </label>
                </div>
              </div>
              <textarea
                value={settings.terms_and_conditions || ''}
                onChange={(e) => setSettings({ ...settings, terms_and_conditions: e.target.value })}
                rows={3}
                placeholder="e.g. 1. Exchange possible within 7 days with original tag and bill intact.&#10;2. No cash refund."
                className="w-full px-3.5 py-2 bg-white dark:bg-slate-700 border rounded-xl text-xs leading-relaxed"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-8 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-600/30 transition-all active:scale-95"
              >
                {isSaving ? 'Saving...' : 'Save Store Profile & Settings'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: STAFF & PASSWORDS (OWNER ONLY) */}
      {activeTab === 'STAFF' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h2 className="font-bold text-sm text-slate-800 dark:text-white">
                  Staff Accounts & Counter Permissions
                </h2>
                <p className="text-xs text-slate-400">
                  Add staff members with restricted billing access and reset passwords in 1-click.
                </p>
              </div>
              <button
                onClick={() => setIsAddStaffOpen(true)}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Staff Account</span>
              </button>
            </div>

            <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Username</th>
                    <th className="py-2.5 px-4">Full Name</th>
                    <th className="py-2.5 px-3 text-center">Role</th>
                    <th className="py-2.5 px-4 text-center">Password (Admin View)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {staffUsers.map((u) => {
                    const isRevealed = !!visiblePasswords[u.id];
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold">{u.username}</td>
                        <td className="py-3 px-4 font-semibold">{u.full_name}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            u.role === 'OWNER' 
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' 
                              : u.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : u.role === 'CASHIER'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}>
                            {u.role === 'CASHIER' ? 'CASHIER (POS Only)' : u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <span className="font-mono font-bold text-[11px] select-all">
                              {isRevealed ? (u.plain_password || '••••••••') : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleTogglePasswordVisibility(u.id)}
                              className="text-slate-400 hover:text-pink-600 transition-colors"
                              title={isRevealed ? "Hide Password" : "Show Plain Password"}
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {u.is_active ? 'ACTIVE' : 'DISABLED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleOpenEditStaff(u)}
                              className="p-1.5 text-slate-500 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Edit Staff Name & Role"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setResetPwUserId(u.id)}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-[10px] flex items-center space-x-1"
                              title="Reset Staff Password"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Reset</span>
                            </button>

                            {u.role !== 'OWNER' && u.is_active && (
                              <button
                                onClick={() => handleDeactivateStaff(u.id, u.full_name || u.username)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                title="Deactivate Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Staff Modal */}
          {isAddStaffOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 text-xs animate-in fade-in zoom-in duration-150">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-pink-500" />
                    Create Staff / Cashier Account
                  </h3>
                  <button onClick={() => setIsAddStaffOpen(false)} className="text-slate-400">✕</button>
                </div>

                <form onSubmit={handleCreateStaff} className="space-y-3">
                  <div>
                    <label className="block font-bold mb-1">Username (Login ID)</label>
                    <input
                      type="text"
                      value={newStaff.username}
                      onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                      placeholder="e.g. kishore, counter1, cashier1"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Full Name</label>
                    <input
                      type="text"
                      value={newStaff.full_name}
                      onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                      placeholder="e.g. Kishore Patil"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Account Role & Access Level</label>
                    <select
                      value={newStaff.role}
                      onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold"
                    >
                      <option value="CASHIER">CASHIER (Strictly POS Billing & Returns Only)</option>
                      <option value="STAFF">STAFF (Billing, Inventory, Barcode)</option>
                      <option value="ADMIN">ADMIN (Manager Access)</option>
                      <option value="OWNER">OWNER (Full Master Control)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Password</label>
                    <input
                      type="text"
                      value={newStaff.password}
                      onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                      placeholder="e.g. 1234, cash@2026"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono"
                      required
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddStaffOpen(false)}
                      className="px-4 py-2 border rounded-xl font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-pink-600 text-white rounded-xl font-bold shadow-md"
                    >
                      Create Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Staff Details Modal */}
          {isEditStaffOpen && editingStaff && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-4 text-xs animate-in fade-in zoom-in duration-150">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-pink-500" />
                    Edit Staff Profile: {editingStaff.username}
                  </h3>
                  <button onClick={() => { setIsEditStaffOpen(false); setEditingStaff(null); }} className="text-slate-400">✕</button>
                </div>

                <form onSubmit={handleUpdateStaff} className="space-y-3">
                  <div>
                    <label className="block font-bold mb-1">Username (Login ID)</label>
                    <input
                      type="text"
                      value={editingStaff.username}
                      onChange={(e) => setEditingStaff({ ...editingStaff, username: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editingStaff.full_name}
                      onChange={(e) => setEditingStaff({ ...editingStaff, full_name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Role & Permissions</label>
                    <select
                      value={editingStaff.role}
                      onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold"
                    >
                      <option value="CASHIER">CASHIER (Strictly POS Billing & Returns Only)</option>
                      <option value="STAFF">STAFF (Billing, Inventory, Barcode)</option>
                      <option value="ADMIN">ADMIN (Manager Access)</option>
                      <option value="OWNER">OWNER (Full Master Control)</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="edit_staff_active"
                      checked={editingStaff.is_active}
                      onChange={(e) => setEditingStaff({ ...editingStaff, is_active: e.target.checked })}
                      className="w-4 h-4 text-pink-600 rounded"
                    />
                    <label htmlFor="edit_staff_active" className="font-bold cursor-pointer">
                      Account is Active & Enabled for Login
                    </label>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setIsEditStaffOpen(false); setEditingStaff(null); }}
                      className="px-4 py-2 border rounded-xl font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-pink-600 text-white rounded-xl font-bold shadow-md"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Reset Password Modal */}
          {resetPwUserId && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-6 space-y-4 text-xs animate-in fade-in zoom-in duration-150">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-pink-500" />
                  Set New Password
                </h3>

                <form onSubmit={handleResetPassword} className="space-y-3">
                  <div>
                    <label className="block font-bold mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password..."
                      className="w-full px-3 py-2 bg-slate-50 border rounded-xl font-bold"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setResetPwUserId(null); setNewPassword(''); }}
                      className="px-4 py-2 border rounded-xl font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-pink-600 text-white rounded-xl font-bold shadow-md"
                    >
                      Update Password
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CATEGORIES & SUBCATEGORIES */}
      {activeTab === 'CATEGORIES' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <h2 className="font-bold text-sm text-slate-800 dark:text-white">
                  Category & Subcategory Hierarchy
                </h2>
                <p className="text-xs text-slate-400">
                  Organize inventory by creating parent departments, editing existing labels, or removing obsolete categories.
                </p>
              </div>

              {/* Add Parent Category Form */}
              <form onSubmit={handleAddCategory} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="New Category (e.g. Winter Wear)..."
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-semibold"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  + Add Category
                </button>
              </form>
            </div>

            {/* Category Cards */}
            <div className="grid grid-cols-2 gap-4">
              {categories.map((c) => (
                <div key={c.id} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                        <FolderPlus className="w-4 h-4 text-pink-500 shrink-0" />
                        {c.name}
                      </span>
                      {/* Edit Category Button */}
                      <button
                        onClick={() => setEditingCategory({ id: c.id, name: c.name })}
                        className="p-1 text-slate-400 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-slate-700 rounded-lg transition-all"
                        title={`Edit Category "${c.name}"`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {/* Delete Category Button */}
                      <button
                        onClick={() => handleDeleteCategory(c.id, c.name)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-all"
                        title={`Delete Category "${c.name}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => setSelectedCatIdForSubcat(c.id)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-700 border rounded-lg text-[11px] font-bold text-pink-600 hover:bg-pink-50 transition-all cursor-pointer"
                    >
                      + Subcategory
                    </button>
                  </div>

                  {/* Subcategories Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {c.subcategories.length > 0 ? (
                      c.subcategories.map((sc) => (
                        <div key={sc.id} className="group inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold text-[11px] shadow-2xs">
                          <span>{sc.name}</span>
                          <button
                            onClick={() => setEditingSubcategory({ id: sc.id, name: sc.name })}
                            className="text-slate-300 group-hover:text-pink-500 hover:text-pink-600 ml-1 transition-colors"
                            title={`Edit Subcategory "${sc.name}"`}
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubcategory(sc.id, sc.name)}
                            className="text-slate-300 group-hover:text-red-500 hover:text-red-600 transition-colors"
                            title={`Delete Subcategory "${sc.name}"`}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">No subcategories yet</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Subcategory Modal */}
          {selectedCatIdForSubcat && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-6 space-y-3 text-xs animate-in fade-in zoom-in duration-150">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                  Add Subcategory to: {categories.find(c => c.id === selectedCatIdForSubcat)?.name}
                </h3>

                <form onSubmit={handleAddSubcategory} className="space-y-3">
                  <input
                    type="text"
                    value={newSubcatName}
                    onChange={(e) => setNewSubcatName(e.target.value)}
                    placeholder="e.g. Rompers, Mittens, Remote Cars..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold"
                    autoFocus
                    required
                  />

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCatIdForSubcat(null)}
                      className="px-4 py-2 border rounded-xl font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-pink-600 text-white rounded-xl font-bold cursor-pointer shadow-sm"
                    >
                      Save Subcategory
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Category Modal */}
          {editingCategory && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-6 space-y-3 text-xs animate-in fade-in zoom-in duration-150">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-pink-500" />
                  Edit Category Name
                </h3>

                <form onSubmit={handleUpdateCategory} className="space-y-3">
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold"
                    autoFocus
                    required
                  />

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingCategory(null)}
                      className="px-4 py-2 border rounded-xl font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-pink-600 text-white rounded-xl font-bold cursor-pointer shadow-sm"
                    >
                      Update Category
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Subcategory Modal */}
          {editingSubcategory && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-6 space-y-3 text-xs animate-in fade-in zoom-in duration-150">
                <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-pink-500" />
                  Edit Subcategory Name
                </h3>

                <form onSubmit={handleUpdateSubcategory} className="space-y-3">
                  <input
                    type="text"
                    value={editingSubcategory.name}
                    onChange={(e) => setEditingSubcategory({ ...editingSubcategory, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold"
                    autoFocus
                    required
                  />

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingSubcategory(null)}
                      className="px-4 py-2 border rounded-xl font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-pink-600 text-white rounded-xl font-bold cursor-pointer shadow-sm"
                    >
                      Update Subcategory
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PRINTER DRIVER STUDIO & HARDWARE TEST LAB */}
      {activeTab === 'PRINTERS' && (
        <div className="space-y-5">
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h2 className="font-bold text-sm text-slate-800 dark:text-white">
                    Hardware Printer Driver Studio (Universal ESC/POS, TSPL, ZPL, A4)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Configure thermal paper width, barcode sticker rolls, and laser tax invoice sizes.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  {isSaving ? 'Saving...' : 'Save Presets'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border space-y-2.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Receipt Paper Width & Layout</span>
                  <select
                    value={settings.thermal_width || '80mm'}
                    onChange={(e) => setSettings({ ...settings, thermal_width: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border rounded-xl font-bold"
                  >
                    <option value="80mm">80mm (3-inch Standard POS Receipt - Epson / TVS / Star / Generic)</option>
                    <option value="58mm">58mm (2-inch Mini Thermal Receipt)</option>
                    <option value="112mm">112mm (4-inch Wide Thermal Format)</option>
                    <option value="A4">A4 Full Page Detailed Tax Invoice (Laser / Inkjet)</option>
                    <option value="A5">A5 Half Page Tax Invoice</option>
                  </select>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border space-y-2.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Barcode & Sticker Presets</span>
                  <select
                    value={settings.barcode_label_size || '50x25mm'}
                    onChange={(e) => setSettings({ ...settings, barcode_label_size: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border rounded-xl font-bold"
                  >
                    <option value="50x25mm">50 x 25 mm (1-Across Standard Thermal Roll - TSC / TVS / Zebra)</option>
                    <option value="50x25mm_2up">50 x 25 mm (2-Across Dual Roll - TSC TE244 / TVS LP46)</option>
                    <option value="38x25mm">38 x 25 mm (1.5" x 1" Small Garment Tag)</option>
                    <option value="50x35mm">50 x 35 mm (2" x 1.4" Detailed Sticker)</option>
                    <option value="100x50mm">100 x 50 mm (4" x 2" Master Box / Carton Label)</option>
                    <option value="a4_24up">A4 Sheet (24 Stickers / Page: 3x8 Grid - Laser/Inkjet)</option>
                    <option value="a4_40up">A4 Sheet (40 Stickers / Page: 4x10 Grid - Laser/Inkjet)</option>
                  </select>
                </div>
              </div>
            </div>
          </form>

          {/* HARDWARE PRINTER TEST LAB */}
          <div className="bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-blue-500/5 p-5 rounded-3xl border border-pink-100 dark:border-pink-900/30 space-y-5">
            <div className="flex items-center justify-between border-b border-pink-200/50 dark:border-pink-900/40 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-pink-600 text-white flex items-center justify-center shadow-md">
                  <Printer className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    Interactive Hardware Printer Test Lab
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-black uppercase">
                      Safe Test Mode • 0% Data Touch
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Connect your receipt or barcode printer to USB, then test live printing instantly using your active store headers, footers, and templates.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Card 1: Thermal Bill Receipt Test */}
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-pink-50 dark:bg-pink-900/30 text-pink-600 flex items-center justify-center">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800 dark:text-white">
                      Thermal POS Receipt Bill Test
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Layout: {settings.thermal_width || '80mm'} • Dynamic UPI QR • Dual Footers
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  Generates a sample 2-item retail bill with subtotal, discounts, GST breakdown, terms, and custom footers matching your store settings.
                </p>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleTestPrintReceipt}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-pink-400" />
                    <span>Test Print POS Receipt (Mock Bill)</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Barcode Label Printer Test */}
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800 dark:text-white">
                      Barcode Label & Sticker Roll Test
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      TSC TE244 / TVS LP46 / Zebra / Laser Sheet
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  Generates sample Code128 barcode stickers (Item, Size, MRP, Scannable Bars) across single rolls, 2-across rolls, or A4 sheets.
                </p>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isGeneratingTestBarcode}
                    onClick={() => handleTestPrintBarcode('1UP_50x25')}
                    className="py-2 px-2 bg-pink-50 hover:bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 font-bold text-[11px] rounded-xl border border-pink-200 dark:border-pink-800 flex items-center justify-center space-x-1 cursor-pointer"
                    title="1-Across Single Thermal Roll"
                  >
                    <span>1-Up Roll</span>
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingTestBarcode}
                    onClick={() => handleTestPrintBarcode('2UP_50x25')}
                    className="py-2 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-bold text-[11px] rounded-xl border border-purple-200 dark:border-purple-800 flex items-center justify-center space-x-1 cursor-pointer"
                    title="2-Across Dual Thermal Roll (TE244)"
                  >
                    <span>2-Up Dual</span>
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingTestBarcode}
                    onClick={() => handleTestPrintBarcode('A4_SHEET')}
                    className="py-2 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-bold text-[11px] rounded-xl border border-blue-200 dark:border-blue-800 flex items-center justify-center space-x-1 cursor-pointer"
                    title="A4 24-Up Sticker Sheet"
                  >
                    <span>A4 Grid (24)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Render Test Receipt Modal */}
      {testReceiptData && (
        <ThermalReceiptView
          receiptData={testReceiptData}
          onClose={() => setTestReceiptData(null)}
        />
      )}

      {/* TAB 5: BACKUP & DISASTER RECOVERY */}
      {activeTab === 'BACKUP' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-pink-500" />
                  Automatic Monthly Backup & Disaster Recovery Studio
                </h2>
                <p className="text-xs text-slate-400">
                  Guaranteed 0% data loss. Automatic full backups on the 1st of every month + manual instant exports.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportFullJsonBackup}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm"
                  title="Download complete database JSON archive"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Full Database (.JSON)</span>
                </button>

                <button
                  onClick={handleCreateInstantBackup}
                  disabled={isCreatingBackup}
                  className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm"
                  title="Create backup directly to configured folder"
                >
                  <Zap className="w-4 h-4 text-white" />
                  <span>{isCreatingBackup ? 'Saving Backup...' : 'Save Backup to Folder Now'}</span>
                </button>
              </div>
            </div>

            {backupMsg && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{backupMsg}</span>
              </div>
            )}

            {restoreMsg && (
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 rounded-2xl border border-blue-200 dark:border-blue-800 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{restoreMsg}</span>
              </div>
            )}

            {/* Section 1: AUTOMATIC 1ST-OF-THE-MONTH BACKUP & CUSTOM PATH CONFIG */}
            <div className="p-5 bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-blue-500/5 rounded-3xl border border-pink-100 dark:border-pink-900/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-pink-600 text-white flex items-center justify-center font-black text-xs">
                    01
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-2">
                      Automatic Monthly Backup on 1st of Every Month
                      <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 text-[10px] font-black uppercase">
                        Zero Data Loss Safe
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      On the 1st of every month (or whenever POS starts), a complete snapshot of all products, barcodes, bills, and customers is saved automatically to your chosen folder.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupConfig.auto_backup}
                    onChange={(e) => setBackupConfig({ ...backupConfig, auto_backup: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                  <span className="ml-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    {backupConfig.auto_backup ? 'Active (Enabled)' : 'Disabled'}
                  </span>
                </label>
              </div>

              {/* Custom Path Selection Input */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  📁 Automatic Backup Destination Folder / Path:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={backupConfig.backup_path}
                    onChange={(e) => setBackupConfig({ ...backupConfig, backup_path: e.target.value })}
                    placeholder="e.g. C:\DollyPos_Backups or D:\Store_Backups or E:\USB_Backup"
                    className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-800 border rounded-2xl font-mono text-xs font-bold text-slate-800 dark:text-white shadow-xs focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveBackupPath}
                    disabled={isSavingBackupPath}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl flex items-center space-x-1.5 shadow-sm transition-all"
                  >
                    <Save className="w-4 h-4 text-pink-400" />
                    <span>{isSavingBackupPath ? 'Saving...' : 'Save Path & Test Backup'}</span>
                  </button>
                </div>

                {/* Quick Directory Presets */}
                <div className="flex items-center space-x-2 pt-1 text-xs">
                  <span className="text-[11px] font-bold text-slate-400">Quick Path Presets:</span>
                  {['C:\\DollyPos_Backups', 'D:\\DollyPos_Backups', 'C:\\Users\\SomeshBang\\Desktop\\Dolly_Backups'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBackupConfig({ ...backupConfig, backup_path: preset })}
                      className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border hover:border-pink-500 text-[11px] font-mono text-slate-600 dark:text-slate-300 font-semibold"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 2: RESTORE / IMPORT AREA */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-pink-500" />
                  Restore Database from Any Previous Backup (.JSON)
                </div>
                <div className="text-[11px] text-slate-500">
                  Moving to a new laptop or recovering data? Select your `.json` backup file to restore 100% of products, barcodes, customers, and suppliers instantly.
                </div>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportJsonBackup}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRestoring}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  {isRestoring ? 'Restoring Database...' : 'Select Backup File (.JSON) to Restore'}
                </button>
              </div>
            </div>

            {/* Section 3: EXISTING LOCAL BACKUPS TABLE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-pink-500" />
                  Saved Backups in Destination Folder ({existingBackups.length} Files)
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  Folder: {backupConfig.backup_path}
                </span>
              </div>

              <div className="overflow-hidden border rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Backup Filename</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {existingBackups.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-slate-400">
                          No backup files found in this folder yet. Click "Save Path & Test Backup" above.
                        </td>
                      </tr>
                    ) : (
                      existingBackups.map((b, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-white">
                            {b.filename}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              b.is_auto_monthly || b.filename.includes('AutoMonthly')
                                ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {b.is_auto_monthly || b.filename.includes('AutoMonthly') ? '🗓️ Auto-Monthly' : '💾 Manual Snapshot'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-500">
                            {b.size_kb} KB
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleDownloadBackupFile(b.filename)}
                              className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-pink-50 hover:text-pink-600 font-bold rounded-lg text-[11px] transition-colors"
                            >
                              Download ⬇
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: 50-YEAR LONGEVITY & DATABASE */}
      {activeTab === 'DATABASE' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h2 className="font-bold text-sm text-slate-800 dark:text-white border-b pb-2">
              50-Year Longevity & 10 Lakhs Scale Engine
            </h2>

            {longevityAudit && (
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Current Catalog</span>
                  <span className="text-lg font-black font-mono">{longevityAudit.current_product_count} Products</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Total Invoices</span>
                  <span className="text-lg font-black font-mono">{longevityAudit.current_invoice_count} Bills</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">50-Year Projected DB Size</span>
                  <span className="text-lg font-black font-mono text-emerald-600">~{longevityAudit.projected_50_year_size_gb} GB</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Scale Capacity</span>
                  <span className="text-xs font-bold text-pink-600 block mt-1">10,000,000+ Products</span>
                </div>
              </div>
            )}

            {/* Explanation of VACUUM ANALYZE & Barcode Integrity */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/40 text-xs space-y-1.5">
              <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-600" />
                What happens when you click "Optimize 10-Lakhs Search Indexes (VACUUM ANALYZE)"?
              </div>
              <p className="text-blue-800/90 dark:text-blue-300">
                1. <strong>Barcodes & Data are 100% Untouched:</strong> Index optimization will <strong>NEVER</strong> change, rewrite, or regenerate any product barcodes, SKUs, sales bills, or customer records.
              </p>
              <p className="text-blue-800/90 dark:text-blue-300">
                2. <strong>Speed Maintenance:</strong> It instructs PostgreSQL to defragment memory space and update internal B-Tree search trees so 10-lakh item searches return in &lt;10 milliseconds.
              </p>
            </div>

            {optimizeMsg && <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200">{optimizeMsg}</div>}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleOptimizeDatabase}
                disabled={isOptimizing}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>{isOptimizing ? 'Optimizing Indexes...' : 'Optimize 10-Lakhs Search Indexes (VACUUM ANALYZE)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: DATA CLEANUP & HISTORICAL RANGE PURGE */}
      {activeTab === 'CLEANUP' && (
        <div className="space-y-6">
          {/* 1. HISTORICAL DATE-RANGE PURGE CARD (FIRST) */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex items-center space-x-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Historical Records Purge & Disk Space Reclaim
                </h2>
                <p className="text-xs text-slate-500">
                  Safely delete expired bills or expenses from past years (e.g. 2020 to 2023) to clear disk storage. Products, inventory stock, and customer khata balances are <strong>never</strong> deleted.
                </p>
              </div>
            </div>

            {/* Warning Alert */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Important Safety Information
              </div>
              <p className="text-amber-800/90 dark:text-amber-300">
                • Before purging, we recommend exporting a full JSON backup from the <strong>Backup & Restore</strong> tab.
              </p>
              <p className="text-amber-800/90 dark:text-amber-300">
                • Only invoices/expenses strictly within the selected date range will be purged.
              </p>
            </div>

            {/* Purge Form */}
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Records to Purge
                </label>
                <select
                  value={purgeType}
                  onChange={(e) => setPurgeType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold"
                >
                  <option value="INVOICES">📄 Sales Invoices / Bills Only</option>
                  <option value="EXPENSES">💸 Expenses Logs Only</option>
                  <option value="BOTH">💥 Both Bills & Expenses</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Start Date (From)
                </label>
                <input
                  type="date"
                  value={purgeStartDate}
                  onChange={(e) => setPurgeStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  End Date (To)
                </label>
                <input
                  type="date"
                  value={purgeEndDate}
                  onChange={(e) => setPurgeEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono"
                />
              </div>
            </div>

            {/* Confirmation Input */}
            <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/40 space-y-3">
              <label className="block text-xs font-bold text-rose-900 dark:text-rose-200">
                Security Confirmation: Type <span className="font-mono bg-rose-200 dark:bg-rose-900 px-1.5 py-0.5 rounded text-rose-900 dark:text-rose-100">DELETE</span> below to authorize:
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={purgeConfirmText}
                  onChange={(e) => setPurgeConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-64 px-3.5 py-2 bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-800 rounded-xl font-mono font-bold text-xs uppercase"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (purgeConfirmText.trim().toUpperCase() !== 'DELETE') {
                      alert('Please type DELETE in the confirmation box to authorize data purging.');
                      return;
                    }
                    if (!window.confirm(`FINAL WARNING: This will permanently erase ${purgeType} between ${purgeStartDate} and ${purgeEndDate}. This action CANNOT be undone. Proceed?`)) {
                      return;
                    }

                    setIsPurging(true);
                    setPurgeResult(null);
                    try {
                      const res = await api.post('/settings/purge-data', {
                        purge_type: purgeType,
                        start_date: purgeStartDate,
                        end_date: purgeEndDate,
                        confirmation: purgeConfirmText.trim().toUpperCase()
                      });
                      setPurgeResult(res.data.message);
                      setPurgeConfirmText('');
                      alert(res.data.message);
                    } catch (err: any) {
                      alert(err.response?.data?.detail || 'Failed to purge data');
                    } finally {
                      setIsPurging(false);
                    }
                  }}
                  disabled={isPurging || purgeConfirmText.trim().toUpperCase() !== 'DELETE'}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/30 flex items-center space-x-2 transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isPurging ? 'Purging Records...' : `Purge Range (${purgeStartDate} to ${purgeEndDate})`}</span>
                </button>
              </div>
            </div>

            {purgeResult && (
              <div className="p-3 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200">
                {purgeResult}
              </div>
            )}
          </div>

          {/* 2. FACTORY RESET & CLEAR ALL TEST DATA CARD (SECOND) */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border-2 border-rose-300 dark:border-rose-900/60 shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-rose-100 dark:border-rose-900/30 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-md shadow-rose-600/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      Clear All Test Data / Factory Reset
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 uppercase tracking-wide border border-rose-200">
                      🔒 21-Word Security Protocol
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Wipes all test data (inventory products, sales bills, purchases, expenses, customers, barcodes, damaged stock, whatsapp logs) for official shop launch.
                  </p>
                </div>
              </div>
            </div>

            {/* Safety & Barcode Guarantees */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl space-y-1">
                <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>100% Barcode Reuse Guarantee</span>
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                  Once test data is cleared, all previously created or scanned product barcodes are completely freed up and can be reused from scratch for your real store products.
                </p>
              </div>

              <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl space-y-1">
                <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Permanent Master Key & Admin Protection</span>
                </div>
                <p className="text-[11px] text-blue-800 dark:text-blue-300">
                  The lifetime master authorization key file is saved in your project folder as <code className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded text-[10px]">dolly_pos_master_security_key.txt</code>. Owner accounts & Store Settings are never deleted.
                </p>
              </div>
            </div>

            {/* Authorization Methods: Upload File OR Type 21 Words */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
              <h3 className="font-black text-slate-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-pink-500" />
                Authorize Factory Reset (Choose Method A or B)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method A: Upload File */}
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">
                      Method A: Upload Master Key File (.txt)
                    </span>
                    <p className="text-slate-400 text-[11px]">
                      Upload <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">dolly_pos_master_security_key.txt</code> from your project folder:
                    </p>
                  </div>

                  <input
                    ref={purgeFileInputRef}
                    type="file"
                    accept=".txt"
                    onChange={handlePurgeFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => purgeFileInputRef.current?.click()}
                    className={`w-full py-2.5 px-3 border-2 border-dashed rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all ${
                      purgeKeyFile
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-slate-300 dark:border-slate-600 hover:border-pink-500 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>{purgeKeyFile ? `✓ Loaded: ${purgeKeyFile.name}` : 'Select dolly_pos_master_security_key.txt'}</span>
                  </button>
                </div>

                {/* Method B: Paste 21 Words */}
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">
                      Method B: Paste 21 Words in Sequence
                    </span>
                    <p className="text-slate-400 text-[11px]">
                      Or paste the 21 words directly from your security key:
                    </p>
                  </div>

                  <textarea
                    rows={2}
                    value={purgeKeyTextPreview || ''}
                    onChange={(e) => setPurgeKeyTextPreview(e.target.value)}
                    placeholder="e.g. DOLLY POS RETAIL SHIELD MATRIX SUMMIT BEACON VECTOR..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-[11px] uppercase resize-none font-bold"
                  />
                </div>
              </div>

              {/* Wipe Action Button */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="text-[11px] text-slate-500">
                  {purgeKeyTextPreview ? (
                    <span className="text-emerald-600 font-bold">✓ 21-Word Security Authorization Key is loaded.</span>
                  ) : (
                    <span className="text-slate-400">Load the master key file or paste the 21 words above to enable data wipe.</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleFactoryPurgeWipe}
                  disabled={isWipingTestData || !purgeKeyTextPreview}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-600/30 flex items-center space-x-2 transition-all active:scale-95 whitespace-nowrap"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isWipingTestData ? 'Wiping All Test Records...' : 'Execute Factory Reset & Wipe All Test Data'}</span>
                </button>
              </div>
            </div>

            {factoryPurgeResult && (
              <div className="p-3.5 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-2xl border border-emerald-200 flex items-center space-x-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{factoryPurgeResult}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
