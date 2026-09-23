import React, { useState } from 'react';
import { Customer, CustomerServiceNote, CustomerNoteCategory, UserAccount } from '../../types';
import { db } from '../../db/database';
import { Language } from '../../utils/translations';
import {
  FileText,
  Plus,
  Lock,
  Search,
  Tag,
  Calendar,
  User,
  Edit2,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface CustomerNotesTabProps {
  customer: Customer;
  notes: CustomerServiceNote[];
  currentUser: UserAccount;
  lang: Language;
  onOpenAddNote: (context?: any) => void;
  onOpenEditNote: (note: CustomerServiceNote) => void;
  onRefresh: () => void;
}

export const CustomerNotesTab: React.FC<CustomerNotesTabProps> = ({
  customer,
  notes,
  currentUser,
  lang,
  onOpenAddNote,
  onOpenEditNote,
  onRefresh,
}) => {
  const isMm = lang === 'my';
  const canViewPrivate = ['owner', 'manager', 'admin'].includes(currentUser.role);

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Filter notes by role permission & filters
  const visibleNotes = notes.filter(n => {
    // Role security check
    if (n.isPrivate && !canViewPrivate) {
      return false; // concealed from non-authorized roles
    }

    if (categoryFilter !== 'all' && n.category !== categoryFilter) {
      return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = n.title.toLowerCase().includes(q);
      const matchContent = n.content.toLowerCase().includes(q);
      const matchAuthor = n.createdBy?.toLowerCase().includes(q);
      const matchTags = n.tags?.some(t => t.toLowerCase().includes(q));
      if (!matchTitle && !matchContent && !matchAuthor && !matchTags) return false;
    }

    return true;
  });

  const handleDelete = async (noteId: string) => {
    if (!confirm(isMm ? 'မှတ်စုကို အပြီးတိုင် ဖျက်ပစ်ရန် သေချာပါသလား?' : 'Are you sure you want to delete this note?')) return;
    try {
      await db.deleteCustomerServiceNote(noteId, {
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
      });
      onRefresh();
    } catch (err: any) {
      alert('Error deleting note: ' + err.message);
    }
  };

  const getCategoryBadgeClass = (cat: CustomerNoteCategory) => {
    switch (cat) {
      case 'treatment':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'service':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'preference':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'follow_up':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-3">
        <div>
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-600" />
            <span>{isMm ? 'ဝန်ဆောင်မှုနှင့် ကုသမှု မှတ်တမ်းများ' : 'Service & Treatment Notes'}</span>
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">
              {visibleNotes.length}
            </span>
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {isMm ? 'ဖောက်သည် နှစ်သက်မှု၊ ပြုစုခဲ့ပုံနှင့် အကြံပြုချက်များ' : 'Structured service history observations and treatment recommendations.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenAddNote()}
          className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          <span>{isMm ? 'မှတ်စု အသစ်ရေးမည်' : 'Add Note'}</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={isMm ? 'ခေါင်းစဉ်၊ တဂ်၊ အကြောင်းအရာဖြင့် ရှာရန်...' : 'Search notes by keyword, tags, author...'}
            className="w-full rounded-xl border border-gray-200 pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:border-purple-500 focus:outline-hidden bg-gray-50/50"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {['all', 'preference', 'treatment', 'service', 'follow_up', 'general'].map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold capitalize transition-colors ${
                categoryFilter === cat
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Notes List */}
      {visibleNotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center bg-gray-50/50">
          <FileText className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-xs font-bold text-gray-500">
            {isMm ? 'မှတ်စု မှတ်တမ်း မရှိသေးပါ' : 'No service notes recorded for this customer yet.'}
          </p>
          <button
            type="button"
            onClick={() => onOpenAddNote()}
            className="mt-3 inline-flex items-center gap-1 rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isMm ? 'ပထမဆုံး မှတ်စု ရေးမည်' : 'Write First Note'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleNotes.map(note => (
            <div
              key={note.id}
              className={`rounded-2xl border p-4 transition-all ${
                note.isPrivate
                  ? 'border-amber-200 bg-linear-to-br from-amber-50/60 to-white shadow-xs'
                  : 'border-gray-200 bg-white hover:border-purple-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-black uppercase tracking-wider ${getCategoryBadgeClass(
                        note.category
                      )}`}
                    >
                      {note.category.replace('_', ' ')}
                    </span>

                    {note.isPrivate && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300">
                        <Lock className="h-3 w-3 text-amber-700" />
                        <span>Confidential</span>
                      </span>
                    )}

                    {note.serviceName && (
                      <span className="text-xs text-gray-500 font-medium">
                        • {note.serviceName}
                      </span>
                    )}

                    {note.staffName && (
                      <span className="text-xs text-gray-500 font-medium">
                        (Therapist: {note.staffName})
                      </span>
                    )}
                  </div>

                  <h5 className="font-bold text-sm text-gray-900">{note.title}</h5>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenEditNote(note)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-purple-600"
                    title="Edit Note"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  {canViewPrivate && (
                    <button
                      type="button"
                      onClick={() => handleDelete(note.id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Delete Note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <p className="mt-2 text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                {note.content}
              </p>

              {/* Focus areas pills */}
              {note.focusAreas && note.focusAreas.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  <span className="text-[11px] font-bold text-gray-400 mr-1 self-center">Focus:</span>
                  {note.focusAreas.map(area => (
                    <span
                      key={area}
                      className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 border border-purple-100"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              )}

              {/* Tags */}
              {note.tags && note.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {note.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{note.createdBy || 'Staff'}</span>
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(note.createdAt).toLocaleDateString()} {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
