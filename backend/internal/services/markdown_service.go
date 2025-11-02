package services

import (
	"regexp"
	"strings"

	"github.com/microcosm-cc/bluemonday"
	"github.com/russross/blackfriday/v2"
	"github.com/google/uuid"
)

// MarkdownResult represents the result of markdown processing
type MarkdownResult struct {
	HTML     string            `json:"html"`
	TOC      []TOCItem         `json:"toc"`
	Metadata map[string]string `json:"metadata"`
	Tags     []string          `json:"tags"`
}

// TOCItem represents a table of contents item
type TOCItem struct {
	Level   int    `json:"level"`
	Title   string `json:"title"`
	Anchor  string `json:"anchor"`
	Children []TOCItem `json:"children,omitempty"`
}

// MarkdownService handles markdown processing operations
type MarkdownService struct {
	parser    blackfriday.Parser
	sanitizer bluemonday.Policy
}

// NewMarkdownService creates a new markdown service instance
func NewMarkdownService() *MarkdownService {
	// Create CommonMark compliant parser
	parser := blackfriday.New(blackfriday.WithExtensions(blackfriday.CommonExtensions))

	// Create strict HTML sanitizer for security
	sanitizer := bluemonday.StrictPolicy()

	// Allow safe HTML elements for formatting
	sanitizer.AllowStandardURLs()
	sanitizer.AllowStandardAttributes()

	// Allow basic formatting elements
	sanitizer.AllowElements("p", "br", "strong", "em", "u", "s", "del", "ins")
	sanitizer.AllowElements("h1", "h2", "h3", "h4", "h5", "h6")
	sanitizer.AllowElements("ul", "ol", "li", "dl", "dt", "dd")
	sanitizer.AllowElements("blockquote", "pre", "code")
	sanitizer.AllowElements("table", "thead", "tbody", "tr", "th", "td")
	sanitizer.AllowElements("a", "img")

	// Allow safe attributes
	sanitizer.AllowAttrs("href").OnElements("a")
	sanitizer.AllowAttrs("src", "alt", "title", "width", "height").OnElements("img")
	sanitizer.AllowAttrs("class").OnElements("code", "pre")
	sanitizer.AllowAttrs("id").OnElements("h1", "h2", "h3", "h4", "h5", "h6")

	return &MarkdownService{
		parser:    parser,
		sanitizer: sanitizer,
	}
}

// ProcessMarkdown converts markdown content to safe HTML and extracts metadata
func (s *MarkdownService) ProcessMarkdown(content string) (*MarkdownResult, error) {
	// Parse markdown to AST
	ast := s.parser.Parse([]byte(content))

	// Convert to HTML
	html := blackfriday.Run([]byte(content), blackfriday.WithRenderer(blackfriday.NewHTMLRenderer(blackfriday.HTMLRendererParameters{
		Flags: blackfriday.HTMLFlagsNone,
	})))

	// Sanitize HTML
	safeHTML := s.sanitizer.SanitizeBytes(html)

	// Extract metadata
	metadata := s.extractMetadata(content)

	// Extract table of contents
	toc := s.extractTOC(ast)

	// Extract tags from content
	tags := s.extractTags(content)

	return &MarkdownResult{
		HTML:     string(safeHTML),
		TOC:      toc,
		Metadata: metadata,
		Tags:     tags,
	}, nil
}

// PreviewMarkdown generates a safe HTML preview of markdown content
func (s *MarkdownService) PreviewMarkdown(content string) (string, error) {
	result, err := s.ProcessMarkdown(content)
	if err != nil {
		return "", err
	}
	return result.HTML, nil
}

// extractMetadata extracts metadata from markdown content
func (s *MarkdownService) extractMetadata(content string) map[string]string {
	metadata := make(map[string]string)

	// Extract title from first H1 or filename pattern
	titleRegex := regexp.MustCompile(`^#\s+(.+)$`)
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		if matches := titleRegex.FindStringSubmatch(line); matches != nil {
			metadata["title"] = strings.TrimSpace(matches[1])
			break
		}
	}

	// If no H1 found, try to extract from first line
	if metadata["title"] == "" && len(lines) > 0 {
		firstLine := strings.TrimSpace(lines[0])
		if firstLine != "" && !strings.HasPrefix(firstLine, "#") {
			metadata["title"] = firstLine
		}
	}

	return metadata
}

// extractTOC generates a table of contents from markdown AST
func (s *MarkdownService) extractTOC(ast *blackfriday.Node) []TOCItem {
	var toc []TOCItem
	var stack []TOCItem

	// Traverse AST to find headers
	ast.Walk(func(node *blackfriday.Node, entering bool) blackfriday.WalkStatus {
		if entering && node.Type == blackfriday.Heading {
			level := node.Level
			title := string(node.FirstChild.Literal)
			anchor := s.generateAnchor(title)

			item := TOCItem{
				Level:  level,
				Title:  title,
				Anchor: anchor,
			}

			// Handle nesting
			for len(stack) >= level {
				stack = stack[:len(stack)-1]
			}

			if len(stack) == 0 {
				toc = append(toc, item)
			} else {
				parent := &stack[len(stack)-1]
				parent.Children = append(parent.Children, item)
			}

			stack = append(stack, item)
		}
		return blackfriday.GoToNext
	})

	return toc
}

// generateAnchor creates a URL-friendly anchor from text
func (s *MarkdownService) generateAnchor(text string) string {
	// Convert to lowercase and replace spaces with hyphens
	anchor := strings.ToLower(text)
	anchor = regexp.MustCompile(`[^\w\s-]`).ReplaceAllString(anchor, "")
	anchor = regexp.MustCompile(`\s+`).ReplaceAllString(anchor, "-")
	anchor = regexp.MustCompile(`-+`).ReplaceAllString(anchor, "-")
	anchor = strings.Trim(anchor, "-")
	return anchor
}

// extractTags extracts hashtags from markdown content
func (s *MarkdownService) extractTags(content string) []string {
	tagRegex := regexp.MustCompile(`#([a-zA-Z0-9_]+)`)
	matches := tagRegex.FindAllStringSubmatch(content, -1)

	tagMap := make(map[string]bool)
	for _, match := range matches {
		tag := match[1]
		if len(tag) > 0 {
			tagMap["#"+tag] = true
		}
	}

	// Convert map to slice
	tags := make([]string, 0, len(tagMap))
	for tag := range tagMap {
		tags = append(tags, tag)
	}

	return tags
}

// ValidateMarkdown checks if markdown content is valid and safe
func (s *MarkdownService) ValidateMarkdown(content string) error {
	// Basic validation
	if len(content) > 1000000 { // 1MB limit
		return &ValidationError{Message: "Content too large"}
	}

	// Check for potentially dangerous patterns
	dangerousPatterns := []string{
		`<script[^>]*>.*?</script>`,
		`javascript:`,
		`on\w+\s*=`,
	}

	for _, pattern := range dangerousPatterns {
		if matched, _ := regexp.MatchString(pattern, content); matched {
			return &ValidationError{Message: "Potentially dangerous content detected"}
		}
	}

	return nil
}

// ValidationError represents a markdown validation error
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

// MarkdownHelp returns markdown syntax help content
func (s *MarkdownService) MarkdownHelp() map[string]interface{} {
	return map[string]interface{}{
		"basic_syntax": map[string]string{
			"heading":     "# Heading 1",
			"bold":        "**bold text**",
			"italic":      "*italic text*",
			"strikethrough": "~~strikethrough~~",
			"quote":       "> quote",
			"code":        "`code`",
			"code_block":  "```code block```",
		},
		"lists": map[string]string{
			"unordered":   "- item",
			"ordered":     "1. item",
			"nested":      "  - nested item",
		},
		"links": map[string]string{
			"link":        "[text](url)",
			"image":       "![alt text](image.jpg)",
		},
		"tables": map[string]string{
			"table": "| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |",
		},
		"extensions": map[string]string{
			"task_list":  "- [x] completed task",
			"footnote":   "[^1]: footnote text",
		},
	}
}