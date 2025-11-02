package models

import (
	"time"

	"github.com/google/uuid"
)

// Template represents a note template
type Template struct {
	ID          uuid.UUID `json:"id" db:"id"`
	UserID      uuid.UUID `json:"user_id" db:"user_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Content     string    `json:"content" db:"content"`
	Category    string    `json:"category" db:"category"`
	Variables   []string  `json:"variables" db:"variables"`
	IsBuiltIn   bool      `json:"is_built_in" db:"is_built_in"`
	UsageCount  int       `json:"usage_count" db:"usage_count"`
	IsPublic    bool      `json:"is_public" db:"is_public"`
	Icon        string    `json:"icon" db:"icon"`
	Tags        []string  `json:"tags" db:"tags"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// TemplateVariable represents a template variable definition
type TemplateVariable struct {
	Name         string `json:"name"`
	Type         string `json:"type"` // text, date, number, boolean, list
	Label        string `json:"label"`
	Description  string `json:"description"`
	DefaultValue string `json:"default_value"`
	Required     bool   `json:"required"`
	Options      []string `json:"options,omitempty"` // For select type
}

// TemplateUsage represents a template usage record
type TemplateUsage struct {
	ID         uuid.UUID `json:"id" db:"id"`
	TemplateID uuid.UUID `json:"template_id" db:"template_id"`
	UserID     uuid.UUID `json:"user_id" db:"user_id"`
	NoteID     uuid.UUID `json:"note_id" db:"note_id"`
	Variables  string    `json:"variables" db:"variables"` // JSON string
	UsedAt     time.Time `json:"used_at" db:"used_at"`
}

// TemplateCategory represents a template category
type TemplateCategory struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	Icon        string    `json:"icon" db:"icon"`
	Color       string    `json:"color" db:"color"`
	SortOrder   int       `json:"sort_order" db:"sort_order"`
	IsBuiltIn   bool      `json:"is_built_in" db:"is_built_in"`
}

// Built-in template variables
var BuiltInVariables = map[string]TemplateVariable{
	"date": {
		Name:         "date",
		Type:         "date",
		Label:        "Date",
		Description:  "Current date",
		DefaultValue: "{{date}}",
		Required:     false,
	},
	"time": {
		Name:         "time",
		Type:         "time",
		Label:        "Time",
		Description:  "Current time",
		DefaultValue: "{{time}}",
		Required:     false,
	},
	"timestamp": {
		Name:         "timestamp",
		Type:         "datetime",
		Label:        "Timestamp",
		Description:  "Current date and time",
		DefaultValue: "{{timestamp}}",
		Required:     false,
	},
	"datetime": {
		Name:         "datetime",
		Type:         "datetime",
		Label:        "Date Time",
		Description:  "Current date and time (formatted)",
		DefaultValue: "{{datetime}}",
		Required:     false,
	},
	"user_name": {
		Name:         "user_name",
		Type:         "text",
		Label:        "User Name",
		Description:  "Current user's name",
		DefaultValue: "{{user_name}}",
		Required:     false,
	},
	"user_email": {
		Name:         "user_email",
		Type:         "email",
		Label:        "User Email",
		Description:  "Current user's email",
		DefaultValue: "{{user_email}}",
		Required:     false,
	},
	"uuid": {
		Name:         "uuid",
		Type:         "text",
		Label:        "UUID",
		Description:  "Unique identifier",
		DefaultValue: "{{uuid}}",
		Required:     false,
	},
	"random_number": {
		Name:         "random_number",
		Type:         "number",
		Label:        "Random Number",
		Description:  "Random number between 1 and 1000",
		DefaultValue: "{{random_number}}",
		Required:     false,
	},
	"today": {
		Name:         "today",
		Type:         "date",
		Label:        "Today",
		Description:  "Today's date",
		DefaultValue: "{{today}}",
		Required:     false,
	},
	"tomorrow": {
		Name:         "tomorrow",
		Type:         "date",
		Label:        "Tomorrow",
		Description:  "Tomorrow's date",
		DefaultValue: "{{tomorrow}}",
		Required:     false,
	},
	"yesterday": {
		Name:         "yesterday",
		Type:         "date",
		Label:        "Yesterday",
		Description:  "Yesterday's date",
		DefaultValue: "{{yesterday}}",
		Required:     false,
	},
	"week_start": {
		Name:         "week_start",
		Type:         "date",
		Label:        "Week Start",
		Description:  "Start of current week",
		DefaultValue: "{{week_start}}",
		Required:     false,
	},
	"week_end": {
		Name:         "week_end",
		Type:         "date",
		Label:        "Week End",
		Description:  "End of current week",
		DefaultValue: "{{week_end}}",
		Required:     false,
	},
	"month_start": {
		Name:         "month_start",
		Type:         "date",
		Label:        "Month Start",
		Description:  "Start of current month",
		DefaultValue: "{{month_start}}",
		Required:     false,
	},
	"month_end": {
		Name:         "month_end",
		Type:         "date",
		Label:        "Month End",
		Description:  "End of current month",
		DefaultValue: "{{month_end}}",
		Required:     false,
	},
	"year": {
		Name:         "year",
		Type:         "number",
		Label:        "Year",
		Description:  "Current year",
		DefaultValue: "{{year}}",
		Required:     false,
	},
	"month": {
		Name:         "month",
		Type:         "text",
		Label:        "Month",
		Description:  "Current month name",
		DefaultValue: "{{month}}",
		Required:     false,
	},
	"day_of_week": {
		Name:         "day_of_week",
		Type:         "text",
		Label:        "Day of Week",
		Description:  "Current day of week",
		DefaultValue: "{{day_of_week}}",
		Required:     false,
	},
}

// Built-in template categories
var BuiltInCategories = []TemplateCategory{
	{
		ID:          uuid.MustParse("00000000-0000-0000-0000-000000000001"),
		Name:        "work",
		Description: "Work-related templates",
		Icon:        "briefcase",
		Color:       "#3b82f6",
		SortOrder:   1,
		IsBuiltIn:   true,
	},
	{
		ID:          uuid.MustParse("00000000-0000-0000-0000-000000000002"),
		Name:        "personal",
		Description: "Personal templates",
		Icon:        "user",
		Color:       "#10b981",
		SortOrder:   2,
		IsBuiltIn:   true,
	},
	{
		ID:          uuid.MustParse("00000000-0000-0000-0000-000000000003"),
		Name:        "productivity",
		Description: "Productivity templates",
		Icon:        "check-circle",
		Color:       "#f59e0b",
		SortOrder:   3,
		IsBuiltIn:   true,
	},
	{
		ID:          uuid.MustParse("00000000-0000-0000-0000-000000000004"),
		Name:        "meeting",
		Description: "Meeting templates",
		Icon:        "users",
		Color:       "#8b5cf6",
		SortOrder:   4,
		IsBuiltIn:   true,
	},
	{
		ID:          uuid.MustParse("00000000-0000-0000-0000-000000000005"),
		Name:        "project",
		Description: "Project management templates",
		Icon:        "folder",
		Color:       "#ef4444",
		SortOrder:   5,
		IsBuiltIn:   true,
	},
}

// Built-in templates
var BuiltInTemplates = []Template{
	{
		ID:          uuid.MustParse("00000000-0000-0000-0000-000000000101"),
		UserID:      uuid.Nil,
		Name:        "Meeting Notes",
		Description: "Template for taking meeting notes",
		Content: `# {{meeting_title}} - {{date}}

**Attendees:**
{{attendees}}

**Agenda:**
{{agenda}}

**Discussion Points:**
{{discussion}}

**Action Items:**
{{action_items}}

**Next Steps:**
{{next_steps}}

**Next Meeting:**
{{next_meeting_date}} at {{next_meeting_time}}`,
		Category:    "meeting",
		Variables:   []string{"meeting_title", "attendees", "agenda", "discussion", "action_items", "next_steps", "next_meeting_date", "next_meeting_time"},
		IsBuiltIn:   true,
		UsageCount:  0,
		IsPublic:    true,
		Icon:        "users",
		Tags:        []string{"#meeting", "#notes"},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	},
	{
		ID:          uuid.MustParse("00000000-0000-0000-0000-000000000102"),
		UserID:      uuid.Nil,
		Name:        "Daily Journal",
		Description: "Template for daily journaling",
		Content: `# Daily Journal - {{date}}

## Mood
{{mood}}

## Highlights
- {{highlight_1}}
- {{highlight_2}}
- {{highlight_3}}

## Gratitude
{{gratitude}}

## Challenges
{{challenges}}

## Learnings
{{learnings}}

## Tomorrow's Goals
{{tomorrow_goals}}

## Notes
{{notes}}`,
		Category:    "personal",
		Variables:   []string{"date", "mood", "highlight_1", "highlight_2", "highlight_3", "gratitude", "challenges", "learnings", "tomorrow_goals", "notes"},
		IsBuiltIn:   true,
		UsageCount:  0,
		IsPublic:    true,
		Icon:        "book",
		Tags:        []string{"#journal", "#daily"},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	},
	{
		ID:          uuid.MustParse("00000000-0000-0000-0000-000000000103"),
		UserID:      uuid.Nil,
		Name:        "Bug Report",
		Description: "Template for reporting bugs",
		Content: `# Bug Report - {{issue_id}}

**Summary:**
{{summary}}

**Description:**
{{description}}

**Steps to Reproduce:**
{{steps_to_reproduce}}

**Expected Behavior:**
{{expected_behavior}}

**Actual Behavior:**
{{actual_behavior}}

**Environment:**
- Browser: {{browser}}
- OS: {{os}}
- Version: {{version}}

**Screenshots:**
{{screenshots}}

**Additional Context:**
{{additional_context}}

**Priority:**
{{priority}}

**Assignee:**
{{assignee}}`,
		Category:    "work",
		Variables:   []string{"issue_id", "summary", "description", "steps_to_reproduce", "expected_behavior", "actual_behavior", "browser", "os", "version", "screenshots", "additional_context", "priority", "assignee"},
		IsBuiltIn:   true,
		UsageCount:  0,
		IsPublic:    true,
		Icon:        "bug",
		Tags:        []string{"#bug", "#report"},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	},
	{
		ID:          uuid.MustParse("00000000-0000-0000-0000-000000000104"),
		UserID:      uuid.Nil,
		Name:        "Project Planning",
		Description: "Template for project planning",
		Content: `# {{project_name}} - Project Plan

**Project Overview:**
{{project_overview}}

**Timeline:**
- Start: {{start_date}}
- End: {{end_date}}
- Duration: {{duration}}

**Team Members:**
{{team_members}}

**Objectives:**
{{objectives}}

**Milestones:**
{{milestones}}

**Requirements:**
{{requirements}}

**Resources:**
{{resources}}

**Risks:**
{{risks}}

**Success Criteria:**
{{success_criteria}}

**Budget:**
{{budget}}`,
		Category:    "project",
		Variables:   []string{"project_name", "project_overview", "start_date", "end_date", "duration", "team_members", "objectives", "milestones", "requirements", "resources", "risks", "success_criteria", "budget"},
		IsBuiltIn:   true,
		UsageCount:  0,
		IsPublic:    true,
		Icon:        "folder",
		Tags:        []string{"#project", "#planning"},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	},
	{
		ID:          uuid.MustParse("00000000-0000-0000-0000-000000000105"),
		UserID:      uuid.Nil,
		Name:        "Book Notes",
		Description: "Template for taking book notes",
		Content: `# Book Notes: {{title}}

**Author:** {{author}}
**ISBN:** {{isbn}}
**Pages:** {{pages}}
**Genre:** {{genre}}
**Rating:** {{rating}}/5

**Summary:**
{{summary}}

**Key Takeaways:**
{{takeaways}}

**Favorite Quotes:**
{{quotes}}

**Characters:**
{{characters}}

**Themes:**
{{themes}}

**Personal Reflection:**
{{reflection}}

**Recommendation:**
{{recommendation}}

**Reading Dates:**
- Started: {{start_date}}
- Finished: {{end_date}}`,
		Category:    "personal",
		Variables:   []string{"title", "author", "isbn", "pages", "genre", "rating", "summary", "takeaways", "quotes", "characters", "themes", "reflection", "recommendation", "start_date", "end_date"},
		IsBuiltIn:   true,
		UsageCount:  0,
		IsPublic:    true,
		Icon:        "book-open",
		Tags:        []string{"#book", "#reading", "#notes"},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	},
}

// TableName returns the table name for Template
func (t Template) TableName() string {
	return "templates"
}

// TableName returns the table name for TemplateUsage
func (t TemplateUsage) TableName() string {
	return "template_usages"
}

// TableName returns the table name for TemplateCategory
func (t TemplateCategory) TableName() string {
	return "template_categories"
}