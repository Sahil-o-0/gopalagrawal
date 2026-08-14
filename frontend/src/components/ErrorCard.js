import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * ErrorCard — displays a styled error message with an optional retry action.
 * Props:
 *   title     (string) — short heading, e.g. "Connection Error"
 *   message   (string) — detailed description of the error
 *   onRetry   (func)   — if provided, shows a "Try Again" button
 */
export default function ErrorCard({ title = 'Something went wrong', message, onRetry }) {
  return (
    <View style={styles.card}>
      <View style={styles.iconRow}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {!!message && <Text style={styles.message}>{message}</Text>}
      {!!onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    borderRadius: 10,
    padding: 16,
    marginVertical: 10,
    marginHorizontal: 16,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  icon: {
    fontSize: 18,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B91C1C',
    flex: 1,
    flexWrap: 'wrap',
  },
  message: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 19,
    marginTop: 2,
  },
  retryBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
