import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

interface Ups {
  mid: string
  name: string
  avatar: string
  last_sync_time: string
}

export const useDownloadStore = defineStore('download', () => {
  const ups = useLocalStorage<Ups[]>('ups', [])

  return {
    ups
  }
})
