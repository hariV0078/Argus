import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoAlertCircle, IoCloudUploadOutline, IoImages, IoRocketOutline, IoVideocam } from 'react-icons/io5';
import { listSamples, uploadVideo } from '../api/client';
import type { SampleDataset } from '../api/types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { ListRow } from '../components/ui/ListRow';
import { useServerStore } from '../store/serverStore';
import './pages.css';

export function NewScan() {
  const navigate = useNavigate();
  const utmEpsg = useServerStore((s) => s.utmEpsg);
  const connected = useServerStore((s) => s.connected);
  const submit = useServerStore((s) => s.submit);
  const fileInput = useRef<HTMLInputElement>(null);

  const [videoPath, setVideoPath] = useState('data/raw/drone.MOV');
  const [fps, setFps] = useState('3.0');
  const [blur, setBlur] = useState('80');
  const [epsg, setEpsg] = useState(String(utmEpsg));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [samples, setSamples] = useState<SampleDataset[]>([]);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) {
      setSamples([]);
      return;
    }
    listSamples()
      .then(setSamples)
      .catch(() => setSamples([]));
  }, [connected]);

  const onSubmit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const job = await submit({
        video_path: videoPath.trim() || 'data/raw/drone.MOV',
        fps: Number(fps) || 3,
        blur_threshold: Number(blur) || 80,
        utm_epsg: Number(epsg) || utmEpsg,
      });
      navigate(`/jobs/${job.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start job');
    }
    setBusy(false);
  };

  const runSample = async (sample: SampleDataset) => {
    setBusy(true);
    setErr(null);
    try {
      const job = await submit(sample.run_request);
      navigate(`/jobs/${job.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start job from sample');
    }
    setBusy(false);
  };

  const onFileChosen = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const res = await uploadVideo(file);
      setVideoPath(res.video_path);
      setUploadedName(res.filename);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    }
    setUploading(false);
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="h-title">New job</h1>
        <p className="p-body">{connected ? 'Live server' : 'Local preview'}</p>
      </div>

      {connected && samples.length ? (
        <Card style={{ marginBottom: 12 }}>
          <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>Sample inputs on server</p>
          {samples.map((s) => (
            <ListRow
              key={s.id}
              icon={s.kind === 'frames' ? <IoImages size={16} color="var(--signal)" /> : <IoVideocam size={16} color="var(--signal)" />}
              title={s.name}
              subtitle={s.description}
              onClick={() => runSample(s)}
            />
          ))}
        </Card>
      ) : null}

      <Card>
        <Field label="Video path" autoCapitalize="none" value={videoPath} onChange={(e) => setVideoPath(e.target.value)} />
        {uploadedName ? <p className="uploaded-name">Uploaded: {uploadedName}</p> : null}
        <div className="field-grid">
          <Field label="FPS" inputMode="decimal" value={fps} onChange={(e) => setFps(e.target.value)} />
          <Field label="Blur threshold" inputMode="numeric" value={blur} onChange={(e) => setBlur(e.target.value)} />
        </div>
        <Field label="UTM EPSG" inputMode="numeric" value={epsg} onChange={(e) => setEpsg(e.target.value)} />
      </Card>

      {err ? (
        <div className="err-row">
          <IoAlertCircle size={16} />
          {err}
        </div>
      ) : null}

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button icon={<IoRocketOutline size={18} />} loading={busy} onClick={onSubmit}>
          Submit job
        </Button>
        {connected ? (
          <label className="upload-drop">
            <input
              ref={fileInput}
              type="file"
              accept="video/*"
              onChange={(e) => onFileChosen(e.target.files?.[0])}
            />
            <IoCloudUploadOutline size={22} style={{ marginBottom: 6 }} />
            <div>{uploading ? 'Uploading…' : 'Click to upload a drone video from your computer'}</div>
          </label>
        ) : null}
      </div>
    </div>
  );
}
