import React, { useState, useMemo } from 'react';
import { ProductItem, ProductCategory, UserAccount } from '../../../types';
import { db } from '../../../db/database';
import { Language } from '../../../utils/translations';
import { formatMMK } from '../../../domain/financial';
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

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    item: ProductItem | null;
  }>({ isOpen: false, item: null });

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

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{isMm ? 'ကုန်ပစ္စည်းအသစ် ထည့်သွင်းရန်' : 'Add New Product'}</span>
        </button>
      </div>

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
    </div>
  );
};
