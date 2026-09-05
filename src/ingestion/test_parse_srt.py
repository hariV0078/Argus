"""Quick smoke-test — no video required. Run: conda run -n recon python -m src.ingestion.test_parse_srt"""
import tempfile
from pathlib import Path
from .parse_telemetry import _parse_srt

SAMPLE_SRT = """1
00:00:00,000 --> 00:00:00,033
<font size="28">SrtCnt : 1, DiffTime : 33ms
2024-01-01 12:00:00.033
[iso : 100] [shutter : 1/1000] [fnum : 2.8] [ev : 0] [ct : 5500] [color_md : default] [focal_len : 24.00] [dzoom_ratio: 10000, delta:0][latitude: 28.613939] [longitude: 77.209023] [rel_alt: 50.100000 abs_alt: 198.300000] [pitch : -45] [yaw : 23] [roll : 0] </font>

2
00:00:00,033 --> 00:00:00,066
<font size="28">SrtCnt : 2, DiffTime : 33ms
2024-01-01 12:00:00.066
[iso : 100] [shutter : 1/1000] [fnum : 2.8] [ev : 0] [ct : 5500] [color_md : default] [focal_len : 24.00] [dzoom_ratio: 10000, delta:0][latitude: 28.613955] [longitude: 77.209041] [rel_alt: 50.200000 abs_alt: 198.400000] [pitch : -45] [yaw : 23] [roll : 0] </font>

"""

if __name__ == "__main__":
    with tempfile.NamedTemporaryFile(suffix=".srt", mode="w", delete=False) as f:
        f.write(SAMPLE_SRT)
        p = Path(f.name)
    df = _parse_srt(p)
    p.unlink()
    assert len(df) == 2, f"Expected 2 rows, got {len(df)}"
    assert abs(df.iloc[0].lat - 28.613939) < 1e-5
    assert abs(df.iloc[0].lon - 77.209023) < 1e-5
    assert df.iloc[0].gimbal_pitch == -45
    print("PASS — SRT parser OK")
    print(df.to_string())
