import React, { useRef, useEffect } from 'react';
import { Printer, X, Share2 } from 'lucide-react';
import { formatINR } from '../../utils/formatters';
import { useSettingStore } from '../../store/settingStore';
import { renderWhatsAppBillMessage, buildWhatsAppUrl, DEFAULT_WHATSAPP_BILL_TEMPLATE } from '../../utils/whatsappFormatter';

interface ThermalReceiptViewProps {
  receiptData: any;
  onClose: () => void;
}

export const ThermalReceiptView: React.FC<ThermalReceiptViewProps> = ({ receiptData, onClose }) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettingStore();

  const handlePrint = () => {
    window.print();
  };

  // Keyboard navigation: Enter to Print, Escape to Close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!receiptData) return null;

  // 1. Replace "and" / "And" with "&" in shop title
  const formattedShopName = (receiptData.shop_name || "Dolly Toys & Kids Wear")
    .replace(/\band\b/gi, '&');

  // Item counts & Total Quantity calculations
  const itemCount = receiptData.items?.length || receiptData.items_count || 0;
  const totalQty = receiptData.total_quantity || receiptData.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || receiptData.total_items || 0;

  const halfTax = receiptData.tax_amount ? (receiptData.tax_amount / 2).toFixed(2) : '0.00';

  const handleShareWhatsApp = () => {
    const phone = receiptData.customer_phone ? receiptData.customer_phone.replace(/\D/g, '') : '';
    const template = settings?.whatsapp_bill_template || receiptData.whatsapp_bill_template || DEFAULT_WHATSAPP_BILL_TEMPLATE;
    const message = renderWhatsAppBillMessage(template, receiptData);
    const url = buildWhatsAppUrl(phone, message);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-150">
      {/* Embedded High-Contrast Print Styles for Sharp Jet-Black Thermal Output */}
      <style>{`
        @media print {
          @page {
            margin: 0mm !important;
            size: 80mm auto;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            border-color: #000000 !important;
          }
          #printable-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 80mm !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 1mm 2mm 1mm !important;
            font-weight: 600 !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
              <Printer className="w-4 h-4 text-pink-500" />
              Thermal Bill Preview (80mm)
            </h3>
            <p className="text-[11px] text-slate-400">
              High-contrast crisp thermal layout • Press Enter to Print
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Close (Esc)">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950 flex justify-center">
          <div 
            id="printable-receipt"
            ref={receiptRef}
            className="w-full max-w-[80mm] min-h-fit bg-white text-black px-[3px] pt-1.5 pb-3 font-mono text-[11px] leading-tight border border-slate-300 shadow-md flex flex-col box-border"
          >
            {/* Shop Header */}
            <div className="text-center pb-1 space-y-0.5">
              <h2 className="font-black text-[16px] uppercase tracking-wide text-black leading-snug mt-[2px]">
                {formattedShopName}
              </h2>
              {/* Tagline on top of bill with bold setting */}
              {receiptData.tag_line && (
                <p 
                  className={`text-[10px] text-black italic ${receiptData.is_tagline_bold ? 'font-black tracking-tight' : 'font-semibold'}`}
                  style={receiptData.is_tagline_bold ? { fontWeight: 900, WebkitTextStroke: '0.4px #000' } : {}}
                >
                  {receiptData.is_tagline_bold ? <strong>{receiptData.tag_line}</strong> : receiptData.tag_line}
                </p>
              )}
              <p className="text-[10.5px] font-bold text-black mt-[5px] mb-[5px] leading-tight">{receiptData.address}</p>
              {receiptData.mobile && (
                <p className="text-[11px] font-bold text-black mt-[2px]">Mob: {receiptData.mobile}</p>
              )}
              
              {receiptData.gstin && (
                <p className="text-[10.5px] font-bold text-black my-[3px] uppercase tracking-wider bg-slate-100 py-0.5">
                  GSTIN: {receiptData.gstin}
                </p>
              )}
            </div>

            {/* Exactly ONE Line + 'Invoice Details' + ONE Line + Bill Details */}
            <div className="border-t border-dashed border-black my-1"></div>
            <div className="text-center font-black uppercase text-[11px] tracking-wider text-black py-0.5">
              Invoice Details
            </div>
            <div className="border-t border-dashed border-black my-1"></div>

            {/* Bill Details (Date, Time, Bill No, Payment Mode) */}
            <div className="py-1 border-b border-dashed border-black space-y-0.5 text-[10.5px] font-semibold text-black">
              <div className="flex justify-between">
                <span>Bill No: <strong className="font-black text-black">{receiptData.bill_number}</strong></span>
                <span className="font-bold text-black">{receiptData.bill_date.split(' ')[0]}</span>
              </div>
              <div className="flex justify-between">
                <span>Time: <span className="font-bold text-black">{receiptData.bill_date.split(' ').slice(1).join(' ')}</span></span>
                <span>Mode: <strong className="font-black text-black">{receiptData.payment_mode}</strong></span>
              </div>
            </div>

            {/* Items Table */}
            <div className={`py-1.5 ${(receiptData.discount_amount > 0 || receiptData.tax_amount > 0) ? 'border-b border-dashed border-black' : ''}`}>
              <div className="flex justify-between font-black pb-1 text-[10.5px] uppercase text-black">
                <span className="flex-1 min-w-0 pr-1 text-left">Item</span>
                <span className="w-7 text-center shrink-0">Qty</span>
                <span className="w-12 text-right shrink-0">Rate</span>
                <span className="w-14 text-right shrink-0">Total</span>
              </div>
              {/* Divider Line immediately following column headers */}
              <div className="border-b border-dashed border-black mb-1"></div>

              <div className="divide-y divide-dotted divide-black">
                {receiptData.items.map((item: any, idx: number) => (
                  <div key={idx} className="py-1 flex justify-between items-start text-[10.5px] text-black">
                    <div className="flex-1 min-w-0 pr-1 flex flex-col text-left">
                      <span className="font-bold text-black line-clamp-2 leading-tight break-words">{item.item_name}</span>
                      {(item.size || item.color) && (
                        <span className="text-[10px] font-semibold text-black">
                          {item.size ? `Sz:${item.size} ` : ''}{item.color ? `Col:${item.color}` : ''}
                        </span>
                      )}
                    </div>
                    <span className="w-7 text-center font-bold text-black shrink-0">{item.quantity}</span>
                    <span className="w-12 text-right font-medium text-black shrink-0">₹{item.unit_price}</span>
                    <span className="w-14 text-right font-bold text-black shrink-0">₹{item.total_price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="py-2 border-b border-dashed border-black space-y-1 text-[11px] text-black font-semibold">
              {/* Conditional Subtotal: Show when discount, tax, or extra charges are present */}
              {(receiptData.discount_amount > 0 || receiptData.tax_amount > 0 || (receiptData.extra_charges_amount && receiptData.extra_charges_amount > 0)) && (
                <div className="space-y-1 pb-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{receiptData.subtotal}</span>
                  </div>
                  {receiptData.discount_amount > 0 && (
                    <div className="flex justify-between font-bold">
                      <span>Discount:</span>
                      <span>-₹{receiptData.discount_amount}</span>
                    </div>
                  )}
                  {receiptData.tax_amount > 0 && (
                    <>
                      <div className="flex justify-between text-[10.5px]">
                        <span>CGST:</span>
                        <span>₹{halfTax}</span>
                      </div>
                      <div className="flex justify-between text-[10.5px]">
                        <span>SGST:</span>
                        <span>₹{halfTax}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Total GST:</span>
                        <span>₹{receiptData.tax_amount}</span>
                      </div>
                    </>
                  )}
                  {receiptData.extra_charges_amount > 0 && (
                    <div className="space-y-0.5 pt-0.5 border-t border-dotted border-black">
                      {(() => {
                        let parsed: any[] = [];
                        if (receiptData.extra_charges_breakdown) {
                          try {
                            if (typeof receiptData.extra_charges_breakdown === 'string') {
                              parsed = JSON.parse(receiptData.extra_charges_breakdown);
                            } else if (Array.isArray(receiptData.extra_charges_breakdown)) {
                              parsed = receiptData.extra_charges_breakdown;
                            }
                          } catch (e) {
                            parsed = [];
                          }
                        }
                        if (parsed.length > 0) {
                          return parsed.map((bc: any, idx: number) => (
                            <div key={idx} className="flex justify-between font-bold text-[10.5px]">
                              <span>{bc.name} {bc.type === 'PERCENT' ? `(${bc.value}%)` : ''}:</span>
                              <span>+₹{Number(bc.amount).toFixed(2)}</span>
                            </div>
                          ));
                        }
                        return (
                          <div className="flex justify-between font-bold text-[10.5px]">
                            <span>Extra Charges / Surcharge:</span>
                            <span>+₹{Number(receiptData.extra_charges_amount).toFixed(2)}</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
              {/* Exactly ONE solid line before GRAND TOTAL */}
              <div className="flex justify-between font-black text-[15px] pt-1 border-t border-black text-black">
                <span>GRAND TOTAL:</span>
                <span>₹{receiptData.grand_total}</span>
              </div>
              
              {/* Change / Due (Paid line removed to save thermal vertical space) */}
              {(receiptData.change_amount > 0 || receiptData.due_amount > 0) && (
                <div className="flex justify-between text-[10.5px] font-bold text-black">
                  {receiptData.change_amount > 0 && <span>Change: ₹{receiptData.change_amount}</span>}
                  {receiptData.due_amount > 0 && <span>Khata Due: ₹{receiptData.due_amount}</span>}
                </div>
              )}

              {/* No of items & Total Quantity */}
              <div className="border-t border-dotted border-black pt-1.5 mt-1 text-[11px] font-bold text-black flex justify-between">
                <span>No of items : <strong className="font-black text-black">{itemCount}</strong></span>
                <span>Total Quantity : <strong className="font-black text-black">{totalQty}</strong></span>
              </div>
            </div>

            {/* Dynamic UPI QR Embedded */}
            {receiptData.upi_qr_base64 && (
              <div className="py-2.5 flex flex-col items-center justify-center border-b border-dashed border-black">
                <img 
                  src={receiptData.upi_qr_base64} 
                  alt="Bill UPI QR" 
                  className="w-24 h-24 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="text-[10px] font-black text-black mt-1 uppercase tracking-wider">Scan & Pay via UPI</span>
              </div>
            )}

            {/* Follow Us Section */}
            {(receiptData.show_instagram_on_bill || receiptData.show_facebook_on_bill || receiptData.show_threads_on_bill || receiptData.show_website_on_bill || receiptData.show_custom_social_on_bill) && (
              <div className="py-2 border-b border-dashed border-black text-[10.5px] text-black">
                <span className="font-black text-[10.5px] uppercase tracking-wider block text-center mb-1 text-black">Follow Us</span>
                <div className="space-y-1 w-full text-left px-1">
                  {receiptData.show_instagram_on_bill && receiptData.instagram_handle && (
                    <div className="flex items-start py-0.5">
                      <span className="font-bold text-black shrink-0">Instagram:</span>
                      <span className="font-semibold text-black ml-1 break-all flex-1">{receiptData.instagram_handle}</span>
                    </div>
                  )}
                  {receiptData.show_facebook_on_bill && receiptData.facebook_handle && (
                    <div className="flex items-start py-0.5">
                      <span className="font-bold text-black shrink-0">Facebook:</span>
                      <span className="font-semibold text-black ml-1 break-all flex-1">{receiptData.facebook_handle}</span>
                    </div>
                  )}
                  {receiptData.show_threads_on_bill && receiptData.threads_handle && (
                    <div className="flex items-start py-0.5">
                      <span className="font-bold text-black shrink-0">Threads:</span>
                      <span className="font-semibold text-black ml-1 break-all flex-1">{receiptData.threads_handle}</span>
                    </div>
                  )}
                  {receiptData.show_website_on_bill && receiptData.website_url && (
                    <div className="flex items-start py-0.5">
                      <span className="font-bold text-black shrink-0">Website:</span>
                      <span className="font-semibold text-black ml-1 break-all flex-1">{receiptData.website_url}</span>
                    </div>
                  )}
                  {receiptData.show_custom_social_on_bill && receiptData.custom_socials && receiptData.custom_socials.map((cs: any, i: number) => (
                    <div key={i} className="flex items-start py-0.5">
                      <span className="font-bold text-black shrink-0">{cs.label || 'Social'}:</span>
                      <span className="font-semibold text-black ml-1 break-all flex-1">{cs.handle}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Terms & Conditions */}
            {receiptData.show_terms_on_bill && receiptData.terms_and_conditions && (
              <div className="py-2 text-left text-[9.5px] text-black border-b border-dashed border-black space-y-0.5 font-medium">
                <span className="font-black uppercase tracking-wider block text-center text-[10px] text-black">Terms & Conditions</span>
                <p className="whitespace-pre-line leading-tight text-black font-semibold">{receiptData.terms_and_conditions}</p>
              </div>
            )}

            {/* Bill Footer: Software powered by Dolly POS and Since 2002 on the EXACT SAME LINE */}
            <div className="text-center pt-2.5 text-black space-y-1 font-semibold">
              <p 
                className={`italic text-black ${receiptData.is_footer_bold ? 'font-black' : 'font-bold'}`}
                style={{ 
                  fontSize: receiptData.footer_font_size || '9.5px', 
                  lineHeight: 1.15,
                  fontWeight: receiptData.is_footer_bold ? 900 : 700,
                  WebkitTextStroke: receiptData.is_footer_bold ? '0.35px #000' : 'none'
                }}
              >
                {receiptData.is_footer_bold ? <strong>{receiptData.bill_footer || 'Thank you for shopping at Dolly Toys & Kids Wear!'}</strong> : (receiptData.bill_footer || 'Thank you for shopping at Dolly Toys & Kids Wear!')}
              </p>
              <p 
                className={`pt-1 text-black flex items-center justify-center space-x-1.5 ${receiptData.is_power_footer_bold ? 'font-black' : 'font-bold'}`}
                style={{
                  fontSize: receiptData.power_footer_font_size || '9px',
                  fontWeight: receiptData.is_power_footer_bold ? 900 : 600,
                  WebkitTextStroke: receiptData.is_power_footer_bold ? '0.3px #000' : 'none'
                }}
              >
                <span>Software powered by Dolly POS©</span>
                <span>|</span>
                <span className="font-black">Since 2002</span>
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <button
            onClick={handleShareWhatsApp}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Send Bill on WhatsApp</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline-block">
              (Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px]">Enter</kbd> to Print, <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px]">Esc</kbd> to Close)
            </span>
            <button
              onClick={handlePrint}
              className="px-6 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-pink-600/20 transition-all active:scale-95"
              title="Press Enter to Print"
            >
              <Printer className="w-4 h-4" />
              <span>Print Thermal Receipt (80mm)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
