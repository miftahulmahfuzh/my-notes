// Markdown utility functions

export interface MarkdownTOCItem {
  level: number;
  title: string;
  anchor: string;
  children: MarkdownTOCItem[];
}

export interface MarkdownMetadata {
  title?: string;
  description?: string;
  author?: string;
  date?: string;
  wordCount?: string;
  readingTime?: string;
}

// Convert markdown to simple HTML (fallback when backend is unavailable)
export const markdownToHTML = (markdown: string): string => {
  let html = markdown;

  // Headers with IDs
  html = html.replace(/^### (.*$)/gim, (match, title) => {
    const id = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    return `<h3 id="${id}">${title}</h3>`;
  });

  html = html.replace(/^## (.*$)/gim, (match, title) => {
    const id = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    return `<h2 id="${id}">${title}</h2>`;
  });

  html = html.replace(/^# (.*$)/gim, (match, title) => {
    const id = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    return `<h1 id="${id}">${title}</h1>`;
  });

  // Bold text
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic text
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Strikethrough text
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Inline code
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // Code blocks with language detection
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'text';
    return `<pre><code class="language-${language}">${code.trim()}</code></pre>`;
  });

  // Links with external link indicator
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Images with alt text
  html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" loading="lazy" />');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Nested blockquotes
  html = html.replace(/^>> (.+)$/gm, '<blockquote><blockquote>$1</blockquote></blockquote>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Task lists
  html = html.replace(/^- \[ \] (.+)$/gm, '<li class="task-item"><input type="checkbox" disabled> $1</li>');
  html = html.replace(/^- \[x\] (.+)$/gm, '<li class="task-item completed"><input type="checkbox" checked disabled> $1</li>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^\*\*\*$/gm, '<hr>');

  // Line breaks (convert double newlines to paragraphs)
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ol>)/g, '$1');
  html = html.replace(/(<\/ol>)<\/p>/g, '$1');

  // Convert single newlines to <br> within paragraphs
  html = html.replace(/\n/g, '<br>');

  return html;
};

// Extract table of contents from markdown
export const extractTOC = (markdown: string): MarkdownTOCItem[] => {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const toc: MarkdownTOCItem[] = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const title = match[2].trim();
    const anchor = generateAnchor(title);

    toc.push({
      level,
      title,
      anchor,
      children: []
    });
  }

  return toc;
};

// Generate URL-friendly anchor from text
export const generateAnchor = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')        // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '');     // Remove leading/trailing hyphens
};

// Extract metadata from markdown content
export const extractMetadata = (markdown: string): MarkdownMetadata => {
  const metadata: MarkdownMetadata = {};

  // Extract title from first H1
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  // Extract description from first paragraph
  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine &&
        !trimmedLine.startsWith('#') &&
        !trimmedLine.startsWith('>') &&
        !trimmedLine.startsWith('```') &&
        !trimmedLine.startsWith('-') &&
        !trimmedLine.startsWith('*')) {
      metadata.description = trimmedLine;
      break;
    }
  }

  // Extract author from metadata
  const authorMatch = markdown.match(/(?:^|\n)author:\s*(.+)$/mi);
  if (authorMatch) {
    metadata.author = authorMatch[1].trim();
  }

  // Extract date from metadata
  const dateMatch = markdown.match(/(?:^|\n)(?:date|created):\s*(.+)$/mi);
  if (dateMatch) {
    metadata.date = dateMatch[1].trim();
  }

  // Calculate word count
  const wordCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  metadata.wordCount = wordCount.toString();

  // Calculate reading time (200 words per minute)
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  metadata.readingTime = `${readingTime} min read`;

  return metadata;
};

// Extract hashtags from markdown content
export const extractHashtags = (text: string): string[] => {
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const matches = text.match(hashtagRegex);
  return matches ? [...new Set(matches)] : [];
};

// Validate markdown content for security
export const validateMarkdown = (content: string, maxLength: number = 50000): { isValid: boolean; error?: string } => {
  if (content.length > maxLength) {
    return {
      isValid: false,
      error: `Content too long (max ${maxLength} characters)`
    };
  }

  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return {
        isValid: false,
        error: 'Content contains potentially dangerous elements'
      };
    }
  }

  return { isValid: true };
};

// Get markdown statistics
export const getMarkdownStats = (content: string) => {
  if (!content) {
    return {
      characters: 0,
      words: 0,
      paragraphs: 0,
      headings: 0,
      links: 0,
      images: 0,
      codeBlocks: 0,
      lists: 0
    };
  }

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const paragraphs = content.split(/\n\n/).filter(p => p.trim().length > 0).length;
  const headings = (content.match(/^#{1,6}\s+/gm) || []).length;
  const links = (content.match(/\[.+?\]\(.+?\)/g) || []).length;
  const images = (content.match(/!\[.+?\]\(.+?\)/g) || []).length;
  const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
  const lists = (content.match(/^[-*+]\s+/gm) || []).length + (content.match(/^\d+\.\s+/gm) || []).length;

  return {
    characters: content.length,
    words,
    paragraphs,
    headings,
    links,
    images,
    codeBlocks,
    lists
  };
};

// Insert markdown at cursor position
export const insertMarkdownAtCursor = (
  textarea: HTMLTextAreaElement,
  markdown: string,
  cursorOffset?: number
): void => {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);

  let newContent: string;
  let newCursorPos: number;

  if (cursorOffset !== undefined) {
    // Insert at specific position
    newContent = textarea.value.substring(0, cursorOffset) + markdown + textarea.value.substring(cursorOffset);
    newCursorPos = cursorOffset + markdown.length;
  } else {
    // Insert at current cursor position
    newContent = textarea.value.substring(0, start) + markdown + textarea.value.substring(end);
    newCursorPos = start + markdown.length;
  }

  textarea.value = newContent;
  textarea.focus();
  textarea.setSelectionRange(newCursorPos, newCursorPos);

  // Trigger input event for React to detect the change
  const event = new Event('input', { bubbles: true });
  textarea.dispatchEvent(event);
};

// Wrap selected text with markdown
export const wrapSelectionWithMarkdown = (
  textarea: HTMLTextAreaElement,
  before: string,
  after: string
): void => {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);

  const newContent = textarea.value.substring(0, start) + before + selectedText + after + textarea.value.substring(end);

  textarea.value = newContent;
  textarea.focus();
  textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);

  // Trigger input event for React to detect the change
  const event = new Event('input', { bubbles: true });
  textarea.dispatchEvent(event);
};

// Check if content is likely markdown
export const isMarkdownContent = (content: string): boolean => {
  const markdownIndicators = [
    /^#{1,6}\s+/m,           // Headers
    /\*\*.*?\*\*/,           // Bold
    /\*.*?\*/,               // Italic
    /`.*?`/,                 // Inline code
    /```[\s\S]*?```/,        // Code blocks
    /\[.*?\]\(.*?\)/,        // Links
    /^>\s+/m,                // Blockquotes
    /^[-*+]\s+/m,            // Unordered lists
    /^\d+\.\s+/m,            // Ordered lists
    /\|.*\|/,                // Tables
  ];

  return markdownIndicators.some(pattern => pattern.test(content));
};

// Convert plain text to markdown
export const textToMarkdown = (text: string): string => {
  // Convert URLs to links
  text = text.replace(/(https?:\/\/[^\s]+)/g, '[$1]($1)');

  // Convert line breaks to double line breaks for paragraphs
  text = text.replace(/\n/g, '\n\n');

  return text;
};

// Sanitize markdown content for display
export const sanitizeMarkdown = (content: string): string => {
  return content
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
};

// Export all functions
export default {
  markdownToHTML,
  extractTOC,
  generateAnchor,
  extractMetadata,
  extractHashtags,
  validateMarkdown,
  getMarkdownStats,
  insertMarkdownAtCursor,
  wrapSelectionWithMarkdown,
  isMarkdownContent,
  textToMarkdown,
  sanitizeMarkdown
};