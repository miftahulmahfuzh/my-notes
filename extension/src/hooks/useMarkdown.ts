import { useState, useCallback, useEffect } from 'react';

interface MarkdownResult {
  html: string;
  toc: Array<{
    level: number;
    title: string;
    anchor: string;
    children: any[];
  }>;
  metadata: Record<string, string>;
  tags: string[];
}

interface UseMarkdownOptions {
  enableAutoPreview?: boolean;
  previewDebounceMs?: number;
  maxContentLength?: number;
}

export const useMarkdown = (options: UseMarkdownOptions = {}) => {
  const {
    enableAutoPreview = true,
    previewDebounceMs = 300,
    maxContentLength = 50000
  } = options;

  const [content, setContent] = useState('');
  const [previewData, setPreviewData] = useState<MarkdownResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [lastPreviewTime, setLastPreviewTime] = useState<number>(0);

  // Validate markdown content
  const validateMarkdown = useCallback((text: string): { isValid: boolean; error?: string } => {
    if (text.length > maxContentLength) {
      return {
        isValid: false,
        error: `Content too long (max ${maxContentLength} characters)`
      };
    }

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(text)) {
        return {
          isValid: false,
          error: 'Content contains potentially dangerous elements'
        };
      }
    }

    return { isValid: true };
  }, [maxContentLength]);

  // Extract metadata from markdown content
  const extractMetadata = useCallback((text: string): Record<string, string> => {
    const metadata: Record<string, string> = {};

    // Extract title from first H1
    const titleMatch = text.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }

    // Extract description from first paragraph
    const lines = text.split('\n');
    let descriptionFound = false;
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('>') && !trimmedLine.startsWith('```')) {
        metadata.description = trimmedLine;
        descriptionFound = true;
        break;
      }
    }
    if (!descriptionFound) {
      metadata.description = '';
    }

    // Extract author from front matter or metadata
    const authorMatch = text.match(/(?:^|\n)author:\s*(.+)$/m);
    if (authorMatch) {
      metadata.author = authorMatch[1].trim();
    }

    // Extract date from front matter or metadata
    const dateMatch = text.match(/(?:^|\n)(?:date|created):\s*(.+)$/m);
    if (dateMatch) {
      metadata.date = dateMatch[1].trim();
    }

    // Extract word count
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    metadata.wordCount = wordCount.toString();

    // Extract reading time (approximate, 200 words per minute)
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));
    metadata.readingTime = `${readingTime} min read`;

    return metadata;
  }, []);

  // Extract table of contents from markdown content
  const extractTOC = useCallback((text: string): Array<{ level: number; title: string; anchor: string; children: any[] }> => {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const toc: Array<{ level: number; title: string; anchor: string; children: any[] }> = [];
    let match;

    while ((match = headingRegex.exec(text)) !== null) {
      const level = match[1].length;
      const title = match[2].trim();
      const anchor = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      toc.push({
        level,
        title,
        anchor,
        children: []
      });
    }

    return toc;
  }, []);

  // Extract hashtags from content
  const extractHashtags = useCallback((text: string): string[] => {
    const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? [...new Set(matches)] : [];
  }, []);

  // Generate simple HTML preview (fallback for when API is unavailable)
  const generatePreviewHTML = useCallback((markdown: string): string => {
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 id="$1">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 id="$1">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 id="$1">$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Code
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Links
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Images
    html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" />');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    return html;
  }, []);

  // Preview markdown content
  const previewMarkdown = useCallback(async (markdown: string): Promise<MarkdownResult> => {
    if (!markdown.trim()) {
      return {
        html: '',
        toc: [],
        metadata: {},
        tags: []
      };
    }

    const validation = validateMarkdown(markdown);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    try {
      // Try to use backend API first
      const response = await fetch('/api/v1/markdown/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: markdown }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setLastPreviewTime(Date.now());
          return {
            html: result.data.html,
            toc: result.data.toc,
            metadata: result.data.metadata,
            tags: result.data.tags
          };
        }
      }
    } catch (error) {
      console.warn('Backend preview failed, using fallback:', error);
    }

    // Fallback to client-side processing
    const metadata = extractMetadata(markdown);
    const toc = extractTOC(markdown);
    const tags = extractHashtags(markdown);
    const html = generatePreviewHTML(markdown);

    setLastPreviewTime(Date.now());
    return {
      html,
      toc,
      metadata,
      tags
    };
  }, [validateMarkdown, extractMetadata, extractTOC, extractHashtags, generatePreviewHTML]);

  // Debounced preview function
  const debouncedPreview = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (markdown: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (enableAutoPreview && markdown.trim()) {
            setIsPreviewLoading(true);
            setPreviewError(null);

            previewMarkdown(markdown)
              .then(result => {
                setPreviewData(result);
              })
              .catch(error => {
                setPreviewError(error.message);
                console.error('Preview failed:', error);
              })
              .finally(() => {
                setIsPreviewLoading(false);
              });
          } else if (!markdown.trim()) {
            setPreviewData(null);
            setPreviewError(null);
          }
        }, previewDebounceMs);
      };
    })(),
    [enableAutoPreview, previewDebounceMs, previewMarkdown]
  );

  // Update content and trigger preview
  const updateContent = useCallback((newContent: string) => {
    setContent(newContent);
    debouncedPreview(newContent);
  }, [debouncedPreview]);

  // Manual preview refresh
  const refreshPreview = useCallback(() => {
    if (content.trim()) {
      setIsPreviewLoading(true);
      setPreviewError(null);

      previewMarkdown(content)
        .then(result => {
          setPreviewData(result);
        })
        .catch(error => {
          setPreviewError(error.message);
          console.error('Preview failed:', error);
        })
        .finally(() => {
          setIsPreviewLoading(false);
        });
    }
  }, [content, previewMarkdown]);

  // Get markdown statistics
  const getStatistics = useCallback(() => {
    if (!content) {
      return {
        characters: 0,
        words: 0,
        paragraphs: 0,
        headings: 0,
        links: 0,
        images: 0
      };
    }

    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const paragraphs = content.split(/\n\n/).filter(p => p.trim().length > 0).length;
    const headings = (content.match(/^#{1,6}\s+/gm) || []).length;
    const links = (content.match(/\[.+?\]\(.+?\)/g) || []).length;
    const images = (content.match(/!\[.+?\]\(.+?\)/g) || []).length;

    return {
      characters: content.length,
      words,
      paragraphs,
      headings,
      links,
      images
    };
  }, [content]);

  // Clear content and preview
  const clear = useCallback(() => {
    setContent('');
    setPreviewData(null);
    setPreviewError(null);
  }, []);

  return {
    content,
    setContent: updateContent,
    previewData,
    isPreviewLoading,
    previewError,
    lastPreviewTime,
    refreshPreview,
    validateMarkdown,
    extractMetadata,
    extractTOC,
    extractHashtags,
    getStatistics,
    clear
  };
};

export default useMarkdown;