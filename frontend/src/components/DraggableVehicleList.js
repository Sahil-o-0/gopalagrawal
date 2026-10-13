import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const ITEM_HEIGHT = 68;
const GAP = 8;
const TOTAL_ROW_HEIGHT = ITEM_HEIGHT + GAP;

export default function DraggableVehicleList({ vehicles = [], onOrderChange, onClose }) {
  const [items, setItems] = useState(vehicles);
  const [activeDragId, setActiveDragId] = useState(null);

  const itemsRef = useRef(vehicles);
  itemsRef.current = items;

  const scrollYRef = useRef(0);
  const scrollViewRef = useRef(null);

  // Animated values for each item
  const animsRef = useRef({});
  // panY for each item
  if (!animsRef.current) animsRef.current = {};

  useEffect(() => {
    setItems(vehicles);
    itemsRef.current = vehicles;
  }, [vehicles]);

  // Ensure every item has an Animated.Value
  items.forEach((item, index) => {
    if (!animsRef.current[item.id]) {
      animsRef.current[item.id] = {
        panY: new Animated.Value(0),
        scale: new Animated.Value(1),
        zIndex: 1,
      };
    }
  });

  const activeIndexRef = useRef(-1);
  const currentDragYRef = useRef(0);
  const initialTouchYRef = useRef(0);

  const panRespondersRef = useRef({});

  // Helper to reorder array
  const moveItem = (fromIdx, toIdx) => {
    if (fromIdx === toIdx || toIdx < 0 || toIdx >= itemsRef.current.length) return;
    const updated = [...itemsRef.current];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setItems(updated);
    itemsRef.current = updated;
    try { Haptics.selectionAsync(); } catch (e) {}
  };

  const createPanResponder = (item, index) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only start pan if moved vertically more than 4px
        return Math.abs(gestureState.dy) > 4;
      },
      onPanResponderGrant: (evt, gestureState) => {
        activeIndexRef.current = itemsRef.current.findIndex(v => v.id === item.id);
        setActiveDragId(item.id);
        initialTouchYRef.current = evt.nativeEvent.pageY;

        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}

        const anim = animsRef.current[item.id];
        if (anim) {
          anim.zIndex = 999;
          Animated.parallel([
            Animated.spring(anim.scale, {
              toValue: 1.04,
              friction: 6,
              useNativeDriver: false,
            }),
          ]).start();
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const anim = animsRef.current[item.id];
        if (!anim) return;

        anim.panY.setValue(gestureState.dy);
        currentDragYRef.current = gestureState.dy;

        // Calculate potential new index
        const currentIndex = activeIndexRef.current;
        const offsetSlots = Math.round(gestureState.dy / TOTAL_ROW_HEIGHT);
        const targetIndex = Math.max(0, Math.min(itemsRef.current.length - 1, currentIndex + offsetSlots));

        if (targetIndex !== currentIndex && targetIndex >= 0 && targetIndex < itemsRef.current.length) {
          moveItem(currentIndex, targetIndex);
          activeIndexRef.current = targetIndex;
          initialTouchYRef.current = evt.nativeEvent.pageY;
          anim.panY.setValue(0);
        }
      },
      onPanResponderRelease: () => {
        const anim = animsRef.current[item.id];
        if (anim) {
          Animated.parallel([
            Animated.spring(anim.panY, {
              toValue: 0,
              friction: 7,
              useNativeDriver: false,
            }),
            Animated.spring(anim.scale, {
              toValue: 1,
              friction: 6,
              useNativeDriver: false,
            }),
          ]).start(() => {
            anim.zIndex = 1;
            setActiveDragId(null);
            activeIndexRef.current = -1;
            if (onOrderChange) {
              onOrderChange(itemsRef.current);
            }
          });
        } else {
          setActiveDragId(null);
          if (onOrderChange) {
            onOrderChange(itemsRef.current);
          }
        }
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      },
      onPanResponderTerminate: () => {
        const anim = animsRef.current[item.id];
        if (anim) {
          Animated.parallel([
            Animated.spring(anim.panY, { toValue: 0, useNativeDriver: false }),
            Animated.spring(anim.scale, { toValue: 1, useNativeDriver: false }),
          ]).start(() => {
            anim.zIndex = 1;
            setActiveDragId(null);
          });
        }
      },
    });
  };

  // Move item manually (quick arrows for convenience if requested)
  const shiftItem = (fromIndex, direction) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= items.length) return;
    const updated = [...items];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setItems(updated);
    itemsRef.current = updated;
    if (onOrderChange) onOrderChange(updated);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
  };

  return (
    <View style={styles.container}>
      <View style={styles.tipBanner}>
        <MaterialCommunityIcons name="gesture-swipe-vertical" size={18} color="#2563EB" />
        <Text style={styles.tipText}>
          Hold the <Text style={{ fontWeight: '800' }}>≡</Text> handle to drag up/down and reorder
        </Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        scrollEnabled={activeDragId === null}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {items.map((r, idx) => {
          const isDragging = activeDragId === r.id;
          const anim = animsRef.current[r.id] || { panY: new Animated.Value(0), scale: new Animated.Value(1), zIndex: 1 };
          const panResponder = createPanResponder(r, idx);

          return (
            <Animated.View
              key={r.id}
              style={[
                styles.itemRow,
                isDragging && styles.itemRowActive,
                {
                  transform: [
                    { translateY: anim.panY },
                    { scale: anim.scale },
                  ],
                  zIndex: isDragging ? 999 : 1,
                  elevation: isDragging ? 8 : 1,
                },
              ]}
            >
              {/* Position Index Badge */}
              <View style={[styles.indexBadge, isDragging && styles.indexBadgeActive]}>
                <Text style={[styles.indexText, isDragging && styles.indexTextActive]}>{idx + 1}</Text>
              </View>

              {/* Vehicle Info */}
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleNum}>{r.vehicle_number}</Text>
                <Text style={styles.vehicleFinancier} numberOfLines={1}>
                  {r.financier ? `Fin: ${r.financier}` : 'No Financier'} {r.emi_amount ? `• EMI ₹${parseFloat(r.emi_amount).toLocaleString()}` : ''}
                </Text>
              </View>

              {/* Direct Quick Move buttons */}
              <View style={styles.microBtnGroup}>
                <TouchableOpacity
                  style={[styles.microBtn, idx === 0 && styles.microBtnDisabled]}
                  onPress={() => shiftItem(idx, -1)}
                  disabled={idx === 0}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <MaterialCommunityIcons name="chevron-up" size={18} color={idx === 0 ? '#CBD5E1' : '#475569'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.microBtn, idx === items.length - 1 && styles.microBtnDisabled]}
                  onPress={() => shiftItem(idx, 1)}
                  disabled={idx === items.length - 1}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <MaterialCommunityIcons name="chevron-down" size={18} color={idx === items.length - 1 ? '#CBD5E1' : '#475569'} />
                </TouchableOpacity>
              </View>

              {/* Drag Handle with PanResponder */}
              <View {...panResponder.panHandlers} style={[styles.dragHandle, isDragging && styles.dragHandleActive]}>
                <MaterialCommunityIcons name="drag-vertical" size={24} color={isDragging ? '#2563EB' : '#64748B'} />
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
        <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
        <Text style={styles.doneBtnText}>Save Vehicle Order</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 520,
  },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  tipText: {
    fontSize: 12,
    color: '#1E40AF',
    flex: 1,
  },
  itemRow: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: GAP,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  itemRowActive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#2563EB',
    borderWidth: 1.5,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  indexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  indexBadgeActive: {
    backgroundColor: '#2563EB',
  },
  indexText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  indexTextActive: {
    color: '#FFFFFF',
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  vehicleFinancier: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  microBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginRight: 8,
  },
  microBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  microBtnDisabled: {
    opacity: 0.4,
    borderColor: '#F1F5F9',
  },
  dragHandle: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHandleActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  doneBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
