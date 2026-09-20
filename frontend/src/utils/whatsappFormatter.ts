/**
 * Standard Default WhatsApp Bill / Receipt Template
 */
export const DEFAULT_WHATSAPP_BILL_TEMPLATE = `🛍️ *{shop_name}*
_{tag_line}_
📍 {shop_address} | 📞 {shop_mobile}
{gstin_line}
------------------------------------
🧾 *INVOICE:* #{bill_number}
👤 *Customer:* {customer_name}
📅 *Date:* {bill_date}
------------------------------------
*PURCHASED ITEMS:*
{items_list}
------------------------------------
{subtotal_line}
{discount_line}
{tax_line}
{extra_charges_line}
💰 *GRAND TOTAL: ₹{grand_total}*
{paid_line}
{due_line}
📦 *Items:* {total_items} | *Qty:* {total_qty}
------------------------------------
✨ {bill_footer}
{social_links}
_Software powered by Dolly POS | Since 2002_`;

/**
 * Normalizes text and generates clean WhatsApp web & desktop URLs
 * without character corruption or replacement symbols ().
 */
export function buildWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  // Normalize newlines and clean special non-standard characters
  const normalizedText = (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/©/g, '')
    .replace(/━/g, '-')
    .trim();

  if (finalPhone) {
    return `https://api.whatsapp.com/send/?phone=${finalPhone}&text=${encodeURIComponent(normalizedText)}&type=phone_number&app_absent=0`;
  }
  return `https://api.whatsapp.com/send/?text=${encodeURIComponent(normalizedText)}&type=phone_number&app_absent=0`;
}

/**
 * Replaces all placeholders ({variable}) in the template with actual bill/receipt values.
 */
export function renderWhatsAppBillMessage(template: string, receiptData: any): string {
  const tmpl = (template && template.trim().length > 0) ? template : DEFAULT_WHATSAPP_BILL_TEMPLATE;
  if (!receiptData) return tmpl;

  const rawShopName = receiptData.shop_name || 'Dolly Toys & Kids Wear';
  const formattedShopName = rawShopName.replace(/\band\b/gi, '&').toUpperCase();

  const customerName = (receiptData.customer_name || 'Customer').trim();
  const customerPhone = receiptData.customer_phone || '';
  const billNumber = receiptData.bill_number || 'INV-1001';
  const billDate = receiptData.bill_date || '';
  const address = receiptData.address || 'Agra Road, Near Mahatma Gandhi Statue, Dhule';
  const mobile = receiptData.mobile || '7972558842';
  const tagLine = receiptData.tag_line || 'Exclusive Kids Wear & Quality Toys';
  const billFooter = receiptData.bill_footer || 'Thank you for shopping with us! Visit again!';
  const upiId = receiptData.upi_id || '7972558842@upi';

  // Format Items List
  let itemsListText = '';
  if (Array.isArray(receiptData.items) && receiptData.items.length > 0) {
    itemsListText = receiptData.items.map((it: any) => {
      const sizeStr = it.size ? ` [${it.size}]` : '';
      return `• ${it.item_name}${sizeStr} (${it.quantity}x) - ₹${Number(it.total_price || (it.unit_price * it.quantity)).toFixed(2)}`;
    }).join('\n');
  } else {
    itemsListText = '• Purchased Merchandise (1x) - ₹' + Number(receiptData.grand_total || 0).toFixed(2);
  }

  // Financial lines
  const subtotal = Number(receiptData.subtotal || receiptData.grand_total || 0).toFixed(2);
  const discountAmount = Number(receiptData.discount_amount || 0).toFixed(2);
  const taxAmount = Number(receiptData.tax_amount || 0).toFixed(2);
  const extraChargesAmount = Number(receiptData.extra_charges_amount || 0).toFixed(2);
  const grandTotal = Number(receiptData.grand_total || 0).toFixed(2);
  const paidAmount = Number(receiptData.paid_amount || receiptData.grand_total || 0).toFixed(2);
  const dueAmount = Number(receiptData.due_amount || 0).toFixed(2);
  const paymentMode = receiptData.payment_mode || 'UPI';

  const totalItems = receiptData.items_count || (Array.isArray(receiptData.items) ? receiptData.items.length : 1);
  const totalQty = receiptData.total_quantity || receiptData.total_items || totalItems;

  const gstinLine = (receiptData.show_gst && receiptData.gstin) ? `🏛️ GSTIN: ${receiptData.gstin}` : '';
  const subtotalLine = (Number(discountAmount) > 0 || Number(taxAmount) > 0 || Number(extraChargesAmount) > 0) ? `*Subtotal:* ₹${subtotal}` : '';
  const discountLine = Number(discountAmount) > 0 ? `🏷️ *Discount:* -₹${discountAmount}` : '';
  const taxLine = Number(taxAmount) > 0 ? `🏛️ *GST:* ₹${taxAmount}` : '';
  const extraChargesLine = Number(extraChargesAmount) > 0 ? `⚡ *Extra Charges / Surcharge:* +₹${extraChargesAmount}` : '';
  const paidLine = `Paid (${paymentMode}): ₹${paidAmount}`;
  const dueLine = Number(dueAmount) > 0 ? `⚠️ *Khata Balance Due:* ₹${dueAmount}` : '✓ Bill Fully Paid';

  // Social Links
  const socialLines: string[] = [];
  if (receiptData.show_instagram_on_bill && receiptData.instagram_handle) {
    socialLines.push(`Instagram: instagram.com/${receiptData.instagram_handle.replace('@', '')}`);
  }
  if (receiptData.show_website_on_bill && receiptData.website_url) {
    socialLines.push(`Website: ${receiptData.website_url}`);
  }
  const socialLinksText = socialLines.join('\n');

  let result = tmpl
    .replace(/{shop_name}/g, formattedShopName)
    .replace(/{tag_line}/g, tagLine)
    .replace(/{shop_address}/g, address)
    .replace(/{shop_mobile}/g, mobile)
    .replace(/{upi_id}/g, upiId)
    .replace(/{gstin_line}/g, gstinLine)
    .replace(/{gstin}/g, receiptData.gstin || '')
    .replace(/{bill_number}/g, billNumber)
    .replace(/{invoice_number}/g, billNumber)
    .replace(/{customer_name}/g, customerName)
    .replace(/{name}/g, customerName)
    .replace(/{customer_phone}/g, customerPhone)
    .replace(/{phone}/g, customerPhone)
    .replace(/{number}/g, customerPhone)
    .replace(/{bill_date}/g, billDate)
    .replace(/{date}/g, billDate)
    .replace(/{items_list}/g, itemsListText)
    .replace(/{subtotal_line}/g, subtotalLine)
    .replace(/{subtotal}/g, subtotal)
    .replace(/{discount_line}/g, discountLine)
    .replace(/{discount}/g, discountAmount)
    .replace(/{tax_line}/g, taxLine)
    .replace(/{tax}/g, taxAmount)
    .replace(/{extra_charges_line}/g, extraChargesLine)
    .replace(/{extra_charges}/g, extraChargesAmount)
    .replace(/{grand_total}/g, grandTotal)
    .replace(/{total}/g, grandTotal)
    .replace(/{paid_line}/g, paidLine)
    .replace(/{paid_amount}/g, paidAmount)
    .replace(/{due_line}/g, dueLine)
    .replace(/{due_amount}/g, dueAmount)
    .replace(/{payment_mode}/g, paymentMode)
    .replace(/{total_items}/g, String(totalItems))
    .replace(/{total_qty}/g, String(totalQty))
    .replace(/{bill_footer}/g, billFooter)
    .replace(/{social_links}/g, socialLinksText);

  // Clean empty lines caused by unused conditional lines
  return result
    .split('\n')
    .filter(line => line.trim().length > 0 || line === '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Realistic Sample Test Receipt Data for Live WhatsApp Simulator
 */
export const SAMPLE_TEST_RECEIPT_DATA = {
  shop_name: 'Dolly Toys & Kids Wear',
  tag_line: 'Exclusive Kids Wear & Quality Toys',
  address: 'Agra Road, Near Mahatma Gandhi Statue, Dhule',
  mobile: '7972558842',
  gstin: '27AABCU9603R1ZM',
  show_gst: false,
  upi_id: '7972558842@upi',
  bill_number: 'INV-1088',
  bill_date: '21-Sep-2026 01:30 PM',
  customer_name: 'Somesh Bang',
  customer_phone: '7972558842',
  items: [
    { item_name: 'Kids Festive Kurta Set', size: '28', quantity: 1, unit_price: 1520.0, total_price: 1520.0 },
    { item_name: 'Remote Stunt Racing Car', size: 'Std', quantity: 1, unit_price: 599.0, total_price: 599.0 }
  ],
  items_count: 2,
  total_items: 2,
  total_quantity: 2,
  subtotal: 2119.0,
  discount_amount: 20.0,
  tax_amount: 0.0,
  extra_charges_amount: 8.40,
  grand_total: 2107.40,
  paid_amount: 2107.40,
  due_amount: 0.0,
  payment_mode: 'UPI',
  bill_footer: 'Thank you for shopping at Dolly Toys! No exchange without original bill.',
  show_instagram_on_bill: true,
  instagram_handle: '@dollytoys_dhule',
  show_website_on_bill: false,
  website_url: ''
};
