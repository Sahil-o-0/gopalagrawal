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

const TOP_SCROLL_EDGE = 220; // px from top of screen
const BOTTOM_SCROLL_EDGE_OFFSET = 180; // px from bottom of screen

export default function DraggableCardList({
  items = [],
  itemHeight = 175,
  gap = 12,
  paddingHorizontal = 16,
  renderItem,
  onOrderChange,
  storageKey = 'default_vertical_list',
  scrollViewRef,
  scrollYRef,
  dragHint = 'Hold & drag to arrange order',
}) {
  const { height: windowHeight } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);

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
    return {
      x: 0,
      y: slotIndex * (itemHeight + gap),
    };
  }, [itemHeight, gap]);

  // Load saved order from AsyncStorage and reconcile with current items
  useEffect(() => {
    let isMounted = true;

    async function loadSavedOrder() {
      try {
        const saved = await AsyncStorage.getItem(storageKey);
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
    if (activeDragIdRef.current || isDraggingRef.current) return;

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

  // Calculate closest slot index given y offset within container
  const findClosestSlot = (y) => {
    const totalSlots = currentOrderRef.current.length || orderedItems.length;
    if (totalSlots <= 0) return 0;
    const calculatedSlot = Math.round(y / (itemHeight + gap));
    return Math.min(totalSlots - 1, Math.max(0, calculatedSlot));
  };

  // Reorder slots dynamically while dragging - safely using actual index in currentOrderRef
  const reorderSlots = (draggedId, toIndex) => {
    const currentOrder = currentOrderRef.current;
    const fromIndex = currentOrder.indexOf(draggedId);
    if (fromIndex === -1 || fromIndex === toIndex || toIndex < 0 || toIndex >= currentOrder.length) return;

    const newOrderIds = [...currentOrder];
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
            const dy = lastTouchRef.current.pageY - startTouchRef.current.pageY;
            const newY = startPos.y + dy + scrollDiff;

            currentPos.pan.setValue({ x: 0, y: newY });

            const hoveredSlot = findClosestSlot(newY);
            if (hoveredSlot !== currentHoverSlotRef.current) {
              currentHoverSlotRef.current = hoveredSlot;
              reorderSlots(itemId, hoveredSlot);
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

    // Re-enable parent scrolling via nativeProps
    scrollViewRef?.current?.setNativeProps?.({ scrollEnabled: true });

    const wasDragging = isDraggingRef.current;
    const targetId = activeDragIdRef.current || itemId;

    isDraggingRef.current = false;
    activeDragIdRef.current = null;
    setActiveDragId(null);

    if (wasDragging && targetId) {
      const currentPos = positionsRef.current[targetId];
      const resolvedSlot = currentOrderRef.current.indexOf(targetId);
      const finalSlot = resolvedSlot >= 0 ? resolvedSlot : currentHoverSlotRef.current;

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

      // Commit state
      const itemMap = new Map(orderedItems.map((it) => [it.id, it]));
      const updatedList = currentOrderRef.current
        .map((id) => itemMap.get(id))
        .filter(Boolean);

      setOrderedItems(updatedList);

      if (onOrderChange) {
        onOrderChange(updatedList);
      }

      // Save order
      try {
        await AsyncStorage.setItem(
          storageKey,
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
      // If finger moved > 8px before long press fires, user is scrolling -> cancel drag timer
      const dist = Math.hypot(
        pageX - startTouchRef.current.pageX,
        pageY - startTouchRef.current.pageY
      );
      if (dist > 8) {
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
    const dy = pageY - startTouchRef.current.pageY;
    const newY = startPos.y + dy + scrollDiff;

    currentPos.pan.setValue({ x: 0, y: newY });

    // Dynamic slot recalculation
    const hoveredSlot = findClosestSlot(newY);
    if (hoveredSlot !== currentHoverSlotRef.current) {
      currentHoverSlotRef.current = hoveredSlot;
      reorderSlots(item.id, hoveredSlot);
    }

    handleAutoScroll();
  };

  const handleTouchEnd = (item, index, evt) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isDraggingRef.current) {
      finalizeDrag(item.id);
    }
  };

  const totalSlots = orderedItems.length;
  const containerHeight = totalSlots > 0 ? totalSlots * itemHeight + Math.max(0, totalSlots - 1) * gap : 0;

  return (
    <View 
      style={[styles.wrapper, paddingHorizontal > 0 ? { paddingHorizontal } : null]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerWidth) > 1) {
          setContainerWidth(w);
        }
      }}
    >
      {dragHint ? (
        <View style={styles.hintRow}>
          <MaterialCommunityIcons name="gesture-tap-hold" size={13} color="#64748B" />
          <Text style={styles.hintText}>{dragHint}</Text>
        </View>
      ) : null}

      <View style={[styles.listContainer, { height: containerHeight, width: '100%' }]}>
        {orderedItems.map((item, index) => {
          const isDragging = activeDragId === item.id;
          const posObj = positionsRef.current[item.id];

          const panStyle = posObj
            ? {
                transform: [
                  { translateY: posObj.pan.y },
                  { scale: posObj.scale },
                ],
                zIndex: isDragging ? 9999 : 1,
                elevation: isDragging ? 16 : 2,
              }
            : {
                transform: [{ translateY: getSlotPosition(index).y }],
                zIndex: 1,
              };

          return (
            <Animated.View
              key={item.id}
              style={[
                styles.cardBox,
                {
                  height: itemHeight,
                },
                panStyle,
                isDragging && styles.cardBoxDragging,
              ]}
              onTouchStart={(e) => handleTouchStart(item, index, e)}
              onTouchMove={(e) => handleTouchMove(item, index, e)}
              onTouchEnd={(e) => handleTouchEnd(item, index, e)}
              onTouchCancel={() => finalizeDrag(item.id)}
            >
              {renderItem(item, index, isDragging)}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hintText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  listContainer: {
    position: 'relative',
    width: '100%',
  },
  cardBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
  },
  cardBoxDragging: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
});
