import React, { lazy, Suspense } from 'react';

const MarkdownPreviewImpl = lazy(() => import('./MarkdownPreview'));

interface TOCItem {
  level: number;
  title: string;
  anchor: string;
  children: TOCItem[];
}

interface MarkdownPreviewLazyProps {
  html: string;
  toc: TOCItem[];
  metadata: Record<string, string>;
}

const MarkdownPreviewLazy: React.FC<MarkdownPreviewLazyProps> = (props) => {
  return (
    <Suspense fallback={
      <div className="markdown-loading">
        <div className="spinner"></div>
        <p>Loading preview...</p>
      </div>
    }>
      <MarkdownPreviewImpl {...props} />
    </Suspense>
  );
};

export default MarkdownPreviewLazy;
