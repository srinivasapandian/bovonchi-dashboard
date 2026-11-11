import { useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';

export type CatalogTutorialComponentProps = {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
};

type CatalogHelpLinkProps = {
  topic: string;
  Tutorial?: ComponentType<CatalogTutorialComponentProps>;
  /** Path to navigate to when "Got it, let's go!" is clicked on the last slide. */
  createPath?: string;
  onTutorialComplete?: () => void;
};

export default function CatalogHelpLink({ topic, Tutorial, createPath, onTutorialComplete }: CatalogHelpLinkProps) {
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const handleClick = () => {
    if (Tutorial) {
      setTutorialOpen(true);
      return;
    }
    addToast(`A guided tour of ${topic} will be available here.`, 'info');
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          color: '#B89550',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--font-primary)',
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
          help
        </span>
        How {topic} Work
      </button>
      {Tutorial ? (
        <Tutorial
          open={tutorialOpen}
          onClose={() => setTutorialOpen(false)}
          onComplete={() => {
            onTutorialComplete?.();
            if (createPath) navigate(createPath);
          }}
        />
      ) : null}
    </>
  );
}
