export function buildGlbViewerHtml(src: string) {
  const safe = src.replace(/"/g, '&quot;');
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<style>html,body{margin:0;height:100%;background:#081210}</style>
</head><body>
<script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
<model-viewer src="${safe}" camera-controls auto-rotate shadow-intensity="1"
  style="width:100vw;height:100vh;background:#081210"></model-viewer>
</body></html>`;
}
