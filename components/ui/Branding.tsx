'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store';

const ACCEPT = '.webp,.svg,.png,image/webp,image/svg+xml,image/png';

/**
 * Plakietka brandingowa w lewym górnym rogu finalnego widoku.
 * Tryb 'text' renderuje stylowany napis (domyślnie CONCEPTFAB),
 * tryb 'image' — wgrane logo (webp/svg/png) jako objectURL.
 * Ukryty input pliku eksponuje window.__openLogoPicker (woła go przycisk leva).
 */
export function Branding() {
  const branding = useStore((s) => s.config.branding);
  const setBranding = useStore((s) => s.setBranding);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevUrl = useRef<string | null>(null);

  const accept = useCallback(
    (file: File) => {
      const name = file.name.toLowerCase();
      if (!/\.(webp|svg|png)$/.test(name)) {
        alert('Dozwolone formaty logo: .webp, .svg, .png');
        return;
      }
      if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
      const objectUrl = URL.createObjectURL(file);
      prevUrl.current = objectUrl;
      setBranding({ mode: 'image', imageUrl: objectUrl, imageName: file.name });
    },
    [setBranding]
  );

  useEffect(() => {
    (window as any).__openLogoPicker = () => inputRef.current?.click();
    return () => {
      delete (window as any).__openLogoPicker;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
    };
  }, []);

  const showImage = branding.mode === 'image' && !!branding.imageUrl;

  return (
    <div
      className="branding"
      style={{
        background: branding.bgEnabled ? branding.bgColor : 'transparent',
        border: branding.bgEnabled ? undefined : 'none',
        backdropFilter: branding.bgEnabled ? undefined : 'none',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        aria-label="Wczytaj obraz logo"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) accept(file);
          e.target.value = '';
        }}
      />
      {showImage ? (
        <img className="branding__img" src={branding.imageUrl} alt={branding.imageName || 'logo'} />
      ) : (
        <span
          className="branding__text"
          style={{
            fontFamily: branding.fontFamily,
            color: branding.color,
            fontSize: branding.fontSize,
            fontWeight: branding.fontWeight,
            letterSpacing: branding.letterSpacing,
          }}
        >
          {branding.text}
        </span>
      )}
    </div>
  );
}
