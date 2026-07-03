import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { supabase, type Profile } from '@/lib/supabase';

export default function HomeScreen() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setProfileError(error.message);
        else setProfile(data);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.greeting}>
          {profile ? `Hello, ${profile.full_name}` : 'Hello'}
        </Text>
        {profile && (
          <View style={[styles.badge, profile.role === 'staff' && styles.badgeStaff]}>
            <Text style={styles.badgeText}>{profile.role}</Text>
          </View>
        )}
        <Text style={styles.email}>{session?.user.email}</Text>
        {profileError && <Text style={styles.error}>Profile failed to load: {profileError}</Text>}
      </View>

      <Text style={styles.placeholder}>Lines, favorites and live trips are coming next.</Text>

      <Pressable style={styles.signOut} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 24,
    backgroundColor: '#f8fafc',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#eaecf0',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff8ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  badgeStaff: {
    backgroundColor: '#fef0c7',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
  },
  email: {
    color: '#475467',
  },
  error: {
    color: '#d92d20',
  },
  placeholder: {
    color: '#98a2b3',
    textAlign: 'center',
  },
  signOut: {
    marginTop: 'auto',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#344054',
  },
});
