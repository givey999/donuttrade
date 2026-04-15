import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'DonutTrade — Trade safely on DonutSMP';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#0a0a0f',
          backgroundImage:
            'radial-gradient(ellipse at top, rgba(124,58,237,0.15) 0%, transparent 60%)',
          color: 'white',
          fontFamily: 'monospace',
          padding: 80,
        }}
      >
        <div
          style={{
            fontSize: 20,
            letterSpacing: 4,
            color: '#a78bfa',
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          DONUTSMP · ESCROW TRADING
        </div>
        <div
          style={{
            fontSize: 150,
            fontWeight: 400,
            lineHeight: 0.9,
            textAlign: 'center',
            fontFamily: 'monospace',
          }}
        >
          TRADE SAFELY
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 150,
            fontWeight: 400,
            lineHeight: 0.9,
            fontFamily: 'monospace',
          }}
        >
          ON <span style={{ color: '#a78bfa', marginLeft: 32 }}>DONUTSMP</span>
          <div
            style={{
              width: 38,
              height: 118,
              backgroundColor: '#7c3aed',
              marginLeft: 12,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
