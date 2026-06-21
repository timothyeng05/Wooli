CREATE TABLE wishlist_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  note TEXT,
  visited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, country_code)
);

ALTER TABLE wishlist_countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own wishlist"
  ON wishlist_countries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
