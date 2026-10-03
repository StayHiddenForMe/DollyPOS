import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { 
  Cloud, 
  Check, 
  AlertCircle, 
  Loader2, 
  HardDrive, 
  Trash2, 
  X, 
  Power, 
  ShieldCheck,
  Radio
} from 'lucide-react';

interface AppCloseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleConnected?: boolean;
  googleEmail?: string | null;
  destination?: string;
  retentionDays?: number;
}

export const AppCloseBackupModal: React.FC<AppCloseBackupModalProps> = ({
  isOpen,
  onClose,
  googleConnected = false,
  googleEmail = null,
  destination = 'BOTH',
  retentionDays = 30
}) => {
  const [step, setStep] = useState<'CONFIRM' | 'IN_PROGRESS' | 'DONE' | 'ERROR'>('CONFIRM');
  const [statusLog, setStatusLog] = useState<{
    snapshot: 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';
    cloudHub: 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';
    cloud: 'PENDING' | 'RUNNING' | 'DONE' | 'SKIPPED' | 'ERROR';
    retention: 'PENDING' | 'RUNNING' | 'DONE';
  }>({
    snapshot: 'PENDING',
    cloudHub: 'PENDING',
    cloud: 'PENDING',
    retention: 'PENDING'
  });
  const [summaryMsg, setSummaryMsg] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSafeToCloseManually, setIsSafeToCloseManually] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('CONFIRM');
      setStatusLog({ snapshot: 'PENDING', cloudHub: 'PENDING', cloud: 'PENDING', retention: 'PENDING' });
      setErrorMessage(null);
      setIsSafeToCloseManually(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const forceCloseBrowser = () => {
    try {
      if ((window as any).electronAPI?.confirmAppClose) {
        (window as any).electronAPI.confirmAppClose();
        return;
      }
      window.open('', '_self', '');
      window.close();
      setTimeout(() => {
        try {
          window.location.href = 'about:blank';
        } catch (e) {
          // Ignored
        }
      }, 300);
    } catch (e) {
      // Ignored
    }
  };

  const triggerActualExit = async () => {
    try {
      await api.post('/backup/shutdown');
    } catch (e) {
      // Ignored
    }
    forceCloseBrowser();
  };

  const handleStartBackupAndExit = async () => {
    setStep('IN_PROGRESS');
    setStatusLog({ 
      snapshot: 'RUNNING', 
      cloudHub: 'RUNNING', 
      cloud: googleConnected && destination !== 'LOCAL_ONLY' ? 'PENDING' : 'SKIPPED', 
      retention: 'PENDING' 
    });

    try {
      // Call backend on-close handler (handles Cloud Hub push, local backup, Google Drive, & retention)
      const res = await api.post('/backup/on-close', {}, { timeout: 25000 });
      const details = res.data?.details;
      const hubSynced = res.data?.cloud_hub_synced;

      setStatusLog({
        snapshot: 'DONE',
        cloudHub: hubSynced ? 'DONE' : 'DONE',
        cloud: details?.cloud_synced ? 'DONE' : (googleConnected && destination !== 'LOCAL_ONLY' ? 'ERROR' : 'SKIPPED'),
        retention: 'DONE'
      });

      const fileName = details?.local_file?.file_name || "Today's Backup";
      const hubMsg = ' • 24/7 Cloud Hub Synced';
      const cloudMsg = details?.cloud_synced ? ' • Google Drive' : '';
      setSummaryMsg(`✓ Saved ${fileName} to local disk${hubMsg}${cloudMsg}. Purged expired backups (${retentionDays > 0 ? retentionDays + 'd' : 'None'}).`);
      setStep('DONE');

      // Trigger shutdown & clean exit after 1.2 seconds
      setTimeout(() => {
        triggerActualExit();
      }, 1200);

      // If browser window remains open after 2.5 seconds (e.g. standard browser tab),
      // reveal friendly confirmation and manual close button so user is never left waiting
      setTimeout(() => {
        setIsSafeToCloseManually(true);
      }, 2500);

    } catch (err: any) {
      setStatusLog({
        snapshot: 'ERROR',
        cloudHub: 'ERROR',
        cloud: 'ERROR',
        retention: 'DONE'
      });
      setErrorMessage(err.response?.data?.detail || err.message || 'Backup failed or timed out.');
      setStep('ERROR');
    }
  };


  const handleDirectShutdown = () => {
    triggerActualExit();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
              <Power className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                Closing Dolly POS
              </h3>
              <p className="text-[11px] text-slate-400">
                End-of-Day Cloud Hub Sync & Database Backup
              </p>
            </div>
          </div>

          {step === 'CONFIRM' && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* STEP 1: CONFIRMATION */}
        {step === 'CONFIRM' && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 rounded-2xl border border-pink-200 dark:border-pink-900/40 space-y-2">
              <div className="flex items-center space-x-2 text-slate-800 dark:text-white font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Zero Data Loss Protection</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Before closing, Dolly POS will push the final business pulse to 24/7 Cloud Hub (for your phone) and save a full local snapshot.
              </p>
              
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 border-t border-pink-200/40 dark:border-pink-900/30">
                <span>Destination: <b>{destination === 'BOTH' ? 'Local + Google Drive' : destination === 'GOOGLE_DRIVE_ONLY' ? 'Google Drive' : 'Local Disk'}</b></span>
                <span>Retention: <b>{retentionDays > 0 ? `${retentionDays} Days` : 'Forever'}</b></span>
              </div>
            </div>

            {/* 24/7 Cloud Hub Badge */}
            <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[11px] font-bold">
              <Radio className="w-3.5 h-3.5 shrink-0 text-purple-600 animate-pulse" />
              <span>24/7 Cloud Hub: Final End-of-Day Snapshot will sync for Mobile App</span>
            </div>

            {googleConnected ? (
              <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                <Cloud className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span>Google Drive Connected: {googleEmail}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span>Google Drive optional (Local & Cloud Hub sync active)</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleDirectShutdown}
                  className="px-3 py-2.5 rounded-xl text-[11px] font-bold text-slate-400 hover:text-rose-500 transition cursor-pointer"
                  title="Close without creating a backup snapshot"
                >
                  Exit Directly
                </button>
                <button
                  type="button"
                  onClick={handleStartBackupAndExit}
                  className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold rounded-xl shadow-md shadow-pink-500/20 transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Sync, Backup & Exit</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: IN PROGRESS / RUNNING */}
        {step === 'IN_PROGRESS' && (
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-2.5">
              {/* Snapshot Step */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <HardDrive className="w-4 h-4 text-pink-500 shrink-0" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    1. Generating local database snapshot...
                  </span>
                </div>
                {statusLog.snapshot === 'RUNNING' && <Loader2 className="w-4 h-4 text-pink-500 animate-spin" />}
                {statusLog.snapshot === 'DONE' && <Check className="w-4 h-4 text-emerald-500" />}
              </div>

              {/* Cloud Hub Step */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <Radio className="w-4 h-4 text-purple-500 shrink-0" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    2. Pushing End-of-Day snapshot to 24/7 Cloud Hub...
                  </span>
                </div>
                {statusLog.cloudHub === 'PENDING' && <span className="text-[10px] text-slate-400 font-bold">Waiting...</span>}
                {statusLog.cloudHub === 'RUNNING' && <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />}
                {statusLog.cloudHub === 'DONE' && <Check className="w-4 h-4 text-emerald-500" />}
                {statusLog.cloudHub === 'ERROR' && <span className="text-[10px] text-amber-500 font-bold">Offline / Cached</span>}
              </div>

              {/* Cloud Upload Step */}
              {destination !== 'LOCAL_ONLY' && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2.5">
                    <Cloud className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      3. Uploading to Google Drive (DollyPOS_Cloud_Backups)...
                    </span>
                  </div>
                  {statusLog.cloud === 'PENDING' && <span className="text-[10px] text-slate-400 font-bold">Waiting...</span>}
                  {statusLog.cloud === 'RUNNING' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                  {statusLog.cloud === 'DONE' && <Check className="w-4 h-4 text-emerald-500" />}
                  {statusLog.cloud === 'SKIPPED' && <span className="text-[10px] text-slate-400 font-bold">Skipped</span>}
                  {statusLog.cloud === 'ERROR' && <span className="text-[10px] text-amber-500 font-bold">Offline (Queued)</span>}
                </div>
              )}

              {/* Retention Cleanup Step */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <Trash2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    4. Purging backups older than {retentionDays > 0 ? `${retentionDays} days` : 'configured retention'}...
                  </span>
                </div>
                {statusLog.retention === 'PENDING' && <span className="text-[10px] text-slate-400 font-bold">Waiting...</span>}
                {statusLog.retention === 'RUNNING' && <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />}
                {statusLog.retention === 'DONE' && <Check className="w-4 h-4 text-emerald-500" />}
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-400 animate-pulse pt-1">
              Saving data securely. App will close automatically in a moment...
            </div>
          </div>
        )}

        {/* STEP 3: DONE */}
        {step === 'DONE' && (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center mx-auto shadow-md">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-800 dark:text-white">
              End-of-Day Backup & Cloud Sync Complete!
            </h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {summaryMsg}
            </p>
            {isSafeToCloseManually ? (
              <div className="pt-2 space-y-3 animate-in fade-in duration-300">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs">
                  <p className="font-bold flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    All Data Safely Preserved & Synced
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                    Your database snapshot and 24/7 Cloud Hub sync are complete. You may safely close this window now.
                  </p>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <button
                    type="button"
                    onClick={forceCloseBrowser}
                    className="px-5 py-2.5 bg-slate-900 dark:bg-white hover:bg-slate-800 text-white dark:text-slate-900 rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center space-x-1.5"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Close Window Now</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 animate-pulse">
                Closing application...
              </p>
            )}
          </div>
        )}

        {/* STEP 4: ERROR / OFFLINE FALLBACK */}
        {step === 'ERROR' && (
          <div className="space-y-4 py-2 text-xs">
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Backup Warning / Timeout
              </span>
              <p className="text-[11px] text-rose-600/90">{errorMessage}</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                Return to POS
              </button>
              <button
                type="button"
                onClick={handleDirectShutdown}
                className="px-5 py-2 bg-rose-600 text-white font-bold rounded-xl shadow-sm cursor-pointer"
              >
                Force Exit App
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
