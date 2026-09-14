import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoCube, IoGitNetwork, IoMap } from 'react-icons/io5';
import { Card } from '../components/ui/Card';
import { Loader } from '../components/ui/Loader';
import { formatDate } from '../lib/format';
import type { OutputFile, RunOutputs } from '../api/types';
import { useServerStore } from '../store/serverStore';
import './pages.css';

function pick(files: OutputFile[], ...preferredNames: string[]): OutputFile | undefined {
  for (const name of preferredNames) {
    const hit = files.find((f) => f.filename === name);
    if (hit) return hit;
  }
  return files[0];
}

function Tile({
  icon,
  label,
  detail,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button className="tile" disabled={disabled} onClick={onClick}>
      <span className="tile-icon">{icon}</span>
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div className="tile-label" style={{ color: disabled ? 'var(--dim)' : 'var(--text)' }}>
          {label}
        </div>
        <div className="tile-detail">{detail}</div>
      </span>
    </button>
  );
}

function RunCard({ run, index, onOpen }: { run: RunOutputs; index: number; onOpen: (href: string) => void }) {
  const mesh = pick(run.mesh, 'model.glb');
  const cloud = pick(run.pointcloud, 'dense_labelled.ply', 'dense.ply');
  const map = pick(run.geotiff, 'dsm.tif');
  const bounds = run.geotiff.find((f) => f.filename === 'dsm_bounds.json');

  const subtitleParts = [
    run.created_at ? formatDate(run.created_at) : `Run ${run.job_id.slice(0, 8)}`,
    run.status && run.status !== 'completed' ? run.status : null,
  ].filter(Boolean);

  return (
    <Card style={{ marginTop: index === 0 ? 0 : 12 }}>
      <p className="run-title">Run {index + 1}</p>
      <p className="run-subtitle">{subtitleParts.join(' · ')}</p>
      <div className="run-tiles">
        <Tile
          icon={<IoCube size={20} color={mesh ? 'var(--signal)' : 'var(--dim)'} />}
          label="3D Mesh"
          detail={mesh ? mesh.filename : 'Not available'}
          disabled={!mesh}
          onClick={() => mesh && onOpen(`/outputs/model?url=${encodeURIComponent(mesh.download_url)}`)}
        />
        <Tile
          icon={<IoGitNetwork size={20} color={cloud ? 'var(--signal)' : 'var(--dim)'} />}
          label="Point Cloud"
          detail={cloud ? cloud.filename : 'Not available'}
          disabled={!cloud}
          onClick={() => cloud && onOpen(`/outputs/pointcloud?url=${encodeURIComponent(cloud.download_url)}`)}
        />
        <Tile
          icon={<IoMap size={20} color={map ? 'var(--signal)' : 'var(--dim)'} />}
          label="Map"
          detail={map ? map.filename : 'Not available'}
          disabled={!map}
          onClick={() => {
            if (!map) return;
            const params = [`url=${encodeURIComponent(map.preview_url)}`];
            if (bounds) params.push(`boundsUrl=${encodeURIComponent(bounds.download_url)}`);
            onOpen(`/outputs/map?${params.join('&')}`);
          }}
        />
      </div>
    </Card>
  );
}

export function Outputs() {
  const navigate = useNavigate();
  const runs = useServerStore((s) => s.runs);
  const refreshOutputs = useServerStore((s) => s.refreshOutputs);

  useEffect(() => {
    void refreshOutputs();
  }, [refreshOutputs]);

  return (
    <div>
      <div className="page-head">
        <h1 className="h-title">Outputs</h1>
      </div>
      {!runs.length ? <Loader label="Loading outputs" /> : null}
      {runs.map((run, i) => (
        <RunCard key={run.job_id} run={run} index={i} onOpen={(href) => navigate(href)} />
      ))}
      {runs.length ? (
        <p className="outputs-hint">
          Each run keeps its own mesh, point cloud, and map — newest first. Click a tile to open its viewer.
        </p>
      ) : null}
    </div>
  );
}
