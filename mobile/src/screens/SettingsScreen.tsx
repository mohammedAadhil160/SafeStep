/**
 * SafeStep — Settings Screen
 * Emergency contacts, preferences, and app info
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme/tokens';

const MOCK_CONTACTS = [
  { name: 'Sarah (Sister)', phone: '+1 555-0101' },
  { name: 'Mom',            phone: '+1 555-0102' },
];

export const SettingsScreen: React.FC = () => {
  const [contacts, setContacts] = useState(MOCK_CONTACTS);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [autoAnalyze, setAutoAnalyze] = useState(true);

  const addContact = () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Missing Info', 'Please enter name and phone number.');
      return;
    }
    setContacts([...contacts, { name: newName.trim(), phone: newPhone.trim() }]);
    setNewName('');
    setNewPhone('');
  };

  const removeContact = (idx: number) => {
    Alert.alert('Remove Contact', 'Remove this emergency contact?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        setContacts(contacts.filter((_, i) => i !== idx));
      }},
    ]);
  };

  const SettingRow = ({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) => (
    <View style={styles.settingRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sub && <Text style={styles.settingSub}>{sub}</Text>}
      </View>
      {children}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.bg, Colors.bgCard]} style={StyleSheet.absoluteFillObject} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Preferences & Safety Contacts</Text>
        </View>

        {/* Emergency Contacts */}
        <Text style={styles.sectionHeader}>🆘 Emergency Contacts</Text>
        <View style={styles.card}>
          {contacts.map((c, i) => (
            <View key={i} style={[styles.contactRow, i < contacts.length - 1 && styles.contactBorder]}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactInitial}>{c.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactPhone}>{c.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => removeContact(i)} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Add Contact */}
          <View style={styles.addContactSection}>
            <Text style={styles.addContactLabel}>Add Contact</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={Colors.textMuted}
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addContact}>
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                style={styles.addBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.addBtnText}>+ Add Contact</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Preferences */}
        <Text style={styles.sectionHeader}>⚙️ Preferences</Text>
        <View style={styles.card}>
          <SettingRow label="Safety Alerts" sub="Notify when entering risky areas">
            <Switch
              value={alertsEnabled}
              onValueChange={setAlertsEnabled}
              trackColor={{ false: Colors.bgElevated, true: Colors.primary }}
              thumbColor="#fff"
            />
          </SettingRow>
          <View style={styles.settingDivider} />
          <SettingRow label="Auto-Analyze" sub="Analyze safety as you walk">
            <Switch
              value={autoAnalyze}
              onValueChange={setAutoAnalyze}
              trackColor={{ false: Colors.bgElevated, true: Colors.primary }}
              thumbColor="#fff"
            />
          </SettingRow>
          <View style={styles.settingDivider} />
          <SettingRow label="Offline Mode" sub="Use cached map data when offline">
            <Switch
              value={offlineMode}
              onValueChange={setOfflineMode}
              trackColor={{ false: Colors.bgElevated, true: Colors.primary }}
              thumbColor="#fff"
            />
          </SettingRow>
        </View>

        {/* App Info */}
        <Text style={styles.sectionHeader}>ℹ️ About</Text>
        <View style={styles.card}>
          {[
            ['App Version', '1.0.0'],
            ['Backend', 'FastAPI + PostGIS'],
            ['AI Model', 'KNN + Weighted Regression'],
            ['Data Source', 'Crowdsourced + Seeded'],
          ].map(([key, val]) => (
            <View key={key} style={styles.infoRow}>
              <Text style={styles.infoKey}>{key}</Text>
              <Text style={styles.infoVal}>{val}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          🛡️ SafeStep — Navigate with Confidence
        </Text>
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
  subtitle: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 4 },

  sectionHeader: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.bgGlassBorder,
    overflow: 'hidden',
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  contactBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgGlassBorder,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.primary}44`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitial: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.primary,
  },
  contactName: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  contactPhone: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2 },
  removeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: `${Colors.danger}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: Colors.danger, fontSize: 14 },

  addContactSection: { padding: Spacing.md, gap: Spacing.sm },
  addContactLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.semiBold,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.bgGlassBorder,
    color: Colors.textPrimary,
    fontSize: Typography.sm,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  addBtn: { borderRadius: Radius.full, overflow: 'hidden', marginTop: 4 },
  addBtnGradient: { paddingVertical: 12, alignItems: 'center' },
  addBtnText: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: '#fff',
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  settingLabel: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  settingSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.bgGlassBorder,
    marginHorizontal: Spacing.md,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgGlassBorder,
  },
  infoKey: { fontSize: Typography.sm, color: Colors.textSecondary },
  infoVal: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.medium,
  },

  footer: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: Typography.xs,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
});
