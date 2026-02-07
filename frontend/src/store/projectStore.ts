import { create } from 'zustand'
import type { ProjectData, SyncStatus, SimulationResult } from '@/types'
import * as api from '@/lib/api'
import { runSimulation } from '@/lib/simulation'

interface ProjectStore {
  // State
  project: ProjectData | null
  cloudProject: ProjectData | null
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  previousState: ProjectData | null
  isLoading: boolean
  error: string | null
  simulationResult: SimulationResult | null
  
  // Actions
  loadProject: (projectId: string) => Promise<boolean>
  createProject: (name?: string) => Promise<ProjectData | null>
  updateItem: (itemKey: string, updates: Partial<ProjectData['items'][string]>) => void
  addItem: (itemKey: string, item: ProjectData['items'][string]) => void
  removeItem: (itemKey: string) => void
  setProjectName: (name: string) => void
  
  // Sync actions
  pullFromCloud: () => Promise<boolean>
  pushToCloud: (force?: boolean) => Promise<{ success: boolean; conflict?: boolean }>
  
  // Simulation
  simulate: () => void
  
  // Undo
  undo: () => void
  
  // Export/Import
  exportJson: () => string
  importJson: (json: string) => boolean
  
  // Helpers
  updateSyncStatus: () => void
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  cloudProject: null,
  syncStatus: 'unknown',
  lastSyncedAt: null,
  previousState: null,
  isLoading: false,
  error: null,
  simulationResult: null,
  
  loadProject: async (projectId: string) => {
    set({ isLoading: true, error: null })
    
    try {
      const project = await api.getProject(projectId)
      
      if (project) {
        set({
          project,
          cloudProject: JSON.parse(JSON.stringify(project)),
          syncStatus: 'in_sync',
          lastSyncedAt: new Date().toISOString(),
          isLoading: false,
        })
        return true
      } else {
        set({ error: 'Project not found', isLoading: false })
        return false
      }
    } catch (err) {
      set({ error: 'Failed to load project', isLoading: false })
      return false
    }
  },
  
  createProject: async (name?: string) => {
    set({ isLoading: true, error: null })
    
    try {
      const project = await api.createProject(name)
      set({
        project,
        cloudProject: JSON.parse(JSON.stringify(project)),
        syncStatus: 'in_sync',
        lastSyncedAt: new Date().toISOString(),
        isLoading: false,
      })
      return project
    } catch (err) {
      set({ error: 'Failed to create project', isLoading: false })
      return null
    }
  },
  
  updateItem: (itemKey: string, updates: Partial<ProjectData['items'][string]>) => {
    const { project } = get()
    if (!project) return
    
    set({
      previousState: JSON.parse(JSON.stringify(project)),
      project: {
        ...project,
        items: {
          ...project.items,
          [itemKey]: {
            ...project.items[itemKey],
            ...updates,
          },
        },
      },
    })
    
    get().updateSyncStatus()
  },
  
  addItem: (itemKey: string, item: ProjectData['items'][string]) => {
    const { project } = get()
    if (!project) return
    
    set({
      previousState: JSON.parse(JSON.stringify(project)),
      project: {
        ...project,
        items: {
          ...project.items,
          [itemKey]: item,
        },
      },
    })
    
    get().updateSyncStatus()
  },
  
  removeItem: (itemKey: string) => {
    const { project } = get()
    if (!project) return
    
    const newItems = { ...project.items }
    delete newItems[itemKey]
    
    set({
      previousState: JSON.parse(JSON.stringify(project)),
      project: {
        ...project,
        items: newItems,
      },
    })
    
    get().updateSyncStatus()
  },
  
  setProjectName: (name: string) => {
    const { project } = get()
    if (!project) return
    
    set({
      previousState: JSON.parse(JSON.stringify(project)),
      project: {
        ...project,
        name,
      },
    })
    
    get().updateSyncStatus()
  },
  
  pullFromCloud: async () => {
    const { project } = get()
    if (!project) return false
    
    set({ isLoading: true })
    
    try {
      const cloudProject = await api.getProject(project.project_id)
      
      if (cloudProject) {
        set({
          project: cloudProject,
          cloudProject: JSON.parse(JSON.stringify(cloudProject)),
          syncStatus: 'in_sync',
          lastSyncedAt: new Date().toISOString(),
          isLoading: false,
        })
        return true
      }
      
      set({ isLoading: false })
      return false
    } catch (err) {
      set({ error: 'Failed to pull from cloud', isLoading: false })
      return false
    }
  },
  
  pushToCloud: async (force = false) => {
    const { project, cloudProject } = get()
    if (!project) return { success: false }
    
    set({ isLoading: true })
    
    try {
      const result = await api.updateProject(
        project.project_id,
        project,
        { force, expectedVersion: cloudProject?.version }
      )
      
      set({
        project: result.project,
        cloudProject: JSON.parse(JSON.stringify(result.project)),
        syncStatus: 'in_sync',
        lastSyncedAt: new Date().toISOString(),
        isLoading: false,
      })
      
      return { success: true }
    } catch (err: unknown) {
      if ((err as { type?: string }).type === 'conflict') {
        set({ isLoading: false })
        return { success: false, conflict: true }
      }
      
      set({ error: 'Failed to push to cloud', isLoading: false })
      return { success: false }
    }
  },
  
  simulate: () => {
    const { project } = get()
    if (!project) return
    
    const result = runSimulation(project)
    set({ simulationResult: result })
  },
  
  undo: () => {
    const { previousState } = get()
    if (!previousState) return
    
    set({
      project: previousState,
      previousState: null,
    })
    
    get().updateSyncStatus()
  },
  
  exportJson: () => {
    const { project } = get()
    if (!project) return '{}'
    return JSON.stringify(project, null, 2)
  },
  
  importJson: (json: string) => {
    try {
      const data = JSON.parse(json)
      
      // Basic validation
      if (!data.project_id || !data.items) {
        return false
      }
      
      set({
        previousState: get().project ? JSON.parse(JSON.stringify(get().project)) : null,
        project: data,
      })
      
      get().updateSyncStatus()
      return true
    } catch {
      return false
    }
  },
  
  updateSyncStatus: () => {
    const { project, cloudProject } = get()
    
    if (!project || !cloudProject) {
      set({ syncStatus: 'unknown' })
      return
    }
    
    const localJson = JSON.stringify(project.items)
    const cloudJson = JSON.stringify(cloudProject.items)
    
    if (localJson !== cloudJson || project.name !== cloudProject.name) {
      set({ syncStatus: 'local_changes' })
    } else {
      set({ syncStatus: 'in_sync' })
    }
  },
}))
