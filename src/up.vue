<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useDownloadStore } from './store'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Toast from 'primevue/toast'

interface DownloadSong {
  url: string
  title: string
  cover: string
  author: string
  dir: string  // 新增的 dir 参数
}

const toast = useToast()
const store = useDownloadStore()

const upId = useLocalStorage('upId', '')
const outputPath = useLocalStorage('outputPath', '')
const cookie = useLocalStorage('cookie', '')
const list = ref<any[]>([])

function getUpUrl(obj: any) {
  const url1 = obj.baseUrl || ''
  const url2 = obj.backup_url?.[0] || ''
  const url3 = obj.backup_url?.[1] || ''

  // 找到第一个不是https://xy 开头的url
  const urlList = [url1, url2, url3].filter(url => !url.startsWith('https://xy'))
  return urlList[0] || url1
}

const page = ref({
  pn: 1,
  ps: 25,
  count: 0,
})

onMounted(() => {
  getDefaultPath()
})

const getDefaultPath = async () => {
  const result = await window.ipcRenderer.invoke('dir:getDesktopPath')
  outputPath.value = result
}

const handleFolderSelect = async () => {
  try {
    const result = await window.ipcRenderer.invoke('dialog:openDirectory')
    if (result.filePaths && result.filePaths.length > 0) {
      outputPath.value = result.filePaths[0]
    }
  } catch (error) {
    console.error('选择文件夹失败:', error)
  }
}

const handleAddUp = async () => {
  if (!upId.value) {
    toast.add({ severity: 'error', summary: 'Error', detail: '请输入up主id', life: 3000 })
    return
  }

  const upInfo = await window.ipcRenderer.invoke('api:getUpInfo', upId.value)
  if (!upInfo) {
    toast.add({ severity: 'error', summary: 'Error', detail: '获取up主信息失败', life: 3000 })
    return
  }

  store.ups.push({
    mid: upId.value,
    name: upInfo.name,
    avatar: upInfo.face,
    last_sync_time: new Date().toISOString()
  })

  upId.value = ''
  toast.add({ severity: 'success', summary: 'Success', detail: '添加up主成功', life: 3000 })
}

const getAllUserVideos = async (mid: string) => {
  const videos = []
  let currentPage = 1
  let totalCount = 0
  
  try {
    // 先获取第一页，以获取总数
    const firstResult = await window.ipcRenderer.invoke('api:getUserArc', {
      mid,
      bili_cookie: cookie.value,
      pn: currentPage,
      ps: page.value.ps
    })

    if (!firstResult || !firstResult.data) {
      throw new Error('获取视频列表失败')
    }
    totalCount = firstResult.data.page.count
    videos.push(...firstResult.data.list.vlist)

    // 计算总页数
    const totalPages = Math.ceil(totalCount / page.value.ps)

    // 获取剩余页面
    for (currentPage = 2; currentPage <= totalPages; currentPage++) {
      const result = await window.ipcRenderer.invoke('api:getUserArc', {
        mid,
        bili_cookie: cookie.value,
        pn: currentPage,
        ps: page.value.ps
      })

      if (!result || !result.data) {
        throw new Error(`获取第 ${currentPage} 页失败`)
      }

      videos.push(...result.data.list.vlist)
      // 可以添加进度提示
      toast.add({ 
        severity: 'info', 
        summary: '进度', 
        detail: `已获取 ${currentPage}/${totalPages} 页`, 
        life: 2000 
      })
    }

    return videos
  } catch (error) {
    console.error('获取视频列表出错:', error)
    toast.add({ 
      severity: 'error', 
      summary: 'Error', 
      detail: String(error), 
      life: 3000 
    })
    return null
  }
}

const handleGetUserArc = async () => {
  if (!upId.value) {
    toast.add({ severity: 'error', summary: 'Error', detail: '请输入up主id', life: 3000 })
    return
  }

  const allVideos = await getAllUserVideos(upId.value)
  if (allVideos) {
    list.value = allVideos
    toast.add({ 
      severity: 'success', 
      summary: 'Success', 
      detail: `成功获取 ${allVideos.length} 个视频`, 
      life: 3000 
    })
  }
}

// 添加计数的 ref
const completed = ref(0)
const processing = ref(new Set())

const handleDownload = async () => {
  if (list.value.length === 0) {
    toast.add({ severity: 'error', summary: 'Error', detail: '没有可下载的视频', life: 3000 })
    return
  }

  // 重置计数
  completed.value = 0
  processing.value = new Set()

  const authorName = list.value[0].author
  const authorDir = `${outputPath.value}/${authorName}`
  
  try {
    await window.ipcRenderer.invoke('dir:create', authorDir)
  } catch (error) {
    console.error('创建文件夹失败:', error)
    toast.add({ 
      severity: 'error', 
      summary: 'Error', 
      detail: '创建下载文件夹失败', 
      life: 3000 
    })
    return
  }

  const concurrentLimit = 8
  const videos = [...list.value]

  const downloadOne = async (video: any) => {
    try {
      await getVideoData(video.bvid)
      completed.value++
      toast.add({ 
        severity: 'success', 
        summary: 'Success', 
        detail: `下载进度: ${completed.value}/${list.value.length}`, 
        life: 2000 
      })
    } catch (error) {
      console.error(`下载失败 ${video.title}:`, error)
      toast.add({ 
        severity: 'error', 
        summary: 'Error', 
        detail: `下载失败: ${video.title}`, 
        life: 3000 
      })
    }
  }

  const processQueue = async () => {
    while (videos.length > 0 || processing.value.size > 0) {
      while (processing.value.size < concurrentLimit && videos.length > 0) {
        const video = videos.shift()!
        const promise = downloadOne(video)
        processing.value.add(promise)
        promise.then(() => processing.value.delete(promise))
      }
      if (processing.value.size > 0) {
        await Promise.race(processing.value)
      }
    }
  }

  try {
    await processQueue()
    toast.add({ 
      severity: 'success', 
      summary: 'Success', 
      detail: '所有视频下载完成！', 
      life: 3000 
    })
  } catch (error) {
    console.error('下载过程出错:', error)
    toast.add({ 
      severity: 'error', 
      summary: 'Error', 
      detail: '下载过程出错', 
      life: 3000 
    })
  }
}

async function getVideoData(bvid: string) {
  const res = await window.ipcRenderer.invoke('api:getCid', bvid)
  if (!res) {
    console.error('没有找到cid')
    return
  }

  const videData = await window.ipcRenderer.invoke('api:getAudioUrl', res.bvid, res.cid)
  if (!videData) {
    console.error('没有找到视频数据')
    return
  }

  let dash = videData.data.dash
  const url = getUpUrl(dash.audio[0])
  const authorDir = `${outputPath.value}/${res.data.owner.name}`
  const title = res.data.title
  
  // 检查文件是否已存在
  const exists = await window.ipcRenderer.invoke('file:exists', {
    dir: authorDir,
    title: title
  })
  
  if (exists) {
    toast.add({ 
      severity: 'info', 
      summary: 'Skip', 
      detail: `文件已存在: ${title}`, 
      life: 2000 
    })
    return
  }

  const song: DownloadSong = {
    url,
    title: title,
    cover: res.data.pic,
    author: res.data.owner.name,
    dir: authorDir,
  }
  
  toast.add({ severity: 'info', summary: 'Info', detail: '开始下载', life: 3000 });
  await window.ipcRenderer.invoke('download:download', song)
}
</script>

<template>
  <div class="flex flex-col gap-5 p-10">
    <div class="flex gap-5 items-center">
        b站cookie
      <InputText class="w-[300px]" v-model="cookie" />
    </div>
    <div class="flex gap-5 items-center">
      输入up主id
      <InputText class="w-[300px]" v-model="upId" />
      <Button label="添加" @click="handleAddUp" />
    </div>
    <div class="flex gap-5 items-center">
      选择下载目录
      <InputText v-model="outputPath" class="w-[300px]" />
      <Button label="选择目录" @click="handleFolderSelect" />
    </div>
    <Toast />
    <div class="flex gap-5 items-center">
      <Button class="w-[200px]" label="获取视频列表" @click="handleGetUserArc" />
      <Button class="w-[100px]" label="下载" @click="handleDownload" />
      总数量: {{ list.length }}
      已下载: {{ completed }}
      下载中: {{ processing.size }}
    </div>
    <div class="flex flex-col gap-5">
      <div v-for="item in list" :key="item.bvid">
        <div>{{ item.title }}</div>
        <div>{{ item.bvid }}</div>
        <div>{{ item.pubdate }}</div>
      </div>
    </div>
  </div>
</template>
