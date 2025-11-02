import React, { useState } from 'react';

interface MarkdownHelpProps {
  onClose: () => void;
}

const MarkdownHelp: React.FC<MarkdownHelpProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'extended' | 'shortcuts'>('basic');

  const syntaxExamples = {
    basic: [
      {
        title: 'Headings',
        description: 'Create headings using hash symbols',
        examples: [
          { code: '# Heading 1', description: 'Largest heading' },
          { code: '## Heading 2', description: 'Large heading' },
          { code: '### Heading 3', description: 'Medium heading' },
          { code: '#### Heading 4', description: 'Small heading' },
          { code: '##### Heading 5', description: 'Smaller heading' },
          { code: '###### Heading 6', description: 'Smallest heading' }
        ]
      },
      {
        title: 'Text Formatting',
        description: 'Format your text with emphasis',
        examples: [
          { code: '**bold text**', description: 'Bold text' },
          { code: '*italic text*', description: 'Italic text' },
          { code: '~~strikethrough~~', description: 'Strikethrough text' },
          { code: '***bold and italic***', description: 'Bold and italic' }
        ]
      },
      {
        title: 'Links and Images',
        description: 'Add links and images to your content',
        examples: [
          { code: '[Link text](https://example.com)', description: 'Create a link' },
          { code: '[Link with title](https://example.com "Title")', description: 'Link with title' },
          { code: '![Alt text](image.jpg)', description: 'Add an image' },
          { code: '![Alt text](image.jpg "Title")', description: 'Image with title' }
        ]
      },
      {
        title: 'Lists',
        description: 'Create organized lists',
        examples: [
          { code: '- Item 1\n- Item 2\n- Item 3', description: 'Unordered list' },
          { code: '1. First item\n2. Second item\n3. Third item', description: 'Ordered list' },
          { code: '  - Nested item\n  - Another nested item', description: 'Nested list' }
        ]
      },
      {
        title: 'Code',
        description: 'Display code snippets',
        examples: [
          { code: '`inline code`', description: 'Inline code' },
          { code: '```\ncode block\n```', description: 'Code block' },
          { code: '```javascript\nconsole.log("Hello");\n```', description: 'Code with syntax highlighting' }
        ]
      },
      {
        title: 'Quotes',
        description: 'Add quoted text',
        examples: [
          { code: '> Blockquote', description: 'Blockquote' },
          { code: '>> Nested quote', description: 'Nested quote' }
        ]
      }
    ],
    extended: [
      {
        title: 'Tables',
        description: 'Create structured tables',
        examples: [
          {
            code: '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n| Cell 3   | Cell 4   |',
            description: 'Basic table'
          },
          {
            code: '| Left | Center | Right |\n|:----|:------:|-----:|\n| Text | Center | Text |',
            description: 'Table with alignment'
          }
        ]
      },
      {
        title: 'Task Lists',
        description: 'Create interactive checklists',
        examples: [
          {
            code: '- [x] Completed task\n- [ ] Incomplete task\n- [ ] Another task',
            description: 'Task list with checkboxes'
          }
        ]
      },
      {
        title: 'Footnotes',
        description: 'Add footnotes to your content',
        examples: [
          { code: 'Here is a statement with a footnote[^1].\n\n[^1]: This is the footnote.', description: 'Footnote reference' }
        ]
      },
      {
        title: 'Horizontal Rules',
        description: 'Create horizontal dividers',
        examples: [
          { code: '---', description: 'Horizontal rule' },
          { code: '***', description: 'Horizontal rule with asterisks' }
        ]
      },
      {
        title: 'Escaping',
        description: 'Escape markdown formatting',
        examples: [
          { code: '\\*not italic\\*', description: 'Escape asterisk' },
          { code: '\\# not heading', description: 'Escape hash' },
          { code: '\\` not code', description: 'Escape backtick' }
        ]
      }
    ],
    shortcuts: [
      {
        title: 'Editor Shortcuts',
        description: 'Quick shortcuts for the markdown editor',
        examples: [
          { code: 'Ctrl + S', description: 'Save note' },
          { code: 'Ctrl + P', description: 'Toggle preview mode' },
          { code: 'Ctrl + /', description: 'Show/hide help' },
          { code: 'Ctrl + Shift + Enter', description: 'Save and close' },
          { code: 'Ctrl + Esc', description: 'Cancel with confirmation' },
          { code: 'Tab', description: 'Insert indentation' }
        ]
      },
      {
        title: 'Formatting Shortcuts',
        description: 'Quick text formatting',
        examples: [
          { code: 'Shift + B', description: 'Bold selected text' },
          { code: 'Shift + I', description: 'Italic selected text' },
          { code: 'Shift + `', description: 'Inline code for selected text' }
        ]
      }
    ]
  };

  const renderExamples = (examples: Array<{ code: string; description: string }>) => {
    return examples.map((example, index) => (
      <div key={index} className="syntax-example">
        <div className="example-code">
          <code>{example.code}</code>
          <button
            className="copy-btn"
            onClick={() => copyToClipboard(example.code)}
            title="Copy code"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
        <div className="example-description">{example.description}</div>
      </div>
    ));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Show brief success feedback
      const button = event?.target as HTMLButtonElement;
      if (button) {
        const originalHTML = button.innerHTML;
        button.innerHTML = '✓';
        button.classList.add('copied');
        setTimeout(() => {
          button.innerHTML = originalHTML;
          button.classList.remove('copied');
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="markdown-help-overlay">
      <div className="markdown-help-modal">
        <div className="help-header">
          <h2>Markdown Syntax Guide</h2>
          <button
            onClick={onClose}
            className="close-btn"
            title="Close help"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="help-tabs">
          <button
            className={`tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            Basic Syntax
          </button>
          <button
            className={`tab-btn ${activeTab === 'extended' ? 'active' : ''}`}
            onClick={() => setActiveTab('extended')}
          >
            Extended Syntax
          </button>
          <button
            className={`tab-btn ${activeTab === 'shortcuts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            Shortcuts
          </button>
        </div>

        <div className="help-content">
          {activeTab === 'basic' && (
            <div className="syntax-sections">
              {syntaxExamples.basic.map((section, index) => (
                <div key={index} className="syntax-section">
                  <h3>{section.title}</h3>
                  <p className="section-description">{section.description}</p>
                  {renderExamples(section.examples)}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'extended' && (
            <div className="syntax-sections">
              {syntaxExamples.extended.map((section, index) => (
                <div key={index} className="syntax-section">
                  <h3>{section.title}</h3>
                  <p className="section-description">{section.description}</p>
                  {renderExamples(section.examples)}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="syntax-sections">
              {syntaxExamples.shortcuts.map((section, index) => (
                <div key={index} className="syntax-section">
                  <h3>{section.title}</h3>
                  <p className="section-description">{section.description}</p>
                  {renderExamples(section.examples)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="help-footer">
          <div className="help-links">
            <a
              href="https://www.markdownguide.org/basic-syntax/"
              target="_blank"
              rel="noopener noreferrer"
              className="help-link"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15,3 21,3 21,9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              Markdown Guide
            </a>
            <a
              href="https://github.github.com/gfm/"
              target="_blank"
              rel="noopener noreferrer"
              className="help-link"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15,3 21,3 21,9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              GitHub Flavored Markdown
            </a>
          </div>
          <div className="help-tips">
            <p>
              <strong>Pro tip:</strong> Use the toolbar buttons above the editor to quickly insert markdown formatting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownHelp;