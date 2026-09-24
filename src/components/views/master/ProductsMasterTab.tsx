import React, { useState, useMemo, useEffect } from 'react';
import { ProductItem, ProductCategory, UserAccount, SupplierRecord, PurchaseOrderRecord } from '../../../types';
import { db } from '../../../db/database';
import { Language } from '../../../utils/translations';
import { formatMMK } from '../../../domain/financial';
import { syncManager } from '../../../services/syncManager';
import { localServerClient } from '../../../services/localServerClient';
import {
  ShoppingBag,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  X,
  Save,
  Barcode,
  Boxes,
  Tag,
  DollarSign,
  TrendingUp,
  Truck,
  FileText,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { ConfirmDeactivateModal } from './ConfirmDeactivateModal';

interface ProductsMasterTabProps {
  products: ProductItem[];
  productCategories: ProductCategory[];
  currentUser: UserAccount;
  lang: Language;
  onRefresh: () => void;
}

export const ProductsMasterTab: React.FC<ProductsMasterTabProps> = ({
  products,
  productCategories,
  currentUser,
  lang,
  onRefresh,
}) => {
  const isMm = lang === 'my';

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

  // Form states for Product
  const [formName, setFormName] = useState('');
  const [formNameMm, setFormNameMm] = useState('');
  const [formSKU, setFormSKU] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState<number>(5000);
  const [formCostPrice, setFormCostPrice] = useState<number>(3000);
  const [formTrackStock, setFormTrackStock] = useState(true);
  const [formStockQuantity, setFormStockQuantity] = useState<number>(20);
  const [formUnit, setFormUnit] = useState('Bottle');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');

  // Phase 35: Suppliers, PO & Stock Adjustments Modals
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [newSupName, setNewSupName] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupContact, setNewSupContact] = useState('');
  const [newSupAddress, setNewSupAddress] = useState('');

  const [showPOModal, setShowPOModal] = useState(false);
  const [poSupplierId, setPOSupplierId] = useState('');
  const [poItems, setPOItems] = useState<{ productId: string; productName: string; quantity: number; costPriceMMK: number; totalCostMMK: number }[]>([]);
  const [poSelProduct, POSelProduct] = useState('');
  const [poQty, setPOQty] = useState(10);
  const [poCost, setPOCost] = useState(3000);

  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjProductId, setAdjProductId] = useState('');
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState('Stock Count Audit');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    item: ProductItem | null;
  }>({ isOpen: false, item: null });

  // Load suppliers
  const loadSuppliers = async () => {
    try {
      const list = await db.suppliers.toArray();
      setSuppliers(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        searchTerm === '' ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.nameMm && p.nameMm.includes(searchTerm)) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory =
        categoryFilter === 'all' ||
        p.categoryId === categoryFilter ||
        p.category.toLowerCase() === categoryFilter.toLowerCase();

      const matchStock =
        stockFilter === 'all'
          ? true
          : stockFilter === 'tracked'
          ? p.trackStock === true
          : stockFilter === 'low'
          ? p.trackStock === true && (p.stockQty || 0) <= 5
          : p.trackStock === false;

      const matchActive =
        activeFilter === 'all'
          ? true
          : activeFilter === 'active'
          ? p.isActive !== false
          : p.isActive === false;

      return matchSearch && matchCategory && matchStock && matchActive;
    });
  }, [products, searchTerm, categoryFilter, stockFilter, activeFilter]);

  const lowStockCount = useMemo(() => {
    return products.filter(p => p.trackStock && (p.stockQty || 0) <= 5).length;
  }, [products]);

  // Create Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim() || !newSupPhone.trim()) return;

    const sup: SupplierRecord = {
      id: `sup_${Date.now()}`,
      businessId: 'default',
      branchId: 'main',
      name: newSupName.trim(),
      phone: newSupPhone.trim(),
      contactPerson: newSupContact.trim() || undefined,
      address: newSupAddress.trim() || undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await syncManager.executeMutation({
        operationType: 'SUPPLIER_SAVE',
        entityType: 'SUPPLIER',
        entityId: sup.id,
        payload: sup,
        offlineMutationFn: async () => {
          await db.suppliers.put(sup);
          return sup;
        },
      });
      setNewSupName('');
      setNewSupPhone('');
      setNewSupContact('');
      setNewSupAddress('');
      setShowSupplierModal(false);
      loadSuppliers();
    } catch (err) {
      console.error(err);
    }
  };

  // Add Item to PO
  const handleAddPOItem = () => {
    const prd = products.find(p => p.id === poSelProduct);
    if (!prd || poQty <= 0) return;
    const cost = poCost || prd.costPriceMMK || 0;
    setPOItems(prev => [...prev, {
      productId: prd.id,
      productName: prd.name,
      quantity: poQty,
      costPriceMMK: cost,
      totalCostMMK: poQty * cost,
    }]);
  };

  // Submit Purchase Order
  const handleSubmitPO = async () => {
    const sup = suppliers.find(s => s.id === poSupplierId);
    if (!sup || poItems.length === 0) return;

    const totalCost = poItems.reduce((acc, i) => acc + (i.quantity * i.costPriceMMK), 0);
    const poPayload = {
      supplierId: sup.id,
      supplierName: sup.name,
      items: poItems,
      totalAmountMMK: totalCost,
      paidAmountMMK: totalCost,
      paymentStatus: 'paid' as const,
      paymentMethod: 'cash',
      createdBy: currentUser.name,
    };

    try {
      await syncManager.executeMutation({
        operationType: 'PURCHASE_ORDER_CREATE',
        entityType: 'PURCHASE_ORDER',
        entityId: `po_${Date.now()}`,
        payload: poPayload,
        offlineMutationFn: async () => {
          return db.recordPurchaseOrderTransaction(poPayload);
        },
      });

      setShowPOModal(false);
      setPOItems([]);
      setPOSupplierId('');
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Stock Adjustment
  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjProductId || adjQty === 0) return;

    try {
      await syncManager.executeMutation({
        operationType: 'STOCK_ADJUSTMENT',
        entityType: 'STOCK_ADJUSTMENT',
        entityId: `adj_${Date.now()}`,
        payload: {
          productId: adjProductId,
          adjustQty: adjQty,
          reason: adjReason,
          adjustedBy: currentUser.name,
        },
        offlineMutationFn: async () => {
          return db.recordStockAdjustmentTransaction({
            productId: adjProductId,
            adjustQty: adjQty,
            reason: adjReason,
            adjustedBy: currentUser.name,
          });
        },
      });

      setShowAdjModal(false);
      setAdjProductId('');
      setAdjQty(0);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormName('');
    setFormNameMm('');
    setFormSKU(`SKU-${Date.now().toString().slice(-5)}`);
    setFormCategoryId(productCategories[0]?.id || '');
    setFormSellingPrice(5000);
    setFormCostPrice(3000);
    setFormTrackStock(true);
    setFormStockQuantity(24);
    setFormUnit('Bottle');
    setFormIsActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: ProductItem) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormNameMm(product.nameMm || '');
    setFormSKU(product.sku || '');
    setFormCategoryId(product.categoryId || '');
    setFormSellingPrice(product.sellingPriceMMK);
    setFormCostPrice(product.costPriceMMK || 0);
    setFormTrackStock(product.trackStock !== false);
    setFormStockQuantity(product.stockQty || 0);
    setFormUnit(product.unit || 'Bottle');
    setFormIsActive(product.isActive !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError(isMm ? 'ကုန်ပစ္စည်းအမည် ထည့်သွင်းပေးပါ' : 'Product name is required');
      return;
    }
    if (formSellingPrice <= 0) {
      setFormError(isMm ? 'ရောင်းဈေးမှာ သုညထက်ကြီးရမည်' : 'Selling price must be greater than 0');
      return;
    }

    const matchedCat = productCategories.find((c) => c.id === formCategoryId);
    const categoryName = matchedCat ? matchedCat.name : 'Drinks & Beverages';

    try {
      if (editingProduct) {
        await db.products.update(editingProduct.id, {
          name: formName.trim(),
          nameMm: formNameMm.trim() || undefined,
          sku: formSKU.trim().toUpperCase() || undefined,
          categoryId: formCategoryId || undefined,
          category: categoryName,
          sellingPriceMMK: Number(formSellingPrice),
          costPriceMMK: Number(formCostPrice) || 0,
          trackStock: formTrackStock,
          stockQty: Number(formStockQuantity) || 0,
          unit: formUnit.trim() || 'Unit',
          isActive: formIsActive,
        });
      } else {
        const newId = `prod_${Date.now()}`;
        await db.products.add({
          id: newId,
          name: formName.trim(),
          nameMm: formNameMm.trim() || undefined,
          sku: formSKU.trim().toUpperCase() || undefined,
          categoryId: formCategoryId || undefined,
          category: categoryName,
          sellingPriceMMK: Number(formSellingPrice),
          costPriceMMK: Number(formCostPrice) || 0,
          trackStock: formTrackStock,
          stockQty: Number(formStockQuantity) || 0,
          unit: formUnit.trim() || 'Unit',
          isActive: formIsActive,
        });
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err?.message || 'Error saving product');
    }
  };

  const handleToggleActive = async (product: ProductItem) => {
    try {
      await db.products.update(product.id, {
        isActive: product.isActive === false,
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-blue-600" />
            <span>{isMm ? 'ကုန်ပစ္စည်း မာစတာ စီမံခန့်ခွဲမှု' : 'Products & Goods Catalog'}</span>
            <span className="ml-2 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5">
              {products.length}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isMm
              ? 'အဖျော်ယမကာ၊ သွားရည်စာ၊ စပါသုံးပစ္စည်းများ၊ SKU ဘားကုဒ်၊ သွင်းဈေး/ရောင်းဈေးနှင့် သိုလှောင်လက်ကျန် စာရင်း'
              : 'Manage products, SKUs, wholesale cost, selling prices, inventory tracking flags, and unit measurements.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSupplierModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            <Truck className="h-4 w-4 text-emerald-600" />
            <span>{isMm ? 'ဒိုင်/ကုန်သည်' : 'Suppliers'}</span>
          </button>

          <button
            onClick={() => setShowPOModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
          >
            <FileText className="h-4 w-4 text-blue-600" />
            <span>{isMm ? 'ပစ္စည်းဝယ်ယူမှု (PO)' : 'Purchase Order'}</span>
          </button>

          <button
            onClick={() => setShowAdjModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100"
          >
            <Sliders className="h-4 w-4 text-amber-600" />
            <span>{isMm ? 'စတော့ပြင်ဆင်ရန်' : 'Stock Adjustment'}</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{isMm ? 'ကုန်ပစ္စည်းအသစ် ထည့်သွင်းရန်' : 'Add New Product'}</span>
          </button>
        </div>
      </div>

      {lowStockCount > 0 && (
        <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              {isMm
                ? `သတိပေးချက်: ကုန်ပစ္စည်း ${lowStockCount} ခုသည် စတော့လက်ကျန် နည်းနေပါသည် (၅ ခု သို့မဟုတ် အောက်)`
                : `Low Stock Alert: ${lowStockCount} item(s) are running low on stock (<= 5 units remaining).`}
            </span>
          </div>
          <button
            onClick={() => setStockFilter('low')}
            className="px-2.5 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700"
          >
            {isMm ? 'ကြည့်ရှုမည်' : 'View Low Stock'}
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isMm ? 'အမည်၊ SKU၊ ကဏ္ဍ ရှာရန်...' : 'Search name, SKU, category...'}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'ကဏ္ဍ: အားလုံး' : 'Category: All'}</option>
            {productCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {isMm && c.nameMm ? c.nameMm : c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'စတော့ထိန်းသိမ်းမှု: အားလုံး' : 'Stock Tracking: All'}</option>
            <option value="tracked">{isMm ? 'စတော့မှတ်တမ်းရှိ (Tracked)' : 'Tracked Stock'}</option>
            <option value="untracked">{isMm ? 'စတော့မမှတ် (Untracked)' : 'Untracked Stock'}</option>
          </select>
        </div>

        <div>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white text-gray-700 font-medium"
          >
            <option value="all">{isMm ? 'အသုံးပြုခွင့်: အားလုံး' : 'Active Status: All'}</option>
            <option value="active">{isMm ? 'အသုံးပြုဆဲ (Active)' : 'Active Only'}</option>
            <option value="inactive">{isMm ? 'ပိတ်ထားသောစာရင်း (Inactive)' : 'Inactive Only'}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-slate-50 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                <th className="py-3 px-4">{isMm ? 'ကုန်ပစ္စည်း / SKU' : 'Product & SKU'}</th>
                <th className="py-3 px-4">{isMm ? 'ကဏ္ဍ' : 'Category'}</th>
                <th className="py-3 px-4">{isMm ? 'သွင်းဈေး (Cost)' : 'Cost Price'}</th>
                <th className="py-3 px-4">{isMm ? 'ရောင်းဈေး (Selling)' : 'Selling Price'}</th>
                <th className="py-3 px-4">{isMm ? 'အမြတ်ငွေ' : 'Margin / Profit'}</th>
                <th className="py-3 px-4">{isMm ? 'လက်ကျန်စတော့' : 'Stock Status'}</th>
                <th className="py-3 px-4">{isMm ? 'စာရင်းဝင်' : 'Active'}</th>
                <th className="py-3 px-4 text-right">{isMm ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    {isMm ? 'ကုန်ပစ္စည်း ရှာမတွေ့ပါ' : 'No products found.'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const catObj = productCategories.find((c) => c.id === p.categoryId);
                  const marginMMK = p.sellingPriceMMK - (p.costPriceMMK || 0);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        p.isActive === false ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      {/* Name & SKU */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{p.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {p.nameMm && (
                            <span className="text-[11px] text-gray-500">{p.nameMm}</span>
                          )}
                          {p.sku && (
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md">
                              {p.sku}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200/60 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                          <Tag className="h-3 w-3" />
                          <span>{catObj ? (isMm && catObj.nameMm ? catObj.nameMm : catObj.name) : p.category}</span>
                        </span>
                      </td>

                      {/* Cost Price */}
                      <td className="py-3.5 px-4 font-semibold text-gray-600">
                        {p.costPriceMMK ? formatMMK(p.costPriceMMK) : '-'}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3.5 px-4 font-bold text-blue-900">
                        {formatMMK(p.sellingPriceMMK)}
                      </td>

                      {/* Margin */}
                      <td className="py-3.5 px-4">
                        {p.costPriceMMK ? (
                          <div className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <TrendingUp className="h-3 w-3" />
                            <span>+{formatMMK(marginMMK)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Stock Tracking & Quantity */}
                      <td className="py-3.5 px-4">
                        {p.trackStock ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                (p.stockQty || 0) <= 5
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              <Boxes className="h-3 w-3" />
                              <span>{p.stockQty || 0} {p.unit || 'Unit'}</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">
                            {isMm ? 'စတော့မမှတ်' : 'Untracked'}
                          </span>
                        )}
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {p.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{isMm ? 'အသုံးပြုဆဲ' : 'Active'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400 font-semibold text-[11px]">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>{isMm ? 'ပိတ်ထားသည်' : 'Inactive'}</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title={isMm ? 'ပြင်ဆင်ရန်' : 'Edit'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                item: p,
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              p.isActive !== false
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {p.isActive !== false
                              ? isMm ? 'ပိတ်မည်' : 'Deactivate'
                              : isMm ? 'ပြန်ဖွင့်' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
                <span>
                  {editingProduct
                    ? isMm ? 'ကုန်ပစ္စည်း ပြင်ဆင်ခြင်း' : 'Edit Product Item'
                    : isMm ? 'ကုန်ပစ္စည်း အသစ်ထည့်သွင်းခြင်း' : 'Add New Product'}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Name EN */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ကုန်ပစ္စည်းအမည် (အင်္ဂလိပ်)' : 'Product Name (EN)'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Heineken Beer Can"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>

                {/* Name MM */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ကုန်ပစ္စည်းအမည် (မြန်မာ)' : 'Product Name (Myanmar)'}
                  </label>
                  <input
                    type="text"
                    value={formNameMm}
                    onChange={(e) => setFormNameMm(e.target.value)}
                    placeholder="ဥပမာ - ဟိုင်းနီးကန်း ဘီယာဘူး"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* SKU */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'SKU ဘားကုဒ်' : 'SKU / Barcode'}
                  </label>
                  <input
                    type="text"
                    value={formSKU}
                    onChange={(e) => setFormSKU(e.target.value.toUpperCase())}
                    placeholder="e.g. BEER-HK-01"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-mono uppercase text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ကုန်ပစ္စည်းကဏ္ဍ' : 'Category'}
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                  >
                    <option value="">{isMm ? '-- ကဏ္ဍရွေးချယ်ပါ --' : '-- Select Category --'}</option>
                    {productCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {isMm && c.nameMm ? c.nameMm : c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cost & Selling Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'သွင်းဈေး / ဝယ်ရင်းဈေး (MMK)' : 'Cost Price (MMK)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {isMm ? 'ရောင်းဈေး (MMK)' : 'Selling Price (MMK)'} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="500"
                    required
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
              </div>

              {/* Stock Tracking Flag & Stock Qty */}
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="formTrackStock"
                    checked={formTrackStock}
                    onChange={(e) => setFormTrackStock(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="formTrackStock" className="text-xs font-bold text-gray-800">
                    {isMm ? 'သိုလှောင်လက်ကျန် စတော့ မှတ်သားမည်' : 'Enable Inventory Stock Tracking'}
                  </label>
                </div>

                {formTrackStock && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        {isMm ? 'လက်ကျန်အရေအတွက်' : 'In Stock Quantity'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formStockQuantity}
                        onChange={(e) => setFormStockQuantity(Number(e.target.value))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        {isMm ? 'ရေတွက်ပုံယူနစ်' : 'Unit of Measurement'}
                      </label>
                      <input
                        type="text"
                        value={formUnit}
                        onChange={(e) => setFormUnit(e.target.value)}
                        placeholder="e.g. Bottle, Can, Pack, Box"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="formIsActiveProd"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="formIsActiveProd" className="text-xs font-medium text-gray-700">
                  {isMm ? 'ဤကုန်ပစ္စည်းကို ရောင်းချခွင့်ပေးမည် (Active)' : 'Active for direct POS sale'}
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {isMm ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  <Save className="h-4 w-4" />
                  <span>{isMm ? 'သိမ်းဆည်းမည်' : 'Save Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.item && (
        <ConfirmDeactivateModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ isOpen: false, item: null })}
          onConfirm={() => handleToggleActive(confirmModal.item!)}
          title={isMm ? 'ကုန်ပစ္စည်း အခြေအနေပြောင်းလဲခြင်း' : 'Update Product Active Status'}
          itemName={confirmModal.item.name}
          currentStatus={confirmModal.item.isActive !== false}
          lang={lang}
        />
      )}

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Truck className="h-5 w-5 text-emerald-600" />
                <span>{isMm ? 'ဒိုင်/ကုန်သည် စာရင်း' : 'Suppliers Management'}</span>
              </h3>
              <button onClick={() => setShowSupplierModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 bg-slate-50 p-3 rounded-xl border">
              <div className="text-xs font-bold text-gray-700">{isMm ? 'ကုန်သည်အသစ် ထည့်ရန်' : 'Add New Supplier'}</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder={isMm ? 'ဒိုင်အမည် *' : 'Supplier Name *'}
                  value={newSupName}
                  onChange={e => setNewSupName(e.target.value)}
                  className="rounded-lg border p-2 text-xs bg-white"
                />
                <input
                  type="text"
                  required
                  placeholder={isMm ? 'ဖုန်းနံပါတ် *' : 'Phone *'}
                  value={newSupPhone}
                  onChange={e => setNewSupPhone(e.target.value)}
                  className="rounded-lg border p-2 text-xs bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={isMm ? 'ဆက်သွယ်ရန်သူ' : 'Contact Person'}
                  value={newSupContact}
                  onChange={e => setNewSupContact(e.target.value)}
                  className="rounded-lg border p-2 text-xs bg-white"
                />
                <input
                  type="text"
                  placeholder={isMm ? 'လိပ်စာ' : 'Address'}
                  value={newSupAddress}
                  onChange={e => setNewSupAddress(e.target.value)}
                  className="rounded-lg border p-2 text-xs bg-white"
                />
              </div>
              <button type="submit" className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">
                {isMm ? 'ကုန်သည် သိမ်းဆည်းမည်' : 'Save Supplier'}
              </button>
            </form>

            <div className="max-h-48 overflow-y-auto divide-y text-xs">
              {suppliers.map(s => (
                <div key={s.id} className="py-2 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-gray-900">{s.name}</div>
                    <div className="text-[11px] text-gray-500">{s.phone} {s.contactPerson ? `• ${s.contactPerson}` : ''}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">Active</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PO Modal */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span>{isMm ? 'ပစ္စည်းဝယ်ယူမှု စာရင်းသွင်းရန် (Purchase Order)' : 'Create Purchase Order'}</span>
              </h3>
              <button onClick={() => setShowPOModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">{isMm ? 'ဒိုင်/ကုန်သည် ရွေးပါ' : 'Select Supplier'}</label>
                <select
                  value={poSupplierId}
                  onChange={e => setPOSupplierId(e.target.value)}
                  className="w-full border p-2 rounded-lg bg-white"
                >
                  <option value="">{isMm ? '-- ကုန်သည် ရွေးပါ --' : '-- Select Supplier --'}</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>
                  ))}
                </select>
              </div>

              <div className="border p-3 rounded-xl bg-slate-50 space-y-2">
                <div className="font-bold text-gray-800">{isMm ? 'ဝယ်ယူမည့် ပစ္စည်း ထည့်ပါ' : 'Add Items'}</div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={poSelProduct}
                    onChange={e => {
                      POSelProduct(e.target.value);
                      const prd = products.find(p => p.id === e.target.value);
                      if (prd) setPOCost(prd.costPriceMMK || 0);
                    }}
                    className="border p-2 rounded-lg bg-white col-span-3 sm:col-span-1"
                  >
                    <option value="">{isMm ? '-- ပစ္စည်း ရွေးပါ --' : '-- Select Product --'}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={poQty}
                    onChange={e => setPOQty(Number(e.target.value))}
                    className="border p-2 rounded-lg bg-white"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Unit Cost"
                    value={poCost}
                    onChange={e => setPOCost(Number(e.target.value))}
                    className="border p-2 rounded-lg bg-white"
                  />
                </div>
                <button
                  onClick={handleAddPOItem}
                  type="button"
                  className="w-full py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                >
                  + {isMm ? 'စာရင်းထဲထည့်မည်' : 'Add Item'}
                </button>
              </div>

              {poItems.length > 0 && (
                <div className="space-y-1 max-h-36 overflow-y-auto divide-y">
                  {poItems.map((item, idx) => (
                    <div key={idx} className="py-1.5 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold">{item.productName}</div>
                        <div className="text-[11px] text-gray-500">{item.quantity} units @ {formatMMK(item.costPriceMMK)}</div>
                      </div>
                      <div className="font-bold text-blue-700">{formatMMK(item.quantity * item.costPriceMMK)}</div>
                    </div>
                  ))}
                  <div className="pt-2 flex justify-between font-bold text-sm text-gray-900 border-t">
                    <span>Total Cost:</span>
                    <span>{formatMMK(poItems.reduce((a, b) => a + (b.quantity * b.costPriceMMK), 0))}</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmitPO}
                disabled={!poSupplierId || poItems.length === 0}
                className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
              >
                {isMm ? 'ဝယ်ယူမှု အတည်ပြုပြီး စတော့တိုးမည်' : 'Submit PO & Update Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Sliders className="h-5 w-5 text-amber-600" />
                <span>{isMm ? 'စတော့ ပမာဏ ပြင်ဆင်ရန်' : 'Adjust Inventory Stock'}</span>
              </h3>
              <button onClick={() => setShowAdjModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">{isMm ? 'ကုန်ပစ္စည်း ရွေးပါ' : 'Select Product'}</label>
                <select
                  required
                  value={adjProductId}
                  onChange={e => setAdjProductId(e.target.value)}
                  className="w-full border p-2 rounded-lg bg-white"
                >
                  <option value="">{isMm ? '-- ကုန်ပစ္စည်း ရွေးပါ --' : '-- Select Product --'}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Cur: {p.stockQty || 0})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  {isMm ? 'တိုး/လျှော့ ပမာဏ (ဥပမာ +5 သို့မဟုတ် -3)' : 'Adjust Quantity (+ or -)'}
                </label>
                <input
                  type="number"
                  required
                  value={adjQty}
                  onChange={e => setAdjQty(Number(e.target.value))}
                  className="w-full border p-2 rounded-lg bg-white font-bold text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">{isMm ? 'အကြောင်းပြချက်' : 'Reason'}</label>
                <input
                  type="text"
                  required
                  value={adjReason}
                  onChange={e => setAdjReason(e.target.value)}
                  className="w-full border p-2 rounded-lg bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700"
              >
                {isMm ? 'စတော့ ပြင်ဆင်မှု သိမ်းမည်' : 'Save Stock Adjustment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
