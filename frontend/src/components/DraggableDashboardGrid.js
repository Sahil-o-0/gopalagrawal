import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const NUM_COLUMNS = 2;
const GAP = 10;
const PADDING_HORIZONTAL = 14;
const STORAGE_KEY_PREFIX = '@dashboard_grid_order_v5_';

const TOP_SCROLL_EDGE = 220; // px from top of screen
const BOTTOM_SCROLL_EDGE_OFFSET = 180; // px from bottom of screen

export default function DraggableDashboardGrid({
  items = [],
  onItemPress,
  isLockedItem,
  storageKey = 'default',
  scrollViewRef,
  scrollYRef,
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const gridWidth = windowWidth - (PADDING_HORIZONTAL * 2);
  const itemWidth = Math.floor((gridWidth - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS);
  
  // Ergonomic card height with ample space for multi-line titles and large fonts
  const itemHeight = Math.max(106, Math.floor(itemWidth * 0.78));

  const [orderedItems, setOrderedItems] = useState([]);
  const [activeDragId, setActiveDragId] = useState(null);

  // References for drag coordinates & animation values
  const positionsRef = useRef({}); // itemId -> { currentSlotIndex, pan: Animated.ValueXY, scale: Animated.Value }
  const currentOrderRef = useRef([]); // array of itemIds in order
  const activeDragIdRef = useRef(null);
  const startDragCoordRef = useRef({ x: 0, y: 0 });
  const startTouchRef = useRef({ pageX: 0, pageY: 0, time: 0 });
  const currentHoverSlotRef = useRef(0);
  const startScrollYRef = useRef(0);
  const lastTouchRef = useRef({ pageX: 0, pageY: 0 });
  const autoScrollTimerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Helper to get (x, y) for slot index
  const getSlotPosition = useCallback((slotIndex) => {
    const col = slotIndex % NUM_COLUMNS;
    const row = Math.floor(slotIndex / NUM_COLUMNS);
    return {
      x: col * (itemWidth + GAP),
      y: row * (itemHeight + GAP),
    };
  }, [itemWidth, itemHeight]);

  // Load saved order from AsyncStorage and reconcile with current items
  useEffect(() => {
    let isMounted = true;

    async function loadSavedOrder() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + storageKey);
        let reconciled = [...items];

        if (saved) {
          const savedIds = JSON.parse(saved);
          const itemMap = new Map(items.map((it) => [it.id, it]));
          const sorted = [];

          savedIds.forEach((id) => {
            if (itemMap.has(id)) {
              sorted.push(itemMap.get(id));
              itemMap.delete(id);
            }
          });

          // Append any new items not yet in saved order
          itemMap.forEach((it) => sorted.push(it));
          reconciled = sorted;
        }

        if (isMounted) {
          setOrderedItems(reconciled);
          currentOrderRef.current = reconciled.map((it) => it.id);
        }
      } catch (err) {
        if (isMounted) {
          setOrderedItems(items);
          currentOrderRef.current = items.map((it) => it.id);
        }
      }
    }

    loadSavedOrder();

    return () => {
      isMounted = false;
      stopAutoScroll();
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      isDraggingRef.current = false;
      activeDragIdRef.current = null;
    };
  }, [items, storageKey]);

  // Ensure Animated values exist for each item
  orderedItems.forEach((item, index) => {
    if (!positionsRef.current[item.id]) {
      const pos = getSlotPosition(index);
      positionsRef.current[item.id] = {
        currentSlotIndex: index,
        pan: new Animated.ValueXY({ x: pos.x, y: pos.y }),
        scale: new Animated.Value(1),
      };
    } else {
      positionsRef.current[item.id].currentSlotIndex = index;
    }
  });

  // Re-sync positions when orderedItems changes and not dragging
  useEffect(() => {
    if (activeDragIdRef.current) return;

    orderedItems.forEach((item, index) => {
      const posObj = positionsRef.current[item.id];
      if (posObj) {
        posObj.currentSlotIndex = index;
        const targetPos = getSlotPosition(index);
        Animated.parallel([
          Animated.spring(posObj.pan, {
            toValue: targetPos,
            friction: 8,
            tension: 65,
            useNativeDriver: false,
          }),
          Animated.spring(posObj.scale, {
            toValue: 1,
            friction: 7,
            useNativeDriver: false,
          }),
        ]).start();
      }
    });
  }, [orderedItems, getSlotPosition]);

  // Calculate closest slot index given an (x, y) offset within the grid container
  const findClosestSlot = (x, y) => {
    const col = Math.min(
      NUM_COLUMNS - 1,
      Math.max(0, Math.floor((x + itemWidth / 2) / (itemWidth + GAP)))
    );
    const row = Math.max(
      0,
      Math.floor((y + itemHeight / 2) / (itemHeight + GAP))
    );
    const totalSlots = orderedItems.length;
    const calculatedSlot = row * NUM_COLUMNS + col;
    return Math.min(totalSlots - 1, Math.max(0, calculatedSlot));
  };

  // Reorder slots dynamically while dragging
  const reorderSlots = (draggedId, fromIndex, toIndex) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= orderedItems.length) return;

    const newOrderIds = [...currentOrderRef.current];
    const [movedId] = newOrderIds.splice(fromIndex, 1);
    newOrderIds.splice(toIndex, 0, movedId);
    currentOrderRef.current = newOrderIds;

    // Animate all OTHER items to their newly assigned slots
    newOrderIds.forEach((id, slotIndex) => {
      if (id !== draggedId && positionsRef.current[id]) {
        positionsRef.current[id].currentSlotIndex = slotIndex;
        const targetPos = getSlotPosition(slotIndex);
        Animated.spring(positionsRef.current[id].pan, {
          toValue: targetPos,
          friction: 7,
          tension: 75,
          useNativeDriver: false,
        }).start();
      }
    });

    try {
      Haptics.selectionAsync();
    } catch (_) {}
  };

  // Stop auto-scrolling
  const stopAutoScroll = () => {
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  };

  // Check and run auto-scrolling if finger is in edge zones
  const handleAutoScroll = () => {
    if (!scrollViewRef?.current || !activeDragIdRef.current) {
      stopAutoScroll();
      return;
    }

    const { pageY } = lastTouchRef.current;
    const bottomEdge = windowHeight - BOTTOM_SCROLL_EDGE_OFFSET;

    let scrollSpeed = 0;

    if (pageY > 0 && pageY < TOP_SCROLL_EDGE) {
      const ratio = Math.min(1, Math.max(0, (TOP_SCROLL_EDGE - pageY) / TOP_SCROLL_EDGE));
      scrollSpeed = -1 * Math.round(8 + ratio * 24);
    } else if (pageY > bottomEdge) {
      const ratio = Math.min(1, Math.max(0, (pageY - bottomEdge) / BOTTOM_SCROLL_EDGE_OFFSET));
      scrollSpeed = Math.round(8 + ratio * 24);
    }

    if (scrollSpeed === 0) {
      stopAutoScroll();
      return;
    }

    if (!autoScrollTimerRef.current) {
      autoScrollTimerRef.current = setInterval(() => {
        if (!activeDragIdRef.current || !scrollViewRef?.current) {
          stopAutoScroll();
          return;
        }

        const currentScrollY = scrollYRef?.current || 0;
        const nextScrollY = Math.max(0, currentScrollY + scrollSpeed);

        if (nextScrollY !== currentScrollY) {
          if (scrollYRef) scrollYRef.current = nextScrollY;
          scrollViewRef.current.scrollTo({ y: nextScrollY, animated: false });

          // Update dragged card coordinates accounting for screen scroll
          const itemId = activeDragIdRef.current;
          const currentPos = positionsRef.current[itemId];
          if (currentPos) {
            const startPos = startDragCoordRef.current;
            const scrollDiff = nextScrollY - startScrollYRef.current;
            const dx = lastTouchRef.current.pageX - startTouchRef.current.pageX;
            const dy = lastTouchRef.current.pageY - startTouchRef.current.pageY;
            const newX = startPos.x + dx;
            const newY = startPos.y + dy + scrollDiff;

            currentPos.pan.setValue({ x: newX, y: newY });

            const hoveredSlot = findClosestSlot(newX, newY);
            if (hoveredSlot !== currentHoverSlotRef.current) {
              const prevSlot = currentHoverSlotRef.current;
              currentHoverSlotRef.current = hoveredSlot;
              reorderSlots(itemId, prevSlot, hoveredSlot);
            }
          }
        }
      }, 16);
    }
  };

  // Activate drag mode after long press
  const activateDrag = (item, index) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    const slotIndex = currentOrderRef.current.indexOf(item.id);
    const resolvedSlot = slotIndex >= 0 ? slotIndex : index;
    const startCoord = getSlotPosition(resolvedSlot);

    isDraggingRef.current = true;
    activeDragIdRef.current = item.id;
    setActiveDragId(item.id);
    startDragCoordRef.current = startCoord;
    currentHoverSlotRef.current = resolvedSlot;
    startScrollYRef.current = scrollYRef?.current || 0;

    // Temporarily disable parent scrolling via nativeProps without re-rendering React tree
    scrollViewRef?.current?.setNativeProps?.({ scrollEnabled: false });

    const posObj = positionsRef.current[item.id];
    if (posObj) {
      Animated.spring(posObj.scale, {
        toValue: 1.07,
        friction: 6,
        tension: 80,
        useNativeDriver: false,
      }).start();
    }
  };

  // Cleanly finalize drag state
  const finalizeDrag = async (itemId) => {
    stopAutoScroll();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Re-enable parent scrolling via nativeProps
    scrollViewRef?.current?.setNativeProps?.({ scrollEnabled: true });

    const wasDragging = isDraggingRef.current;
    const targetId = activeDragIdRef.current || itemId;

    isDraggingRef.current = false;
    activeDragIdRef.current = null;
    setActiveDragId(null);

    if (wasDragging && targetId) {
      const currentPos = positionsRef.current[targetId];
      const finalSlot = currentHoverSlotRef.current;

      if (currentPos) {
        const finalCoord = getSlotPosition(finalSlot);
        Animated.parallel([
          Animated.spring(currentPos.pan, {
            toValue: finalCoord,
            friction: 7,
            tension: 70,
            useNativeDriver: false,
          }),
          Animated.spring(currentPos.scale, {
            toValue: 1,
            friction: 7,
            tension: 70,
            useNativeDriver: false,
          }),
        ]).start();
      }

      // Ensure all scales are reset to 1
      Object.keys(positionsRef.current).forEach((id) => {
        if (positionsRef.current[id]) {
          Animated.spring(positionsRef.current[id].scale, {
            toValue: 1,
            friction: 7,
            useNativeDriver: false,
          }).start();
        }
      });

      // Commit state
      const itemMap = new Map(orderedItems.map((it) => [it.id, it]));
      const updatedList = currentOrderRef.current
        .map((id) => itemMap.get(id))
        .filter(Boolean);

      setOrderedItems(updatedList);

      // Save order
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY_PREFIX + storageKey,
          JSON.stringify(currentOrderRef.current)
        );
      } catch (_) {}

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}
    } else {
      // Reset all scales
      Object.keys(positionsRef.current).forEach((id) => {
        if (positionsRef.current[id]) {
          Animated.spring(positionsRef.current[id].scale, {
            toValue: 1,
            friction: 7,
            useNativeDriver: false,
          }).start();
        }
      });
    }
  };

  // Touch Handlers for each card
  const handleTouchStart = (item, index, evt) => {
    const { pageX, pageY } = evt.nativeEvent;
    startTouchRef.current = { pageX, pageY, time: Date.now() };
    lastTouchRef.current = { pageX, pageY };

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      activateDrag(item, index);
    }, 220);
  };

  const handleTouchMove = (item, index, evt) => {
    const { pageX, pageY } = evt.nativeEvent;
    lastTouchRef.current = { pageX, pageY };

    if (!isDraggingRef.current) {
      // If finger moved > 6px before long press fires, user is scrolling -> cancel drag timer
      const dist = Math.hypot(
        pageX - startTouchRef.current.pageX,
        pageY - startTouchRef.current.pageY
      );
      if (dist > 6) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
      return;
    }

    if (activeDragIdRef.current !== item.id) return;

    const currentPos = positionsRef.current[item.id];
    if (!currentPos) return;

    const currentScrollY = scrollYRef?.current || 0;
    const scrollDiff = currentScrollY - startScrollYRef.current;
    const startPos = startDragCoordRef.current;
    const dx = pageX - startTouchRef.current.pageX;
    const dy = pageY - startTouchRef.current.pageY;
    const newX = startPos.x + dx;
    const newY = startPos.y + dy + scrollDiff;

    currentPos.pan.setValue({ x: newX, y: newY });

    // Dynamic slot recalculation
    const hoveredSlot = findClosestSlot(newX, newY);
    if (hoveredSlot !== currentHoverSlotRef.current) {
      const prevSlot = currentHoverSlotRef.current;
      currentHoverSlotRef.current = hoveredSlot;
      reorderSlots(item.id, prevSlot, hoveredSlot);
    }

    handleAutoScroll();
  };

  const handleTouchEnd = (item, index, evt) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!isDraggingRef.current) {
      const pressDuration = Date.now() - startTouchRef.current.time;
      const { pageX, pageY } = evt.nativeEvent;
      const dist = Math.hypot(
        pageX - startTouchRef.current.pageX,
        pageY - startTouchRef.current.pageY
      );

      // Quick tap -> Navigate
      if (dist < 10 && pressDuration < 320) {
        if (onItemPress) {
          onItemPress(item);
        }
      }
    } else {
      // Was dragging or long-held -> normalize smoothly
      finalizeDrag(item.id);
    }
  };

  const totalRows = Math.ceil(orderedItems.length / NUM_COLUMNS);
  const containerHeight = totalRows * itemHeight + (totalRows - 1) * GAP;

  return (
    <View style={styles.wrapper}>
      {/* Header Info Row */}
      <View style={styles.infoRow}>
        <Text style={styles.sectionLabel}>PAGES & APPS</Text>
        <View style={styles.rearrangeHint}>
          <MaterialCommunityIcons name="gesture-tap-hold" size={12} color="#64748B" />
          <Text style={styles.hintText}>Hold & drag to arrange</Text>
        </View>
      </View>

      <View style={[styles.gridContainer, { height: containerHeight, width: gridWidth }]}>
        {orderedItems.map((item, index) => {
          const isDragging = activeDragId === item.id;
          const posObj = positionsRef.current[item.id];
          const isLocked = isLockedItem ? isLockedItem(item) : false;

          const panStyle = posObj
            ? {
                transform: [
                  { translateX: posObj.pan.x },
                  { translateY: posObj.pan.y },
                  { scale: posObj.scale },
                ],
                zIndex: isDragging ? 9999 : 1,
                elevation: isDragging ? 16 : 2,
              }
            : {
                ...getSlotPosition(index),
                zIndex: 1,
              };

          return (
            <Animated.View
              key={item.id}
              style={[
                styles.cardBox,
                {
                  width: itemWidth,
                  height: itemHeight,
                  backgroundColor: item.color || '#FFFFFF',
                  borderColor: isDragging ? item.accent || '#3B82F6' : '#E2E8F0',
                },
                panStyle,
                isDragging && styles.cardBoxDragging,
              ]}
              onTouchStart={(e) => handleTouchStart(item, index, e)}
              onTouchMove={(e) => handleTouchMove(item, index, e)}
              onTouchEnd={(e) => handleTouchEnd(item, index, e)}
              onTouchCancel={() => finalizeDrag(item.id)}
            >
              <View style={styles.innerCardContent}>
                {/* Top Row: Icon + Lock / Reorder grip */}
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.iconBadge,
                      { backgroundColor: item.accent ? item.accent + '15' : '#EFF6FF' },
                    ]}
                  >
                    <Text style={styles.cardEmoji}>{item.icon}</Text>
                  </View>

                  {isLocked ? (
                    <View style={styles.lockBadge}>
                      <Text style={styles.lockIcon}>🔒</Text>
                    </View>
                  ) : (
                    <MaterialCommunityIcons
                      name="drag-horizontal-variant"
                      size={15}
                      color="#94A3B8"
                      style={styles.dragGrip}
                    />
                  )}
                </View>

                {/* Card Title & Subtitle */}
                <View style={styles.cardBody}>
                  <Text
                    style={[styles.cardTitle, { color: item.accent || '#1E293B' }]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                </View>

                {/* Bottom Accent Bar */}
                <View
                  style={[
                    styles.bottomAccentBar,
                    { backgroundColor: item.accent || '#3B82F6' },
                  ]}
                />
              </View>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 14,
    paddingHorizontal: PADDING_HORIZONTAL,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  rearrangeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  hintText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  gridContainer: {
    position: 'relative',
  },
  cardBox: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 1.5,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  cardBoxDragging: {
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    backgroundColor: '#FFFFFF',
  },
  innerCardContent: {
    flex: 1,
    padding: 9,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 16,
  },
  dragGrip: {
    opacity: 0.5,
  },
  lockBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  lockIcon: {
    fontSize: 10,
  },
  cardBody: {
    marginTop: 2,
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 9.5,
    color: '#64748B',
    marginTop: 2,
  },
  bottomAccentBar: {
    height: 2.5,
    borderRadius: 2,
    width: '32%',
    marginTop: 3,
  },
});
