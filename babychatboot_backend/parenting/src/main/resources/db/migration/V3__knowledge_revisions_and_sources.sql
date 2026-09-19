-- Preserve all existing embeddings. Unreviewed legacy vectors are excluded by the new retrieval filter.
CREATE TABLE knowledge_revision (
    id uuid PRIMARY KEY,
    source_url text NOT NULL,
    title varchar(200) NOT NULL,
    publisher varchar(200) NOT NULL,
    revised_on date,
    content_hash varchar(64) NOT NULL,
    active boolean NOT NULL,
    chunk_count integer NOT NULL CHECK (chunk_count BETWEEN 1 AND 32),
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_url, content_hash)
);
CREATE UNIQUE INDEX knowledge_revision_one_active ON knowledge_revision (source_url) WHERE active;
ALTER TABLE chat_messages ADD COLUMN retrieval_sources text;
