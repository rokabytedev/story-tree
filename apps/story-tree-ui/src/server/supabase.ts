import "server-only";

import { cache } from "react";
import {
  SupabaseConfigurationError,
  createSupabaseServiceClient,
  type SupabaseServiceClientOptions,
} from "../../../../supabase/src/client";

type SupabaseMode = "local" | "remote";

type SupabaseCredentials = Required<Pick<SupabaseServiceClientOptions, "url" | "serviceRoleKey">>;

const MODE_LOCAL: SupabaseMode = "local";
const MODE_REMOTE: SupabaseMode = "remote";

export const getSupabaseClient = cache(() => {
  const credentials = resolveSupabaseCredentials();
  return createSupabaseServiceClient(credentials);
});

function resolveSupabaseCredentials(): SupabaseCredentials {
  const mode = resolveSupabaseMode();

  const url = getFirstDefined(
    mode === MODE_REMOTE
      ? ["SUPABASE_REMOTE_URL", "SUPABASE_URL"]
      : ["SUPABASE_LOCAL_URL", "SUPABASE_URL"],
  );

  if (!url) {
    throw new SupabaseConfigurationError(
      missingEnvMessage(
        mode,
        mode === MODE_REMOTE
          ? ["SUPABASE_REMOTE_URL", "SUPABASE_URL"]
          : ["SUPABASE_LOCAL_URL", "SUPABASE_URL"],
      ),
    );
  }

  const serviceRoleKey = getFirstDefined(
    mode === MODE_REMOTE
      ? ["SUPABASE_REMOTE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
      : ["SUPABASE_LOCAL_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  );

  if (!serviceRoleKey) {
    throw new SupabaseConfigurationError(
      missingEnvMessage(
        mode,
        mode === MODE_REMOTE
          ? ["SUPABASE_REMOTE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
          : ["SUPABASE_LOCAL_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
      ),
    );
  }

  return { url, serviceRoleKey };
}

function resolveSupabaseMode(): SupabaseMode {
  const raw = process.env.STORY_TREE_SUPABASE_MODE?.toLowerCase().trim();
  if (raw === MODE_REMOTE) {
    return MODE_REMOTE;
  }
  return MODE_LOCAL;
}

function getFirstDefined(keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) {
      return value;
    }
  }
  return null;
}

function missingEnvMessage(mode: SupabaseMode, keys: string[]): string {
  const formatted = keys.map((key) => `\`${key}\``).join(" or ");
  return `Unable to resolve Supabase credentials for ${mode} mode. Define ${formatted} in your environment.`;
}
