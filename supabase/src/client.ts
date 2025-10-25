import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseServiceClientOptions {
  /** Override the Supabase REST URL (defaults to SUPABASE_URL env var). */
  url?: string;
  /** Override the Supabase service role key (defaults to SUPABASE_SERVICE_ROLE_KEY env var). */
  serviceRoleKey?: string;
}

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigurationError';
  }
}

export function createSupabaseServiceClient(
  options: SupabaseServiceClientOptions = {}
): SupabaseClient {
  const supabaseUrl = options.url ?? process.env.SUPABASE_URL ?? '';
  const serviceRoleKey = options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!supabaseUrl.trim()) {
    throw new SupabaseConfigurationError('SUPABASE_URL environment variable must be defined.');
  }

  if (!serviceRoleKey.trim()) {
    throw new SupabaseConfigurationError('SUPABASE_SERVICE_ROLE_KEY environment variable must be defined.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
