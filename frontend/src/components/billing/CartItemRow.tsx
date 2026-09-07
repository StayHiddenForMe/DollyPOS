import React, { useRef, useEffect } from 'react';
import { CartItem } from '../../types';
import { useBillingStore } from '../../store/billingStore';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface CartItemRowProps {
  item: CartItem;
  index: number;
  isSelected?: boolean;
  onSelect?: () => void;
}

export const CartItemRow: React.FC<CartItemRowProps> = ({ item, index, isSelected = false, onSelect }) => {
  const { updateQuantity, updateItemPrice, updateItemDiscount, removeItem } = useBillingStore();
  const qtyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSelected && qtyInputRef.current) {
      qtyInputRef.current.focus();
      qtyInputRef.current.select();
    }
  }, [isSelected]);

  return (
    <tr 
      onClick={onSelect}
      className={`border-b border-slate-100 dark:border-slate-800 transition-colors group cursor-pointer ${
        isSelected 
          ? 'bg-pink-50/70 dark:bg-pink-950/30 ring-1 ring-inset ring-pink-400/40' 
          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
      }`}
    >
      {/* Index */}
      <td className="py-2.5 px-3 text-xs font-mono text-slate-400 w-10 text-center">
        {index + 1}
      </td>

      {/* Item Details */}
      <td className="py-2.5 px-3">
        <div className="flex flex-col">
          <span className="font-semibold text-sm text-slate-800 dark:text-white leading-snug">
            {item.item_name}
            {item.is_unlisted && (
              <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.2 rounded font-bold uppercase">
                Custom
              </span>
            )}
          </span>

          <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
            {item.barcode && <span className="font-mono">{item.barcode}</span>}
            {item.size && (
              <span className="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 px-1.5 py-0.2 rounded text-[10px] font-bold">
                Size: {item.size}
              </span>
            )}
            {item.color && (
              <span className="bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 px-1.5 py-0.2 rounded text-[10px] font-bold">
                {item.color}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Unit Price */}
      <td className="py-2.5 px-3 text-right w-28" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end space-x-1">
          <span className="text-xs text-slate-400">₹</span>
          <input
            type="number"
            value={item.unit_price}
            onFocus={(e) => e.target.select()}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            onChange={(e) => updateItemPrice(item.cart_item_id, parseFloat(e.target.value) || 0)}
            className="w-20 px-1.5 py-1 text-right text-sm font-semibold bg-transparent hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded focus:bg-white dark:focus:bg-slate-700 focus:border-pink-500 focus:outline-none"
            min="0"
            step="1"
          />
        </div>
      </td>

      {/* Quantity adjustment buttons */}
      <td className="py-2.5 px-3 w-36" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 w-fit mx-auto">
          <button
            onClick={() => updateQuantity(item.cart_item_id, item.quantity - 1)}
            className="w-7 h-7 flex items-center justify-center rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-pink-50 hover:text-pink-600 shadow-xs active:scale-95 transition-all font-bold"
            title="Decrease"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <input
            ref={qtyInputRef}
            type="number"
            value={item.quantity}
            onFocus={(e) => e.target.select()}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            onChange={(e) => updateQuantity(item.cart_item_id, parseInt(e.target.value) || 1)}
            className="w-10 text-center font-bold text-sm bg-transparent focus:outline-none font-mono selection:bg-pink-500 selection:text-white"
            min="1"
          />

          <button
            onClick={() => updateQuantity(item.cart_item_id, item.quantity + 1)}
            className="w-7 h-7 flex items-center justify-center rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-pink-50 hover:text-pink-600 shadow-xs active:scale-95 transition-all font-bold"
            title="Increase"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>

      {/* Item Discount */}
      <td className="py-2.5 px-3 text-right w-24" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end space-x-1">
          <span className="text-xs text-slate-400">-₹</span>
          <input
            type="number"
            value={item.discount_amount || ''}
            placeholder="0"
            onFocus={(e) => e.target.select()}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            onChange={(e) => updateItemDiscount(item.cart_item_id, parseFloat(e.target.value) || 0)}
            className="w-16 px-1.5 py-1 text-right text-xs font-medium bg-transparent hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 rounded focus:bg-white dark:focus:bg-slate-700 focus:border-pink-500 focus:outline-none text-rose-600"
            min="0"
          />
        </div>
      </td>

      {/* Row Total */}
      <td className="py-2.5 px-3 text-right font-bold text-sm text-slate-900 dark:text-white w-28 font-mono">
        {formatINR(item.total_price)}
      </td>

      {/* Action Remove */}
      <td className="py-2.5 px-2 text-center w-10" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => removeItem(item.cart_item_id)}
          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
          title="Remove Item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};
