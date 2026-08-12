import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { projectApi } from '@/api/index'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'
import router from '@/router'
export interface Project {
  id: string | number
  name: string
  description?: string
}

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProjectId = ref<string | number | null>(
    localStorage.getItem('mc-project-id') || null,
  )
  const loading = ref(false)

  const currentProject = computed(() =>
    projects.value.find((p) => String(p.id) === String(currentProjectId.value)) || projects.value[0] || null,
  )

  async function fetchProjects() {
    loading.value = true
    try {
      const res: any = await projectApi.listEnabled()
      projects.value = res.data || []

      const storedId = localStorage.getItem('mc-project-id')
      if (storedId && projects.value.some((p) => String(p.id) === storedId)) {
        currentProjectId.value = storedId
      } else if (projects.value.length > 0) {
        const firstId = projects.value[0].id
        await setCurrentProject(firstId)
      }
    } catch (e) {
      console.warn('Failed to fetch projects:', e)
    } finally {
      loading.value = false
    }
  }

  async function switchProject(id: string | number) {
    if (String(id) === String(currentProjectId.value)) return
    await setCurrentProject(id)
  }

  async function setCurrentProject(id: string | number) {
    try {
      const res: any = await projectApi.setCurrent(id)
      currentProjectId.value = id
      localStorage.setItem('mc-project-id', String(id))
      const workspaceId: string | null = res?.data?.workspaceId || res?.workspaceId || null
      if (workspaceId) {
        await useWorkspaceStore().switchWorkspace(workspaceId)
        if (router.currentRoute.value.name !== 'Dashboard') {
          router.push({ name: 'Dashboard' })
        }
      }
    } catch (e) {
      console.warn('Failed to set current project:', e)
    }
  }

  return {
    projects,
    currentProjectId,
    currentProject,
    loading,
    fetchProjects,
    switchProject,
  }
})
