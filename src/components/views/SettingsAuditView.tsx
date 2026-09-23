import React, { useState } from 'react';
import {
  UserAccount,
  AuditLog,
  ShopSettings,
  UserRole,
  StaffMember,
  StaffType,
  Room,
  TableRecord,
  ServiceItem,
  ServiceCategory,
  ProductItem,
  ProductCategory,
  Customer,
  PaymentMethodRecord,
  ExpenseCategoryRecord,
  CommissionRuleRecord,
  APP_VERSION,
  APP_BUILD_DATE,
  UPDATE_MODE,
} from '../../types';
import { db } from '../../db/database';
import { Language } from '../../utils/translations';
import {
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  Users,
  FileText,
  Store,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Plus,
  Key,
  Database,
  Info,
  Folder,
  HardDrive,
  Cpu,
} from 'lucide-react';
import { seedForceDemoData } from '../../db/seedData';
import { MasterDataView } from './MasterDataView';

import { verifyPin, hashPin } from '../../utils/cryptoAuth';

interface SettingsAuditViewProps {
  users: UserAccount[];
  auditLogs: AuditLog[];
  settings: ShopSettings | null;
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
  staff?: StaffMember[];
  staffTypes?: StaffType[];
  rooms?: Room[];
  tables?: TableRecord[];
  services?: ServiceItem[];
  serviceCategories?: ServiceCategory[];
  products?: ProductItem[];
  productCategories?: ProductCategory[];
  customers?: Customer[];
  paymentMethods?: PaymentMethodRecord[];
  expenseCategories?: ExpenseCategoryRecord[];
  commissionRules?: CommissionRuleRecord[];
}

export const SettingsAuditView: React.FC<SettingsAuditViewProps> = ({
  users,
  auditLogs,
  settings,
  currentUser,
  lang,
  onRefresh,
  staff = [],
  staffTypes = [],
  rooms = [],
  tables = [],
  services = [],
  serviceCategories = [],
  products = [],
  productCategories = [],
  customers = [],
  paymentMethods = [],
  expenseCategories = [],
  commissionRules = [],
}) => {
  const isMm = lang === 'my';

  const [activeTab, setActiveTab] = useState<'master' | 'shop' | 'users' | 'audit' | 'backup' | 'about'>('master');
  const [preUpdateStatus, setPreUpdateStatus] = useState<string>('');
  const [isPreUpdating, setIsPreUpdating] = useState(false);
  const [auditFilter, setAuditFilter] = useState<string>('all');

  // Shop Settings Form State
  const [shopNameMm, setShopNameMm] = useState(settings?.shopNameMm || '');
  const [shopNameEn, setShopNameEn] = useState(settings?.shopName || '');
  const [phone, setPhone] = useState(settings?.phone || '');
  const [addressMm, setAddressMm] = useState(settings?.addressMm || '');
  const [addressEn, setAddressEn] = useState(settings?.address || '');
  const [taxRate, setTaxRate] = useState(settings?.taxPercent || 0);
  const [serviceChargeRate, setServiceChargeRate] = useState(settings?.serviceChargePercent || 0);
  const [footerMm, setFooterMm] = useState(settings?.receiptFooterNoteMm || '');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // User creation state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('cashier');
  const [newUserPin, setNewUserPin] = useState('');

  // Backup & Restore state
  const [backupStatus, setBackupStatus] = useState<string>('');
  const [restoreFileContent, setRestoreFileContent] = useState<any | null>(null);

  // Handle Export Backup JSON
  const handleExportBackup = async () => {
    try {
      const data = await db.exportDatabaseBackup();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shwe_thiri_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setBackupStatus(isMm ? 'ဒေတာဘေ့စ် မိတ္တူကူးယူပြီးပါပြီ' : 'Database backup downloaded successfully!');
    } catch (err: any) {
      alert('Backup export error: ' + err.message);
    }
  };

  // Handle File Selection for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.version || !json.data) {
          throw new Error('Invalid backup file structure (missing version or data)');
        }
        setRestoreFileContent(json);
      } catch (err: any) {
        alert('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Confirm Restore
  const handleConfirmRestore = async () => {
    if (!restoreFileContent) return;
    const confirm = window.confirm(
      isMm
        ? 'သတိပြုရန် - ဤဖိုင်ကို ပြန်လည်သွင်းယူပါက လက်ရှိဒေတာများကို အစားထိုးမည်ဖြစ်ပါသည်။ သေချာပါသလား?'
        : 'Warning: Restoring will overwrite existing database records. Are you sure you want to proceed?'
    );
    if (!confirm) return;

    try {
      await db.restoreDatabaseBackup(JSON.stringify(restoreFileContent), currentUser);
      alert(isMm ? 'ဒေတာဘေ့စ် ပြန်လည်သွင်းယူခြင်း အောင်မြင်ပါသည်' : 'Database restored successfully!');
      setRestoreFileContent(null);
      onRefresh();
    } catch (err: any) {
      alert('Restore error: ' + err.message);
    }
  };

  // Reset to Demo Data
  const handleResetDemoData = async () => {
    if (currentUser.role !== 'owner') {
      alert(isMm ? 'ဆိုင်ရှင် (Owner) သာလျှင် ဤ လုပ်ဆောင်ချက်ကို ပြုလုပ်ခွင့်ရှိပါသည်' : 'Only Shop Owner can perform Demo Reset');
      return;
    }

    const confirm = window.confirm(
      isMm
        ? 'သတိပေးချက်: သရုပ်ပြစမ်းသပ်ဒေတာ ပြန်လည်ဖြည့်သွင်းခြင်းသည် လက်ရှိဒေတာများအားလုံးကို ဖျက်ဆီးမည် ဖြစ်ပါသည်။ အမှန်တကယ် ဆက်လက်လုပ်ဆောင်လိုပါသလား?'
        : 'WARNING: Resetting demo data will clear all business data and restore default sample data. Existing data will be lost. Are you sure you want to proceed?'
    );
    if (!confirm) return;

    try {
      await seedForceDemoData();
      alert(isMm ? 'စမ်းသပ်ဒေတာများ ထည့်သွင်းပြီးပါပြီ' : 'Sample demo data seeded successfully!');
      onRefresh();
    } catch (err: any) {
      alert('Error resetting demo: ' + err.message);
    }
  };

  // Handle Pre-Update Backup
  const handlePreUpdateBackup = async () => {
    setIsPreUpdating(true);
    setPreUpdateStatus(isMm ? 'ဒေတာဘေ့စ် မိတ္တူ သိမ်းဆည်းနေပါသည်...' : 'Creating pre-update database backup...');
    try {
      const data = await db.exportDatabaseBackup();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pre_update_backup_v${APP_VERSION}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setPreUpdateStatus(
        isMm
          ? `အဆင့်မြှင့်တင်မှုမပြုမီ မိတ္တူဖိုင် (v${APP_VERSION}) ရယူပြီးပါပြီ။ APP_DATA_DIR ရှိ ဒေတာများ လုံခြုံစွာ ရှိပါသည်။`
          : `Pre-update backup v${APP_VERSION} created successfully. APP_DATA_DIR data files verified safe.`
      );
    } catch (err: any) {
      setPreUpdateStatus('Error: ' + err.message);
    } finally {
      setIsPreUpdating(false);
    }
  };

  // Save Shop Settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      if (settings?.id) {
        await db.settings.update(settings.id, {
          shopNameMm,
          shopName: shopNameEn,
          phone,
          addressMm,
          address: addressEn,
          taxPercent: taxRate,
          serviceChargePercent: serviceChargeRate,
          receiptFooterNoteMm: footerMm,
        });
      }
      alert(isMm ? 'ဆိုင်အချက်အလက်များ သိမ်းဆည်းပြီးပါပြီ' : 'Settings saved successfully!');
      onRefresh();
    } catch (err: any) {
      alert('Error saving settings: ' + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Create User
  const handleCreateUser = async () => {
    if (!newUserName.trim() || newUserPin.length < 4) {
      alert('Please enter valid username and 4-digit PIN');
      return;
    }

    try {
      const { pinHash, pinSalt } = hashPin(newUserPin.trim());
      const newUser: UserAccount = {
        id: 'usr_' + Date.now(),
        name: newUserName.trim(),
        username: newUserName.toLowerCase().replace(/\s+/g, '_'),
        role: newUserRole,
        pinHash,
        pinSalt,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      await db.users.add(newUser);
      setIsAddUserOpen(false);
      setNewUserName('');
      setNewUserPin('');
      onRefresh();
    } catch (err: any) {
      alert('Error adding user: ' + err.message);
    }
  };

  // Filter Audit Logs
  const filteredAudit = auditLogs.filter(log => {
    if (auditFilter === 'all') return true;
    return log.entity === auditFilter || log.action.includes(auditFilter);
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {isMm ? 'စနစ်၊ စာရင်းစစ်မှတ်တမ်းနှင့် မိတ္တူ' : 'System Administration & Security'}
          </h2>
          <p className="text-xs text-gray-500">
            {isMm
              ? 'စာရင်းစစ်မှတ်တမ်း၊ အသုံးပြုသူများ၊ ဒေတာဘေ့စ် မိတ္တူကူး/ပြန်သွင်းခြင်း'
              : 'Audit trail, roles & PINs, 100% offline JSON backup/restore, and shop profile'}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'master', icon: Database, labelEn: 'Master Data', labelMm: 'အခြေခံဒေတာများ' },
            { id: 'shop', icon: Store, labelEn: 'Shop Profile', labelMm: 'ဆိုင်အချက်အလက်' },
            { id: 'users', icon: Users, labelEn: 'User Roles & PINs', labelMm: 'အသုံးပြုသူနှင့် PIN' },
            { id: 'audit', icon: FileText, labelEn: 'Audit Trail', labelMm: 'စာရင်းစစ်မှတ်တမ်း' },
            { id: 'backup', icon: Download, labelEn: 'Backup & Restore', labelMm: 'မိတ္တူကူး/ပြန်သွင်း' },
            { id: 'about', icon: Info, labelEn: 'About & Updates', labelMm: 'ဗားရှင်းနှင့် မွမ်းမံမှု' },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{isMm ? tab.labelMm : tab.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 0. Master Data Tab */}
      {activeTab === 'master' && (
        <MasterDataView
          staff={staff}
          staffTypes={staffTypes}
          rooms={rooms}
          tables={tables}
          services={services}
          serviceCategories={serviceCategories}
          products={products}
          productCategories={productCategories}
          customers={customers}
          paymentMethods={paymentMethods}
          expenseCategories={expenseCategories}
          commissionRules={commissionRules}
          currentUser={currentUser}
          lang={lang}
          onRefresh={onRefresh}
        />
      )}

      {/* 1. Audit Trail Tab */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <h3 className="text-sm font-bold text-gray-900">
              {isMm ? 'လုပ်ဆောင်မှုတိုင်း၏ လုံခြုံရေး စာရင်းစစ်မှတ်တမ်း' : 'Immutable Audit Trail Logs'}
            </h3>

            <div className="flex gap-1.5 text-xs">
              {['all', 'session', 'invoice', 'staff', 'expense', 'closing'].map(f => (
                <button
                  key={f}
                  onClick={() => setAuditFilter(f)}
                  className={`rounded-lg px-2.5 py-1 font-semibold uppercase text-[10px] ${
                    auditFilter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-y border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">User & Role</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Entity</th>
                  <th className="py-2.5 px-3">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAudit.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      {isMm ? 'စာရင်းစစ်မှတ်တမ်း မရှိပါ' : 'No audit records found'}
                    </td>
                  </tr>
                ) : (
                  filteredAudit.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50/80">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-gray-900">{log.userName}</span>
                        <span className="block text-[10px] text-gray-400 uppercase">{log.userRole}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800 uppercase">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-600">{log.entity} ({log.entityId.slice(0, 8)}...)</td>
                      <td className="py-2.5 px-3 text-gray-700">{log.reason || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. User Accounts & PINs Tab */}
      {activeTab === 'users' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                {isMm ? 'စနစ်သုံးစွဲခွင့် အကောင့်များနှင့် PIN နံပါတ်များ' : 'User Accounts & Access Roles'}
              </h3>
              <p className="text-xs text-gray-500">
                {isMm ? 'ပိုင်ရှင်၊ မန်နေဂျာနှင့် ငွေကိုင်များ၏ PIN များကို စီမံပါ' : 'Role-based access permissions and quick PIN login'}
              </p>
            </div>

            <button
              onClick={() => setIsAddUserOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span>{isMm ? 'အကောင့်အသစ် ဖန်တီးမည်' : 'Add User Account'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {users.map(u => (
              <div
                key={u.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900">{u.name}</h4>
                    <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 mt-1">
                      {u.role}
                    </span>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                    <Key className="h-4 w-4" />
                  </div>
                </div>

                <div className="rounded-xl bg-gray-50 p-2 text-xs text-gray-600 flex justify-between items-center border border-gray-100">
                  <span>Authentication:</span>
                  <span className="font-mono font-bold tracking-widest text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    •••••• (Salted Hash)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. 100% Offline Backup & Restore Tab */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Export Box */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <Download className="h-6 w-6" />
                <h3 className="text-base font-bold text-gray-900">
                  {isMm ? 'ဒေတာဘေ့စ် မိတ္တူကူးယူခြင်း (Export JSON)' : '100% Offline Database Backup'}
                </h3>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {isMm
                  ? 'အင်တာနက် လုံးဝမလိုဘဲ အခန်းများ၊ ဝန်ထမ်းများ၊ ဘောက်ချာများ၊ ကော်မရှင်စာရင်းများနှင့် စာရင်းစစ်မှတ်တမ်း အားလုံးကို JSON ဖိုင်အဖြစ် သင့်စက်ထဲသို့ သိမ်းဆည်းပါ။'
                  : 'Export all rooms, sessions, invoices, staff ledger records, expenses, and audit trails directly into a standalone JSON file for offline disaster recovery.'}
              </p>
              {backupStatus && (
                <div className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  {backupStatus}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportBackup}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" />
              <span>{isMm ? 'မိတ္တူဖိုင် ဒေါင်းလုဒ်ရယူမည်' : 'Download Complete Backup File'}</span>
            </button>
          </div>

          {/* Restore Box */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-700">
                <Upload className="h-6 w-6" />
                <h3 className="text-base font-bold text-gray-900">
                  {isMm ? 'ဒေတာဘေ့စ် ပြန်လည်သွင်းယူခြင်း (Restore JSON)' : '100% Offline Database Restore'}
                </h3>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {isMm
                  ? 'ယခင်ကူးယူထားသော JSON မိတ္တူဖိုင်ကို ရွေးချယ်၍ စနစ်တစ်ခုလုံးကို မူလအတိုင်း ပြန်လည် ထားရှိနိုင်ပါသည်။'
                  : 'Select a previously downloaded backup JSON file to restore all shop data and continue operations seamlessly.'}
              </p>

              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="w-full text-xs text-gray-500 file:mr-3 file:rounded-xl file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-gray-700 hover:file:bg-gray-200"
              />

              {restoreFileContent && (
                <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-950 border border-indigo-200 space-y-1">
                  <span className="font-bold block">Backup File Verified:</span>
                  <p className="text-[11px]">Exported on: {new Date(restoreFileContent.exportedAt).toLocaleString()}</p>
                  <p className="text-[11px]">Database Version: {restoreFileContent.version}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={!restoreFileContent}
                onClick={handleConfirmRestore}
                className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
              >
                {isMm ? 'အတည်ပြု ပြန်သွင်းမည်' : 'Execute Restore'}
              </button>
              {currentUser.role === 'owner' && (
                <button
                  type="button"
                  onClick={handleResetDemoData}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  title="Reset to fresh demo sample data (Owner Only)"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Shop Profile Tab */}
      {activeTab === 'shop' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs max-w-2xl space-y-4">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
            {isMm ? 'ဆိုင်အချက်အလက်များနှင့် ဘောက်ချာ ဆက်တင်' : 'Shop Profile & Voucher Configuration'}
          </h3>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-semibold text-gray-700">Shop Name (Myanmar)</label>
                <input
                  type="text"
                  value={shopNameMm}
                  onChange={e => setShopNameMm(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-gray-700">Shop Name (English)</label>
                <input
                  type="text"
                  value={shopNameEn}
                  onChange={e => setShopNameEn(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-gray-700">Contact Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-semibold text-gray-700">Address (Myanmar)</label>
                <input
                  type="text"
                  value={addressMm}
                  onChange={e => setAddressMm(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-gray-700">Address (English)</label>
                <input
                  type="text"
                  value={addressEn}
                  onChange={e => setAddressEn(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-semibold text-gray-700">Commercial Tax % (ကုန်သွယ်ခွန်)</label>
                <input
                  type="number"
                  value={taxRate}
                  onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-gray-700">Service Charge % (ဝန်ဆောင်ခ)</label>
                <input
                  type="number"
                  value={serviceChargeRate}
                  onChange={e => setServiceChargeRate(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-gray-700">Receipt Footer Note (Burmese)</label>
              <input
                type="text"
                value={footerMm}
                onChange={e => setFooterMm(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              disabled={isSavingSettings}
              onClick={handleSaveSettings}
              className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
            >
              {isSavingSettings ? 'Saving...' : (isMm ? 'သိမ်းဆည်းမည်' : 'Save Settings')}
            </button>
          </div>
        </div>
      )}

      {/* 5. About & Updates Tab (100% Offline Version Model) */}
      {activeTab === 'about' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Version & Build Metadata */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 font-black">
                  v{APP_VERSION}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Shwe Thiri Spa & KTV ERP
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    Build Release: v{APP_VERSION} ({APP_BUILD_DATE})
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-gray-600 font-medium">Canonical App Version:</span>
                  <span className="font-mono font-bold text-gray-900 bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-md">
                    v{APP_VERSION}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-gray-600 font-medium">{isMm ? 'မွမ်းမံမှု စနစ်:' : 'Update Model:'}</span>
                  <span className="font-semibold text-gray-900">
                    {UPDATE_MODE}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-gray-600 font-medium">{isMm ? 'အင်တာနက် စစ်ဆေးမှု:' : 'Internet Connectivity:'}</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {isMm ? 'အော့ဖ်လိုင်းသီးသန့် (0% Cloud / External Dependency)' : '100% Standalone Offline-First'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-gray-600 font-medium">Database Storage Path:</span>
                  <span className="font-mono text-[11px] text-gray-800 bg-gray-200 px-2 py-0.5 rounded">
                    APP_DATA_DIR / sqlite
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-amber-50/80 p-3.5 border border-amber-200 text-xs text-amber-900 space-y-1">
                <span className="font-bold block">
                  {isMm ? 'အော့ဖ်လိုင်း မွမ်းမံမှု လမ်းညွှန်' : 'Manual Offline Update Policy:'}
                </span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {isMm
                    ? 'ဤဆော့ဖ်ဝဲသည် အင်တာနက်သို့ တိုက်ရိုက်ဆက်သွယ်ပြီး မွမ်းမံမှု စစ်ဆေးမည် မဟုတ်ပါ။ Package အသစ် ရရှိပါက Host စက်ထဲသို့ တိုက်ရိုက် ကူးယူ/ထည့်သွင်းနိုင်ပြီး APP_DATA_DIR ရှိ ဒေတာများနှင့် သုံးစွဲသူ စာရင်းများ ပျောက်ပျက်မည် မဟုတ်ပါ။'
                    : 'This software does NOT connect to external update servers. Local package updates or manual build deployment preserve APP_DATA_DIR data files and apply idempotent database schema migrations safely.'}
                </p>
              </div>
            </div>

            {/* Pre-Update Backup & Migration Safety */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 border-b border-gray-100 pb-3">
                  <ShieldCheck className="h-6 w-6" />
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {isMm ? 'မွမ်းမံမှုမပြုမီ မိတ္တူကူးယူခြင်းနှင့် ဒေတာလုံခြုံရေး' : 'Pre-Update Backup & Local Migration Guard'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {isMm ? 'Package အသစ်မသွင်းမီ ဒေတာဘေ့စ် မိတ္တူအလိုအလျောက် ရယူပါ' : 'Create automated pre-update snapshot before host file update'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed">
                  {isMm
                    ? 'စနစ်အား အဆင့်မြှင့်တင်ခြင်း သို့မဟုတ် Package အသစ် လဲလှယ်ခြင်းမပြုမီ လက်ရှိ ဒေတာများကို မိတ္တူ ရယူရန် အောက်ပါ ခလုတ်ကို နှိပ်ပါ။'
                    : 'Execute an immediate full database export before extracting or running a local update package on this host machine.'}
                </p>

                {preUpdateStatus && (
                  <div className="rounded-xl bg-indigo-50 p-3 text-xs font-semibold text-indigo-900 border border-indigo-200">
                    {preUpdateStatus}
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-2">
                <button
                  type="button"
                  disabled={isPreUpdating}
                  onClick={handlePreUpdateBackup}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >
                  <Download className="h-4 w-4" />
                  <span>
                    {isPreUpdating
                      ? (isMm ? 'မိတ္တူ ကူးယူနေပါသည်...' : 'Creating Pre-Update Backup...')
                      : (isMm ? 'မွမ်းမံမှုမပြုမီ ဒေတာဘေ့စ် မိတ္တူ ရယူမည်' : 'Run Pre-Update Local Backup')}
                  </span>
                </button>

                <div className="text-[11px] text-gray-400 text-center font-mono">
                  Schema Version: v3 (Idempotent SQLite Migration Ready)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 mb-3">Add User Account</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">User Name</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="e.g. Daw Khin Khin"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Role</label>
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2"
                >
                  <option value="cashier">Cashier (ငွေကိုင်)</option>
                  <option value="manager">Manager (မန်နေဂျာ)</option>
                  <option value="auditor">Auditor (စာရင်းစစ်)</option>
                  <option value="owner">Owner (ဆိုင်ရှင်)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  value={newUserPin}
                  onChange={e => setNewUserPin(e.target.value)}
                  placeholder="e.g. 1122"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2 font-mono tracking-widest"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
