import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/lib/theme';
import { useUnreadCount } from '@/lib/use-unread-count';

export default function TabsLayout() {
  const unread = useUnreadCount();

  return (
    // Screens have no headers, so the top inset is handled here for all tabs.
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textFaint,
          // The default tab button ripples a dark Material circle on Android;
          // a plain Pressable gives no press animation at all.
          tabBarButton: ({
            children,
            style,
            onPress,
            onLongPress,
            testID,
            accessibilityLabel,
            accessibilityRole,
            accessibilityState,
          }) => (
            <Pressable
              style={style}
              onPress={onPress}
              onLongPress={onLongPress}
              testID={testID}
              accessibilityLabel={accessibilityLabel}
              accessibilityRole={accessibilityRole}
              accessibilityState={accessibilityState}
            >
              {children}
            </Pressable>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Lines',
            tabBarIcon: ({ color, size }) => <Ionicons name="bus" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="favorites"
          options={{
            title: 'Favorites',
            tabBarIcon: ({ color, size }) => <Ionicons name="star" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" size={size} color={color} />
            ),
            tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.danger, color: colors.onPrimary },
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-circle" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
