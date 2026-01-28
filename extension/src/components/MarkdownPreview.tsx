import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js/lib/common';

// Import markdown CSS styles
import './markdown.css';
import './code-highlight.css';

interface TOCItem {
  level: number;
  title: string;
  anchor: string;
  children: TOCItem[];
}

interface MarkdownPreviewProps {
  html: string;
  toc: TOCItem[];
  metadata: Record<string, string>;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  html,
  toc,
  metadata
}) => {
  const [activeSection, setActiveSection] = useState<string>('');

  // Handle scroll to update active section in TOC
  useEffect(() => {
    const handleScroll = () => {
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

      for (let i = headings.length - 1; i >= 0; i--) {
        const heading = headings[i];
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 100) {
          const id = heading.id || heading.textContent?.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
          if (id) {
            setActiveSection(id);
          }
          break;
        }
      }
    };

    const previewElement = document.querySelector('.markdown-preview-content');
    if (previewElement) {
      previewElement.addEventListener('scroll', handleScroll);
      return () => previewElement.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToSection = (anchor: string) => {
    const element = document.getElementById(anchor);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderTOC = (items: TOCItem[], level: number = 0) => {
    if (!items || items.length === 0) return null;

    return (
      <ul className={`toc-level-${level}`}>
        {items.map((item, index) => (
          <li key={index} className={`toc-item toc-level-${item.level}`}>
            <button
              onClick={() => scrollToSection(item.anchor)}
              className={`toc-link ${activeSection === item.anchor ? 'active' : ''}`}
            >
              {item.title}
            </button>
            {item.children && item.children.length > 0 && (
              renderTOC(item.children, level + 1)
            )}
          </li>
        ))}
      </ul>
    );
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Show brief success feedback
      const button = event?.target as HTMLButtonElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.classList.add('copied');
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove('copied');
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="markdown-preview">
      {toc && toc.length > 0 && (
        <div className="toc-sidebar">
          <div className="toc-header">
            <h3>Table of Contents</h3>
          </div>
          <div className="toc-content">
            {renderTOC(toc)}
          </div>
        </div>
      )}

      <div className="markdown-preview-content">
        <div className="markdown-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Custom code component with syntax highlighting
              code: ({ node, className, children, ...props }: any) => {
                const inline = (props as any)?.inline;
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';

                return !inline && language ? (
                  <div className="code-block-container">
                    <div className="code-block-header">
                      <span className="code-language">{language}</span>
                      <button
                        className="copy-code-btn"
                        onClick={() => copyToClipboard(String(children).replace(/\n$/, ''))}
                        title="Copy code"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </div>
                    <pre className="code-block">
                      <code
                        dangerouslySetInnerHTML={{
                          __html: hljs.highlight(language, String(children).replace(/\n$/, '')).value
                        }}
                      />
                    </pre>
                  </div>
                ) : (
                  <code className="inline-code" {...props}>
                    {children}
                  </code>
                );
              },

              // Custom heading component with IDs
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
              h4: ({ children, ...props }) => {
                const text = children?.toString() || '';
                const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                return <h4 id={id} {...props}>{children}</h4>;
              },
              h5: ({ children, ...props }) => {
                const text = children?.toString() || '';
                const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                return <h5 id={id} {...props}>{children}</h5>;
              },
              h6: ({ children, ...props }) => {
                const text = children?.toString() || '';
                const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                return <h6 id={id} {...props}>{children}</h6>;
              },

              // Custom table component
              table: ({ children, ...props }) => (
                <div className="table-container">
                  <table {...props}>{children}</table>
                </div>
              ),

              // Custom blockquote component
              blockquote: ({ children, ...props }) => (
                <blockquote {...props}>
                  {children}
                </blockquote>
              ),

              // Custom list components
              ul: ({ children, ...props }) => (
                <ul {...props}>{children}</ul>
              ),
              ol: ({ children, ...props }) => (
                <ol {...props}>{children}</ol>
              ),

              // Custom link component
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

              // Custom image component
              img: ({ src, alt, ...props }) => (
                <div className="image-container">
                  <img src={src} alt={alt} {...props} />
                  {alt && <div className="image-caption">{alt}</div>}
                </div>
              ),

              // Custom HR component
              hr: ({ ...props }) => (
                <hr {...props} />
              ),
            }}
          >
            {html}
          </ReactMarkdown>
        </div>

        <div className="preview-footer">
          <div className="word-count-info">
            <span>
              {html.split(/\s+/).filter(word => word.length > 0).length} words
            </span>
            <span>
              {html.length} characters
            </span>
            <span>
              {html.split(/\n\n/).filter(paragraph => paragraph.trim().length > 0).length} paragraphs
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownPreview;