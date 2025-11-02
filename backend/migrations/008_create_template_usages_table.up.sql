-- Create template_usages table for tracking template usage analytics
-- This migration creates the template usage tracking functionality

CREATE TABLE template_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
    variables JSONB DEFAULT '{}',
    processing_time_ms INTEGER,
    processed_content TEXT,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT template_usages_processing_time_non_negative CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0)
);

-- Create indexes for performance and analytics
CREATE INDEX idx_template_usages_template_id ON template_usages(template_id);
CREATE INDEX idx_template_usages_user_id ON template_usages(user_id);
CREATE INDEX idx_template_usages_note_id ON template_usages(note_id);
CREATE INDEX idx_template_usages_used_at ON template_usages(used_at DESC);
CREATE INDEX idx_template_usages_used_at_asc ON template_usages(used_at ASC);

-- Composite indexes for common analytics queries
CREATE INDEX idx_template_usages_template_user_used_at ON template_usages(template_id, user_id, used_at DESC);
CREATE INDEX idx_template_usages_user_used_at_template ON template_usages(user_id, used_at DESC, template_id);
CREATE INDEX idx_template_usages_template_date_count ON template_usages(template_id, date_trunc('day', used_at));

-- GIN index for variables JSONB for analytics
CREATE INDEX idx_template_usages_variables ON template_usages USING GIN(variables);

-- Function to get template usage statistics
CREATE OR REPLACE FUNCTION get_template_usage_stats(
    p_user_id UUID DEFAULT NULL,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    template_id UUID,
    template_name VARCHAR,
    usage_count BIGINT,
    unique_users BIGINT,
    avg_processing_time DECIMAL,
    last_used TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.name,
        COUNT(tu.id) as usage_count,
        COUNT(DISTINCT tu.user_id) as unique_users,
        ROUND(AVG(tu.processing_time_ms), 2) as avg_processing_time,
        MAX(tu.used_at) as last_used
    FROM templates t
    LEFT JOIN template_usages tu ON t.id = tu.template_id
        AND tu.used_at >= CURRENT_DATE - INTERVAL '1 day' * p_days_back
        AND (p_user_id IS NULL OR tu.user_id = p_user_id)
    WHERE (p_user_id IS NULL OR t.user_id = p_user_id OR t.is_public OR t.is_built_in)
    GROUP BY t.id, t.name
    ORDER BY usage_count DESC, last_used DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to record template usage
CREATE OR REPLACE FUNCTION record_template_usage(
    p_template_id UUID,
    p_user_id UUID,
    p_variables JSONB DEFAULT '{}',
    p_processing_time_ms INTEGER DEFAULT NULL,
    p_processed_content TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_usage_id UUID;
BEGIN
    -- Generate new usage ID
    v_usage_id := gen_random_uuid();

    -- Insert usage record
    INSERT INTO template_usages (
        id,
        template_id,
        user_id,
        variables,
        processing_time_ms,
        processed_content,
        used_at
    ) VALUES (
        v_usage_id,
        p_template_id,
        p_user_id,
        p_variables,
        p_processing_time_ms,
        p_processed_content,
        CURRENT_TIMESTAMP
    );

    -- Increment template usage count
    UPDATE templates
    SET usage_count = usage_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_template_id;

    RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get popular templates
CREATE OR REPLACE FUNCTION get_popular_templates(
    p_user_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 10,
    p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    template_id UUID,
    template_name VARCHAR,
    template_description TEXT,
    category VARCHAR,
    usage_count BIGINT,
    is_built_in BOOLEAN,
    is_public BOOLEAN,
    icon VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.name,
        t.description,
        t.category,
        COUNT(tu.id) as usage_count,
        t.is_built_in,
        t.is_public,
        t.icon
    FROM templates t
    INNER JOIN template_usages tu ON t.id = tu.template_id
    WHERE tu.used_at >= CURRENT_DATE - INTERVAL '1 day' * p_days_back
        AND (p_user_id IS NULL OR t.user_id = p_user_id OR t.is_public OR t.is_built_in)
        AND (p_user_id IS NULL OR tu.user_id = p_user_id OR t.is_public OR t.is_built_in)
    GROUP BY t.id, t.name, t.description, t.category, t.is_built_in, t.is_public, t.icon
    ORDER BY usage_count DESC, t.name ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old usage records (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_template_usages(
    p_days_to_keep INTEGER DEFAULT 365
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM template_usages
    WHERE used_at < CURRENT_DATE - INTERVAL '1 day' * p_days_to_keep;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE template_usages IS 'Tracks every instance of template application for analytics and optimization';
COMMENT ON COLUMN template_usages.id IS 'Unique identifier for the usage record';
COMMENT ON COLUMN template_usages.template_id IS 'Reference to the template that was used';
COMMENT ON COLUMN template_usages.user_id IS 'User who applied the template';
COMMENT ON COLUMN template_usages.note_id IS 'Note that was created from the template (if applicable)';
COMMENT ON COLUMN template_usages.variables IS 'JSON object of variable values used in this application';
COMMENT ON COLUMN template_usages.processing_time_ms IS 'Time taken to process the template in milliseconds';
COMMENT ON COLUMN template_usages.processed_content IS 'Final processed content after variable substitution';
COMMENT ON COLUMN template_usages.used_at IS 'Timestamp when the template was applied';

COMMENT ON FUNCTION get_template_usage_stats IS 'Returns usage statistics for templates, optionally filtered by user and time period';
COMMENT ON FUNCTION record_template_usage IS 'Records a template usage and updates the template usage count';
COMMENT ON FUNCTION get_popular_templates IS 'Returns most frequently used templates within a time period';
COMMENT ON FUNCTION cleanup_old_template_usages IS 'Deletes old usage records for maintenance, returns count of deleted records';