import React, { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  Keyboard, PanResponder, Animated, Dimensions, BackHandler,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  backgroundColor?: string;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, backgroundColor = '#fff', children }: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const offsetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const dragStartY = useRef(0);

  function animateOpen() {
    Animated.parallel([
      Animated.spring(offsetY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 280,
        overshootClamping: true,
      }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }

  function animateClose(cb?: () => void) {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(offsetY, { toValue: SCREEN_HEIGHT, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 230, useNativeDriver: true }),
    ]).start(() => cb?.());
  }

  useEffect(() => {
    if (visible) {
      offsetY.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
      setMounted(true);
      requestAnimationFrame(() => animateOpen());
    } else if (mounted) {
      animateClose(() => setMounted(false));
    }
  }, [visible]);

  // Hardware back button dismisses the sheet
  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [mounted, onClose]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && gs.dy > Math.abs(gs.dx),
      onPanResponderGrant: () => {
        offsetY.stopAnimation(v => { dragStartY.current = v; });
      },
      onPanResponderMove: (_, gs) => {
        const next = Math.max(0, dragStartY.current + gs.dy);
        offsetY.setValue(next);
      },
      onPanResponderRelease: (_, gs) => {
        const curr = dragStartY.current + gs.dy;
        if (curr > 120 || gs.vy > 0.7) {
          onClose();
        } else {
          dragStartY.current = 0;
          Animated.spring(offsetY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 300,
            overshootClamping: true,
          }).start();
        }
      },
    })
  ).current;

  if (!mounted) return null;

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { backgroundColor, transform: [{ translateY: offsetY }] }]}>
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          contentContainerStyle={styles.scrollContent}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 99,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 24,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D0D0',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
});
