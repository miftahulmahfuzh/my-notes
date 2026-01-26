import React from 'react';

const MockMarkdownPreview: React.FC<any> = ({ html, toc, metadata }) => {
  return (
    <div className="mock-markdown-preview">
      <div data-testid="markdown-content">{html}</div>
      {toc && toc.length > 0 && (
        <div data-testid="toc-container">
          {toc.map((item: any, index: number) => (
            <div key={index} data-testid="toc-item">
              {item.title}
            </div>
          ))}
        </div>
      )}
      {metadata && Object.keys(metadata).length > 0 && (
        <div data-testid="metadata-container">
          {Object.entries(metadata).map(([key, value]) => (
            <div key={key}>{`${key}: ${value}`}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MockMarkdownPreview;
