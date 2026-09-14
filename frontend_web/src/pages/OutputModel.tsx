import { useNavigate, useSearchParams } from 'react-router-dom';
import { IoArrowBack, IoCubeOutline } from 'react-icons/io5';
import { GlbViewer } from '../components/viewers/GlbViewer';
import './pages.css';

export function OutputModel() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const url = params.get('url') || undefined;
  const rawName = url ? url.split('/').pop() : 'Sample Model';
  const fileName = rawName ? rawName.split('?')[0].split('#')[0] : 'Sample Model';

  return (
    <div className="viewer-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--signal)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            padding: '8px 16px',
            fontWeight: 700,
            fontSize: 14,
            transition: 'all 0.15s ease',
          }}>
          <IoArrowBack size={18} /> Back to Outputs
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="badge" style={{ background: 'var(--signal-soft)', color: 'var(--signal)', border: '1px solid var(--signal-border)' }}>
            <IoCubeOutline size={14} /> 3D Mesh Inspection
          </div>
        </div>
      </div>

      <GlbViewer url={url} initialFileName={fileName} />

      <p className="p-meta" style={{ textAlign: 'center', color: 'var(--muted)' }}>
        Supports drag & drop for custom <span style={{ color: 'var(--signal)' }}>.GLB, .GLTF, .OBJ, .STL, .PLY</span> files · Powered by Three.js
      </p>
    </div>
  );
}
