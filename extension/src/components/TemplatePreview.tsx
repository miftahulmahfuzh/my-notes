import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface TemplatePreviewProps {
  template: any;
  variables?: Record<string, string>;
  onVariableChange?: (variable: string, value: string) => void;
  showVariablesPanel?: boolean;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  variables = {},
  onVariableChange,
  showVariablesPanel = true
}) => {
  const [processedContent, setProcessedContent] = useState('');
  const [unfilledVariables, setUnfilledVariables] = useState<string[]>([]);

  // Process template content with variables
  const processTemplate = useCallback(() => {
    if (!template?.content) {
      setProcessedContent('');
      setUnfilledVariables([]);
      return;
    }

    let content = template.content;
    const unfilled: string[] = [];

    // Get built-in variable values
    const now = new Date();
    const builtInVars = {
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      datetime: now.toLocaleString(),
      today: now.toLocaleDateString(),
      tomorrow: new Date(now.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString(),
      yesterday: new Date(now.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString(),
      year: now.getFullYear().toString(),
      month: now.toLocaleDateString('en-US', { month: 'long' }),
      day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }),
      uuid: crypto.randomUUID(),
      random_number: Math.floor(Math.random() * 1000).toString()
    };

    // Replace variables
    const variablePattern = /\{\{([^}]+)\}\}/g;
    content = content.replace(variablePattern, (match) => {
      const varName = match.slice(2, -2).trim();
      const value = variables[varName] || builtInVars[varName as keyof typeof builtInVars];

      if (!value) {
        unfilled.push(varName);
        return match; // Keep original placeholder if no value
      }

      return value;
    });

    setProcessedContent(content);
    setUnfilledVariables(unfilled);
  }, [template?.content, variables]);

  useEffect(() => {
    processTemplate();
  }, [processTemplate]);

  const handleVariableChange = (variable: string, value: string) => {
    onVariableChange?.(variable, value);
  };

  const renderMarkdown = (content: string) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({ node, inline, className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : '';

              return !inline && language ? (
                <div className="code-block-container">
                  <div className="code-block-header">
                    <span className="code-language">{language}</span>
                  </div>
                  <SyntaxHighlighter
                    style={tomorrow}
                    language={language}
                    PreTag="div"
                    className="code-block"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code className="inline-code" {...props}>
                  {children}
                </code>
              );
            },
          h1: ({ children, ...props }) => {
              const text = children?.toString() || '';
              const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
              return <h1 id={id} {...props}>{children}</h1>;
            },
            h2: ({ children, ...props }) => {
              const text = children?.toString() || '';
              const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
              return <h2 id={id} {...props}>{children}</h2>;
            },
            h3: ({ children, ...props }) => {
              const text = children?.toString() || '';
              const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
              return <h3 id={id} {...props}>{children}</h3>;
            },
          blockquote: ({ children, ...props }) => (
            <blockquote {...props}>{children}</blockquote>
          ),
          ul: ({ children, ...props }) => (
            <ul {...props}>{children}</ul>
          ),
          ol: ({ children, ...props }) => (
            <ol {...props}>{children}</ol>
          ),
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  const getVariableLabel = (variable: string): string => {
    return variable
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="template-preview">
      <div className="preview-header">
        <div className="preview-title">
          <h3>{template?.name || 'Template Preview'}</h3>
          {template?.description && (
            <p className="preview-description">{template.description}</p>
          )}
        </div>
        <div className="preview-meta">
          <span className="template-category">
            {template?.icon && <span className="template-icon">{template.icon}</span>}
            {template?.category}
          </span>
          {template?.tags?.length > 0 && (
            <div className="template-tags">
              {template.tags.map((tag: string) => (
                <span key={tag} className="template-tag">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="preview-content-wrapper">
        <div className="preview-content">
          {processedContent ? (
            renderMarkdown(processedContent)
          ) : (
            <div className="empty-preview">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
              <p>No content to preview</p>
            </div>
          )}
        </div>

        {showVariablesPanel && template?.variables?.length > 0 && (
          <div className="variables-panel">
            <h4>Template Variables</h4>
            <div className="variables-list">
              {template.variables.map(variable => (
                <div key={variable} className="variable-field">
                  <label htmlFor={`preview-var-${variable}`}>
                    {getVariableLabel(variable)}
                  </label>
                  <div className="variable-input-wrapper">
                    <input
                      id={`preview-var-${variable}`}
                      type="text"
                      value={variables[variable] || ''}
                      onChange={(e) => handleVariableChange(variable, e.target.value)}
                      placeholder={`Enter ${getVariableLabel(variable)}`}
                      className="variable-input"
                    />
                    {unfilledVariables.includes(variable) && (
                      <span className="variable-unfilled" title="This variable is not filled">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {unfilledVariables.length > 0 && (
              <div className="unfilled-variables-notice">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>
                  {unfilledVariables.length} variable{unfilledVariables.length !== 1 ? 's' : ''} not filled
                </span>
              </div>
            )}

            <div className="built-in-variables-info">
              <h5>Built-in Variables</h5>
              <p>
                These variables are automatically available:
              </p>
              <div className="built-in-variables-list">
                <code>{'{now.toLocaleDateString()}'</code> → <span>date</span>
                <code>{now.toLocaleTimeString()}'</code> → <span>time</span>
                <code>{now.toLocaleString()}'</code> → <span>datetime</span>
                <code>{crypto.randomUUID()}'</code> → <span>uuid</span>
                <code>{Math.floor(Math.random() * 1000)}'</code> → <span>random_number</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="preview-footer">
        <div className="preview-stats">
          <span>
            {processedContent.length} characters
          </span>
          <span>
            {processedContent.split(/\s+/).filter(word => word.length > 0).length} words
          </span>
          <span>
            {processedContent.split(/\n\n/).filter(p => p.trim().length > 0).length} paragraphs
          </span>
        </div>
      </div>
    </div>
  );
};

export default TemplatePreview;