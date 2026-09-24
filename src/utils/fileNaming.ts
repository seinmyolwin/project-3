/**
 * Reusable utility for generating standardized file names and saving them offline.
 * Format: ShopName-CategoryName-Date-FileType
 */

export function getStandardFilename(categoryName: string, fileExtension: string, shopName?: string): string {
  const rawShopName = shopName || 'Shwe_Thiri_Spa_And_KTV';
  
  // Replace non-alphanumeric characters with underscore to keep filenames web-safe
  const cleanShopName = rawShopName
    .replace(/[^a-zA-Z0-9_\u1200-\u137F\u1000-\u109F]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
    
  const cleanCategoryName = categoryName
    .replace(/[^a-zA-Z0-9_\u1200-\u137F\u1000-\u109F]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
    
  const dateStr = new Date().toISOString().split('T')[0];
  const cleanExtension = fileExtension.replace(/^\./, '');
  
  return `${cleanShopName}-${cleanCategoryName}-${dateStr}.${cleanExtension}`;
}

interface SaveFileOptions {
  categoryName: string;
  fileExtension: string;
  mimeType: string;
  shopName?: string;
  suggestedDirectory?: string;
}

/**
 * Triggers a file save dialog.
 * Utilizes showSaveFilePicker API if supported to allow directory selection,
 * otherwise falls back to standard anchor tag downloading.
 */
export async function triggerFileSave(
  content: string | Uint8Array | Blob,
  options: SaveFileOptions
): Promise<void> {
  const defaultFilename = getStandardFilename(options.categoryName, options.fileExtension, options.shopName);
  
  let blob: Blob;
  if (content instanceof Blob) {
    blob = content;
  } else if (typeof content === 'string') {
    blob = new Blob([content], { type: options.mimeType });
  } else {
    // Uint8Array fallback
    blob = new Blob([content as any], { type: options.mimeType });
  }
  
  // 1. Attempt File System Access API (Modern browsers)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [
          {
            description: `${options.categoryName} Files`,
            accept: {
              [options.mimeType]: [`.${options.fileExtension.replace(/^\./, '')}`],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      
      alert(`[အောင်မြင်ပါသည်] ဖိုင်ကို ရွေးချယ်ထားသော ဖိုဒါထဲသို့ "${defaultFilename}" အမည်ဖြင့် သိမ်းဆည်းပြီးပါပြီ။`);
      return;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled, do nothing
        return;
      }
      console.warn('showSaveFilePicker failed, trying fallback anchor download:', err);
    }
  }

  // 2. Fallback Anchor Download Link (Supports all browsers/devices)
  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`[ဒေါင်းလုဒ်စတင်ပါပြီ] သင့်ဖိုင်ကို "Downloads" သို့မဟုတ် local storage ထဲရှိ "ရွှေသီရိ စပါ & KTV" ဖိုဒါထဲတွင် "${defaultFilename}" အမည်ဖြင့် သိမ်းဆည်းရန် တိုက်တွန်းပါသည်။ သိမ်းဆည်းရန်နေရာ (Location Picker) ကို browser ကွန်ပျူတာပေါ်တွင် ရွေးချယ်နိုင်ပါသည်။`);
  }
}
