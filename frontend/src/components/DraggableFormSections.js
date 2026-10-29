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

const GAP = 10;
const PADDING_HORIZONTAL = 2;
const STORAGE_KEY = '@compliance_form_section_order_v1';

export default function DraggableFormSections({
  sections = [],
  scrollViewRef,
  scrollYRef,
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [orderedSections, setOrderedSections] = useState([]);
  const [activeDragId, setActiveDragId] = useState(null);

  const containerRef = useRef(null);
  const containerBoundsRef = useRef({ pageY: 150, height: 500 });

  const positionsRef = useRef({}); // id -> { currentSlot, pan: Animated.ValueXY, scale: Animated.Value, height }
  const currentOrderRef = useRef([]); // array of ids
  const activeDragIdRef = useRef(null);
  const startDragCoordRef = useRef({ x: 0, y: 0 });
  const startTouchRef = useRef({ pageX: 0, pageY: 0, time: 0 });
  const currentHoverSlotRef = useRef(0);
  const startScrollYRef = useRef(0);
  const lastTouchRef = useRef({ pageX: 0, pageY: 0 });
  const autoScrollTimerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Measure container position in window
  const measureContainer = () => {
    if (containerRef.current?.measureInWindow) {
      containerRef.current.measureInWindow((x, y, width, height) => {
        if (height > 0) {
          containerBoundsRef.current = { pageY: y, height };
        }
      });
    }
  };

  // Calculate cumulative Y for each slot
  const getSlotY = useCallback((slotIndex) => {
    let currentY = 0;
    for (let i = 0; i < slotIndex; i++) {
      const id = currentOrderRef.current[i];
      const section = sections.find((s) => s.id === id);
      const h = section?.height || 92;
      currentY += h + GAP;
    }
    return currentY;
  }, [sections]);

  // Load saved order from AsyncStorage once on mount or when section IDs change
  const sectionIdsKey = sections.map((s) => s.id).join(',');
  useEffect(() => {
    let isMounted = true;

    async function loadSavedOrder() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        let reconciled = [...sections];

        if (saved) {
          const savedIds = JSON.parse(saved);
          const secMap = new Map(sections.map((s) => [s.id, s]));
          const sorted = [];

          savedIds.forEach((id) => {
            if (secMap.has(id)) {
              sorted.push(secMap.get(id));
              secMap.delete(id);
            }
          });

          secMap.forEach((s) => sorted.push(s));
          reconciled = sorted;
        }

        if (isMounted) {
          setOrderedSections(reconciled);
          currentOrderRef.current = reconciled.map((s) => s.id);
        }
      } catch (_) {
        if (isMounted) {
          setOrderedSections(sections);
          currentOrderRef.current = sections.map((s) => s.id);
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
  }, [sectionIdsKey]);

  // Initialize Animated values for each section
  orderedSections.forEach((sec, index) => {
    const secDef = sections.find((s) => s.id === sec.id) || sec;
    const h = secDef.height || 92;
    if (!positionsRef.current[sec.id]) {
      const y = getSlotY(index);
      positionsRef.current[sec.id] = {
        currentSlotIndex: index,
        pan: new Animated.ValueXY({ x: 0, y }),
        scale: new Animated.Value(1),
        height: h,
      };
    } else {
      positionsRef.current[sec.id].currentSlotIndex = index;
      positionsRef.current[sec.id].height = h;
    }
  });

  // Re-sync positions when orderedSections changes and not dragging
  useEffect(() => {
    if (activeDragIdRef.current) return;

    orderedSections.forEach((sec, index) => {
      const posObj = positionsRef.current[sec.id];
      if (posObj) {
        posObj.currentSlotIndex = index;
        const targetY = getSlotY(index);
        Animated.parallel([
          Animated.spring(posObj.pan, {
            toValue: { x: 0, y: targetY },
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
  }, [orderedSections, getSlotY]);

  // Calculate closest slot index for a given Y coordinate
  const findClosestSlot = (y) => {
    const totalSlots = orderedSections.length;
    let accumulatedY = 0;
    for (let i = 0; i < totalSlots; i++) {
      const id = currentOrderRef.current[i];
      const sec = sections.find((s) => s.id === id);
      const h = sec?.height || 92;
      const mid = accumulatedY + h / 2;
      if (y < mid) {
        return Math.max(0, i);
      }
      accumulatedY += h + GAP;
    }
    return totalSlots - 1;
  };

  // Reorder slots dynamically while dragging
  const reorderSlots = (draggedId, fromIndex, toIndex) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= orderedSections.length) return;

    const newOrderIds = [...currentOrderRef.current];
    const [movedId] = newOrderIds.splice(fromIndex, 1);
    newOrderIds.splice(toIndex, 0, movedId);
    currentOrderRef.current = newOrderIds;

    let accumY = 0;
    newOrderIds.forEach((id, slotIndex) => {
      const sec = sections.find((s) => s.id === id);
      const h = sec?.height || 92;

      if (id !== draggedId && positionsRef.current[id]) {
        positionsRef.current[id].currentSlotIndex = slotIndex;
        Animated.spring(positionsRef.current[id].pan, {
          toValue: { x: 0, y: accumY },
          friction: 7,
          tension: 75,
          useNativeDriver: false,
        }).start();
      }
      accumY += h + GAP;
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

  // Check and run auto-scrolling relative to modal viewport
  const handleAutoScroll = () => {
    if (!scrollViewRef?.current || !activeDragIdRef.current) {
      stopAutoScroll();
      return;
    }

    const { pageY } = lastTouchRef.current;
    const { pageY: containerTop, height: containerHeight } = containerBoundsRef.current;

    // Trigger auto-scroll when within 140px of visible top or bottom of container
    const topScrollZone = Math.max(80, containerTop + 130);
    const bottomScrollZone = Math.min(windowHeight - 80, containerTop + containerHeight - 110);

    let scrollSpeed = 0;

    if (pageY > 0 && pageY < topScrollZone) {
      const ratio = Math.min(1, Math.max(0, (topScrollZone - pageY) / 130));
      scrollSpeed = -1 * Math.round(8 + ratio * 22);
    } else if (pageY > bottomScrollZone) {
      const ratio = Math.min(1, Math.max(0, (pageY - bottomScrollZone) / 110));
      scrollSpeed = Math.round(8 + ratio * 22);
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

          const itemId = activeDragIdRef.current;
          const currentPos = positionsRef.current[itemId];
          if (currentPos) {
            const startPos = startDragCoordRef.current;
            const scrollDiff = nextScrollY - startScrollYRef.current;
            const dy = lastTouchRef.current.pageY - startTouchRef.current.pageY;
            const newY = startPos.y + dy + scrollDiff;

            currentPos.pan.setValue({ x: 0, y: newY });

            const hoveredSlot = findClosestSlot(newY);
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
  const activateDrag = (sec, index) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    measureContainer();

    const slotIndex = currentOrderRef.current.indexOf(sec.id);
    const resolvedSlot = slotIndex >= 0 ? slotIndex : index;
    const startY = getSlotY(resolvedSlot);

    isDraggingRef.current = true;
    activeDragIdRef.current = sec.id;
    setActiveDragId(sec.id);
    startDragCoordRef.current = { x: 0, y: startY };
    currentHoverSlotRef.current = resolvedSlot;
    startScrollYRef.current = scrollYRef?.current || 0;

    scrollViewRef?.current?.setNativeProps?.({ scrollEnabled: false });

    const posObj = positionsRef.current[sec.id];
    if (posObj) {
      Animated.spring(posObj.scale, {
        toValue: 1.04,
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

    scrollViewRef?.current?.setNativeProps?.({ scrollEnabled: true });

    const wasDragging = isDraggingRef.current;
    const targetId = activeDragIdRef.current || itemId;

    isDraggingRef.current = false;
    activeDragIdRef.current = null;
    setActiveDragId(null);

    if (wasDragging && targetId) {
      const currentPos = positionsRef.current[targetId];
      const finalSlot = currentHoverSlotRef.current;
      const finalY = getSlotY(finalSlot);

      if (currentPos) {
        Animated.parallel([
          Animated.spring(currentPos.pan, {
            toValue: { x: 0, y: finalY },
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

      // Reset scales
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
      const secMap = new Map(orderedSections.map((s) => [s.id, s]));
      const updatedList = currentOrderRef.current
        .map((id) => secMap.get(id))
        .filter(Boolean);

      setOrderedSections(updatedList);

      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(currentOrderRef.current)
        );
      } catch (_) {}

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}
    } else {
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

  // Touch handlers on section headers/drag handle
  const handleTouchStart = (sec, index, evt) => {
    measureContainer();
    const { pageX, pageY } = evt.nativeEvent;
    startTouchRef.current = { pageX, pageY, time: Date.now() };
    lastTouchRef.current = { pageX, pageY };

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      activateDrag(sec, index);
    }, 200);
  };

  const handleTouchMove = (sec, index, evt) => {
    const { pageX, pageY } = evt.nativeEvent;
    lastTouchRef.current = { pageX, pageY };

    if (!isDraggingRef.current) {
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

    if (activeDragIdRef.current !== sec.id) return;

    const currentPos = positionsRef.current[sec.id];
    if (!currentPos) return;

    const currentScrollY = scrollYRef?.current || 0;
    const scrollDiff = currentScrollY - startScrollYRef.current;
    const startPos = startDragCoordRef.current;
    const dy = pageY - startTouchRef.current.pageY;
    const newY = startPos.y + dy + scrollDiff;

    currentPos.pan.setValue({ x: 0, y: newY });

    const hoveredSlot = findClosestSlot(newY);
    if (hoveredSlot !== currentHoverSlotRef.current) {
      const prevSlot = currentHoverSlotRef.current;
      currentHoverSlotRef.current = hoveredSlot;
      reorderSlots(sec.id, prevSlot, hoveredSlot);
    }

    handleAutoScroll();
  };

  const handleTouchEnd = (sec) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    finalizeDrag(sec.id);
  };

  // Calculate container height dynamically using latest section heights
  const containerHeight = orderedSections.reduce((acc, s) => {
    const secDef = sections.find((x) => x.id === s.id) || s;
    return acc + (secDef.height || 92) + GAP;
  }, 0);

  return (
    <View
      ref={containerRef}
      onLayout={measureContainer}
      style={styles.wrapper}
    >
      {/* Header Info Banner */}
      <View style={styles.rearrangeBar}>
        <MaterialCommunityIcons name="gesture-tap-hold" size={13} color="#64748B" />
        <Text style={styles.rearrangeText}>Hold & drag header to rearrange form fields</Text>
      </View>

      <View style={[styles.container, { height: containerHeight }]}>
        {orderedSections.map((sec, index) => {
          const isDragging = activeDragId === sec.id;
          const posObj = positionsRef.current[sec.id];
          const secDef = sections.find((s) => s.id === sec.id) || sec;
          const secHeight = secDef.height || 92;

          const panStyle = posObj
            ? {
                transform: [
                  { translateY: posObj.pan.y },
                  { scale: posObj.scale },
                ],
                zIndex: isDragging ? 9999 : 1,
                elevation: isDragging ? 14 : 1,
              }
            : {
                top: getSlotY(index),
                zIndex: 1,
              };

          return (
            <Animated.View
              key={sec.id}
              style={[
                styles.sectionCard,
                {
                  height: secHeight,
                  borderColor: isDragging ? sec.color || '#2563EB' : '#E2E8F0',
                  borderWidth: isDragging ? 2 : 1,
                },
                panStyle,
                isDragging && styles.sectionCardDragging,
              ]}
            >
              {/* Drag Header Grip */}
              <View
                style={[
                  styles.dragHeader,
                  { backgroundColor: sec.color ? sec.color + '0E' : '#F8FAFC' },
                ]}
                onTouchStart={(e) => handleTouchStart(sec, index, e)}
                onTouchMove={(e) => handleTouchMove(sec, index, e)}
                onTouchEnd={() => handleTouchEnd(sec)}
                onTouchCancel={() => finalizeDrag(sec.id)}
              >
                <View style={styles.dragHeaderTitleRow}>
                  <MaterialCommunityIcons
                    name={sec.icon || 'file-document'}
                    size={15}
                    color={sec.color || '#2563EB'}
                  />
                  <Text style={[styles.dragHeaderTitle, { color: sec.color || '#1E293B' }]}>
                    {sec.title}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="drag-horizontal-variant"
                  size={16}
                  color="#94A3B8"
                />
              </View>

              {/* Section Form Content */}
              <View style={styles.sectionBody}>
                {secDef.renderContent ? secDef.renderContent() : sec.renderContent()}
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
    marginTop: 6,
    paddingHorizontal: PADDING_HORIZONTAL,
  },
  rearrangeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
    gap: 5,
  },
  rearrangeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  container: {
    position: 'relative',
    width: '100%',
  },
  sectionCard: {
    position: 'absolute',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  sectionCardDragging: {
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    backgroundColor: '#FFFFFF',
  },
  dragHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dragHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dragHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  sectionBody: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    flex: 1,
    justifyContent: 'center',
  },
});
