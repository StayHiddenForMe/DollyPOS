import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../utils/api';
import { 
  MessageSquare, 
  Send, 
  Sparkles, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  CreditCard, 
  Gift, 
  RotateCw, 
  Zap, 
  ExternalLink,
  Save, 
  Check, 
  Smartphone, 
  Globe, 
  Settings, 
  ShieldCheck,
  Copy,
  ChevronRight,
  ChevronLeft,
  Search,
  CheckSquare,
  Square,
  Play,
  X,
  Filter,
  Tag,
  PhoneCall,
  SlidersHorizontal,
  Eye,
  Download,
  IndianRupee,
  Calendar,
  FileText,
  Receipt,
  Type,
  List,
  Minus,
  Smile,
  RefreshCcw
} from 'lucide-react';
import { formatINR } from '../utils/formatters';
import { 
  DEFAULT_WHATSAPP_BILL_TEMPLATE, 
  SAMPLE_TEST_RECEIPT_DATA, 
  renderWhatsAppBillMessage, 
  buildWhatsAppUrl as generateCleanWhatsAppUrl 
} from '../utils/whatsappFormatter';
import { useSettingStore } from '../store/settingStore';

export const WhatsAppMarketingPage: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [config, setConfig] = useState<any>({
    store_phone: '7972558842',
    store_name: 'Dolly Toys and Kids Wear',
    store_address: 'Agra Road, Near Mahatma Gandhi Statue, Dhule',
    upi_id: '7972558842@upi',
    provider: 'DIRECT_WEB',
    meta_api_token: '',
    meta_phone_number_id: '',
    meta_business_account_id: '',
    is_connected: true
  });
  const [templates, setTemplates] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'CAMPAIGNS' | 'BILL_TEMPLATE' | 'KHATA_REMINDERS' | 'TEST_SENDER' | 'SETTINGS' | 'LOGS'>('CAMPAIGNS');

  // Broadcast Studio State
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTemplateId, setSelectedTemplateId] = useState('diwali_greeting');
  const [customTemplateText, setCustomTemplateText] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  // Bill Template Designer State
  const [billTemplateText, setBillTemplateText] = useState<string>(DEFAULT_WHATSAPP_BILL_TEMPLATE);
  const [testBillPhone, setTestBillPhone] = useState<string>('');
  const [savingBillTemplate, setSavingBillTemplate] = useState<boolean>(false);
  const [billTemplateFeedback, setBillTemplateFeedback] = useState<string | null>(null);
  const billTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Advanced Target Audience Filters
  const [spendTier, setSpendTier] = useState<'ALL' | '1K' | '2K' | '3K' | '5K' | '10K' | 'CUSTOM'>('ALL');
  const [minSpendInput, setMinSpendInput] = useState<string>('2000');
  const [maxSpendInput, setMaxSpendInput] = useState<string>('');
  const [dueFilter, setDueFilter] = useState<'ALL' | 'HAS_DUE' | 'DUE_500' | 'DUE_1K' | 'DUE_2K'>('ALL');
  const [visitFilter, setVisitFilter] = useState<'ALL' | '3_PLUS' | 'SINGLE' | 'INACTIVE'>('ALL');

  // Step-by-Step Manual Dispatch Assistant Modal State
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantIndex, setAssistantIndex] = useState(0);
  const [assistantSentIds, setAssistantSentIds] = useState<number[]>([]);

  // Single Direct Chat Form
  const [singlePhone, setSinglePhone] = useState('');
  const [singleName, setSingleName] = useState('');
  const [singleMessage, setSingleMessage] = useState('Namaskar! Special greetings from our store.');
  const [sendingSingle, setSendingSingle] = useState(false);
  const [singleFeedback, setSingleFeedback] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Listen for Escape key to close the Step-by-Step Assistant modal (Point 4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAssistantOpen) {
        e.preventDefault();
        setIsAssistantOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAssistantOpen]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [statusRes, configRes, tmplRes, logsRes, custRes, billTmplRes] = await Promise.all([
        api.get('/whatsapp/status').catch(() => ({ data: null })),
        api.get('/whatsapp/config').catch(() => ({ data: null })),
        api.get('/whatsapp/templates').catch(() => ({ data: [] })),
        api.get('/whatsapp/logs').catch(() => ({ data: [] })),
        api.get('/customers').catch(() => ({ data: [] })),
        api.get('/whatsapp/bill-template').catch(() => ({ data: { template: DEFAULT_WHATSAPP_BILL_TEMPLATE } }))
      ]);

      if (statusRes.data) setStatus(statusRes.data);
      if (configRes.data) {
        setConfig(configRes.data);
      }
      if (tmplRes.data) {
        setTemplates(tmplRes.data);
        if (tmplRes.data.length > 0) {
          setSelectedTemplateId(tmplRes.data[0].id);
          setCustomTemplateText(tmplRes.data[0].template);
        }
      }
      if (logsRes.data) setLogs(logsRes.data);
      if (custRes.data) {
        setCustomers(custRes.data);
        setSelectedCustomerIds(custRes.data.map((c: any) => c.id));
      }
      if (billTmplRes.data?.template) {
        setBillTemplateText(billTmplRes.data.template);
      }
    } catch (e) {
      console.error('Failed to load WhatsApp data', e);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach(t => {
      if (t.category) set.add(t.category);
    });
    return ['All', ...Array.from(set)];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'All') return templates;
    return templates.filter(t => t.category === selectedCategory);
  }, [templates, selectedCategory]);

  // Handle Category Click: Immediately switches category AND auto-selects first template + updates text (Point 2)
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    const available = cat === 'All' ? templates : templates.filter(t => t.category === cat);
    if (available.length > 0) {
      setSelectedTemplateId(available[0].id);
      setCustomTemplateText(available[0].template);
    }
  };

  // Handle Template Dropdown Change: Immediately updates selectedTemplateId and message content (Point 2)
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const found = templates.find(t => t.id === templateId);
    if (found) {
      setCustomTemplateText(found.template);
    }
  };

  // Insert Dynamic Tag at Cursor Position in Textarea (Point 2)
  const handleInsertTag = (tag: string) => {
    const tagText = `{${tag}}`;
    if (!textareaRef.current) {
      setCustomTemplateText(prev => prev + ` ${tagText} `);
      return;
    }
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = customTemplateText;
    const newVal = currentVal.substring(0, start) + tagText + currentVal.substring(end);
    setCustomTemplateText(newVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tagText.length, start + tagText.length);
    }, 0);
  };

  // Filtered Customers based on Search, Spend Tier, Khata Due & Visits (Points 1 & 6)
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // 1. Search Query
      if (customerSearch.trim() !== '') {
        const query = customerSearch.toLowerCase().trim();
        const matchName = c.name && c.name.toLowerCase().includes(query);
        const matchPhone = c.phone && c.phone.includes(query);
        const matchCity = c.city && c.city.toLowerCase().includes(query);
        if (!matchName && !matchPhone && !matchCity) return false;
      }

      // Customer financial values
      const spend = Number(c.total_spend || c.total_spent || 0);
      const due = Number(c.credit_balance || 0);
      const visits = Number(c.visit_count || 0);

      // 2. Spend Tier Filter (Point 6)
      if (spendTier === '1K' && spend < 1000) return false;
      if (spendTier === '2K' && spend < 2000) return false;
      if (spendTier === '3K' && spend < 3000) return false;
      if (spendTier === '5K' && spend < 5000) return false;
      if (spendTier === '10K' && spend < 10000) return false;
      if (spendTier === 'CUSTOM') {
        const min = minSpendInput ? parseFloat(minSpendInput) : 0;
        const max = maxSpendInput ? parseFloat(maxSpendInput) : Infinity;
        if (spend < min || spend > max) return false;
      }

      // 3. Khata Due Filter
      if (dueFilter === 'HAS_DUE' && due <= 0) return false;
      if (dueFilter === 'DUE_500' && due < 500) return false;
      if (dueFilter === 'DUE_1K' && due < 1000) return false;
      if (dueFilter === 'DUE_2K' && due < 2000) return false;

      // 4. Visit Frequency Filter
      if (visitFilter === '3_PLUS' && visits < 3) return false;
      if (visitFilter === 'SINGLE' && visits > 1) return false;
      if (visitFilter === 'INACTIVE') {
        if (!c.last_visit_at) return true;
        const days = (Date.now() - new Date(c.last_visit_at).getTime()) / (1000 * 3600 * 24);
        if (days < 30) return false;
      }

      return true;
    });
  }, [customers, customerSearch, spendTier, minSpendInput, maxSpendInput, dueFilter, visitFilter]);

  const selectedCustomers = useMemo(() => {
    return filteredCustomers.filter(c => selectedCustomerIds.includes(c.id));
  }, [filteredCustomers, selectedCustomerIds]);

  const handleSelectAllAudience = () => {
    const ids = filteredCustomers.map(c => c.id);
    setSelectedCustomerIds(ids);
  };

  const handleDeselectAllAudience = () => {
    setSelectedCustomerIds([]);
  };

  const handleInvertAudience = () => {
    const currentlySelected = new Set(selectedCustomerIds);
    const newSelected = filteredCustomers
      .filter(c => !currentlySelected.has(c.id))
      .map(c => c.id);
    setSelectedCustomerIds(newSelected);
  };

  const toggleCustomerSelection = (id: number) => {
    if (selectedCustomerIds.includes(id)) {
      setSelectedCustomerIds(selectedCustomerIds.filter(x => x !== id));
    } else {
      setSelectedCustomerIds([...selectedCustomerIds, id]);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setConfigFeedback(null);
    try {
      const res = await api.post('/whatsapp/config', config);
      setConfigFeedback('✓ WhatsApp configuration & Meta Cloud API settings saved successfully!');
      const statusRes = await api.get('/whatsapp/status');
      setStatus(statusRes.data);
    } catch (e: any) {
      setConfigFeedback(`❌ Error: ${e.response?.data?.detail || 'Failed to update settings'}`);
    } finally {
      setSavingConfig(false);
    }
  };

  // Insert Dynamic Tag at Cursor Position in Bill Template Designer
  const handleInsertBillTag = (tag: string) => {
    const tagText = `{${tag}}`;
    if (!billTextareaRef.current) {
      setBillTemplateText(prev => prev + ` ${tagText} `);
      return;
    }
    const textarea = billTextareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = billTemplateText;
    const newVal = currentVal.substring(0, start) + tagText + currentVal.substring(end);
    setBillTemplateText(newVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tagText.length, start + tagText.length);
    }, 0);
  };

  // Insert Formatting (*bold*, _italic_, ~strikethrough~, `code`, etc.)
  const handleInsertBillFormatting = (prefix: string, suffix: string = prefix) => {
    if (!billTextareaRef.current) {
      setBillTemplateText(prev => prev + prefix + 'text' + suffix);
      return;
    }
    const textarea = billTextareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = billTemplateText;
    const selected = currentVal.substring(start, end) || 'text';
    const newVal = currentVal.substring(0, start) + prefix + selected + suffix + currentVal.substring(end);
    setBillTemplateText(newVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  // Insert Emoji at Cursor Position
  const handleInsertBillEmoji = (emoji: string) => {
    if (!billTextareaRef.current) {
      setBillTemplateText(prev => prev + emoji);
      return;
    }
    const textarea = billTextareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = billTemplateText;
    const newVal = currentVal.substring(0, start) + emoji + currentVal.substring(end);
    setBillTemplateText(newVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  // Save Bill Template to Database & Global Store
  const handleSaveBillTemplate = async () => {
    setSavingBillTemplate(true);
    setBillTemplateFeedback(null);
    try {
      await api.post('/whatsapp/bill-template', { template: billTemplateText });
      setBillTemplateFeedback('✓ WhatsApp Bill Template saved successfully! It will now be used across all POS bills.');
      // Also update settings in Zustand store for instant live sync
      const { updateSettings } = useSettingStore.getState();
      await updateSettings({ whatsapp_bill_template: billTemplateText });
    } catch (e: any) {
      setBillTemplateFeedback(`❌ Error: ${e.response?.data?.detail || 'Failed to save bill template'}`);
    } finally {
      setSavingBillTemplate(false);
    }
  };

  // Factory Reset Bill Template to Standard Default
  const handleResetBillTemplate = () => {
    if (window.confirm('Reset WhatsApp Bill Template to standard factory default?')) {
      setBillTemplateText(DEFAULT_WHATSAPP_BILL_TEMPLATE);
      setBillTemplateFeedback('✓ Template reset to standard default. Click "Save Template" to apply permanently.');
    }
  };

  // Send Test Bill to WhatsApp
  const handleSendTestBill = () => {
    const renderedMsg = renderWhatsAppBillMessage(billTemplateText, SAMPLE_TEST_RECEIPT_DATA);
    const url = generateCleanWhatsAppUrl(testBillPhone, renderedMsg);
    window.open(url, '_blank');
  };

  /**
   * Universal WhatsApp URL Generator with Emoji & Newline Normalization (Point 3)
   * Converts Windows CRLF \r\n to standard \n so that WhatsApp Web & Desktop preserve all
   * line breaks, paragraphs, and 4-byte UTF-8 emoji characters without mangling into .
   */
  const buildWhatsAppUrl = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    // Normalize newlines to prevent %0D%0A double-encoding and preserve line breaks
    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    return `https://api.whatsapp.com/send/?phone=${finalPhone}&text=${encodeURIComponent(normalizedText)}&type=phone_number&app_absent=0`;
  };

  const openWhatsAppDirect = (phone: string, text: string) => {
    const url = buildWhatsAppUrl(phone, text);
    window.open(url, '_blank');
  };

  const personalizeTextForCustomer = (cust: any, templateText: string) => {
    let cleanName = (cust?.name || 'Customer').trim();
    if (/^Customer\s*\(\d+\)$/i.test(cleanName) || cleanName === '') {
      cleanName = 'Customer';
    }

    return templateText
      .replace(/{name}/g, cleanName)
      .replace(/{balance}/g, (cust?.credit_balance || 0).toLocaleString('en-IN'))
      .replace(/{total_spend}/g, (cust?.total_spend || cust?.total_spent || 0).toLocaleString('en-IN'))
      .replace(/{city}/g, cust?.city || 'Dhule')
      .replace(/{store_name}/g, config.store_name || 'Dolly Toys and Kids Wear')
      .replace(/{phone}/g, config.store_phone || '7972558842')
      .replace(/{upi_id}/g, config.upi_id || `${config.store_phone || '7972558842'}@upi`)
      .replace(/{store_address}/g, config.store_address || 'Agra Road, Near Mahatma Gandhi Statue, Dhule');
  };

  const copyBroadcastNumbers = () => {
    const validPhones = selectedCustomers
      .map(c => c.phone ? c.phone.replace(/\D/g, '') : '')
      .filter(p => p.length >= 10);

    if (validPhones.length === 0) {
      alert('No valid phone numbers found in the selected customer list.');
      return;
    }

    const commaSeparated = validPhones.map(p => p.length === 10 ? `+91${p}` : `+${p}`).join(', ');
    navigator.clipboard.writeText(commaSeparated);
    
    setCopiedToast(`✓ Copied ${validPhones.length} customer phone numbers to clipboard! Ready to paste into WhatsApp Broadcast.`);
    setTimeout(() => setCopiedToast(null), 4000);
  };

  const exportAudienceCSV = () => {
    if (selectedCustomers.length === 0) {
      alert('No customers selected to export.');
      return;
    }
    const headers = 'Name,Phone,City,Total Spend,Khata Due,Visit Count\n';
    const rows = selectedCustomers.map(c => 
      `"${c.name || ''}","+91${c.phone || ''}","${c.city || 'Dhule'}",${c.total_spend || c.total_spent || 0},${c.credit_balance || 0},${c.visit_count || 0}`
    ).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `WhatsApp_Audience_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startStepByStepAssistant = () => {
    if (selectedCustomers.length === 0) {
      alert('Please select at least one customer to start broadcast.');
      return;
    }
    setAssistantIndex(0);
    setAssistantSentIds([]);
    setIsAssistantOpen(true);
  };

  const handleAssistantNext = async () => {
    const currentCust = selectedCustomers[assistantIndex];
    if (!currentCust || !currentCust.phone) return;

    const personalizedMsg = personalizeTextForCustomer(currentCust, customTemplateText);

    // Open WhatsApp Web in new tab with emoji & line break safe URL
    openWhatsAppDirect(currentCust.phone, personalizedMsg);

    // Record in backend delivery logs
    try {
      await api.post('/whatsapp/send-single', {
        recipient_phone: currentCust.phone,
        recipient_name: currentCust.name || 'Customer',
        message_text: personalizedMsg,
        message_type: 'CUSTOM_BROADCAST'
      });
    } catch (e) {
      console.warn('Could not log dispatch', e);
    }

    setAssistantSentIds(prev => [...prev, currentCust.id]);

    // Advance to next customer
    if (assistantIndex < selectedCustomers.length - 1) {
      setAssistantIndex(assistantIndex + 1);
    }
  };

  const handleAssistantSkip = () => {
    if (assistantIndex < selectedCustomers.length - 1) {
      setAssistantIndex(assistantIndex + 1);
    }
  };

  const handleOpenAllTabsSequentially = () => {
    if (selectedCustomers.length === 0) return;
    if (selectedCustomers.length > 12) {
      const confirmOpen = window.confirm(
        `You have selected ${selectedCustomers.length} customers. Opening too many tabs simultaneously may be blocked by your browser popup blocker. Do you want to proceed? (Tip: Use the "Step-by-Step Dispatch Assistant" for a much smoother experience).`
      );
      if (!confirmOpen) return;
    }

    selectedCustomers.forEach((cust, idx) => {
      if (!cust.phone) return;
      const personalizedMsg = personalizeTextForCustomer(cust, customTemplateText);
      setTimeout(() => {
        openWhatsAppDirect(cust.phone, personalizedMsg);
      }, idx * 400);
    });
  };

  const handleSendSingle = async (phoneToUse?: string, nameToUse?: string, openDirect: boolean = true) => {
    const targetPhone = phoneToUse || singlePhone;
    const targetName = nameToUse || singleName;

    if (openDirect) {
      openWhatsAppDirect(targetPhone, singleMessage);
    }

    setSendingSingle(true);
    setSingleFeedback(null);
    try {
      await api.post('/whatsapp/send-single', {
        recipient_phone: targetPhone,
        recipient_name: targetName,
        message_text: singleMessage,
        message_type: 'CUSTOM_BROADCAST'
      });
      setSingleFeedback(`✓ Message opened & logged for +91 ${targetPhone}!`);
      const logsRes = await api.get('/whatsapp/logs');
      setLogs(logsRes.data);
    } catch (e: any) {
      setSingleFeedback(`❌ Error: ${e.response?.data?.detail || 'Failed to log message'}`);
    } finally {
      setSendingSingle(false);
    }
  };

  const handleSendKhataReminder = async (cust: any) => {
    const storeName = config.store_name || 'our store';
    const storeAddr = config.store_address || 'our showroom';
    const storeUpi = config.upi_id || `${config.store_phone || '7972558842'}@upi`;
    const template = templates.find(t => t.id === 'khata_reminder')?.template || 
      `Namaskar {name} ji, 🙏\n\nThis is a gentle reminder regarding your outstanding Khata balance of *₹{balance}* at *${storeName}*.\n\n📲 *Pay easily via UPI:* ${storeUpi}\nOr visit our shop at ${storeAddr}.\n\nThank you for shopping with us! 😊`;
    
    const text = personalizeTextForCustomer(cust, template);
    openWhatsAppDirect(cust.phone, text);

    try {
      await api.post('/whatsapp/send-single', {
        recipient_phone: cust.phone,
        recipient_name: cust.name,
        message_text: text,
        message_type: 'KHATA_REMINDER'
      });
      const logsRes = await api.get('/whatsapp/logs');
      setLogs(logsRes.data);
    } catch (e) {
      console.warn('Failed to log reminder', e);
    }
  };

  const previewCustomer = selectedCustomers[0] || filteredCustomers[0] || {
    name: 'Aarav Sharma',
    phone: '9876543210',
    city: 'Dhule',
    credit_balance: 1450,
    total_spend: 18500
  };

  const samplePreviewText = personalizeTextForCustomer(previewCustomer, customTemplateText);

  return (
    <div className="h-full flex flex-col p-4 bg-slate-100 dark:bg-slate-950 overflow-hidden space-y-3 select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-500" />
            WhatsApp Marketing & Customer Broadcast Studio
          </h1>
          <p className="text-xs text-slate-500">
            Send festive wishes, new collection launches, custom promotions & Khata reminders directly to customers via WhatsApp.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <Zap className="w-3.5 h-3.5 text-emerald-500" />
            <span>Store Phone: +91 {config.store_phone}</span>
          </div>

          <button
            onClick={fetchInitialData}
            disabled={loading}
            className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold hover:text-emerald-600 transition-all active:scale-95"
            title="Refresh Data"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit text-xs font-bold">
        {[
          { id: 'CAMPAIGNS', label: 'Festival & Collection Broadcasts', icon: Gift },
          { id: 'BILL_TEMPLATE', label: 'Bill / Receipt Template', icon: FileText },
          { id: 'KHATA_REMINDERS', label: 'Khata Due Reminders', icon: CreditCard },
          { id: 'TEST_SENDER', label: 'Quick Direct Chat', icon: Send },
          { id: 'SETTINGS', label: 'Settings & Meta API', icon: Settings },
          { id: 'LOGS', label: 'Delivery History', icon: Clock },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Tab Container */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col p-4">
        
        {/* TAB 1: FESTIVAL & COLLECTION BROADCAST STUDIO */}
        {activeTab === 'CAMPAIGNS' && (
          <div className="h-full flex gap-4 overflow-hidden">
            {/* Left Column: Template Selection, Tags & Message Composer */}
            <div className="w-7/12 flex flex-col space-y-2.5 overflow-y-auto pr-2">
              {/* 1. Category Filter Pills (Point 2) */}
              <div>
                <label className="font-bold text-xs text-slate-700 dark:text-slate-200 block mb-1">
                  1. Choose Template Category
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => handleCategoryChange(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                        selectedCategory === cat
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Dropdown */}
              <div>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  {filteredTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* 2. Message Composer with Insert Tag Chips (Point 2) */}
              <div className="flex-1 flex flex-col min-h-[220px]">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-xs text-slate-700 dark:text-slate-200">
                    2. Message Content & Dynamic Tags
                  </label>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-[10.5px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    <span>{showPreview ? 'Hide Preview' : 'Show Live Preview'}</span>
                  </button>
                </div>

                {/* Tag Insert Buttons (Point 2) */}
                <div className="flex flex-wrap items-center gap-1 mb-1.5 p-1.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Insert Tag:</span>
                  {[
                    { tag: 'name', label: '🏷️ Customer Name' },
                    { tag: 'balance', label: '💳 Khata Due (₹)' },
                    { tag: 'total_spend', label: '🛍️ Lifetime Spend' },
                    { tag: 'store_name', label: '🏪 Shop Name' },
                    { tag: 'phone', label: '📞 Phone' },
                    { tag: 'city', label: '📍 City' },
                    { tag: 'upi_id', label: '📲 UPI ID' },
                    { tag: 'store_address', label: '🏬 Address' }
                  ].map(item => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => handleInsertTag(item.tag)}
                      className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-700 dark:hover:text-emerald-300 text-[10px] font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-2xs transition-all active:scale-95"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  rows={8}
                  value={customTemplateText}
                  onChange={(e) => setCustomTemplateText(e.target.value)}
                  placeholder="Type your WhatsApp message template here..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed flex-1"
                />
                
                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                  <span>Chars: {customTemplateText.length} | Words: {customTemplateText.trim().split(/\s+/).filter(Boolean).length}</span>
                  <span>Line breaks & emojis are preserved in WhatsApp</span>
                </div>
              </div>

              {/* Live WhatsApp Chat Bubble Preview (Point 3) */}
              {showPreview && (
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span>📱 Live WhatsApp Preview ({previewCustomer.name}):</span>
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="p-3 bg-[#DCF8C6] dark:bg-[#054740] text-slate-900 dark:text-emerald-50 rounded-xl text-xs whitespace-pre-wrap leading-relaxed border border-emerald-300 dark:border-emerald-800 max-h-36 overflow-y-auto font-sans shadow-2xs">
                    {samplePreviewText}
                  </div>
                </div>
              )}

              {/* Action Buttons: Copy Numbers, Export, Step-by-Step Assistant */}
              <div className="space-y-2 pt-1">
                {copiedToast && (
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{copiedToast}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={copyBroadcastNumbers}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                    title="Copy all selected phone numbers for WhatsApp Broadcast"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-300" />
                    <span>Copy All Numbers</span>
                  </button>

                  <button
                    onClick={exportAudienceCSV}
                    className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-2xs active:scale-95 transition-all"
                    title="Export selected audience to CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Export CSV</span>
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <button
                    onClick={startStepByStepAssistant}
                    className="col-span-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <Play className="w-4 h-4" />
                    <span>Launch Step-by-Step Assistant ({selectedCustomers.length} Customers)</span>
                  </button>

                  <button
                    onClick={handleOpenAllTabsSequentially}
                    className="col-span-4 py-3 bg-teal-700 hover:bg-teal-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                    title="Open all selected customers in individual tabs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open All</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Advanced Target Audience Filters & Customer List (Points 1 & 6) */}
            <div className="w-5/12 flex flex-col border-l border-slate-200 dark:border-slate-800 pl-4 space-y-2.5 overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    3. Target Audience & Customer Segmentation
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Selected <strong>{selectedCustomers.length}</strong> of {filteredCustomers.length} filtered ({customers.length} total registered)
                  </p>
                </div>

                {/* Audience Selection Quick Controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleSelectAllAudience}
                    className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-bold rounded-lg text-[11px] border border-emerald-200 dark:border-emerald-800"
                  >
                    Select All ({filteredCustomers.length})
                  </button>
                  <button
                    onClick={handleDeselectAllAudience}
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold rounded-lg text-[11px]"
                  >
                    Deselect
                  </button>
                  <button
                    onClick={handleInvertAudience}
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold rounded-lg text-[11px]"
                  >
                    Invert
                  </button>
                </div>
              </div>

              {/* Filter Controls Box: Spend Tier, Khata Due & Frequency (Point 6) */}
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                {/* Lifetime Spend Tier Pills */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      <IndianRupee className="w-3 h-3 text-emerald-600" />
                      Lifetime Spend Filter (VIP / Purchase Range):
                    </span>
                    {spendTier === 'CUSTOM' && (
                      <span className="text-[10px] font-mono text-emerald-600 font-bold">Custom Range Active</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {[
                      { id: 'ALL', label: 'All Spend (₹0+)' },
                      { id: '1K', label: '₹1,000+' },
                      { id: '2K', label: '₹2,000+ (VIP)' },
                      { id: '3K', label: '₹3,000+' },
                      { id: '5K', label: '₹5,000+' },
                      { id: '10K', label: '₹10,000+' },
                      { id: 'CUSTOM', label: '⚙️ Custom Range' },
                    ].map(tier => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSpendTier(tier.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          spendTier === tier.id
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Range Inputs (Point 6) */}
                  {spendTier === 'CUSTOM' && (
                    <div className="flex items-center gap-2 pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-[11px] text-slate-500 font-bold">Min Spend: ₹</span>
                        <input
                          type="number"
                          value={minSpendInput}
                          onChange={(e) => setMinSpendInput(e.target.value)}
                          placeholder="e.g. 2000"
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-[11px] text-slate-500 font-bold">Max Spend: ₹</span>
                        <input
                          type="number"
                          value={maxSpendInput}
                          onChange={(e) => setMaxSpendInput(e.target.value)}
                          placeholder="Any / Max"
                          className="w-full px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Secondary Filters: Khata Dues & Visit Activity */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-500 block mb-0.5">Khata Due Filter</label>
                    <select
                      value={dueFilter}
                      onChange={(e) => setDueFilter(e.target.value as any)}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg text-[11px] font-semibold focus:outline-none"
                    >
                      <option value="ALL">All Customers</option>
                      <option value="HAS_DUE">Any Khata Due (&gt; ₹0)</option>
                      <option value="DUE_500">Khata Due &gt; ₹500</option>
                      <option value="DUE_1K">Khata Due &gt; ₹1,000</option>
                      <option value="DUE_2K">Khata Due &gt; ₹2,000</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold text-slate-500 block mb-0.5">Visit Activity</label>
                    <select
                      value={visitFilter}
                      onChange={(e) => setVisitFilter(e.target.value as any)}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border rounded-lg text-[11px] font-semibold focus:outline-none"
                    >
                      <option value="ALL">All Visit Frequencies</option>
                      <option value="3_PLUS">Frequent (3+ Visits)</option>
                      <option value="SINGLE">New / Single Visit</option>
                      <option value="INACTIVE">Inactive (30+ Days)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search customer by name, mobile phone or city..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Customer Checkbox Table List */}
              <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs">
                    No customers found matching the search and purchase filters.
                  </div>
                ) : (
                  filteredCustomers.map(cust => {
                    const isSelected = selectedCustomerIds.includes(cust.id);
                    const spendVal = Number(cust.total_spend || cust.total_spent || 0);
                    const dueVal = Number(cust.credit_balance || 0);
                    return (
                      <div
                        key={cust.id}
                        onClick={() => toggleCustomerSelection(cust.id)}
                        className={`flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-all ${
                          isSelected ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                          )}
                          <div>
                            <span className="font-bold text-xs text-slate-800 dark:text-white block">
                              {cust.name || 'Unnamed Customer'}
                            </span>
                            <span className="text-[10.5px] font-mono text-slate-400">
                              +91 {cust.phone || 'No Phone'} • {cust.city || 'Dhule'} • {cust.visit_count || 0} visits
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 text-right">
                          {dueVal > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-mono">
                              Due: {formatINR(dueVal)}
                            </span>
                          )}
                          <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200">
                            {formatINR(spendVal)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: WHATSAPP BILL & DIGITAL RECEIPT TEMPLATE DESIGNER */}
        {activeTab === 'BILL_TEMPLATE' && (
          <div className="h-full flex gap-4 overflow-hidden">
            {/* Left Column: Editor, Formatting, Emojis & Dynamic Tags */}
            <div className="w-7/12 flex flex-col space-y-2.5 overflow-y-auto pr-2">
              <div>
                <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                  WhatsApp Digital Bill Template Designer
                </h3>
                <p className="text-[11px] text-slate-400">
                  Customize the exact invoice message your customers receive on WhatsApp when clicking <strong>"Send Bill on WhatsApp"</strong> at POS billing checkout.
                </p>
              </div>

              {/* Formatting & Emoji Toolbar */}
              <div className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                {/* 1. WhatsApp Text Formatting */}
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mr-0.5">Style:</span>
                  <button
                    type="button"
                    onClick={() => handleInsertBillFormatting('*')}
                    className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 font-black text-[10.5px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-2xs transition-all"
                    title="Bold (*text*)"
                  >
                    *Bold*
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertBillFormatting('_')}
                    className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 italic text-[10.5px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-2xs transition-all"
                    title="Italic (_text_)"
                  >
                    _Italic_
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertBillFormatting('~')}
                    className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 line-through text-[10.5px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-2xs transition-all"
                    title="Strikethrough (~text~)"
                  >
                    ~Strike~
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertBillFormatting('```')}
                    className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 font-mono text-[10px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-2xs transition-all"
                    title="Monospace (```code```)"
                  >
                    ```Code```
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertBillEmoji('\n------------------------------------\n')}
                    className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 font-mono text-[10px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-2xs transition-all"
                    title="Insert Divider Line"
                  >
                    --- Divider Line ---
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertBillEmoji('• ')}
                    className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-[10.5px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-2xs transition-all"
                    title="Insert Bullet Point"
                  >
                    • Bullet
                  </button>
                </div>

                {/* 2. Emoji Quick Bar */}
                <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mr-0.5">Emojis:</span>
                  {['🧾', '🛍️', '🎁', '✨', '🙏', '🛒', '💳', '🏷️', '📦', '💰', '📱', '🏪', '📍', '📞', '🌟', '🇮🇳', '💯', '✅', '👗', '🧸', '⚡', '🏛️'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleInsertBillEmoji(emoji)}
                      className="w-6 h-6 rounded-md bg-white dark:bg-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900 flex items-center justify-center text-xs border border-slate-200 dark:border-slate-600 shadow-2xs active:scale-95 transition-all"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Invoice Tags Bar */}
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Click to Insert Dynamic Bill Tags into Template:
                </span>
                
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {/* Customer Group */}
                  {[
                    { tag: 'customer_name', label: '👤 {customer_name}' },
                    { tag: 'name', label: '👤 {name}' },
                    { tag: 'customer_phone', label: '📞 {customer_phone}' },
                    { tag: 'number', label: '📞 {number}' },
                  ].map(it => (
                    <button
                      key={it.tag}
                      type="button"
                      onClick={() => handleInsertBillTag(it.tag)}
                      className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 font-mono font-semibold"
                    >
                      {it.label}
                    </button>
                  ))}

                  {/* Invoice Group */}
                  {[
                    { tag: 'bill_number', label: '🧾 {bill_number}' },
                    { tag: 'bill_date', label: '📅 {bill_date}' },
                    { tag: 'items_list', label: '📋 {items_list}' },
                    { tag: 'total_items', label: '📦 {total_items}' },
                    { tag: 'total_qty', label: '🔢 {total_qty}' },
                  ].map(it => (
                    <button
                      key={it.tag}
                      type="button"
                      onClick={() => handleInsertBillTag(it.tag)}
                      className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 font-mono font-semibold"
                    >
                      {it.label}
                    </button>
                  ))}

                  {/* Financial Group */}
                  {[
                    { tag: 'grand_total', label: '💰 {grand_total}' },
                    { tag: 'subtotal_line', label: '💵 {subtotal_line}' },
                    { tag: 'discount_line', label: '🏷️ {discount_line}' },
                    { tag: 'tax_line', label: '🏛️ {tax_line}' },
                    { tag: 'extra_charges_line', label: '⚡ {extra_charges_line}' },
                    { tag: 'paid_line', label: '✅ {paid_line}' },
                    { tag: 'due_line', label: '⚠️ {due_line}' },
                    { tag: 'payment_mode', label: '💳 {payment_mode}' },
                  ].map(it => (
                    <button
                      key={it.tag}
                      type="button"
                      onClick={() => handleInsertBillTag(it.tag)}
                      className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 font-mono font-semibold"
                    >
                      {it.label}
                    </button>
                  ))}

                  {/* Shop Info Group */}
                  {[
                    { tag: 'shop_name', label: '🏪 {shop_name}' },
                    { tag: 'tag_line', label: '✨ {tag_line}' },
                    { tag: 'shop_address', label: '📍 {shop_address}' },
                    { tag: 'shop_mobile', label: '📞 {shop_mobile}' },
                    { tag: 'upi_id', label: '📲 {upi_id}' },
                    { tag: 'gstin_line', label: '🏛️ {gstin_line}' },
                    { tag: 'bill_footer', label: '💬 {bill_footer}' },
                    { tag: 'social_links', label: '🌐 {social_links}' },
                  ].map(it => (
                    <button
                      key={it.tag}
                      type="button"
                      onClick={() => handleInsertBillTag(it.tag)}
                      className="px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 font-mono font-semibold"
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Textarea */}
              <div className="flex-1 flex flex-col min-h-[220px]">
                <textarea
                  ref={billTextareaRef}
                  rows={11}
                  value={billTemplateText}
                  onChange={(e) => setBillTemplateText(e.target.value)}
                  placeholder="Design your WhatsApp Bill / Receipt Template here..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed flex-1"
                />
                
                <div className="flex justify-between items-center text-[10.5px] text-slate-400 pt-1">
                  <span>Chars: {billTemplateText.length} | Lines: {billTemplateText.split('\n').length}</span>
                  <span className="italic">All emojis and formatting characters are verified and safe against encoding errors ()</span>
                </div>
              </div>

              {/* Feedback Banner */}
              {billTemplateFeedback && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                  billTemplateFeedback.startsWith('✓') 
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{billTemplateFeedback}</span>
                </div>
              )}

              {/* Action Buttons: Save & Reset */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveBillTemplate}
                  disabled={savingBillTemplate}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingBillTemplate ? 'Saving Template...' : 'Save Bill Template'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetBillTemplate}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
                  title="Reset to factory default"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Reset to Default</span>
                </button>
              </div>
            </div>

            {/* Right Column: Live Interactive WhatsApp Simulator & Test Sender */}
            <div className="w-5/12 flex flex-col border-l border-slate-200 dark:border-slate-800 pl-4 space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    Live WhatsApp Customer Preview
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Real-time visual preview of how the customer sees their bill
                  </p>
                </div>
              </div>

              {/* WhatsApp Mock Chat Bubble Container */}
              <div className="flex-1 overflow-y-auto bg-[#EFEAE2] dark:bg-[#0b141a] rounded-2xl border border-slate-300 dark:border-slate-800 p-3.5 flex flex-col space-y-2 shadow-inner">
                {/* Chat Header inside mock */}
                <div className="flex items-center justify-between bg-white dark:bg-[#202c33] p-2 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-700 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center">
                      D
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block text-[11px] leading-tight">
                        Dolly Toys & Kids Wear
                      </span>
                      <span className="text-[9.5px] text-emerald-600 font-medium">Online • Verified Business</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Today</span>
                </div>

                {/* WhatsApp Chat Message Bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[95%] bg-[#DCF8C6] dark:bg-[#005c4b] text-slate-900 dark:text-[#e9edef] rounded-2xl rounded-tr-xs p-3.5 shadow-md border border-emerald-300/60 dark:border-emerald-800/40 text-[11.5px] font-sans leading-relaxed whitespace-pre-wrap select-text">
                    {renderWhatsAppBillMessage(billTemplateText, SAMPLE_TEST_RECEIPT_DATA)}
                    
                    {/* WhatsApp Timestamp and Blue Ticks */}
                    <div className="flex items-center justify-end space-x-1 pt-1.5 text-[9.5px] text-slate-500 dark:text-emerald-200/70 font-mono">
                      <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-blue-500 font-bold">✓✓</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Test Sender Box (prefilled with 7972558842) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-bold text-[11px] text-slate-700 dark:text-slate-200 uppercase tracking-wider block flex items-center gap-1">
                  <Send className="w-3 h-3 text-emerald-600" />
                  Test Send Live Bill on WhatsApp
                </span>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1">
                    <span className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-l-xl border border-r-0 text-xs">
                      +91
                    </span>
                    <input
                      type="text"
                      value={testBillPhone}
                      onChange={(e) => setTestBillPhone(e.target.value)}
                      placeholder="7972558842"
                      className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-r-xl font-mono text-xs font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSendTestBill}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Send Test Bill</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  Opens WhatsApp Web / Desktop with this exact live sample invoice formatted and ready to send.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: KHATA DUE REMINDERS */}
        {activeTab === 'KHATA_REMINDERS' && (
          <div className="h-full flex flex-col space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
              <div>
                <h3 className="font-bold text-xs text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  Outstanding Customer Khata Dues & Direct WhatsApp Payment Reminders
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Total Outstanding: <strong className="font-mono">{formatINR(customers.reduce((acc, c) => acc + (c.credit_balance || 0), 0))}</strong> across {customers.filter(c => (c.credit_balance || 0) > 0).length} customers.
                </p>
              </div>

              <button
                onClick={() => {
                  const duePhones = customers
                    .filter(c => (c.credit_balance || 0) > 0 && c.phone)
                    .map(c => `+91${c.phone.replace(/\D/g, '')}`)
                    .join(', ');
                  navigator.clipboard.writeText(duePhones);
                  alert(`✓ Copied ${customers.filter(c => (c.credit_balance || 0) > 0 && c.phone).length} Khata due customer numbers!`);
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy All Due Numbers</span>
              </button>
            </div>

            <div className="space-y-2">
              {customers.filter(c => (c.credit_balance || 0) > 0).length === 0 ? (
                <div className="text-center py-20 text-slate-400 text-xs">
                  ✓ Excellent! No outstanding customer Khata balances.
                </div>
              ) : (
                customers.filter(c => (c.credit_balance || 0) > 0).map((cust, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/40 text-xs hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block text-sm">{cust.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">Mobile: +91 {cust.phone || 'No Phone'} • {cust.city || 'Dhule'}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-bold">Outstanding Khata Balance</span>
                        <span className="font-black text-rose-600 font-mono text-sm">{formatINR(cust.credit_balance)}</span>
                      </div>
                      <button
                        onClick={() => handleSendKhataReminder(cust)}
                        disabled={!cust.phone}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Send WhatsApp Reminder</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: QUICK DIRECT CHAT */}
        {activeTab === 'TEST_SENDER' && (
          <div className="h-full flex flex-col space-y-4 overflow-y-auto max-w-3xl">
            <div className="space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Direct Customer WhatsApp Dispatcher</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Recipient Phone Number</label>
                  <input
                    type="text"
                    value={singlePhone}
                    onChange={(e) => setSinglePhone(e.target.value)}
                    placeholder="Enter 10-digit mobile number"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-500 block mb-1">Recipient Customer Name</label>
                  <input
                    type="text"
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    placeholder="Customer Name (Optional)"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="font-semibold text-slate-500 block mb-1">Message Content</label>
                <textarea
                  rows={4}
                  value={singleMessage}
                  onChange={(e) => setSingleMessage(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {singleFeedback && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${singleFeedback.startsWith('✓') ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-800'}`}>
                  {singleFeedback}
                </div>
              )}

              <button
                onClick={() => handleSendSingle(undefined, undefined, true)}
                disabled={sendingSingle}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/30 flex items-center gap-2 active:scale-95 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in WhatsApp & Send (1-Click)</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: SETTINGS & META CLOUD API */}
        {activeTab === 'SETTINGS' && (
          <div className="h-full flex flex-col space-y-4 overflow-y-auto max-w-4xl">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-emerald-600" />
                  Store Profile & Default WhatsApp Number
                </h4>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingConfig ? 'Saving...' : 'Save Profile Phone'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-500 block mb-1">Store WhatsApp Phone (Editable)</label>
                  <div className="flex items-center">
                    <span className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-l-xl border border-r-0 text-xs">
                      +91
                    </span>
                    <input
                      type="text"
                      value={config.store_phone || ''}
                      onChange={(e) => setConfig({ ...config, store_phone: e.target.value })}
                      placeholder="e.g. 7972558842"
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border rounded-r-xl font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-500 block mb-1">Store / Business Name</label>
                  <input
                    type="text"
                    value={config.store_name || ''}
                    onChange={(e) => setConfig({ ...config, store_name: e.target.value })}
                    placeholder="Dolly Toys & Kids Wear"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-500 block mb-1">Store UPI Payment ID</label>
                  <input
                    type="text"
                    value={config.upi_id || ''}
                    onChange={(e) => setConfig({ ...config, upi_id: e.target.value })}
                    placeholder="7972558842@upi"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-500 block mb-1">Store Address</label>
                  <input
                    type="text"
                    value={config.store_address || ''}
                    onChange={(e) => setConfig({ ...config, store_address: e.target.value })}
                    placeholder="Agra Road, Near Mahatma Gandhi Statue, Dhule"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Dispatch Modes & Meta Cloud API Credentials */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className={`p-4 rounded-2xl border transition-all ${config.provider === 'DIRECT_WEB' ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 ring-1 ring-emerald-500' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                      1. WhatsApp Web / Desktop (Active & Free)
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Active Default
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 mb-3 leading-relaxed text-xs">
                  Zero setup costs or monthly fees. Opens customer chats pre-filled in 1 click in WhatsApp Web or Desktop app.
                </p>

                <button
                  onClick={() => setConfig({ ...config, provider: 'DIRECT_WEB' })}
                  className={`w-full py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${config.provider === 'DIRECT_WEB' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{config.provider === 'DIRECT_WEB' ? 'Selected Default Mode' : 'Select WhatsApp Web Mode'}</span>
                </button>
              </div>

              <div className={`p-4 rounded-2xl border transition-all ${config.provider === 'META_CLOUD_API' ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                      2. Meta WhatsApp Cloud API
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    Future Enterprise
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 mb-3 leading-relaxed text-xs">
                  Configure your Meta Business API token for future automated background dispatch when you purchase Meta API access.
                </p>

                <div className="space-y-2 mb-3">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-500 block mb-0.5">Meta API Access Token</label>
                    <input
                      type="password"
                      value={config.meta_api_token || ''}
                      onChange={(e) => setConfig({ ...config, meta_api_token: e.target.value })}
                      placeholder="EAAG..."
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-lg font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10.5px] font-bold text-slate-500 block mb-0.5">Phone Number ID</label>
                      <input
                        type="text"
                        value={config.meta_phone_number_id || ''}
                        onChange={(e) => setConfig({ ...config, meta_phone_number_id: e.target.value })}
                        placeholder="e.g. 104857..."
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-lg font-mono text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-bold text-slate-500 block mb-0.5">Business Account ID</label>
                      <input
                        type="text"
                        value={config.meta_business_account_id || ''}
                        onChange={(e) => setConfig({ ...config, meta_business_account_id: e.target.value })}
                        placeholder="e.g. 20948..."
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-lg font-mono text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setConfig({ ...config, provider: 'META_CLOUD_API' })}
                  className={`w-full py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${config.provider === 'META_CLOUD_API' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{config.provider === 'META_CLOUD_API' ? 'Selected Mode' : 'Select Cloud API Mode'}</span>
                </button>
              </div>
            </div>

            {configFeedback && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${configFeedback.startsWith('✓') ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-800'}`}>
                {configFeedback}
              </div>
            )}

            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all w-fit"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingConfig ? 'Saving Settings...' : 'Save Configuration & Meta API'}</span>
            </button>
          </div>
        )}

        {/* TAB 5: DELIVERY LOGS */}
        {activeTab === 'LOGS' && (
          <div className="h-full flex flex-col space-y-2 overflow-hidden">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Recent Message Dispatch History ({logs.length} messages)
            </h3>
            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-400 uppercase sticky top-0 z-10 border-b">
                  <tr>
                    <th className="py-2 px-3">Recipient</th>
                    <th className="py-2 px-2 text-center">Phone</th>
                    <th className="py-2 px-2">Type</th>
                    <th className="py-2 px-3">Message Snippet</th>
                    <th className="py-2 px-2 text-center">Status</th>
                    <th className="py-2 px-2 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-white">{log.recipient_name}</td>
                      <td className="py-2 px-2 text-center font-mono text-slate-500">+91 {log.recipient_phone}</td>
                      <td className="py-2 px-2">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-bold">
                          {log.message_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate text-[11px]">
                        {log.message_text}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[11px] text-slate-400">{log.sent_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* STEP-BY-STEP MANUAL DISPATCH ASSISTANT MODAL (Points 3, 4, 7) */}
      {isAssistantOpen && selectedCustomers.length > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-600" />
                  Manual Dispatch Assistant
                </h3>
                <span className="text-xs text-slate-400">
                  Customer {assistantIndex + 1} of {selectedCustomers.length} • Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono border">Esc</kbd> to close
                </span>
              </div>
              <button
                onClick={() => setIsAssistantOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Target Card */}
            {selectedCustomers[assistantIndex] && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-black text-sm text-slate-900 dark:text-white block">
                      {selectedCustomers[assistantIndex].name || 'Valued Customer'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {selectedCustomers[assistantIndex].city || 'Dhule'} • Spend: {formatINR(selectedCustomers[assistantIndex].total_spend || selectedCustomers[assistantIndex].total_spent || 0)}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                    +91 {selectedCustomers[assistantIndex].phone}
                  </span>
                </div>

                {/* Personalized Message Preview with Emoji & Spacing (Point 3) */}
                <div className="p-3.5 bg-[#DCF8C6] dark:bg-[#054740] text-slate-900 dark:text-emerald-50 rounded-xl border border-emerald-300 dark:border-emerald-800 text-xs font-sans max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-2xs">
                  {personalizeTextForCustomer(selectedCustomers[assistantIndex], customTemplateText)}
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${((assistantIndex + 1) / selectedCustomers.length) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                <span>Opened: {assistantSentIds.length}</span>
                <span>Remaining: {selectedCustomers.length - assistantSentIds.length}</span>
              </div>
            </div>

            {/* Assistant Controls */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => assistantIndex > 0 && setAssistantIndex(assistantIndex - 1)}
                disabled={assistantIndex === 0}
                className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 disabled:opacity-30 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1"
                title="Previous Customer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <button
                onClick={handleAssistantSkip}
                disabled={assistantIndex >= selectedCustomers.length - 1}
                className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 disabled:opacity-30 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1"
                title="Skip to Next Customer"
              >
                <span>Skip</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleAssistantNext}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 active:scale-95 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in WhatsApp & Next ⏭️</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


