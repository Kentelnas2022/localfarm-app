import React, { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const FS = 110;
const LOGO_SIZE = 100;
const BORDER = (FS - LOGO_SIZE) / 2;
const DASH = 22;
const HD = DASH / 2;
const PERIMETER = 4 * FS;
const DURATION = 2000;

export function LoadingScreen(): React.JSX.Element {
  const dist = useSharedValue(0);

  useEffect(() => {
    dist.value = withRepeat(
      withTiming(PERIMETER, { duration: DURATION, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const dashStyle = useAnimatedStyle(() => {
    "worklet";
    const d = dist.value;

    if (d < FS) {
      return { left: d - HD, top: 0, width: DASH, height: BORDER };
    } else if (d < 2 * FS) {
      return {
        left: FS - BORDER,
        top: d - FS - HD,
        width: BORDER,
        height: DASH,
      };
    } else if (d < 3 * FS) {
      return {
        left: 3 * FS - d - HD,
        top: FS - BORDER,
        width: DASH,
        height: BORDER,
      };
    } else {
      return { left: 0, top: 4 * FS - d - HD, width: BORDER, height: DASH };
    }
  });

  return (
    <View style={styles.screen}>
      <View style={styles.frame}>
        <Animated.View style={[styles.dash, dashStyle]} />

        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/logo1.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  frame: {
    width: FS,
    height: FS,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  dash: {
    position: "absolute",
    backgroundColor: "#72AF5B",
  },
  logoContainer: {
    position: "absolute",
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    left: BORDER,
    top: BORDER,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
