import { StyleSheet, Text, View } from 'react-native';

const SEVERITY_STYLES: Record<string, { icon: string; fg: string; bg: string; border: string }> = {
  info: { icon: 'ℹ️', fg: '#175cd3', bg: '#eff8ff', border: '#84caff' },
  warning: { icon: '⚠️', fg: '#b54708', bg: '#fffaeb', border: '#fec84b' },
  disruption: { icon: '⛔', fg: '#d92d20', bg: '#fef3f2', border: '#fda29b' },
};

export function AlertBanner({
  title,
  body,
  severity,
}: {
  title: string;
  body: string;
  severity: string;
}) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;
  return (
    <View style={[styles.banner, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={styles.icon}>{s.icon}</Text>
      <View style={styles.body}>
        <Text style={[styles.title, { color: s.fg }]}>{title}</Text>
        {!!body && <Text style={styles.text}>{body}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  icon: {
    fontSize: 18,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  text: {
    color: '#344054',
    lineHeight: 19,
  },
});
