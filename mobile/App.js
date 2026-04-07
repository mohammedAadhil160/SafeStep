/**
 * SafeStep — Root App.js
 * Navigation setup: bottom tab navigator with Map, Report, Settings
 */

import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { MapScreen }      from './src/screens/MapScreen';
import { ReportScreen }   from './src/screens/ReportScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

// ─── Navigation Theme ─────────────────────────────────────────────────────────
const SafeStepTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background:   '#0A0A1A',
    card:         '#12122A',
    text:         '#F0F0FF',
    border:       'rgba(255,255,255,0.08)',
    primary:      '#6C63FF',
    notification: '#FF1744',
  },
};

// ─── Tab Icon Helper ──────────────────────────────────────────────────────────
const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Map:      { active: '🗺️',  inactive: '🗺️'  },
  Report:   { active: '⚠️',  inactive: '⚠️'  },
  Settings: { active: '⚙️',  inactive: '⚙️'  },
};

const Tab = createBottomTabNavigator();

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <NavigationContainer theme={SafeStepTheme}>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarStyle: {
                backgroundColor: '#0D0D22',
                borderTopColor: 'rgba(255,255,255,0.08)',
                borderTopWidth: 1,
                height: Platform.OS === 'ios' ? 85 : 65,
                paddingBottom: Platform.OS === 'ios' ? 24 : 10,
                paddingTop: 8,
                position: 'absolute',
                elevation: 0,
              },
              tabBarActiveTintColor: '#6C63FF',
              tabBarInactiveTintColor: '#5A5A7A',
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: 0.3,
              },
              tabBarIcon: ({ focused, color }) => {
                const icon = focused
                  ? TAB_ICONS[route.name]?.active
                  : TAB_ICONS[route.name]?.inactive;
                return (
                  <React.Fragment>
                    {/* Active indicator dot */}
                    {focused && (
                      <SafeAreaView style={{
                        position: 'absolute',
                        top: -2,
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: '#6C63FF',
                      }} />
                    )}
                    {/* Icon */}
                    <SafeAreaView style={{
                      backgroundColor: focused ? 'rgba(108,99,255,0.18)' : 'transparent',
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}>
                      <StatusBar />
                    </SafeAreaView>
                  </React.Fragment>
                );
              },
            })}
          >
            <Tab.Screen
              name="Map"
              component={MapScreen}
              options={{ tabBarLabel: '🗺️  Map' }}
            />
            <Tab.Screen
              name="Report"
              component={ReportScreen}
              options={{ tabBarLabel: '⚠️  Report' }}
            />
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ tabBarLabel: '⚙️  Settings' }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
