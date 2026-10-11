// true = fake backend in your browser for local testing (no Supabase needed)
// set to false once you've filled in the two values below
const USE_MOCK = false;

// Supabase dashboard > Project Settings > API
// The anon key is meant to be public. NEVER put the service_role key in here.
const SUPABASE_URL = "https://isxjyehkrpyyupltbbna.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeGp5ZWhrcnB5eXVwbHRiYm5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NDg5MTIsImV4cCI6MjEwNzIyNDkxMn0.V2FF2EQJrjTtDqmoCgXNY6FW_-MqglrqCGSid88ZRSs";

// Auto stock dashboard UI (NL / toggle / listing coords). Shown only to head admins.
const AUTO_STOCK_UI = true;
