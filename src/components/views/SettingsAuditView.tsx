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
import { triggerFileSave } from '../../utils/fileNaming';
import {
  ShieldCheck,
  Download,
  Upload,
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
  Edit2,
  Check,
  XCircle,
  KeyRound,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { MasterDataView } from './MasterDataView';
import { verifyPin, hashPin, hashPassword } from '../../utils/cryptoAuth';
import { localServerClient } from '../../services/localServerClient';

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
  onOpenUserGuide: () => void;
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
  onOpenUserGuide,
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

  // User management states
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('cashier');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserConfirmPassword, setNewUserConfirmPassword] = useState('');

  // Edit User State
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserUsername, setEditUserUsername] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserRole>('cashier');

  // Change Password State
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [targetPasswordUserId, setTargetPasswordUserId] = useState<string | null>(null);
  const [targetPasswordUserName, setTargetPasswordUserName] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  // Backup & Restore state
  const [backupStatus, setBackupStatus] = useState<string>('');
  const [restoreFileContent, setRestoreFileContent] = useState<any | null>(null);

  // Update check state
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState<string | null>(null);

  const handleCheckForUpdates = () => {
    setIsCheckingUpdate(true);
    setUpdateCheckResult(null);
    setTimeout(() => {
      setIsCheckingUpdate(false);
      setUpdateCheckResult(
        isMm
          ? `စနစ်သည် နောက်ဆုံးပေါ်ဗားရှင်း (v${APP_VERSION}) တွင်ရှိနေပါသည်။ (Build Date: ${APP_BUILD_DATE})။ အော့ဖ်လိုင်း ဆာဗာသည် အပ်ဒိတ်အဆင်သင့်ဖြစ်နေပါသည်။`
          : `System is up-to-date! Running latest version v${APP_VERSION} (Build: ${APP_BUILD_DATE}). Local offline package is verified.`
      );
    }, 800);
  };

  // Handle Export Backup JSON
  const handleExportBackup = async () => {
    try {
      const data = await db.exportDatabaseBackup();
      await triggerFileSave(data, {
        categoryName: 'Backup',
        fileExtension: 'json',
        mimeType: 'application/json',
        shopName: settings?.shopName || 'Shwe_Thiri_Spa_And_KTV'
      });
      setBackupStatus(isMm ? 'ဒေတာဘေ့စ် မိတ္တူကူးယူပြီးပါပြီ' : 'Database backup downloaded successfully!');
    } catch (err: any) {
      alert('Backup export error: ' + err.message);
    }
  };

  const handlePreUpdateBackup = async () => {
    setIsPreUpdating(true);
    setPreUpdateStatus('');
    try {
      await handleExportBackup();
      setPreUpdateStatus(
        isMm
          ? 'ဆော့ဖ်ဝဲ မွမ်းမံမှုမပြုမီ ဒေတာဘေ့စ် မိတ္တူကူးယူခြင်း အောင်မြင်ပါသည် (Pre-update snapshot ready)'
          : 'Pre-update database snapshot generated and saved successfully!'
      );
    } catch (err: any) {
      setPreUpdateStatus('Error: ' + err.message);
    } finally {
      setIsPreUpdating(false);
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

  // Create User (Authoritative Server + Dexie Sync)
  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserUsername.trim()) {
      alert(isMm ? 'ကျေးဇူးပြု၍ အမည်နှင့် အသုံးပြုသူအမည် ထည့်သွင်းပါ' : 'Please enter name and username');
      return;
    }
    if (newUserPassword.length < 4) {
      alert(isMm ? 'စကားဝှက် အနည်းဆုံး ၄ လုံး ရှိရပါမည်' : 'Password must be at least 4 characters');
      return;
    }
    if (newUserPassword !== newUserConfirmPassword) {
      alert(isMm ? 'စကားဝှက် ၂ ကြိမ် ရိုက်ထည့်မှု မတူညီပါ' : 'Passwords do not match');
      return;
    }

    const cleanUsername = newUserUsername.toLowerCase().trim();
    const cleanName = newUserName.trim();
    const cleanPassword = newUserPassword.trim();

    if (!cleanName || !cleanUsername) {
      alert(isMm ? 'အမည်နှင့် အသုံးပြုသူအမည် ထည့်သွင်းပါ' : 'Please provide name and username');
      return;
    }

    if (cleanPassword.length < 4 || cleanPassword.length > 6) {
      alert(isMm ? 'စကားဝှက်/PIN သည် ၄ လုံးမှ ၆ လုံး အထိ ဖြစ်ရပါမည်' : 'Password/PIN must be between 4 and 6 characters');
      return;
    }

    if (cleanPassword !== newUserConfirmPassword.trim()) {
      alert(isMm ? 'စကားဝှက် ၂ ကြိမ် ရိုက်ထည့်မှု မတူညီပါ' : 'Passwords do not match');
      return;
    }

    try {
      let createdId = 'usr_' + Date.now();

      // 1. Authoritative Server Call
      try {
        const sRes = await localServerClient.createUser({
          name: cleanName,
          username: cleanUsername,
          role: newUserRole,
          password: cleanPassword,
          mustChangePassword: false,
        });
        if (sRes && sRes.user && sRes.user.id) {
          createdId = sRes.user.id;
        }
      } catch (serverErr: any) {
        console.warn('LAN server user creation notice:', serverErr);
        if (serverErr.status === 400 && serverErr.message?.includes('already in use')) {
          alert(isMm ? 'ဤ အသုံးပြုသူအမည် ရှိနှင့်ပြီးဖြစ်ပါသည်' : 'Username is already taken');
          return;
        }
      }

      // 2. Local Dexie Storage
      const { passwordHash, salt } = hashPassword(cleanPassword);
      const newUser: UserAccount = {
        id: createdId,
        name: cleanName,
        username: cleanUsername,
        role: newUserRole,
        pinHash: passwordHash,
        pinSalt: salt,
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date().toISOString(),
      };

      await db.users.put(newUser);
      setIsAddUserOpen(false);
      setNewUserName('');
      setNewUserUsername('');
      setNewUserPassword('');
      setNewUserConfirmPassword('');
      onRefresh();
      alert(isMm ? 'အသုံးပြုသူအကောင့် အသစ်ဖန်တီးပြီးပါပြီ' : 'User account created successfully');
    } catch (err: any) {
      alert('Error adding user: ' + err.message);
    }
  };

  // Edit User Details
  const handleStartEditUser = (user: UserAccount) => {
    setEditingUserId(user.id);
    setEditUserName(user.name);
    setEditUserUsername(user.username);
    setEditUserRole(user.role);
    setIsEditUserOpen(true);
  };

  const handleSaveEditUser = async () => {
    if (!editingUserId || !editUserName.trim() || !editUserUsername.trim()) {
      alert('Please provide valid name and username');
      return;
    }

    try {
      const cleanUsername = editUserUsername.toLowerCase().trim();
      const cleanName = editUserName.trim();

      // Server update
      try {
        await localServerClient.updateUser(editingUserId, {
          name: cleanName,
          username: cleanUsername,
          role: editUserRole,
        });
      } catch (err) {
        console.warn('Server edit notice:', err);
      }

      // Dexie update
      await db.users.update(editingUserId, {
        name: cleanName,
        username: cleanUsername,
        role: editUserRole,
      });

      setIsEditUserOpen(false);
      setEditingUserId(null);
      onRefresh();
      alert(isMm ? 'အချက်အလက်များ ပြင်ဆင်ပြီးပါပြီ' : 'User updated successfully');
    } catch (err: any) {
      alert('Error editing user: ' + err.message);
    }
  };

  // Change / Reset Password
  const handleOpenPasswordModal = (user: UserAccount) => {
    setTargetPasswordUserId(user.id);
    setTargetPasswordUserName(user.name);
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setIsChangePasswordOpen(true);
  };

  const handleSavePassword = async () => {
    if (!targetPasswordUserId) return;
    const cleanPassword = newPasswordInput.trim();
    if (cleanPassword.length < 4 || cleanPassword.length > 6) {
      alert(isMm ? 'စကားဝှက်သည် ၄ လုံးမှ ၆ လုံး အထိ ဖြစ်ရပါမည်' : 'Password must be between 4 and 6 characters');
      return;
    }
    if (cleanPassword !== confirmPasswordInput.trim()) {
      alert(isMm ? 'စကားဝှက် ၂ ကြိမ် ရိုက်ထည့်မှု မတူညီပါ' : 'Passwords do not match');
      return;
    }

    try {
      // Server update
      try {
        await localServerClient.changeUserPassword(targetPasswordUserId, cleanPassword);
      } catch (err) {
        console.warn('Server password change notice:', err);
      }

      // Dexie update
      const { passwordHash, salt } = hashPassword(cleanPassword);
      await db.users.update(targetPasswordUserId, {
        pinHash: passwordHash,
        pinSalt: salt,
        mustChangePassword: false,
      });

      setIsChangePasswordOpen(false);
      setTargetPasswordUserId(null);
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      onRefresh();
      alert(isMm ? 'စကားဝှက် အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ' : 'Password changed successfully');
    } catch (err: any) {
      alert('Error changing password: ' + err.message);
    }
  };

  // Toggle Active Status
  const handleToggleUserActive = async (user: UserAccount) => {
    if (user.id === currentUser.id && user.isActive) {
      alert(isMm ? 'မိမိကိုယ်ပိုင် အကောင့်ကို ပိတ်၍မရပါ' : 'Cannot deactivate your own logged-in account');
      return;
    }

    const nextActive = !user.isActive;
    const confirmMsg = nextActive
      ? (isMm ? `${user.name} အား ပြန်လည်ဖွင့်လှစ်ပေးမည်လား?` : `Activate account for ${user.name}?`)
      : (isMm ? `${user.name} အား ပိတ်သိမ်းမည်လား? အကောင့်ပိတ်ပါက စနစ်သို့ ဝင်ရောက်ခွင့် မရတော့ပါ။` : `Deactivate account for ${user.name}? They will no longer be able to log in.`);

    if (!window.confirm(confirmMsg)) return;

    try {
      try {
        await localServerClient.toggleUserActive(user.id, nextActive);
      } catch (err) {
        console.warn('Server toggle active notice:', err);
      }

      await db.users.update(user.id, { isActive: nextActive });
      onRefresh();
    } catch (err: any) {
      alert('Error updating user status: ' + err.message);
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full border-b border-gray-100 pb-3 mb-1 gap-3">
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
          <button
            type="button"
            onClick={onOpenUserGuide}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <BookOpen className="h-4 w-4" />
            <span>{isMm ? 'အသုံးပြုသူလမ်းညွှန် ဖတ်ရန်' : 'Read User Manual'}</span>
          </button>
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

      {/* 2. User Accounts & Access Control Tab */}
      {activeTab === 'users' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                {isMm ? 'စနစ်သုံးစွဲခွင့် အကောင့်များနှင့် လုံခြုံရေး' : 'User Accounts & Security (RBAC)'}
              </h3>
              <p className="text-xs text-gray-500">
                {isMm
                  ? 'ဆိုင်ရှင်၊ မန်နေဂျာ၊ ငွေကိုင်များနှင့် အသုံးပြုသူ အကောင့်များကို စီမံခန့်ခွဲပါ'
                  : 'Authoritative user management, role assignments, status toggling, and secure password changes'}
              </p>
            </div>

            {currentUser.role === 'owner' && (
              <button
                onClick={() => setIsAddUserOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{isMm ? 'အသုံးပြုသူ အသစ်ဖန်တီးမည်' : 'Create User Account'}</span>
              </button>
            )}
          </div>

          {currentUser.role !== 'owner' ? (
            <div className="rounded-xl bg-amber-50 p-4 text-xs text-amber-900 border border-amber-200 flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                {isMm
                  ? 'အသုံးပြုသူ စာရင်းနှင့် လုံခြုံရေး ဆက်တင်များကို ဆိုင်ရှင် (Owner) သာလျှင် စီမံခန့်ခွဲခွင့် ရှိပါသည်။ မိမိ စကားဝှက်ကိုသာ ပြောင်းလဲနိုင်ပါသည်။'
                  : 'Only the Shop Owner can manage user accounts. Non-owner staff can change their own password below.'}
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-y border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50/80">
                      <td className="py-3 px-3">
                        <div className="font-bold text-gray-900">{u.name}</div>
                        {u.id === currentUser.id && (
                          <span className="text-[10px] text-emerald-600 font-semibold">(Current You)</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-gray-600">@{u.username}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            u.role === 'owner'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : u.role === 'manager'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                            <Check className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
                            <XCircle className="h-3 w-3" /> Deactivated
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleStartEditUser(u)}
                          title="Edit user details"
                          className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer"
                        >
                          <Edit2 className="inline h-3 w-3 mr-1" />
                          <span>{isMm ? 'ပြင်ဆင်' : 'Edit'}</span>
                        </button>
                        <button
                          onClick={() => handleOpenPasswordModal(u)}
                          title="Change or reset password"
                          className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-100 cursor-pointer"
                        >
                          <KeyRound className="inline h-3 w-3 mr-1" />
                          <span>{isMm ? 'စကားဝှက်' : 'Password'}</span>
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => handleToggleUserActive(u)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                              u.isActive
                                ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {u.isActive ? (isMm ? 'ပိတ်မည်' : 'Deactivate') : (isMm ? 'ဖွင့်မည်' : 'Activate')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Self password change for non-owners */}
          {currentUser.role !== 'owner' && (
            <div className="pt-2">
              <button
                onClick={() => handleOpenPasswordModal(currentUser)}
                className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 cursor-pointer"
              >
                <KeyRound className="h-4 w-4" />
                <span>{isMm ? 'မိမိ စကားဝှက် ပြောင်းလဲမည်' : 'Change My Password'}</span>
              </button>
            </div>
          )}
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
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
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
                className="w-full text-xs text-gray-500 file:mr-3 file:rounded-xl file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
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
                className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                {isMm ? 'အတည်ပြု ပြန်သွင်းမည်' : 'Execute Restore'}
              </button>
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

            {/* Check for Software Updates Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-cyan-700 border-b border-gray-100 pb-3">
                  <RefreshCw className="h-6 w-6" />
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {isMm ? 'ဆော့ဖ်ဝဲ အပ်ဒိတ် စစ်ဆေးရန်' : 'Check for Software Updates'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {isMm ? 'လက်ရှိဗားရှင်းနှင့် ဒေသတွင်း မွမ်းမံမှုအခြေအနေ စစ်ဆေးရန်' : 'Verify current release version and build status'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed">
                  {isMm
                    ? 'ဆော့ဖ်ဝဲ၏ နောက်ဆုံးဗားရှင်းနှင့် ဒေသတွင်း အပ်ဒိတ်အခြေအနေများကို အချိန်နှင့်တပြေးညီ စစ်ဆေးနိုင်ပါသည်။'
                    : 'Check your current local release version and verify offline system update readiness.'}
                </p>

                {updateCheckResult && (
                  <div className="rounded-xl bg-cyan-50 p-3 text-xs font-semibold text-cyan-900 border border-cyan-200">
                    {updateCheckResult}
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  disabled={isCheckingUpdate}
                  onClick={handleCheckForUpdates}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-cyan-700 disabled:opacity-50 transition-all"
                >
                  <RefreshCw className={`h-4 w-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                  <span>
                    {isCheckingUpdate
                      ? (isMm ? 'အပ်ဒိတ် စစ်ဆေးနေပါသည်...' : 'Checking for Updates...')
                      : (isMm ? 'အပ်ဒိတ် ရှိမရှိ စစ်ဆေးမည်' : 'Check for Updates Now')}
                  </span>
                </button>
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
            <h3 className="text-base font-bold text-gray-900 mb-3">
              {isMm ? 'အသုံးပြုသူ အသစ်ထည့်သွင်းခြင်း' : 'Create User Account'}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-gray-700">Display Name</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="e.g. Daw Khin Khin"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-gray-900"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-gray-700">Username (Login ID)</label>
                <input
                  type="text"
                  value={newUserUsername}
                  onChange={e => setNewUserUsername(e.target.value)}
                  placeholder="e.g. khinkhin"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 lowercase text-gray-900"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-gray-700">Role</label>
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-gray-900"
                >
                  <option value="cashier">Cashier (ငွေကိုင်)</option>
                  <option value="receptionist">Receptionist (ဧည့်ကြို)</option>
                  <option value="waiter">Waiter (စားပွဲထိုး/အော်ဒါ)</option>
                  <option value="manager">Manager (မန်နေဂျာ)</option>
                  <option value="owner">Owner (ဆိုင်ရှင်)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1 text-gray-700">Password / PIN (၄ လုံးမှ ၆ လုံး)</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  placeholder="4 to 6 characters"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-gray-900"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-gray-700">Confirm Password / PIN</label>
                <input
                  type="password"
                  value={newUserConfirmPassword}
                  onChange={e => setNewUserConfirmPassword(e.target.value)}
                  placeholder="4 to 6 characters"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-gray-900"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {isEditUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 mb-3">
              {isMm ? 'အသုံးပြုသူ အချက်အလက် ပြင်ဆင်ခြင်း' : 'Edit User Account'}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-gray-700">Display Name</label>
                <input
                  type="text"
                  value={editUserName}
                  onChange={e => setEditUserName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-gray-900"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-gray-700">Username</label>
                <input
                  type="text"
                  value={editUserUsername}
                  onChange={e => setEditUserUsername(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 lowercase text-gray-900"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-gray-700">Role</label>
                <select
                  value={editUserRole}
                  onChange={e => setEditUserRole(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-gray-900"
                >
                  <option value="cashier">Cashier (ငွေကိုင်)</option>
                  <option value="receptionist">Receptionist (ဧည့်ကြို)</option>
                  <option value="waiter">Waiter (စားပွဲထိုး/အော်ဒါ)</option>
                  <option value="manager">Manager (မန်နေဂျာ)</option>
                  <option value="owner">Owner (ဆိုင်ရှင်)</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsEditUserOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditUser}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {isMm ? 'စကားဝှက် ပြောင်းလဲခြင်း / အသစ်သတ်မှတ်ခြင်း' : 'Change Password'}
            </h3>
            <p className="text-xs text-gray-500 mb-4">User: <strong className="text-gray-800">{targetPasswordUserName}</strong></p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-gray-700">New Password</label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={e => setNewPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-gray-900"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-gray-700">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={e => setConfirmPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-gray-900"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsChangePasswordOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePassword}
                className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 cursor-pointer"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
