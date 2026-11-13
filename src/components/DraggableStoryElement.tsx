import React, { useRef, useState, useEffect } from "react";
import {
  Animated,
  PanResponder,
  StyleProp,
  ViewStyle,
  View,
  TouchableOpacity,
  Dimensions,
} from "react-native";

export interface Position {
  x: number;
  y: number;
}

interface DraggableStoryElementProps {
  initialPosition?: Position;
  onPositionChange?: (pos: Position) => void;
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  dragScale?: number;
  enabled?: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function DraggableStoryElement({
  initialPosition = { x: 0, y: 0 },
  onPositionChange,
  onPress,
  children,
  style,
  dragScale = 1.05,
  enabled = true,
}: DraggableStoryElementProps) {
  const pan = useRef(new Animated.ValueXY({ x: initialPosition.x, y: initialPosition.y })).current;
  const currentPos = useRef<Position>({ x: initialPosition.x, y: initialPosition.y });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Sync if initialPosition changes drastically from outside
    currentPos.current = { x: initialPosition.x, y: initialPosition.y };
    pan.setValue({ x: initialPosition.x, y: initialPosition.y });
  }, [initialPosition.x, initialPosition.y]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!enabled) return false;
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (!enabled) return false;
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
        setIsDragging(true);
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        setIsDragging(false);

        let finalX = (pan.x as any)._value;
        let finalY = (pan.y as any)._value;

        // Keep inside reasonable screen bounds
        finalX = Math.max(-50, Math.min(SCREEN_WIDTH - 60, finalX));
        finalY = Math.max(30, Math.min(SCREEN_HEIGHT - 120, finalY));

        currentPos.current = { x: finalX, y: finalY };
        pan.setValue({ x: finalX, y: finalY });

        const isTap = Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6;
        if (isTap && onPress) {
          onPress();
        } else if (onPositionChange) {
          onPositionChange({ x: finalX, y: finalY });
        }
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        setIsDragging(false);
      },
    })
  ).current;

  return (
    <Animated.View
      {...(enabled ? panResponder.panHandlers : {})}
      style={[
        {
          position: "absolute",
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale: isDragging ? dragScale : 1 },
          ],
          zIndex: isDragging ? 999 : 30,
        },
        style,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        disabled={!onPress}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}
