/**
 * MarkdownPreview component tests for Silence Notes Chrome Extension
 * Tests markdown rendering, table of contents generation, code highlighting, and copy functionality
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MarkdownPreview from '../../src/components/MarkdownPreview';

// Mock navigator.clipboard for copy functionality tests
const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
});

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock getBoundingClientRect for scroll tracking
Element.prototype.getBoundingClientRect = jest.fn(() => ({
  top: 50,
  left: 0,
  bottom: 0,
  right: 0,
  width: 0,
  height: 0,
  x: 0,
  y: 50,
  toJSON: () => ({}),
}));

describe('MarkdownPreview Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render markdown content', () => {
      const html = '# Hello World\n\nThis is a test paragraph.';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(screen.getByText('Hello World')).toBeInTheDocument();
      expect(screen.getByText('This is a test paragraph.')).toBeInTheDocument();
    });

    it('should handle empty markdown', () => {
      const html = '';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(container.querySelector('.markdown-preview')).toBeInTheDocument();
      expect(screen.getByText('0 words')).toBeInTheDocument();
    });

    it('should display word count correctly', () => {
      const html = 'This is a test paragraph with seven words.';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(screen.getByText('7 words')).toBeInTheDocument();
    });

    it('should display character count correctly', () => {
      const html = 'Test';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(screen.getByText(/4 characters/)).toBeInTheDocument();
    });

    it('should display paragraph count correctly', () => {
      const html = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(screen.getByText('3 paragraphs')).toBeInTheDocument();
    });
  });

  describe('Table of Contents', () => {
    it('should render table of contents when provided', () => {
      const html = '# Introduction\n\n## Getting Started';
      const toc = [
        {
          level: 1,
          title: 'Introduction',
          anchor: 'introduction',
          children: [],
        },
        {
          level: 2,
          title: 'Getting Started',
          anchor: 'getting-started',
          children: [],
        },
      ];
      const metadata: Record<string, any> = {};

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(screen.getByText('Table of Contents')).toBeInTheDocument();
      expect(screen.getByText('Introduction')).toBeInTheDocument();
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
    });

    it('should not render table of contents when empty', () => {
      const html = '# Introduction';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(container.querySelector('.toc-sidebar')).not.toBeInTheDocument();
    });

    it('should render nested TOC items', () => {
      const html = '# Parent\n\n## Child';
      const toc = [
        {
          level: 1,
          title: 'Parent',
          anchor: 'parent',
          children: [
            {
              level: 2,
              title: 'Child',
              anchor: 'child',
              children: [],
            },
          ],
        },
      ];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(container.querySelector('.toc-level-0')).toBeInTheDocument();
      expect(container.querySelector('.toc-level-1')).toBeInTheDocument();
    });

    it('should mark active section in TOC', () => {
      const html = '# Section 1\n\n# Section 2';
      const toc = [
        {
          level: 1,
          title: 'Section 1',
          anchor: 'section-1',
          children: [],
        },
        {
          level: 1,
          title: 'Section 2',
          anchor: 'section-2',
          children: [],
        },
      ];
      const metadata: Record<string, any> = {};

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      // Initially no section should be active
      const tocLinks = screen.getAllByRole('button');
      expect(tocLinks[0]).not.toHaveClass('active');
    });

    it('should scroll to section when TOC link is clicked', () => {
      const html = '# Introduction\n\n## Getting Started';
      const toc = [
        {
          level: 1,
          title: 'Introduction',
          anchor: 'introduction',
          children: [],
        },
      ];
      const metadata: Record<string, any> = {};

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const tocLink = screen.getByText('Introduction');
      tocLink.click();

      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });
  });

  describe('Code Blocks and Syntax Highlighting', () => {
    it('should render code blocks with language specified', () => {
      const html = '```javascript\nconsole.log("Hello");\n```';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(container.querySelector('.code-block-container')).toBeInTheDocument();
      expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('should render code blocks without language specified', () => {
      const html = '```\ncode here\n```';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      // Should render as inline code when no language
      expect(container.querySelector('.inline-code')).toBeInTheDocument();
    });

    it('should render copy code button for code blocks', () => {
      const html = '```javascript\nconst test = "value";\n```';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const copyButtons = container.querySelectorAll('.copy-code-btn');
      expect(copyButtons.length).toBeGreaterThan(0);
    });

    it('should copy code to clipboard when copy button is clicked', async () => {
      const html = '```javascript\nconst test = "value";\n```';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const copyButton = container.querySelector('.copy-code-btn') as HTMLButtonElement;
      copyButton.click();

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith('const test = "value";');
      });
    });

    it('should show "Copied!" feedback after copying', async () => {
      const html = '```javascript\nconst test = "value";\n```';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const copyButton = container.querySelector('.copy-code-btn') as HTMLButtonElement;

      // Click to copy
      copyButton.click();

      // Wait for the button text to change
      await waitFor(() => {
        expect(copyButton.textContent).toBe('Copied!');
        expect(copyButton).toHaveClass('copied');
      });
    });

    it('should reset copy button after timeout', async () => {
      jest.useFakeTimers();

      const html = '```javascript\nconst test = "value";\n```';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const copyButton = container.querySelector('.copy-code-btn') as HTMLButtonElement;
      copyButton.click();

      // Fast forward past the timeout
      jest.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(copyButton.textContent).not.toBe('Copied!');
        expect(copyButton).not.toHaveClass('copied');
      });

      jest.useRealTimers();
    });
  });

  describe('Markdown Elements', () => {
    it('should render headers with IDs', () => {
      const html = '# Heading 1\n\n## Heading 2\n\n### Heading 3';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(container.querySelector('h1#heading-1')).toBeInTheDocument();
      expect(container.querySelector('h2#heading-2')).toBeInTheDocument();
      expect(container.querySelector('h3#heading-3')).toBeInTheDocument();
    });

    it('should render bold text', () => {
      const html = 'This is **bold** text.';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(screen.getByText('bold')).toBeInTheDocument();
      const boldElement = screen.getByText('bold').closest('strong');
      expect(boldElement).toBeInTheDocument();
    });

    it('should render italic text', () => {
      const html = 'This is *italic* text.';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(screen.getByText('italic')).toBeInTheDocument();
      const italicElement = screen.getByText('italic').closest('em');
      expect(italicElement).toBeInTheDocument();
    });

    it('should render unordered lists', () => {
      const html = '- Item 1\n- Item 2\n- Item 3';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const list = container.querySelector('ul');
      expect(list).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('should render ordered lists', () => {
      const html = '1. First\n2. Second\n3. Third';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const list = container.querySelector('ol');
      expect(list).toBeInTheDocument();
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('should render links with external link attributes', () => {
      const html = '[Click here](https://example.com)';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const link = container.querySelector('a');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render images with captions', () => {
      const html = '![Alt text](https://example.com/image.jpg)';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const imageContainer = container.querySelector('.image-container');
      expect(imageContainer).toBeInTheDocument();

      const image = container.querySelector('img');
      expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
      expect(image).toHaveAttribute('alt', 'Alt text');

      expect(screen.getByText('Alt text')).toBeInTheDocument();
    });

    it('should render blockquotes', () => {
      const html = '> This is a quote';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const blockquote = container.querySelector('blockquote');
      expect(blockquote).toBeInTheDocument();
      expect(screen.getByText('This is a quote')).toBeInTheDocument();
    });

    it('should render horizontal rules', () => {
      const html = '---';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const hr = container.querySelector('hr');
      expect(hr).toBeInTheDocument();
    });

    it('should render tables', () => {
      const html = '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const tableContainer = container.querySelector('.table-container');
      expect(tableContainer).toBeInTheDocument();

      const table = container.querySelector('table');
      expect(table).toBeInTheDocument();

      expect(screen.getByText('Header 1')).toBeInTheDocument();
      expect(screen.getByText('Header 2')).toBeInTheDocument();
      expect(screen.getByText('Cell 1')).toBeInTheDocument();
      expect(screen.getByText('Cell 2')).toBeInTheDocument();
    });

    it('should render inline code', () => {
      const html = 'This is `inline code`.';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const code = container.querySelector('.inline-code');
      expect(code).toBeInTheDocument();
      expect(code).toHaveTextContent('inline code');
    });
  });

  describe('Metadata Display', () => {
    it('should display metadata title', () => {
      const html = 'Content';
      const toc: any[] = [];
      const metadata = {
        title: 'Document Title',
      };

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(screen.getByText('Document Title')).toBeInTheDocument();
      const titleElement = screen.getByText('Document Title');
      expect(titleElement).toHaveClass('document-title');
    });

    it('should display metadata description', () => {
      const html = 'Content';
      const toc: any[] = [];
      const metadata = {
        description: 'This is a description',
      };

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(screen.getByText('This is a description')).toBeInTheDocument();
      const descElement = screen.getByText('This is a description');
      expect(descElement).toHaveClass('document-description');
    });

    it('should display metadata author', () => {
      const html = 'Content';
      const toc: any[] = [];
      const metadata = {
        author: 'John Doe',
      };

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(screen.getByText('By John Doe')).toBeInTheDocument();
      const authorElement = screen.getByText('By John Doe');
      expect(authorElement).toHaveClass('document-author');
    });

    it('should display metadata date', () => {
      const html = 'Content';
      const toc: any[] = [];
      const metadata = {
        date: '2024-01-15',
      };

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(screen.getByText(/Created:/)).toBeInTheDocument();
      const dateElement = screen.getByText(/Created:/);
      expect(dateElement).toHaveClass('document-date');
    });

    it('should display all metadata fields together', () => {
      const html = 'Content';
      const toc: any[] = [];
      const metadata = {
        title: 'Full Document',
        description: 'Complete description',
        author: 'Jane Smith',
        date: '2024-03-20',
      };

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(screen.getByText('Full Document')).toBeInTheDocument();
      expect(screen.getByText('Complete description')).toBeInTheDocument();
      expect(screen.getByText('By Jane Smith')).toBeInTheDocument();
      expect(screen.getByText(/Created:/)).toBeInTheDocument();
    });

    it('should not display metadata header when no metadata', () => {
      const html = 'Content';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(container.querySelector('.metadata-header')).not.toBeInTheDocument();
    });
  });

  describe('Scroll Tracking', () => {
    it('should set up scroll listener on mount', () => {
      const addEventListenerSpy = jest.spyOn(document.querySelector('.markdown-preview-content')!, 'addEventListener');

      const html = '# Section 1\n\n# Section 2';
      const toc = [
        {
          level: 1,
          title: 'Section 1',
          anchor: 'section-1',
          children: [],
        },
      ];
      const metadata: Record<string, any> = {};

      render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      // The component should add a scroll listener
      expect(addEventListenerSpy).toHaveBeenCalled();

      addEventListenerSpy.mockRestore();
    });

    it('should remove scroll listener on unmount', () => {
      const html = '# Section 1';
      const toc = [
        {
          level: 1,
          title: 'Section 1',
          anchor: 'section-1',
          children: [],
        },
      ];
      const metadata: Record<string, any> = {};

      const { unmount } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const removeEventListenerSpy = jest.spyOn(document.querySelector('.markdown-preview-content')!, 'removeEventListener');

      unmount();

      // Cleanup function should be called
      expect(removeEventListenerSpy).toHaveBeenCalled();

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Complex Markdown Scenarios', () => {
    it('should handle mixed markdown elements', () => {
      const html = `# Main Title

This is a paragraph with **bold** and *italic* text.

## Subsection

- List item 1
- List item 2

> A quote

\`\`\`javascript
const test = "value";
\`\`\`

[Link](https://example.com)`;
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(container.querySelector('h1')).toBeInTheDocument();
      expect(container.querySelector('h2')).toBeInTheDocument();
      expect(container.querySelector('ul')).toBeInTheDocument();
      expect(container.querySelector('blockquote')).toBeInTheDocument();
      expect(container.querySelector('.code-block-container')).toBeInTheDocument();
      expect(container.querySelector('a')).toBeInTheDocument();
    });

    it('should handle special characters in headings', () => {
      const html = '# Heading with Special Characters! @#$%';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const h1 = container.querySelector('h1');
      expect(h1).toBeInTheDocument();
      expect(h1).toHaveAttribute('id');
    });

    it('should handle multiple code blocks', () => {
      const html = '```javascript\nconsole.log(1);\n```\n\n```python\nprint(2)\n```';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const codeBlocks = container.querySelectorAll('.code-block-container');
      expect(codeBlocks.length).toBe(2);

      expect(screen.getByText('javascript')).toBeInTheDocument();
      expect(screen.getByText('python')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle clipboard copy errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard error'));

      const html = '```javascript\nconst test = "value";\n```';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const copyButton = container.querySelector('.copy-code-btn') as HTMLButtonElement;
      copyButton.click();

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to copy text: ',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      const html = '# H1\n\n## H2\n\n### H3';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      expect(container.querySelector('h1')).toBeInTheDocument();
      expect(container.querySelector('h2')).toBeInTheDocument();
      expect(container.querySelector('h3')).toBeInTheDocument();
    });

    it('should have accessible buttons', () => {
      const html = '```javascript\nconst test = "value";\n```';
      const toc: any[] = [];
      const metadata: Record<string, any> = {};

      const { container } = render(<MarkdownPreview html={html} toc={toc} metadata={metadata} />);

      const copyButton = container.querySelector('.copy-code-btn');
      expect(copyButton).toHaveAttribute('type', 'button');
    });
  });
});
