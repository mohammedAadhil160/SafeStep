/**
 * SafeStep — Glassmorphism Safety Dashboard Overlay
 * A floating, blurred glass card that shows real-time safety data
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows, getRiskColor } from '../theme/tokens';
import { AnalyzeResponse } from '../services/api';

interface Props {
  analysis: AnalyzeResponse | null;
  isAnalyzing: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onReport: () => void;
}

const RISK_EMOJIS: Record<string, string> = {
  SAFE: '🟢',
  MODERATE: '🟡',
  RISKY: '🟠',
  DANGER: '🔴',
};

const RISK_GRADIENTS: Record<string, string[]> = {
  SAFE:     ['rgba(0,230,118,0.18)', 'rgba(0,230,118,0.04)'],
  MODERATE: ['rgba(255,234,0,0.18)', 'rgba(255,234,0,0.04)'],
  RISKY:    ['rgba(255,109,0,0.18)', 'rgba(255,109,0,0.04)'],
  DANGER:   ['rgba(213,0,0,0.22)', 'rgba(213,0,0,0.04)'],
};

export const SafetyDashboard: React.FC<Props> = ({
  analysis,
  isAnalyzing,
  isExpanded,
  onToggle,
  onReport,
}) => {
  const riskLevel = analysis?.risk_level ?? 'MODERATE';
  const score = analysis?.safety_score ?? 0;
  const riskColor = getRiskColor(score);
  const gradientColors = RISK_GRADIENTS[riskLevel] ?? RISK_GRADIENTS.MODERATE;

  const ScoreRing = () => (
    <View style={styles.scoreRingContainer}>
      <View style={[styles.scoreRing, { borderColor: riskColor }]}>
        <View style={[styles.scoreRingInner, { backgroundColor: `${riskColor}22` }]}>
          {isAnalyzing ? (
            <ActivityIndicator color={riskColor} size="large" />
          ) : (
            <>
              <Text style={[styles.scoreValue, { color: riskColor }]}>
                {score.toFixed(1)}
              </Text>
              <Text style={styles.scoreLabel}>/ 10</Text>
            </>
          )}
        </View>
      </View>
      <Text style={[styles.riskBadge, { color: riskColor }]}>
        {RISK_EMOJIS[riskLevel]} {riskLevel}
      </Text>
    </View>
  );

  const IncidentItem = ({ incident }: { incident: any }) => (
    <View style={styles.incidentRow}>
      <View style={[styles.incidentDot, { backgroundColor: riskColor }]} />
      <View style={styles.incidentText}>
        <Text style={styles.incidentType}>{incident.incident_type.replace(/_/g, ' ')}</Text>
        <Text style={styles.incidentDist}>{Math.round(incident.distance_m)}m away</Text>
      </View>
      <View style={[styles.severityBadge, { backgroundColor: `${getRiskColor(10 - incident.severity)}33` }]}>
        <Text style={[styles.severityText, { color: getRiskColor(10 - incident.severity) }]}>
          {incident.severity}/10
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Glass Card */}
      <TouchableOpacity activeOpacity={0.95} onPress={onToggle} style={styles.glassCard}>
        <LinearGradient
          colors={gradientColors as any}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Header Row */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Safety Analysis</Text>
            {analysis && (
              <Text style={styles.headerSub}>
                {analysis.data_points_used} data points · {Math.round(analysis.confidence * 100)}% confidence
              </Text>
            )}
          </View>
          <ScoreRing />
        </View>

        {/* Expand Indicator */}
        <View style={styles.expandIndicator}>
          <View style={[styles.expandDot, isExpanded && styles.expandDotActive]} />
          <View style={styles.expandLine} />
          <View style={[styles.expandDot, isExpanded && styles.expandDotActive]} />
        </View>
      </TouchableOpacity>

      {/* Expanded Details */}
      {isExpanded && analysis && (
        <View style={styles.expandedPanel}>
          <LinearGradient
            colors={['rgba(18,18,42,0.97)', 'rgba(10,10,26,0.99)']}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Status Message */}
          <View style={[styles.statusBox, { borderLeftColor: riskColor }]}>
            <Text style={styles.statusText}>{analysis.status_message}</Text>
          </View>

          {/* Feature Bar Chart */}
          <Text style={styles.sectionTitle}>Safety Factors</Text>
          <View style={styles.factorBars}>
            {[
              { label: 'Safety Score', value: score / 10 },
              { label: 'Confidence',   value: analysis.confidence },
              { label: 'Data Quality', value: Math.min(analysis.data_points_used / 10, 1) },
            ].map(f => (
              <View key={f.label} style={styles.factorRow}>
                <Text style={styles.factorLabel}>{f.label}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${f.value * 100}%`, backgroundColor: riskColor }]} />
                </View>
                <Text style={[styles.factorValue, { color: riskColor }]}>
                  {Math.round(f.value * 100)}%
                </Text>
              </View>
            ))}
          </View>

          {/* Nearby Incidents */}
          {analysis.nearby_incidents.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Nearby Incidents ({analysis.nearby_incidents.length})
              </Text>
              <ScrollView style={styles.incidentList} scrollEnabled nestedScrollEnabled>
                {analysis.nearby_incidents.slice(0, 5).map(inc => (
                  <IncidentItem key={inc.id} incident={inc} />
                ))}
              </ScrollView>
            </>
          )}

          {/* Report CTA */}
          <TouchableOpacity style={styles.reportButton} onPress={onReport}>
            <LinearGradient
              colors={['#6C63FF', '#3D35CC']}
              style={styles.reportGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.reportText}>⚠️  Report an Incident</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  glassCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.bgGlassBorder,
    backgroundColor: Colors.bgGlass,
    padding: Spacing.md,
    overflow: 'hidden',
    ...Shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  scoreRingContainer: {
    alignItems: 'center',
  },
  scoreRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: Typography.lg,
    fontWeight: Typography.black,
  },
  scoreLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: -2,
  },
  riskBadge: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    marginTop: Spacing.xs,
    letterSpacing: 0.8,
  },
  expandIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    gap: 4,
  },
  expandDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },
  expandDotActive: {
    backgroundColor: Colors.primary,
  },
  expandLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.bgGlassBorder,
    maxWidth: 60,
  },
  expandedPanel: {
    marginTop: 8,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.bgGlassBorder,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  statusBox: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statusText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semiBold,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  factorBars: {
    gap: Spacing.sm,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  factorLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    width: 90,
  },
  barBg: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  factorValue: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    width: 36,
    textAlign: 'right',
  },
  incidentList: {
    maxHeight: 150,
  },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgElevated,
    gap: Spacing.sm,
  },
  incidentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  incidentText: {
    flex: 1,
  },
  incidentType: {
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    textTransform: 'capitalize',
    fontWeight: Typography.medium,
  },
  incidentDist: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  severityText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  reportButton: {
    marginTop: Spacing.md,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  reportGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  reportText: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
});
