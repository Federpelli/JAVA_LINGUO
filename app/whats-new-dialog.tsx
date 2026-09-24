'use client';

import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CURRENT_RELEASE_NOTES } from './release-notes';

type WhatsNewDialogProps = {
  open: boolean;
  onDismiss: () => void;
};

export default function WhatsNewDialog({
  open,
  onDismiss,
}: WhatsNewDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onDismiss();
      }}
    >
      <DialogContent className="whats-new-dialog">
        <DialogHeader>
          <div className="whats-new-dialog-icon" aria-hidden="true">
            <Sparkles />
          </div>
          <div>
            <span className="whats-new-version">
              Versione {CURRENT_RELEASE_NOTES.version}
            </span>
            <DialogTitle>{CURRENT_RELEASE_NOTES.title}</DialogTitle>
            <DialogDescription>
              {CURRENT_RELEASE_NOTES.introduction}
            </DialogDescription>
          </div>
        </DialogHeader>

        <ul className="whats-new-features">
          {CURRENT_RELEASE_NOTES.features.map((feature) => (
            <li key={feature.title}>
              <span aria-hidden="true">
                <Check />
              </span>
              <div>
                <strong>{feature.title}</strong>
                <p>{feature.description}</p>
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button onClick={onDismiss}>Inizia a studiare</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
