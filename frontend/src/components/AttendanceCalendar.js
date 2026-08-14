import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, FlatList } from 'react-native';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * AttendanceCalendar
 * Props:
 *  - records: array of attendance objects from the API { staff_id, date (YYYY-MM-DD), status }
 *  - staffList: array of user objects { id, username }
 *  - onMarkAttendance: function(staffId, date) - called when manager marks present
 */
export default function AttendanceCalendar({ 
  records = [], 
  staffList = [], 
  onMarkAttendance, 
  isAdmin = false,
  selectedStaffId,
  setSelectedStaffId,
  year,
  setYear,
  month,
  setMonth
}) {
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState(null);
  const [isStaffModalVisible, setIsStaffModalVisible] = useState(false);

  // Auto-select first staff when list loads
  useEffect(() => {
    if (staffList.length > 0 && selectedStaffId === null) {
      setSelectedStaffId(staffList[0].id);
    }
  }, [staffList]);

  const selectedStaff = staffList.find(s => s.id === selectedStaffId);

  // Build a set of present/absent dates for selected month
  const statusMap = useMemo(() => {
    const map = {};
    if (!records) return map;
    
    records.forEach(r => {
      try {
        if (selectedStaffId !== null && r.staff_id !== selectedStaffId) return;
        if (!r.date) return;

        // Handle both YYYY-MM-DD and full ISO strings
        const datePart = typeof r.date === 'string' ? r.date.split('T')[0] : '';
        if (!datePart) return;

        const parts = datePart.split('-');
        if (parts.length < 3) return;

        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);

        if (y === year && m - 1 === month) {
          map[d] = r.status;
        }
      } catch (e) {
        console.error("Error parsing attendance record:", r, e);
      }
    });
    return map;
  }, [records, selectedStaffId, year, month]);

  const goToPrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  // Calendar grid
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const cells = Array(firstDayOfWeek).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );
  while (cells.length % 7 !== 0) cells.push(null);

  const isFuture = (day) => {
    if (!day) return false;
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return d > t;
  };

  const handleDayPress = (day) => {
    if (!day || isFuture(day)) return;
    setSelectedDay(day === selectedDay ? null : day);
  };

  const markPresent = (status = 'PRESENT') => {
    if (!selectedDay || !selectedStaffId || !onMarkAttendance) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    onMarkAttendance(selectedStaffId, dateStr, status);
    setSelectedDay(null);
  };

  return (
    <View style={styles.container}>
      {/* Staff Filter Button */}
      {staffList.length > 1 && (
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Viewing Attendance for:</Text>
          <TouchableOpacity style={styles.filterBtn} onPress={() => setIsStaffModalVisible(true)}>
            <Text style={styles.filterBtnText}>{selectedStaff ? selectedStaff.username : 'Select Staff'}</Text>
            <Text style={styles.filterBtnIcon}>▼</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Navigator */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Grid */}
      <View style={styles.weekRow}>
        {DAY_LABELS.map(d => <Text key={d} style={styles.dayLabel}>{d}</Text>)}
      </View>

      <View style={styles.grid}>
        {cells.map((day, idx) => {
          const status = day ? statusMap[day] : null;
          const future = isFuture(day);
          const isSelected = day && day === selectedDay;
          const isToday = day && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();

          let dotColor = null;
          if (day && !future) {
             if (status === 'PRESENT') dotColor = '#10B981';
             else if (status === 'HALF_DAY') dotColor = '#F59E0B'; 
             else if (status === 'ABSENT' || status === 'ON_LEAVE') dotColor = '#EF4444'; 
             else dotColor = '#D1D5DB';
          }

          return (
            <TouchableOpacity 
              key={idx} 
              onPress={() => handleDayPress(day)}
              disabled={!day || future}
              style={[
                styles.cell, 
                isToday && styles.todayCell,
                isSelected && styles.selectedCell
              ]}
            >
              {day && (
                <>
                  <Text style={[styles.dayNumber, isToday && styles.todayText, isSelected && styles.selectedText]}>{day}</Text>
                  {!future && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selection Action */}
      {selectedDay && !statusMap[selectedDay] && (
        <View style={styles.actionRow}>
          {(() => {
            const selectedDate = new Date(year, month, selectedDay);
            const todayDate = new Date();
            todayDate.setHours(0,0,0,0);
            const isPast = selectedDate < todayDate;

            if (isPast && !isAdmin) {
              return <Text style={styles.actionText}>Only admins can mark attendance for past dates ({selectedDay} {MONTH_NAMES[month]}).</Text>;
            }

            return (
              <>
                <Text style={styles.actionText}>Mark {selectedStaff?.username} for {selectedDay} {MONTH_NAMES[month]}?</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={[styles.markBtn, { backgroundColor: '#10B981', flex: 1 }]} onPress={() => markPresent('PRESENT')}>
                      <Text style={styles.markBtnText}>Full Day (Present)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.markBtn, { backgroundColor: '#F59E0B', flex: 1 }]} onPress={() => markPresent('HALF_DAY')}>
                      <Text style={styles.markBtnText}>Half Day</Text>
                  </TouchableOpacity>
                </View>
              </>
            );
          })()}
        </View>
      )}

      {/* Monthly Summary Statistics */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
            <Text style={styles.statLabel}>Full Days</Text>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{Object.values(statusMap).filter(v => v === 'PRESENT').length}</Text>
        </View>
        <View style={styles.statItem}>
            <Text style={styles.statLabel}>Half Days</Text>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>{Object.values(statusMap).filter(v => v === 'HALF_DAY').length}</Text>
        </View>
        <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Present</Text>
            <Text style={[styles.statValue, { color: '#111827' }]}>
                {Object.values(statusMap).reduce((acc, v) => acc + (v === 'PRESENT' ? 1 : v === 'HALF_DAY' ? 0.5 : 0), 0).toFixed(1)}
            </Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#10B981' }]} /><Text style={styles.legendText}>Present</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} /><Text style={styles.legendText}>Half Day</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} /><Text style={styles.legendText}>Absent/Leave</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#D1D5DB' }]} /><Text style={styles.legendText}>No Record</Text></View>
      </View>

      {/* Staff Picker Modal */}
      <Modal visible={isStaffModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setIsStaffModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Staff</Text>
            <FlatList
              data={staffList}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.staffOption} 
                  onPress={() => { setSelectedStaffId(item.id); setIsStaffModalVisible(false); setSelectedDay(null); }}
                >
                  <Text style={[styles.staffOptionText, selectedStaffId === item.id && styles.staffOptionActive]}>{item.username}</Text>
                  {selectedStaffId === item.id && <Text style={{color: '#2563EB'}}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', borderRadius: 12, marginHorizontal: 12, marginTop: 12, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  filterRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', justifyContent: 'space-between' },
  filterLabel: { fontSize: 13, color: '#374151', fontWeight: '600' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  filterBtnText: { color: '#111827', fontWeight: 'bold', fontSize: 14, marginRight: 6 },
  filterBtnIcon: { fontSize: 10, color: '#6B7280' },

  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  navBtn: { padding: 6 },
  navArrow: { fontSize: 24, color: '#374151' },
  monthTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },

  weekRow: { flexDirection: 'row', paddingHorizontal: 4, paddingTop: 8, paddingBottom: 2 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#374151' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4, paddingBottom: 8 },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 10, position: 'relative' },
  todayCell: { backgroundColor: '#F3F4F6', borderRadius: 8 },
  selectedCell: { backgroundColor: '#2563EB', borderRadius: 8 },
  dayNumber: { fontSize: 14, color: '#374151', fontWeight: '500' },
  todayText: { color: '#2563EB', fontWeight: 'bold' },
  selectedText: { color: 'white', fontWeight: 'bold' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },

  actionRow: { padding: 16, backgroundColor: '#F9FAFB', borderTopWidth: 1, borderTopColor: '#F3F4F6', alignItems: 'center' },
  actionText: { fontSize: 14, color: '#4B5563', marginBottom: 12, textAlign: 'center' },
  markBtn: { backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  markBtnText: { color: 'white', fontWeight: 'bold' },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#F9FAFB' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#374151', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: 'white', borderRadius: 16, padding: 20, maxHeight: '60%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 15 },
  staffOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  staffOptionText: { fontSize: 16, color: '#4B5563' },
  staff_option_active: { color: '#2563EB', fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6', backgroundColor: '#F9FAFB' },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#111827' }
});
