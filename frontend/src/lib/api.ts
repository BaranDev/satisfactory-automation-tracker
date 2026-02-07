import type { ProjectData } from '@/types'

const API_BASE = '/api'

export async function createProject(name: string = 'New Project'): Promise<ProjectData> {
  const response = await fetch(`${API_BASE}/project?name=${encodeURIComponent(name)}`, {
    method: 'POST',
  })
  
  if (!response.ok) {
    throw new Error('Failed to create project')
  }
  
  return response.json()
}

export async function getProject(projectId: string): Promise<ProjectData | null> {
  const response = await fetch(`${API_BASE}/project/${projectId}`)
  
  if (response.status === 404) {
    return null
  }
  
  if (!response.ok) {
    throw new Error('Failed to fetch project')
  }
  
  return response.json()
}

export interface UpdateProjectResponse {
  success: boolean
  project: ProjectData
}

export interface UpdateProjectError {
  message: string
  cloud_version: number
  cloud_last_updated: string
  your_version: number
}

export async function updateProject(
  projectId: string,
  project: ProjectData,
  options: { force?: boolean; expectedVersion?: number } = {}
): Promise<UpdateProjectResponse> {
  const response = await fetch(`${API_BASE}/project/${projectId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project,
      force: options.force ?? false,
      expected_version: options.expectedVersion,
    }),
  })
  
  if (response.status === 409) {
    const error: UpdateProjectError = await response.json()
    throw {
      type: 'conflict',
      ...error,
    }
  }
  
  if (!response.ok) {
    throw new Error('Failed to update project')
  }
  
  return response.json()
}

export async function listAssets(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/assets`)
  
  if (!response.ok) {
    return []
  }
  
  const data = await response.json()
  return data.assets || []
}
