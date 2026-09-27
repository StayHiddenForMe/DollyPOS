import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PaymentBreakdown } from '../types';
import { formatINR } from '../utils/formatters';
import { useTheme } from '../context/ThemeContext';

interface PaymentSplitBarProps {
  breakdown: PaymentBreakdown;
  period?: string;
  periodLabel?: string;
}

export const PaymentSplitBar: React.FC<PaymentSplitBarProps> = ({
  breakdown,
  period = 'TODAY',
  periodLabel,
}) => {
  const { colors, isDark } = useTheme();

  const total =
    (breakdown.CASH || 0) +
    (breakdown.UPI || 0) +
    (breakdown.CARD || 0) +
    (breakdown.CREDIT || 0);

  const getPct = (amount: number) => {
    if (total <= 0) return 0;
    return Math.round((amount / total) * 100);
  };

  const cashPct = getPct(breakdown.CASH);
  const upiPct = getPct(breakdown.UPI);
  const cardPct = getPct(breakdown.CARD);
  const creditPct = getPct(breakdown.CREDIT);

  const getDynamicTitle = () => {
    if (periodLabel) return `Payment Collections (${periodLabel})`;
    switch (period?.toUpperCase()) {
      case 'YESTERDAY':
        return 'Payment Collections (Yesterday)';
      case 'WEEK':
        return 'Payment Collections (Last 7 Days)';
      case 'MONTH':
        return 'Payment Collections (This Month)';
      case 'YEAR':
        return 'Payment Collections (This Year)';
      case 'CUSTOM':
        return 'Payment Collections (Selected Range)';
      case 'TODAY':
      default:
        return 'Payment Collections (Today)';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      {/* Header with Title and Total Collected */}
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {getDynamicTitle()}
        </Text>
        <View style={[styles.totalPill, { backgroundColor: colors.surfaceSubtle }]}>
          <Text style={[styles.totalPillText, { color: colors.brand[600] }]}>
            Total: {formatINR(total)}
          </Text>
        </View>
      </View>

      {/* Visual Multi-Segment Bar */}
      <View style={[styles.barContainer, { backgroundColor: colors.surfaceSubtle }]}>
        {cashPct > 0 && (
          <View style={[styles.barSegment, { flex: cashPct, backgroundColor: colors.payment.cash }]} />
        )}
        {upiPct > 0 && (
          <View style={[styles.barSegment, { flex: upiPct, backgroundColor: colors.payment.upi }]} />
        )}
        {cardPct > 0 && (
          <View style={[styles.barSegment, { flex: cardPct, backgroundColor: colors.payment.card }]} />
        )}
        {creditPct > 0 && (
          <View style={[styles.barSegment, { flex: creditPct, backgroundColor: colors.payment.credit }]} />
        )}
        {total === 0 && (
          <View style={[styles.barSegment, { flex: 1, backgroundColor: colors.cardBorder }]} />
        )}
      </View>

      {/* Mode Chips Grid */}
      <View style={styles.chipsGrid}>
        {/* Cash */}
        <View style={[styles.chip, { backgroundColor: colors.surfaceSubtle }]}>
          <View style={[styles.indicator, { backgroundColor: colors.payment.cash }]} />
          <View style={styles.chipTextContainer}>
            <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>Cash ({cashPct}%)</Text>
            <Text style={[styles.chipAmount, { color: colors.textPrimary }]}>{formatINR(breakdown.CASH)}</Text>
          </View>
        </View>

        {/* UPI */}
        <View style={[styles.chip, { backgroundColor: colors.surfaceSubtle }]}>
          <View style={[styles.indicator, { backgroundColor: colors.payment.upi }]} />
          <View style={styles.chipTextContainer}>
            <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>UPI / Online ({upiPct}%)</Text>
            <Text style={[styles.chipAmount, { color: colors.textPrimary }]}>{formatINR(breakdown.UPI)}</Text>
          </View>
        </View>

        {/* Card */}
        <View style={[styles.chip, { backgroundColor: colors.surfaceSubtle }]}>
          <View style={[styles.indicator, { backgroundColor: colors.payment.card }]} />
          <View style={styles.chipTextContainer}>
            <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>Card / POS ({cardPct}%)</Text>
            <Text style={[styles.chipAmount, { color: colors.textPrimary }]}>{formatINR(breakdown.CARD)}</Text>
          </View>
        </View>

        {/* Khata Credit */}
        <View style={[styles.chip, { backgroundColor: colors.surfaceSubtle }]}>
          <View style={[styles.indicator, { backgroundColor: colors.payment.credit }]} />
          <View style={styles.chipTextContainer}>
            <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>Khata Udhar ({creditPct}%)</Text>
            <Text style={[styles.chipAmount, { color: colors.textPrimary }]}>{formatINR(breakdown.CREDIT)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  totalPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  totalPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  barContainer: {
    height: 12,
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 14,
  },
  barSegment: {
    height: '100%',
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 9,
    borderRadius: 9,
  },
  chipTextContainer: {
    flex: 1,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipLabel: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  chipAmount: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 2,
  },
});
