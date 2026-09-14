import { useNavigate, useSearchParams } from 'react-router-dom';
import { IoArrowBack } from 'react-icons/io5';
import { PlyViewer } from '../components/viewers/PlyViewer';
import { LABEL_COLORS, LABEL_NAMES } from '../lib/labelColors';
import './pages.css';

export function OutputPointCloud() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const url = params.get('url') || undefined;

  return (
    <div className="viewer-page">
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: 'var(--signal)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: 0, fontWeight: 600 }}>
        <IoArrowBack size={16} /> Point cloud
      </button>
      <PlyViewer url={url} />
      <div className="viewer-legend">
        {LABEL_NAMES.slice(1).map((name, i) => (
          <span key={name} className="viewer-legend-item">
            <span className="viewer-legend-swatch" style={{ background: LABEL_COLORS[i + 1] }} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
