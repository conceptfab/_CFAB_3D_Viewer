'use client';
// components/scenes/ShareDialog.tsx
// Modal z panelem linków publicznych (/s/ podgląd + /embed/ iframe) dla ZAPISANEJ
// sceny — wywoływany z edytora przyciskiem „Link publiczny". Reużywa ShareLinksPanel
// (ten sam panel co w galerii), żeby logika tworzenia/kopiowania/revoke była jedna.
import { ShareLinksPanel } from '@/app/gallery/_components/ShareLinksPanel';

export function ShareDialog({ sceneId, onClose }: { sceneId: string; onClose: () => void }) {
  return (
    <div className="save-scene-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="save-scene-modal"
        style={{ maxWidth: 600, width: 'min(600px, 92vw)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <ShareLinksPanel sceneId={sceneId} />
        <div className="save-scene-actions" style={{ marginTop: 12 }}>
          <button type="button" onClick={onClose}>
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
