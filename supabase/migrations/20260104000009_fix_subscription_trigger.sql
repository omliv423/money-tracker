-- Fix subscription trigger to ensure proper permissions and schema
-- The original trigger may fail if search_path is not set correctly

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
DROP FUNCTION IF EXISTS create_default_subscription();

-- Recreate function with explicit schema and SET clause
CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create subscription for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_default_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_subscription() TO service_role;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_subscription();
