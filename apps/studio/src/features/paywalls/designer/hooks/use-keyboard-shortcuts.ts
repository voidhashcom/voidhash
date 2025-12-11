'use client';

import { useEffect } from 'react';
import { usePaywallDesignerActions } from '../state/designer-store';

/**
 * Checks if the event target is an editable element that should take priority
 * over global keyboard shortcuts.
 */
function isEditableElement(target: EventTarget | null): boolean {
  if (!(target && target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA';
  const isContentEditable =
    target.contentEditable === 'true' || target.isContentEditable;

  return isInput || isContentEditable;
}

/**
 * Hook that sets up global keyboard shortcuts for the designer.
 * Shortcuts are disabled when typing in input fields or contenteditable elements.
 */
export function useKeyboardShortcuts() {
  const dispatch = usePaywallDesignerActions();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip shortcuts if user is typing in an editable element
      if (isEditableElement(e.target)) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + C: Copy
      if (modKey && e.key === 'c') {
        e.preventDefault();
        dispatch('copyNodes', {});
        return;
      }

      // Cmd/Ctrl + X: Cut
      if (modKey && e.key === 'x') {
        e.preventDefault();
        dispatch('cutNodes', {});
        return;
      }

      // Cmd/Ctrl + V: Paste
      if (modKey && e.key === 'v') {
        e.preventDefault();
        dispatch('pasteNodes', {});
        return;
      }

      // Backspace or Delete: Delete selected nodes
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        dispatch('deleteNodes', {});
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch]);
}
