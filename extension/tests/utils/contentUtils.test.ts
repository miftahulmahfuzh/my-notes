/**
 * Tests for Content Utility Functions
 * Comprehensive test coverage for contentUtils.ts
 */

import { stripHashtags } from '../../src/utils/contentUtils';

describe('Content Utilities - stripHashtags', () => {
  // ============================================================================
  // Basic Functionality Tests
  // ============================================================================

  describe('Basic Functionality', () => {
    test('stripHashtags() removes all hashtags from text', () => {
      const input = 'Hello #world this is a #test';
      const expected = 'Hello  this is a';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() preserves other content like mentions and markdown', () => {
      const input = 'Regular text with @mentions and **markdown**';
      const expected = 'Regular text with @mentions and **markdown**';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles empty string', () => {
      const input = '';
      const expected = '';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles string without hashtags', () => {
      const input = 'No hashtags here';
      const expected = 'No hashtags here';
      expect(stripHashtags(input)).toBe(expected);
    });
  });

  // ============================================================================
  // Hashtag Position Tests
  // ============================================================================

  describe('Hashtag Positions', () => {
    test('stripHashtags() handles hashtags at start, middle, and end', () => {
      const input = '#start middle #middle end#';
      const expected = 'middle  end#';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() removes hashtag at the beginning of text', () => {
      const input = '#tagname This is text';
      const expected = 'This is text';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() removes hashtag at the end of text', () => {
      const input = 'This is text #tagname';
      const expected = 'This is text';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() removes hashtag in the middle of text', () => {
      const input = 'This is #tagname text';
      const expected = 'This is  text';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles multiple hashtags throughout text', () => {
      const input = '#one text #two more #three text #four';
      const expected = 'text  more  text';
      expect(stripHashtags(input)).toBe(expected);
    });
  });

  // ============================================================================
  // Multiple Hashtags Tests
  // ============================================================================

  describe('Multiple Hashtags', () => {
    test('stripHashtags() handles multiple consecutive hashtags', () => {
      const input = 'text #tag1#tag2 more';
      const expected = 'text  more';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles three consecutive hashtags', () => {
      const input = 'text #a#b#c more';
      const expected = 'text  more';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hashtags with spaces between them', () => {
      const input = 'text #tag1 #tag2 #tag3 more';
      const expected = 'text    more';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles mixed consecutive and spaced hashtags', () => {
      const input = '#a#b text #c #d#e more';
      const expected = 'text   more';
      expect(stripHashtags(input)).toBe(expected);
    });
  });

  // ============================================================================
  // Hashtag Format Tests
  // ============================================================================

  describe('Hashtag Formats', () => {
    test('stripHashtags() handles hashtags with numbers', () => {
      const input = 'text #tag123 more';
      const expected = 'text  more';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hashtags with underscores', () => {
      const input = 'text #my_tag more';
      const expected = 'text  more';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hashtags with mixed alphanumeric and underscores', () => {
      const input = 'text #tag_123_test more';
      const expected = 'text  more';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hashtags with only numbers', () => {
      const input = 'text #123 more';
      const expected = 'text  more';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hashtags with only underscores', () => {
      const input = 'text #___ more';
      const expected = 'text  more';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles single character hashtags', () => {
      const input = 'text #a #b #c more';
      const expected = 'text    more';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hashtag starting with number', () => {
      const input = 'text #1tag more';
      const expected = 'text  more';
      expect(stripHashtags(input)).toBe(expected);
    });
  });

  // ============================================================================
  // Whitespace Handling Tests
  // ============================================================================

  describe('Whitespace Handling', () => {
    test('stripHashtags() handles hashtags with space after hash', () => {
      const input = 'text # tagname more';
      const expected = 'text  more';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles multiple spaces after hash', () => {
      const input = 'text #  tagname more';
      const expected = 'text  more';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() trims leading and trailing whitespace', () => {
      const input = '  #tag text #tag  ';
      const expected = 'text';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() preserves internal spacing', () => {
      const input = 'word1  #tag  word2';
      const expected = 'word1    word2';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles newlines with hashtags', () => {
      const input = 'text\n#tag\nmore';
      const expected = 'text\n\nmore';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles tabs with hashtags', () => {
      const input = 'text\t#tag\tmore';
      const expected = 'text\t\tmore';
      expect(stripHashtags(input)).toBe(expected);
    });
  });

  // ============================================================================
  // Edge Cases and Special Characters
  // ============================================================================

  describe('Edge Cases and Special Characters', () => {
    test('stripHashtags() does not remove hash symbols not followed by word chars', () => {
      const input = 'Price is $100 # not a tag';
      const expected = 'Price is $100  a tag';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hash at end of string without word chars', () => {
      const input = 'text #';
      const expected = 'text #';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles only hashtag', () => {
      const input = '#hashtag';
      const expected = '';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles only hash symbol', () => {
      const input = '#';
      const expected = '#';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hashtag followed by special char', () => {
      const input = '#tag! text';
      const expected = '! text';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hashtag followed by punctuation', () => {
      const input = '#tag. text';
      const expected = '. text';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hashtag in parentheses', () => {
      const input = '(#tag) text';
      const expected = '() text';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hashtags with camelCase', () => {
      const input = '#camelCase text #PascalCase';
      const expected = 'text';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hashtags with snake_case', () => {
      const input = '#snake_case text #UPPER_CASE';
      const expected = 'text';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() does not remove hash from URL-like patterns', () => {
      const input = 'http://example.com#anchor';
      const expected = 'http://example.com';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hash followed by digit then letter', () => {
      const input = '#3d text';
      const expected = 'text';
      expect(stripHashtags(input)).toBe(expected);
    });
  });

  // ============================================================================
  // Real-world Content Tests
  // ============================================================================

  describe('Real-world Content', () => {
    test('stripHashtags() handles typical note content', () => {
      const input = 'Remember to buy groceries #shopping #essentials';
      const expected = 'Remember to buy groceries';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles code-related content', () => {
      const input = 'Fix the #bug in #javascript module';
      const expected = 'Fix the  in  module';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles multi-line note with hashtags', () => {
      const input = 'Meeting notes:\n- Discuss project #timeline\n- Review code #review';
      const expected = 'Meeting notes:\n- Discuss project\n- Review code';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles content with URLs and hashtags', () => {
      const input = 'Check https://example.com for info #reference';
      const expected = 'Check https://example.com for info';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles content with email and hashtags', () => {
      const input = 'Email user@example.com about #task';
      const expected = 'Email user@example.com about';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles content with mixed formatting', () => {
      const input = '**Important** #urgent todo item #today';
      const expected = '**Important**  todo item';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles list items with hashtags', () => {
      const input = '- Item 1 #tag1\n- Item 2 #tag2\n- Item 3 #tag3';
      const expected = '- Item 1\n- Item 2\n- Item 3';
      expect(stripHashtags(input)).toBe(expected);
    });
  });

  // ============================================================================
  // International Characters Tests
  // ============================================================================

  describe('International Characters', () => {
    test('stripHashtags() preserves non-ASCII characters in text', () => {
      const input = 'Hello 日本語 #tag';
      const expected = 'Hello 日本語';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() preserves emoji in text', () => {
      const input = 'Great work! 👍 #done';
      const expected = 'Great work! 👍';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() preserves accented characters', () => {
      const input = 'Café résumé #french';
      const expected = 'Café résumé';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() preserves Cyrillic characters', () => {
      const input = 'Привет #tag мир';
      const expected = 'Привет  мир';
      expect(stripHashtags(input)).toBe(expected);
    });
  });

  // ============================================================================
  // Regex Boundary Cases
  // ============================================================================

  describe('Regex Boundary Cases', () => {
    test('stripHashtags() handles word boundary after hashtag', () => {
      const input = '#tagword';
      const expected = '';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hashtag before punctuation', () => {
      const input = '#tag,word';
      const expected = ',word';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles multiple hash symbols', () => {
      const input = '##tag text';
      const expected = '# text';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hash symbol in middle of word', () => {
      const input = 'word#tag text';
      const expected = 'word text';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() treats non-word char as boundary', () => {
      const input = '#tag@user text';
      const expected = '@user text';
      expect(stripHashtags(input)).toBe(expected);
    });
  });

  // ============================================================================
  // Performance and Large Inputs
  // ============================================================================

  describe('Performance and Large Inputs', () => {
    test('stripHashtags() handles text with many hashtags', () => {
      const tags = Array.from({ length: 100 }, (_, i) => `#tag${i}`).join(' ');
      const input = `start ${tags} end`;
      const result = stripHashtags(input);

      // Verify no hashtags remain
      expect(result).not.toContain('#');
      // Verify all tag names are removed (not present in result)
      for (let i = 0; i < 100; i++) {
        expect(result).not.toContain(`tag${i}`);
      }
      // Verify start and end remain
      expect(result).toContain('start');
      expect(result).toContain('end');
    });

    test('stripHashtags() handles very long hashtag name', () => {
      const longTag = 'a'.repeat(1000);
      const input = `text #${longTag} more`;
      const expected = 'text  more';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles very long text with single hashtag', () => {
      const longText = 'word '.repeat(1000);
      const input = `${longText} #tag`;
      const expected = longText.trim();
      expect(stripHashtags(input)).toBe(expected);
    });
  });

  // ============================================================================
  // Backend Compatibility Tests
  // ============================================================================

  describe('Backend Compatibility', () => {
    test('stripHashtags() matches backend Go regex behavior for simple tags', () => {
      // Backend regex: #\w+ matches # followed by word characters
      // stripHashtags removes the entire match
      const input = 'Simple tag #test';
      const expected = 'Simple tag';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles underscore like backend', () => {
      // \w includes underscores
      const input = 'Tag with underscore #my_tag here';
      const expected = 'Tag with underscore  here';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles numbers like backend', () => {
      // \w includes numbers
      const input = 'Tag with numbers #tag123 here';
      const expected = 'Tag with numbers  here';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() optional whitespace matches backend behavior', () => {
      // The regex uses #\s*\w+ which allows optional whitespace
      // Both the #, optional whitespace, and word chars are removed
      const input = 'Hash with space # tagname here';
      const expected = 'Hash with space  here';
      expect(stripHashtags(input)).toBe(expected);
    });
  });

  // ============================================================================
  // Empty and Whitespace Only Tests
  // ============================================================================

  describe('Empty and Whitespace Only', () => {
    test('stripHashtags() handles whitespace only', () => {
      const input = '   ';
      const expected = '';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles tabs only', () => {
      const input = '\t\t';
      const expected = '';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles newlines only', () => {
      const input = '\n\n';
      const expected = '';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles mixed whitespace only', () => {
      const input = ' \t\n \r ';
      const expected = '';
      expect(stripHashtags(input)).toBe(expected);
    });

    test('stripHashtags() handles hashtag with only whitespace result', () => {
      const input = '#tag';
      const expected = '';
      expect(stripHashtags(input)).toBe(expected);
    });
  });
});
