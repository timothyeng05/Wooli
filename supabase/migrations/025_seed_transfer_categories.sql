-- Seed Transfer parent category and subcategories for woolitravel@gmail.com
-- Run this in the Supabase SQL editor

DO $$
DECLARE
  v_user_id uuid;
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'woolitravel@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Insert parent "Transfer" category (skip if already exists by name + user)
  INSERT INTO public.categories (user_id, name, color, icon, is_income, is_transfer, sort_order)
  VALUES (v_user_id, 'Transfer', '#8b5cf6', '🔄', false, true, 100)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_parent_id;

  -- If it already existed, fetch its id
  IF v_parent_id IS NULL THEN
    SELECT id INTO v_parent_id
    FROM public.categories
    WHERE user_id = v_user_id AND name = 'Transfer' AND parent_id IS NULL AND is_transfer = true;
  END IF;

  -- Insert subcategories
  INSERT INTO public.categories (user_id, name, color, icon, is_income, is_transfer, parent_id, sort_order)
  VALUES
    (v_user_id, 'Balance Adjustments', '#8b5cf6', '⚖️', false, true, v_parent_id, 1),
    (v_user_id, 'Transfer',            '#8b5cf6', '↔️', false, true, v_parent_id, 2),
    (v_user_id, 'Credit Card Payment', '#8b5cf6', '💳', false, true, v_parent_id, 3)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Transfer categories seeded for user %', v_user_id;
END $$;
