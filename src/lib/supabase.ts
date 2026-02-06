
import { createClient } from "@supabase/supabase-js";

// Validates if the URL is a valid URL
const isValidUrl = (urlString: string) => {
  try { 
    return Boolean(new URL(urlString)); 
  }
  catch(e){ 
    return false; 
  }
}

// These will need to be provided by the user in a .env file
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = (envUrl && isValidUrl(envUrl)) ? envUrl : "https://placeholder-project.supabase.co";
const supabaseAnonKey = envKey || "placeholder-key";

if (!envUrl || !envKey) {
  console.warn("Supabase credentials missing. Using placeholder values to prevent crash.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
