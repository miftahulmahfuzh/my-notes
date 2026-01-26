/**
 * Content utility functions for note processing
 */

/**
 * Regular expression to match hashtags
 * Matches # followed by optional whitespace, then word characters
 * This matches the backend regex in backend/internal/models/tag.go
 */
const HASHTAG_REGEX = /#\s*\w+/g;

/**
 * Removes all hashtags from content text
 * @param content - The content to strip hashtags from
 * @returns Content with hashtags removed
 */
export function stripHashtags(content: string): string {
  return content.replace(HASHTAG_REGEX, '').trim();
}
