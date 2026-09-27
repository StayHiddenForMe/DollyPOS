import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { HourlyVelocity } from '../types';
import { formatCompactINR } from '../utils/formatters';
import { colors } from '../theme/colors';

interface HourlyVelocityBarProps {
  data: HourlyVelocity[];
}

export const HourlyVelocityBar: React.FC<HourlyVelocityBarProps> = ({ data }) => {
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Hourly Sales Velocity</Text>
        <Text style={styles.subtext}>9:00 AM – 10:00 PM</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {data.map((item, idx) => {
          const heightPct = Math.max(Math.min((item.amount / maxAmount) * 100, 100), item.amount > 0 ? 12 : 4);
          const isPeak = item.amount === maxAmount && item.amount > 0;

          return (
            <View key={idx} style={styles.barColumn}>
              {/* Value Label */}
              <View style={styles.labelContainer}>
                {item.amount > 0 ? (
                  <Text style={[styles.barAmount, isPeak && styles.peakText]}>
                    {formatCompactINR(item.amount)}
                  </Text>
                ) : null}
              </View>

              {/* Bar track */}
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${heightPct}%`,
                      backgroundColor: isPeak
                        ? colors.brand[600]
                        : item.amount > 0
                        ? colors.brand[400]
                        : colors.cardBorder,
                    },
                  ]}
                />
              </View>

              {/* Hour Label */}
              <Text style={[styles.hourLabel, isPeak && styles.peakHour]}>
                {item.hour.replace(':00', '')}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtext: {
    fontSize: 11,
    color: colors.textMuted,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 4,
    gap: 10,
  },
  barColumn: {
    width: 44,
    alignItems: 'center',
  },
  labelContainer: {
    height: 18,
    justifyContent: 'center',
    marginBottom: 4,
  },
  barAmount: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  peakText: {
    color: colors.brand[600],
    fontWeight: '800',
  },
  barTrack: {
    width: 20,
    height: 90,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  hourLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 6,
  },
  peakHour: {
    color: colors.brand[600],
    fontWeight: '700',
  },
});
