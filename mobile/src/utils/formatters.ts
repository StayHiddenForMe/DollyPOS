export const formatINR = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0.00';
  }

  const rounded = Number(amount).toFixed(2);
  const [integerPart, decimalPart] = rounded.split('.');

  // Format integerPart according to Indian numbering system (3 digits, then 2 digits)
  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  return `₹${formattedInteger}.${decimalPart}`;
};

export const formatCompactINR = (amount: number | null | undefined): string => {
  if (!amount || isNaN(amount)) return '₹0';
  const val = Math.abs(amount);
  if (val >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  }
  if (val >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (val >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}k`;
  }
  return `₹${Math.round(amount)}`;
};

export const formatDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};
