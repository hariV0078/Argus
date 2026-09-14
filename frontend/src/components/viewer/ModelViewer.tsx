import { ComponentType, forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';
import { buildViewerHtml, ViewerLayers } from '@/src/lib/viewerHtml';
import { colors, radius } from '@/src/theme';

const WebView = RNWebView as unknown as ComponentType<any>;

export function sceneForJob(name: string, id?: string): 'campus' | 'highway' | 'disaster' | 'new' {
  const s = `${name} ${id || ''}`.toLowerCase();
  if (s.includes('highway')) return 'highway';
  if (s.includes('disaster')) return 'disaster';
  if (s.includes('campus')) return 'campus';
  return 'new';
}

export type ViewerHandle = {
  setLayers: (l: ViewerLayers) => void;
  setMode: (m: string) => void;
  setNav: (n: string) => void;
  setMeasure: (m: string) => void;
  setView: (v: string) => void;
};

export const ModelViewer = forwardRef<
  ViewerHandle,
  { title: string; scene: string; layers: ViewerLayers; onEvent?: (data: any) => void }
>(function ModelViewer({ title, scene, layers, onEvent }, ref) {
  const html = useMemo(() => buildViewerHtml({ title, scene, layers }), [title, scene]);
  const web = useRef<any>(null);
  const ready = useRef(false);
  const queue = useRef<string[]>([]);

  const run = (code: string) => {
    if (!ready.current) {
      queue.current.push(code);
      return;
    }
    web.current?.injectJavaScript(`${code}; true;`);
  };

  useImperativeHandle(ref, () => ({
    setLayers: (l) => run(`window.setLayers(${JSON.stringify(l)})`),
    setMode: (m) => run(`window.setMode(${JSON.stringify(m)})`),
    setNav: (n) => run(`window.setNav(${JSON.stringify(n)})`),
    setMeasure: (m) => run(`window.setMeasure(${JSON.stringify(m)})`),
    setView: (v) => run(`window.setView(${JSON.stringify(v)})`),
  }));

  return (
    <View style={styles.wrap}>
      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        androidLayerType="hardware"
        onLoadEnd={() => {
          ready.current = true;
          queue.current.forEach((code) => web.current?.injectJavaScript(`${code}; true;`));
          queue.current = [];
        }}
        onMessage={(e: { nativeEvent: { data: string } }) => {
          try {
            onEvent?.(JSON.parse(e.nativeEvent.data));
          } catch {
            /* ignore */
          }
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 280,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
  },
  web: { flex: 1, backgroundColor: colors.bg },
});
