import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PeriodInfo, formatTimeRemaining } from '../hooks/usePeriodTimer';

interface PeriodCountdownProps {
  periodInfo: PeriodInfo | null;
}

// Helper za tekst boju na osnovu pozadine
const getTextColor = (bgColor: string): string => {
  switch (bgColor) {
    case '#D3968C': // Rosy Brown
      return '#F7F4D5'; // Beige
    case '#839958': // Moss Green
      return '#105666'; // Midnight Green
    case '#105666': // Midnight Green
      return '#839958'; // Moss Green
    case '#F7F4D5': // Beige
      return '#839958'; // Moss Green
    default:
      return '#839958';
  }
};

export default function PeriodCountdown({ periodInfo }: PeriodCountdownProps) {
  if (!periodInfo) {
    return null;
  }

  const { type, label, color, timeRemaining, minimalPositions } = periodInfo;
  const textColor = getTextColor(color);
  // Za beige pozadinu koristimo border
  const needsBorder = color === '#F7F4D5';

  return (
    <View style={[
      styles.container, 
      { backgroundColor: color },
      needsBorder && styles.containerWithBorder
    ]}>
      <View style={styles.content}>
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        {type !== 'off' ? (
          <>
            <Text style={[styles.timer, { color: textColor }]}>{formatTimeRemaining(timeRemaining)}</Text>
            {type === 'manual' && minimalPositions !== undefined && (
              <Text style={[styles.minimalPositions, { color: textColor }]}>
                Minimalan broj pozicija: {minimalPositions}
              </Text>
            )}
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  containerWithBorder: {
    borderWidth: 2,
    borderColor: '#839958',
  },
  content: {
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  timer: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 5,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  minimalPositions: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
});
