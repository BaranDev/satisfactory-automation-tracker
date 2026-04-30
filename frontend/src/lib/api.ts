// API client for Satisfactory Automation Tracker backend.
// All calls go through /api/* which nginx proxies to the backend container.

const API_BASE = "/api";

// ─── Write-token storage ─────────────────────────────────────────
// One token per project_id is required to mutate it. Tokens are
// returned once on POST /project; we cache them in localStorage so
// subsequent PUTs from the same browser succeed.

const WRITE_TOKEN_KEY = "sap-write-tokens";

function loadTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(WRITE_TOKEN_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function saveTokens(map: Record<string, string>): void {
  localStorage.setItem(WRITE_TOKEN_KEY, JSON.stringify(map));
}

export function setWriteToken(projectId: string, token: string): void {
  const map = loadTokens();
  map[projectId] = token;
  saveTokens(map);
}

export function getWriteToken(projectId: string): string | null {
  return loadTokens()[projectId] ?? null;
}

export interface ProjectData {
  project_id: string;
  name: string;
  version: number;
  last_updated: string;
  assets_base_url?: string;
  items: Record<
    string,
    {
      label: string;
      icon?: string;
      automated: boolean;
      machines: number;
      overclock: number;
    }
  >;
}

interface PushResponse {
  success: boolean;
  project: ProjectData;
}

interface ConflictError {
  message: string;
  cloud_version: number;
  cloud_last_updated: string;
  your_version: number;
}

class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!resp.ok) {
    let detail: unknown;
    try {
      detail = await resp.json();
    } catch {
      detail = resp.statusText;
    }
    throw new ApiError(resp.status, detail);
  }

  return resp.json() as Promise<T>;
}

/** Create a new project. Caches the returned write token in localStorage. */
export async function createProject(
  name: string = "New Project",
): Promise<ProjectData> {
  const data = await request<ProjectData & { write_token?: string }>("/project", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (data.write_token) setWriteToken(data.project_id, data.write_token);
  const { write_token: _omit, ...rest } = data;
  void _omit;
  return rest;
}

/** Fetch project from cloud (Pull) */
export async function getProject(
  projectId: string
): Promise<ProjectData | null> {
  try {
    return await request<ProjectData>(`/project/${projectId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Check cloud version (lightweight version check for polling) */
export async function checkCloudVersion(
  projectId: string
): Promise<{ version: number; lastUpdated: string } | null> {
  try {
    const data = await request<ProjectData>(`/project/${projectId}`);
    return {
      version: data.version,
      lastUpdated: data.last_updated,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Push project to cloud. Sends the cached write-token if we have one. */
export async function updateProject(
  projectId: string,
  project: ProjectData,
  options: { force?: boolean; expectedVersion?: number } = {},
): Promise<PushResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getWriteToken(projectId);
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    return await request<PushResponse>(`/project/${projectId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        project,
        force: options.force ?? false,
        expected_version: options.expectedVersion,
      }),
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      const detail = err.detail as { detail: ConflictError };
      throw new ConflictApiError(detail.detail);
    }
    throw err;
  }
}

/** List asset keys */
export async function listAssets(): Promise<string[]> {
  const resp = await request<{ assets: string[] }>("/assets");
  return resp.assets;
}

/** Get asset URL (returns a redirect URL or presigned URL) */
export function getAssetUrl(key: string): string {
  return `${API_BASE}/assets/${key}`;
}

// Conflict-specific error
export class ConflictApiError extends Error {
  cloudVersion: number;
  cloudLastUpdated: string;
  yourVersion: number;

  constructor(detail: ConflictError) {
    super(detail.message);
    this.cloudVersion = detail.cloud_version;
    this.cloudLastUpdated = detail.cloud_last_updated;
    this.yourVersion = detail.your_version;
  }
}

export { ApiError };