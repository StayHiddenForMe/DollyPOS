import { StoreSettings, PaymentMode } from '../types';

export interface AppliedExtraCharge {
  templateIndex: number;
  name: string;
  condition: string;
  threshold: number;
  type: 'PERCENT' | 'FLAT';
  value: number;
  payment_mode: string;
  chargeAmount: number;
  formattedRate: string;
  description: string;
}

export interface ExtraChargesResult {
  totalCharges: number;
  appliedCharges: AppliedExtraCharge[];
  breakdownJson: string;
}

/**
 * Evaluates active extra charges / surcharge rules against current cart amount & payment mode.
 * @param subtotal Gross cart subtotal (₹)
 * @param discount Total discount (₹)
 * @param paymentMode Target payment mode ('CASH', 'UPI', 'CARD', 'CREDIT_KHATA', 'SPLIT', or 'ALL')
 * @param settings StoreSettings object containing the 5 template configs
 */
export function computeExtraCharges(
  subtotal: number,
  discount: number = 0,
  paymentMode: PaymentMode | 'ALL' | string = 'ALL',
  settings?: Partial<StoreSettings> | null
): ExtraChargesResult {
  if (!settings) {
    return { totalCharges: 0, appliedCharges: [], breakdownJson: '[]' };
  }

  const netAmount = Math.max(0, subtotal - discount);
  const applied: AppliedExtraCharge[] = [];

  for (let i = 1; i <= 5; i++) {
    const enabled = Boolean((settings as any)[`extra_charge_enabled_${i}`]);
    if (!enabled) continue;

    const name = ((settings as any)[`extra_charge_name_${i}`] || `Extra Charge ${i}`).trim();
    const condition = (settings as any)[`extra_charge_condition_${i}`] || 'ALWAYS';
    const threshold = parseFloat(String((settings as any)[`extra_charge_threshold_${i}`] ?? '0')) || 0;
    const type = ((settings as any)[`extra_charge_type_${i}`] || 'PERCENT') as 'PERCENT' | 'FLAT';
    const value = parseFloat(String((settings as any)[`extra_charge_value_${i}`] ?? '0')) || 0;
    const targetMode = (settings as any)[`extra_charge_payment_mode_${i}`] || 'ALL';

    if (value <= 0) continue;

    // 1. Payment mode filter check
    let modeMatches = false;
    if (targetMode === 'ALL' || paymentMode === 'ALL') {
      modeMatches = true;
    } else if (targetMode === paymentMode) {
      modeMatches = true;
    } else if (targetMode === 'ONLINE') {
      modeMatches = paymentMode === 'ONLINE' || paymentMode === 'UPI' || paymentMode === 'CARD';
    } else if (paymentMode === 'ONLINE') {
      modeMatches = targetMode === 'ONLINE' || targetMode === 'UPI' || targetMode === 'CARD';
    } else if (paymentMode === 'SPLIT') {
      // Split payment qualifies if mode is ALL or ONLINE
      modeMatches = targetMode === 'ALL' || targetMode === 'ONLINE';
    } else {
      modeMatches = targetMode === paymentMode;
    }

    if (!modeMatches) continue;

    // 2. Condition threshold match check
    let conditionMatches = false;
    switch (condition) {
      case 'ALWAYS':
        conditionMatches = true;
        break;
      case 'GREATER_THAN':
        conditionMatches = netAmount > threshold;
        break;
      case 'GREATER_EQUAL':
        conditionMatches = netAmount >= threshold;
        break;
      case 'LESS_THAN':
        conditionMatches = netAmount < threshold;
        break;
      case 'LESS_EQUAL':
        conditionMatches = netAmount <= threshold;
        break;
      default:
        conditionMatches = true;
    }

    if (!conditionMatches) continue;

    // 3. Compute charge
    let charge = 0;
    if (type === 'PERCENT') {
      charge = Math.round((netAmount * (value / 100)) * 100) / 100;
    } else {
      charge = Math.round(value * 100) / 100;
    }

    if (charge > 0) {
      applied.push({
        templateIndex: i,
        name,
        condition,
        threshold,
        type,
        value,
        payment_mode: targetMode,
        chargeAmount: charge,
        formattedRate: type === 'PERCENT' ? `${value}%` : `₹${value}`,
        description: getReadableRuleSummary(condition, threshold, type, value, targetMode)
      });
    }
  }

  const totalCharges = Math.round(applied.reduce((acc, c) => acc + c.chargeAmount, 0) * 100) / 100;

  return {
    totalCharges,
    appliedCharges: applied,
    breakdownJson: JSON.stringify(
      applied.map(a => ({
        template: a.templateIndex,
        name: a.name,
        type: a.type,
        value: a.value,
        mode: a.payment_mode,
        amount: a.chargeAmount
      }))
    )
  };
}

/**
 * Returns a human-friendly string describing a charge rule.
 */
export function getReadableRuleSummary(
  condition: string,
  threshold: number,
  type: 'PERCENT' | 'FLAT',
  value: number,
  mode: string
): string {
  let modeStr = 'all payment modes';
  if (mode === 'ONLINE') modeStr = 'Online (UPI / Card)';
  else if (mode === 'UPI') modeStr = 'UPI payments';
  else if (mode === 'CARD') modeStr = 'Card payments';
  else if (mode === 'CASH') modeStr = 'Cash payments';
  else if (mode === 'CREDIT_KHATA') modeStr = 'Credit / Khata';

  let condStr = '';
  switch (condition) {
    case 'ALWAYS':
      condStr = `Applied on any bill amount via ${modeStr}`;
      break;
    case 'GREATER_THAN':
      condStr = `Applied when bill > ₹${threshold.toLocaleString('en-IN')} via ${modeStr}`;
      break;
    case 'GREATER_EQUAL':
      condStr = `Applied when bill ≥ ₹${threshold.toLocaleString('en-IN')} via ${modeStr}`;
      break;
    case 'LESS_THAN':
      condStr = `Applied when bill < ₹${threshold.toLocaleString('en-IN')} via ${modeStr}`;
      break;
    case 'LESS_EQUAL':
      condStr = `Applied when bill ≤ ₹${threshold.toLocaleString('en-IN')} via ${modeStr}`;
      break;
    default:
      condStr = `Applied via ${modeStr}`;
  }

  const rateStr = type === 'PERCENT' ? `${value}% surcharge` : `₹${value} flat fee`;
  return `${condStr} (${rateStr})`;
}

export interface RuleDiagnostic {
  templateIndex: number;
  name: string;
  isEnabled: boolean;
  isTriggered: boolean;
  reason: string;
  calculatedCharge: number;
  condition: string;
  threshold: number;
  type: 'PERCENT' | 'FLAT';
  value: number;
  targetMode: string;
}

export function evaluateRuleDiagnostics(
  subtotal: number,
  discount: number = 0,
  paymentMode: string = 'ONLINE',
  settings?: Partial<StoreSettings> | null
): RuleDiagnostic[] {
  const list: RuleDiagnostic[] = [];
  const netAmount = Math.max(0, subtotal - discount);

  for (let i = 1; i <= 5; i++) {
    const isEnabled = Boolean((settings as any)?.[`extra_charge_enabled_${i}`]);
    const name = ((settings as any)?.[`extra_charge_name_${i}`] || `Template ${i}`).trim();
    const condition = (settings as any)?.[`extra_charge_condition_${i}`] || 'ALWAYS';
    const threshold = parseFloat(String((settings as any)?.[`extra_charge_threshold_${i}`] ?? '0')) || 0;
    const type = ((settings as any)?.[`extra_charge_type_${i}`] || 'PERCENT') as 'PERCENT' | 'FLAT';
    const value = parseFloat(String((settings as any)?.[`extra_charge_value_${i}`] ?? '0')) || 0;
    const targetMode = (settings as any)?.[`extra_charge_payment_mode_${i}`] || 'ALL';

    if (!isEnabled) {
      list.push({
        templateIndex: i,
        name,
        isEnabled: false,
        isTriggered: false,
        reason: 'Disabled (Toggle switch is OFF)',
        calculatedCharge: 0,
        condition,
        threshold,
        type,
        value,
        targetMode
      });
      continue;
    }

    if (value <= 0) {
      list.push({
        templateIndex: i,
        name,
        isEnabled: true,
        isTriggered: false,
        reason: 'Rate / value is 0 or empty',
        calculatedCharge: 0,
        condition,
        threshold,
        type,
        value,
        targetMode
      });
      continue;
    }

    // Check payment mode
    let modeMatches = false;
    if (targetMode === 'ALL' || paymentMode === 'ALL') {
      modeMatches = true;
    } else if (targetMode === paymentMode) {
      modeMatches = true;
    } else if (targetMode === 'ONLINE') {
      modeMatches = paymentMode === 'ONLINE' || paymentMode === 'UPI' || paymentMode === 'CARD';
    } else if (paymentMode === 'ONLINE') {
      modeMatches = targetMode === 'ONLINE' || targetMode === 'UPI' || targetMode === 'CARD';
    } else if (paymentMode === 'SPLIT') {
      modeMatches = targetMode === 'ALL' || targetMode === 'ONLINE';
    } else {
      modeMatches = targetMode === paymentMode;
    }

    if (!modeMatches) {
      list.push({
        templateIndex: i,
        name,
        isEnabled: true,
        isTriggered: false,
        reason: `Payment mode (${paymentMode}) does not match (${targetMode})`,
        calculatedCharge: 0,
        condition,
        threshold,
        type,
        value,
        targetMode
      });
      continue;
    }

    // Check condition
    let conditionMatches = false;
    switch (condition) {
      case 'ALWAYS':
        conditionMatches = true;
        break;
      case 'GREATER_THAN':
        conditionMatches = netAmount > threshold;
        break;
      case 'GREATER_EQUAL':
        conditionMatches = netAmount >= threshold;
        break;
      case 'LESS_THAN':
        conditionMatches = netAmount < threshold;
        break;
      case 'LESS_EQUAL':
        conditionMatches = netAmount <= threshold;
        break;
      default:
        conditionMatches = true;
    }

    if (!conditionMatches) {
      const condSymbol = condition === 'GREATER_THAN' ? '>' : condition === 'GREATER_EQUAL' ? '≥' : condition === 'LESS_THAN' ? '<' : '≤';
      list.push({
        templateIndex: i,
        name,
        isEnabled: true,
        isTriggered: false,
        reason: `Bill ₹${netAmount} not ${condSymbol} threshold ₹${threshold}`,
        calculatedCharge: 0,
        condition,
        threshold,
        type,
        value,
        targetMode
      });
      continue;
    }

    let charge = 0;
    if (type === 'PERCENT') {
      charge = Math.round((netAmount * (value / 100)) * 100) / 100;
    } else {
      charge = Math.round(value * 100) / 100;
    }

    list.push({
      templateIndex: i,
      name,
      isEnabled: true,
      isTriggered: true,
      reason: `Matched & Triggered (+₹${charge.toFixed(2)})`,
      calculatedCharge: charge,
      condition,
      threshold,
      type,
      value,
      targetMode
    });
  }

  return list;
}

