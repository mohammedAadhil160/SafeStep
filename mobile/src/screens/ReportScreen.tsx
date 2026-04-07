/**
 * SafeStep — Report Screen
 * Glassmorphism form for submitting crowdsourced safety reports
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/tokens';

const REPORT_TYPES = [
  { key: 'harassment',           label: 'Harassment',        emoji: '😨' },
  { key: 'theft',                label: 'Theft/Robbery',     emoji: '🔓' },
  { key: 'assault',              label: 'Assault',           emoji: '🚨' },
  { key: 'poor_lighting',        label: 'Poor Lighting',     emoji: '🔦' },
  { key: 'suspicious_activity',  label: 'Suspicious',        emoji: '👁️'  },
  { key: 'other',                label: 'Other',             emoji: '📋' },
];

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Very Low', 2: 'Low', 3: 'Minor', 4: 'Notable', 5: 'Moderate',
  6: 'Significant', 7: 'High', 8: 'Very High', 9: 'Critical', 10: 'Extreme',
};

export const ReportScreen: React.FC = () => {
  const { userLocation } = useStore();
  const [reportType, setReportType] = useState('');
  const [severity, setSeverity] = useState(5);
  const [description, setDescription] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!reportType) {
      Alert.alert('Select Type', 'Please select a report type.');
      return;
    }
    if (!userLocation) {
      Alert.alert('No Location', 'Location is required to submit a report.');
      return;
    }
    setSubmitting(true);
    try {
      await api.submitReport({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        report_type: reportType,
        severity,
        description: description.trim() || undefined,
        anonymous,
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setReportType('');
        setSeverity(5);
        setDescription('');
      }, 3000);
    } catch (err) {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.successContainer}>
        <LinearGradient colors={[Colors.bg, Colors.bgCard]} style={StyleSheet.absoluteFillObject} />
        <Text style={styles.successEmoji}>✅</Text>
        <Text style={styles.successTitle}>Report Submitted</Text>
        <Text style={styles.successSub}>Thank you for making your community safer!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.bg, Colors.bgCard]} style={StyleSheet.absoluteFillObject} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Report Incident</Text>
          <Text style={styles.subtitle}>Help keep your community safe</Text>
        </View>

        {/* Location Indicator */}
        <View style={styles.locationBadge}>
          <Text style={styles.locationEmoji}>📍</Text>
          <Text style={styles.locationText}>
            {userLocation
              ? `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`
              : 'Waiting for GPS...'}
          </Text>
        </View>

        {/* Report Type Grid */}
        <Text style={styles.label}>What happened?</Text>
        <View style={styles.typeGrid}>
          {REPORT_TYPES.map(type => (
            <TouchableOpacity
              key={type.key}
              style={[styles.typeCard, reportType === type.key && styles.typeCardActive]}
              onPress={() => setReportType(type.key)}
            >
              <LinearGradient
                colors={
                  reportType === type.key
                    ? [Colors.primary, Colors.primaryDark]
                    : [Colors.bgElevated, Colors.bgCard]
                }
                style={styles.typeGradient}
              >
                <Text style={styles.typeEmoji}>{type.emoji}</Text>
                <Text style={[styles.typeLabel, reportType === type.key && { color: '#fff' }]}>
                  {type.label}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Severity Slider */}
        <Text style={styles.label}>
          Severity: <Text style={{ color: Colors.primary }}>{severity}/10 — {SEVERITY_LABELS[severity]}</Text>
        </Text>
        <View style={styles.severityRow}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <TouchableOpacity
              key={n}
              style={[
                styles.severityDot,
                n <= severity && { backgroundColor: Colors.primary, ...Shadows.sm },
              ]}
              onPress={() => setSeverity(n)}
            />
          ))}
        </View>

        {/* Description */}
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describe what you observed..."
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          maxLength={500}
        />
        <Text style={styles.charCount}>{description.length}/500</Text>

        {/* Anonymous Toggle */}
        <TouchableOpacity
          style={styles.anonRow}
          onPress={() => setAnonymous(!anonymous)}
        >
          <View style={[styles.checkbox, anonymous && styles.checkboxActive]}>
            {anonymous && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View>
            <Text style={styles.anonLabel}>Submit Anonymously</Text>
            <Text style={styles.anonSub}>Your identity will not be attached to this report</Text>
          </View>
        </TouchableOpacity>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            style={styles.submitGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.submitText}>
              {submitting ? 'Submitting...' : '🚩  Submit Report'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.md, paddingBottom: 120 },
  header: { marginTop: 60, marginBottom: Spacing.lg },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.black,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginTop: 4,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.bgGlassBorder,
    gap: Spacing.sm,
  },
  locationEmoji: { fontSize: 16 },
  locationText: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.semiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    letterSpacing: 0.3,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  typeCard: {
    width: '30%',
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.bgGlassBorder,
  },
  typeCardActive: {
    borderColor: Colors.primary,
    ...Shadows.sm,
  },
  typeGradient: {
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  typeEmoji: { fontSize: 22 },
  typeLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: Typography.medium,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  severityDot: {
    flex: 1,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
  },
  textArea: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.bgGlassBorder,
    color: Colors.textPrimary,
    fontSize: Typography.sm,
    padding: Spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  anonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: { color: '#fff', fontSize: 14 },
  anonLabel: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
  },
  anonSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  submitBtn: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    ...Shadows.md,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  successEmoji: { fontSize: 64, marginBottom: Spacing.lg },
  successTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  successSub: {
    fontSize: Typography.base,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
