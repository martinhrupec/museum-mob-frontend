import React, { useEffect } from 'react';
import { View, Platform, StyleSheet } from 'react-native';

interface WebResponsiveWrapperProps {
  children: React.ReactNode;
}

export default function WebResponsiveWrapper({ children }: WebResponsiveWrapperProps) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  // Set background color on body for the sides
  useEffect(() => {
    document.body.style.backgroundColor = '#e8e5c8';
  }, []);

  return (
    <View style={styles.webContainer}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 'auto',
    // @ts-ignore - web only: centers the container horizontally
    marginLeft: 'auto',
    // @ts-ignore
    marginRight: 'auto',
    backgroundColor: '#F7F4D5',
    // @ts-ignore
    boxShadow: '0 0 20px rgba(10, 51, 35, 0.15)',
  },
});
