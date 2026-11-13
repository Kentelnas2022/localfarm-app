import React from 'react';
import { StyleSheet, View, Image } from 'react-native';

export function AnimatedSplashOverlay() {
  return (
    <View style={styles.splashOverlay}>
      <Image
        source={require('@/assets/images/logo1.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

export function AnimatedIcon() {
  return (
    <Image
      source={require('@/assets/images/logo1.png')}
      style={styles.animatedIcon}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#68A554',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  logo: {
    width: 120,
    height: 120,
  },
  animatedIcon: {
    width: 90,
    height: 90,
  },
});
