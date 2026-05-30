'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

/**
 * Overlay nad canvasem: hint pustego stanu + ukryty input pliku. Drag&drop jest
 * nasłuchiwany na poziomie window (nie blokuje orbity, działa niezależnie od
 * pointer-events overlaya). Przycisk "Wczytaj plik" w EditorPanel woła
 * window.__openModelPicker. Poprzedni objectUrl jest zwalniany przy podmianie.
 */
export function ModelDropzone() {
  const loadedModel = useStore((s) => s.loadedModel);
  const setLoadedModel = useStore((s) => s.setLoadedModel);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevUrl = useRef<string | null>(null);

  const accept = useCallback(
    (file: File) => {
      const name = file.name.toLowerCase();
      if (!name.endsWith('.glb')) {
        // v1: tylko single-file .glb
        alert('v1 obsługuje tylko pliki .glb (single-file).');
        return;
      }
      if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
      const objectUrl = URL.createObjectURL(file);
      prevUrl.current = objectUrl;
      setLoadedModel({ objectUrl, fileName: file.name });
    },
    [setLoadedModel]
  );

  // Udostępnij otwieranie file-pickera globalnie (przycisk leva go wywoła).
  useEffect(() => {
    (window as any).__openModelPicker = () => inputRef.current?.click();
    return () => {
      delete (window as any).__openModelPicker;
    };
  }, []);

  // Globalny drag&drop (działa niezależnie od pointer-events overlaya).
  useEffect(() => {
    const onOver = (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) accept(file);
    };
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [accept]);

  // Zwolnij ostatni objectUrl przy odmontowaniu.
  useEffect(() => {
    return () => {
      if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
    };
  }, []);

  return (
    <div className={`dropzone ${dragging ? 'dropzone--active' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept=".glb,model/gltf-binary"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) accept(file);
          e.target.value = '';
        }}
      />
      {!loadedModel && (
        <div className="dropzone-hint">
          <b>Przeciągnij plik .glb tutaj</b>
          <span>albo użyj „Wczytaj plik" w panelu</span>
        </div>
      )}
    </div>
  );
}
