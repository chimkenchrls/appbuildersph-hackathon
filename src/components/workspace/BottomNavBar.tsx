import React from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { AppIcon } from '@/components/Icon';

export type RootTab = 'projects' | 'agreements' | 'settings';

interface BottomNavBarProps {
  activeTab: RootTab;
  onSelectTab: (tab: RootTab) => void;
}

export function BottomNavBar({ activeTab, onSelectTab }: BottomNavBarProps) {
  const tabs: { id: RootTab; label: string; icon: 'projects' | 'agreements' | 'settings' }[] = [
    { id: 'projects', label: 'Projects', icon: 'projects' },
    { id: 'agreements', label: 'Agreements', icon: 'agreements' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.barInner}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const color = isActive ? colors.tabActive : colors.tabInactive;
          return (
            <Pressable
              key={tab.id}
              style={styles.tabItem}
              onPress={() => onSelectTab(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} tab`}
            >
              <AppIcon name={tab.icon} size={22} color={color} />
              <Text style={[styles.tabLabel, { color }, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.tabBarBorder,
    paddingTop: 8,
    paddingBottom: 16,
    width: '100%',
  },
  barInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    minWidth: 72,
    gap: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
});
