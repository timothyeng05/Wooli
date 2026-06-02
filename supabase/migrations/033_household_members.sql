CREATE TABLE household_members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT        NOT NULL,
  display_name TEXT        NOT NULL,
  color        TEXT        NOT NULL DEFAULT '#6b7280',
  sort_order   INT         NOT NULL DEFAULT 0,
  is_shared    BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own household members"
  ON household_members FOR ALL
  TO authenticated
  USING  ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
