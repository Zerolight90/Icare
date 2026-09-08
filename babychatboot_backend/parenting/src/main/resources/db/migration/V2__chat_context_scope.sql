-- Context IDs are immutable snapshots, not cascading associations.
-- Existing conversations stay readable; they must not silently acquire a baby/family context.
ALTER TABLE chat_room ADD COLUMN context_version integer NOT NULL DEFAULT 0;
ALTER TABLE chat_room ADD COLUMN context_family_id bigint;
ALTER TABLE chat_room ADD COLUMN context_baby_id bigint;
