import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Transparency — How DonutTrade actually works';
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
            'radial-gradient(ellipse at center, rgba(124,58,237,0.12) 0%, transparent 60%)',
          color: 'white',
          fontFamily: 'monospace',
          padding: 80,
        }}
      >
        <div
          style={{
            fontSize: 18,
            letterSpacing: 3,
            color: '#a78bfa',
            textTransform: 'uppercase',
            marginBottom: 30,
          }}
        >
          // sys.transparency
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 160,
            fontWeight: 400,
            lineHeight: 0.9,
            fontFamily: 'monospace',
          }}
        >
          TRANSPARENCY
          <div
            style={{
              width: 40,
              height: 124,
              backgroundColor: '#7c3aed',
              marginLeft: 14,
            }}
          />
        </div>
        <div
          style={{
            fontSize: 24,
            color: '#737380',
            marginTop: 40,
            textAlign: 'center',
          }}
        >
          How escrow, audits, and admin accountability actually work.
        </div>
      </div>
    ),
    { ...size },
  );
}
