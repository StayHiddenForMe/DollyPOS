import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (startDate: string, endDate: string) => void;
  initialStartDate?: string;
  initialEndDate?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const formatYMD = (year: number, monthIndex: number, day: number): string => {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  onClose,
  onApply,
  initialStartDate,
  initialEndDate,
}) => {
  const { colors: themeColors, isDark } = useTheme();

  const today = new Date();
  const todayYMD = formatYMD(today.getFullYear(), today.getMonth(), today.getDate());

  const [activeTab, setActiveTab] = useState<'START' | 'END'>('START');
  const [selectedStart, setSelectedStart] = useState<string>(initialStartDate || todayYMD);
  const [selectedEnd, setSelectedEnd] = useState<string>(initialEndDate || todayYMD);

  // Calendar view navigation
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth());

  useEffect(() => {
    if (visible) {
      if (initialStartDate) setSelectedStart(initialStartDate);
      if (initialEndDate) setSelectedEnd(initialEndDate);

      const target = initialStartDate ? new Date(initialStartDate) : new Date();
      if (!isNaN(target.getTime())) {
        setViewYear(target.getFullYear());
        setViewMonth(target.getMonth());
      }
    }
  }, [visible, initialStartDate, initialEndDate]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const ymd = formatYMD(viewYear, viewMonth, day);
    if (activeTab === 'START') {
      setSelectedStart(ymd);
      if (ymd > selectedEnd) {
        setSelectedEnd(ymd);
      }
      setActiveTab('END');
    } else {
      if (ymd < selectedStart) {
        setSelectedStart(ymd);
      }
      setSelectedEnd(ymd);
    }
  };

  const handleApplyPreset = (type: 'TODAY' | 'YESTERDAY' | 'LAST7' | 'THIS_MONTH' | 'LAST30' | 'THIS_YEAR' | 'PREV_YEAR') => {
    const now = new Date();
    if (type === 'TODAY') {
      const s = formatYMD(now.getFullYear(), now.getMonth(), now.getDate());
      setSelectedStart(s);
      setSelectedEnd(s);
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    } else if (type === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const s = formatYMD(y.getFullYear(), y.getMonth(), y.getDate());
      setSelectedStart(s);
      setSelectedEnd(s);
      setViewYear(y.getFullYear());
      setViewMonth(y.getMonth());
    } else if (type === 'LAST7') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setSelectedStart(formatYMD(w.getFullYear(), w.getMonth(), w.getDate()));
      setSelectedEnd(formatYMD(now.getFullYear(), now.getMonth(), now.getDate()));
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    } else if (type === 'THIS_MONTH') {
      const s = formatYMD(now.getFullYear(), now.getMonth(), 1);
      const e = formatYMD(now.getFullYear(), now.getMonth(), now.getDate());
      setSelectedStart(s);
      setSelectedEnd(e);
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    } else if (type === 'LAST30') {
      const m = new Date();
      m.setDate(m.getDate() - 30);
      setSelectedStart(formatYMD(m.getFullYear(), m.getMonth(), m.getDate()));
      setSelectedEnd(formatYMD(now.getFullYear(), now.getMonth(), now.getDate()));
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    } else if (type === 'THIS_YEAR') {
      const s = formatYMD(now.getFullYear(), 0, 1);
      const e = formatYMD(now.getFullYear(), now.getMonth(), now.getDate());
      setSelectedStart(s);
      setSelectedEnd(e);
      setViewYear(now.getFullYear());
      setViewMonth(0);
    } else if (type === 'PREV_YEAR') {
      const prevY = now.getFullYear() - 1;
      const s = formatYMD(prevY, 0, 1);
      const e = formatYMD(prevY, 11, 31);
      setSelectedStart(s);
      setSelectedEnd(e);
      setViewYear(prevY,);
      setViewMonth(0);
    }
  };

  const handleConfirm = () => {
    onApply(selectedStart, selectedEnd);
    onClose();
  };

  // Calendar grid calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday

  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.headerTitleRow}>
                  <CalendarIcon size={20} color={colors.brand[600]} />
                  <Text style={[styles.headerTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                    Select Date Range
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <X size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Start & End Date Selector Tabs */}
              <View style={[styles.tabBar, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' }]}>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === 'START' && [
                      styles.tabActive,
                      { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' },
                    ],
                  ]}
                  onPress={() => setActiveTab('START')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>From (Start)</Text>
                  <Text style={[styles.tabDate, { color: activeTab === 'START' ? colors.brand[600] : (isDark ? '#E2E8F0' : '#1E293B') }]}>
                    {selectedStart || 'Select Date'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === 'END' && [
                      styles.tabActive,
                      { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' },
                    ],
                  ]}
                  onPress={() => setActiveTab('END')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>To (End)</Text>
                  <Text style={[styles.tabDate, { color: activeTab === 'END' ? colors.brand[600] : (isDark ? '#E2E8F0' : '#1E293B') }]}>
                    {selectedEnd || 'Select Date'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Quick Preset Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.presetsBar}
                contentContainerStyle={styles.presetsContent}
              >
                <TouchableOpacity style={styles.chip} onPress={() => handleApplyPreset('TODAY')}>
                  <Text style={styles.chipText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => handleApplyPreset('YESTERDAY')}>
                  <Text style={styles.chipText}>Yesterday</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => handleApplyPreset('LAST7')}>
                  <Text style={styles.chipText}>Last 7 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => handleApplyPreset('THIS_MONTH')}>
                  <Text style={styles.chipText}>This Month</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => handleApplyPreset('LAST30')}>
                  <Text style={styles.chipText}>Last 30 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => handleApplyPreset('THIS_YEAR')}>
                  <Text style={styles.chipText}>This Year</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.chip} onPress={() => handleApplyPreset('PREV_YEAR')}>
                  <Text style={styles.chipText}>Last Year</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Month / Year Navigator */}
              <View style={styles.navRow}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
                  <ChevronLeft size={20} color={isDark ? '#CBD5E1' : '#334155'} />
                </TouchableOpacity>
                <Text style={[styles.monthYearText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </Text>
                <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
                  <ChevronRight size={20} color={isDark ? '#CBD5E1' : '#334155'} />
                </TouchableOpacity>
              </View>

              {/* Weekday Labels */}
              <View style={styles.weekdaysRow}>
                {WEEKDAYS.map((wd, i) => (
                  <Text key={i} style={styles.weekdayText}>{wd}</Text>
                ))}
              </View>

              {/* Day Grid */}
              <View style={styles.calendarGrid}>
                {calendarCells.map((day, idx) => {
                  if (day === null) {
                    return <View key={`empty-${idx}`} style={styles.dayCell} />;
                  }

                  const cellYMD = formatYMD(viewYear, viewMonth, day);
                  const isStart = cellYMD === selectedStart;
                  const isEnd = cellYMD === selectedEnd;
                  const inRange = cellYMD > selectedStart && cellYMD < selectedEnd;
                  const isToday = cellYMD === todayYMD;

                  return (
                    <TouchableOpacity
                      key={`day-${day}`}
                      style={[
                        styles.dayCell,
                        inRange && { backgroundColor: isDark ? '#3b1227' : '#FCE7F3' },
                        (isStart || isEnd) && styles.selectedDayCell,
                      ]}
                      onPress={() => handleSelectDay(day)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          { color: isDark ? '#E2E8F0' : '#1E293B' },
                          isToday && { color: colors.brand[600], fontWeight: '800' },
                          (isStart || isEnd) && styles.selectedDayText,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Selected Summary & Apply Button */}
              <View style={styles.footerRow}>
                <View style={styles.summaryContainer}>
                  <Text style={styles.summaryLabel}>Selected Range:</Text>
                  <Text style={[styles.summaryDates, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>
                    {selectedStart} → {selectedEnd}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <Check size={18} color="#FFFFFF" />
                  <Text style={styles.applyBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabSub: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabDate: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  presetsBar: {
    maxHeight: 38,
    marginBottom: 12,
  },
  presetsContent: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 4,
  },
  navBtn: {
    padding: 6,
  },
  monthYearText: {
    fontSize: 15,
    fontWeight: '800',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekdayText: {
    width: 38,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCell: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 20,
  },
  selectedDayCell: {
    backgroundColor: colors.brand[600],
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryContainer: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  summaryDates: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand[600],
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
