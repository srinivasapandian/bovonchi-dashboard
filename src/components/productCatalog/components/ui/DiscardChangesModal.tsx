import { Modal } from './Modal';
import { Button } from './Button';

interface DiscardChangesModalProps {
  open: boolean;
  onKeepEditing: () => void;
  onConfirm: () => void;
}

export function DiscardChangesModal({ open, onKeepEditing, onConfirm }: DiscardChangesModalProps) {
  return (
    <Modal
      open={open}
      onClose={onKeepEditing}
      title="Discard changes?"
      footer={
        <>
          <Button variant="ghost" onClick={onKeepEditing}>Keep Editing</Button>
          <Button style={{ background: '#A63D2F', color: '#fff' }} onClick={onConfirm}>Discard</Button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: 'var(--t2)', margin: 0, lineHeight: 1.6 }}>
        You have unsaved changes. Are you sure you want to discard them?
      </p>
    </Modal>
  );
}
