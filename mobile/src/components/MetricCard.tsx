import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  style?: ViewStyle;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  style,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          card: styles.primaryCard,
          title: styles.primaryTitle,
          value: styles.primaryValue,
          subtitle: styles.primarySubtitle,
          iconBg: styles.primaryIconBg,
        };
      case 'success':
        return {
          card: styles.successCard,
          title: styles.defaultTitle,
          value: styles.successValue,
          subtitle: styles.defaultSubtitle,
          iconBg: styles.successIconBg,
        };
      case 'warning':
        return {
          card: styles.warningCard,
          title: styles.defaultTitle,
          value: styles.warningValue,
          subtitle: styles.defaultSubtitle,
          iconBg: styles.warningIconBg,
        };
      case 'danger':
        return {
          card: styles.dangerCard,
          title: styles.defaultTitle,
          value: styles.dangerValue,
          subtitle: styles.defaultSubtitle,
          iconBg: styles.dangerIconBg,
        };
      default:
        return {
          card: styles.defaultCard,
          title: styles.defaultTitle,
          value: styles.defaultValue,
          subtitle: styles.defaultSubtitle,
          iconBg: styles.defaultIconBg,
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <View style={[styles.cardBase, vStyles.card, style]}>
      <View style={styles.headerRow}>
        <Text style={[styles.titleBase, vStyles.title]}>{title}</Text>
        {icon && <View style={[styles.iconBox, vStyles.iconBg]}>{icon}</View>}
      </View>
      <Text style={[styles.valueBase, vStyles.value]}>{value}</Text>
      {subtitle ? (
        <Text style={[styles.subtitleBase, vStyles.subtitle]}>{subtitle}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  cardBase: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBase: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  valueBase: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitleBase: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },

  // Default
  defaultCard: {
    backgroundColor: '#ffffff',
    borderColor: colors.cardBorder,
  },
  defaultTitle: {
    color: colors.textSecondary,
  },
  defaultValue: {
    color: colors.textPrimary,
  },
  defaultSubtitle: {
    color: colors.textMuted,
  },
  defaultIconBg: {
    backgroundColor: colors.surfaceSubtle,
  },

  // Primary (Hero Dolly Rose)
  primaryCard: {
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[700],
  },
  primaryTitle: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  primaryValue: {
    color: '#ffffff',
    fontSize: 28,
  },
  primarySubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  primaryIconBg: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  // Success (Green)
  successCard: {
    backgroundColor: '#ffffff',
    borderColor: '#a7f3d0',
  },
  successValue: {
    color: colors.success,
  },
  successIconBg: {
    backgroundColor: colors.successLight,
  },

  // Warning (Amber)
  warningCard: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
  },
  warningValue: {
    color: colors.warning,
  },
  warningIconBg: {
    backgroundColor: colors.warningLight,
  },

  // Danger (Red)
  dangerCard: {
    backgroundColor: '#ffffff',
    borderColor: '#fecaca',
  },
  dangerValue: {
    color: colors.danger,
  },
  dangerIconBg: {
    backgroundColor: colors.dangerLight,
  },
});
