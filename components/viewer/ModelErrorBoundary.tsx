'use client';
// components/viewer/ModelErrorBoundary.tsx
// Catches model-load (useGLTF) failures so a broken/unsupported .glb surfaces
// as a visible message instead of a silent blank canvas. Renders nothing inside
// the R3F tree on error and reports the reason out via onError (shown as a DOM
// overlay). Wrap with a `key` tied to the model URL so it resets on a new model.

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError: (message: string) => void;
}

interface State {
  hasError: boolean;
}

export class ModelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.props.onError(message);
  }

  render() {
    // null is a valid R3F child — nothing rendered in-canvas on failure.
    return this.state.hasError ? null : this.props.children;
  }
}
