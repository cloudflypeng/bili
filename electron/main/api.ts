import { ipcMain } from 'electron'
import { getWbiKeys, encWbi } from './wbi'
import fs from 'fs'
import path from 'path'

interface UserArcParams {
  mid: number
  pn: number
  ps: number
  tid?: number
  keyword?: string
  order?: string
  bili_cookie: string
}

// https://api.bilibili.com/x/web-interface/view?bvid=BV1BL411Y7kc
// 需要这个获取cid
// 用fetch

const getCid = async (bvid: string) => {
  const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`)
  const data = await res.json()
  return { cid: data.data.cid, bvid, data: data.data }
}

// https://api.bilibili.com/x/player/playurl?fnval=16&bvid=BV1jh4y1G7oT&cid=1157282735
// 需要这个获取音频和视频的url
// 用fetch
const getAudioUrl = async (bvid: string, cid: string) => {
  const res = await fetch(`https://api.bilibili.com/x/player/playurl?fnval=16&bvid=${bvid}&cid=${cid}`)
  const data = await res.json()
  return data
}
// 需要这个获取音频和视频的url

const getUserArc = async (params: UserArcParams) => {
  const defaultParams = {
    mid: 0,
    pn: 1,
    ps: 25,
    tid: 3,
    keyword: '',
    order: 'pubdate',
  }
  params = { ...defaultParams, ...params }
  const web_keys = await getWbiKeys()
  const img_key = web_keys.img_key
  const sub_key = web_keys.sub_key
  const query = encWbi(params, img_key, sub_key)
  const res = await fetch(`https://api.bilibili.com/x/space/wbi/arc/search?${query}`, {
    method: 'GET',
    headers: {
      Referer: 'https://message.bilibili.com/',
      Cookie: params.bili_cookie,
    },
  })
  return res.json()
}

ipcMain.handle('api:getCid', async (event, bvid: string) => {
  try {
    return await getCid(bvid)
  }
  catch (e) {
    console.error(e)
    return null
  }
})

ipcMain.handle('api:getAudioUrl', async (event, bvid: string, cid: string) => {
  try {
    return await getAudioUrl(bvid, cid)
  }
  catch (e) {
    console.error(e)
    return null
  }
})

// 获取up主视频列表
// 

ipcMain.handle('api:getUserArc', async (event, params: UserArcParams) => {
  try {
    return await getUserArc(params)
  }
  catch (e) {
    console.error(e)
    return null
  }
})

// 添加创建文件夹的 IPC 处理器
ipcMain.handle('dir:create', async (event, dirPath: string) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true })
    return true
  } catch (error) {
    console.error('创建文件夹失败:', error)
    return false
  }
})

// 添加文件检查的 IPC 处理器
ipcMain.handle('file:exists', async (event, { dir, title }: { dir: string, title: string }) => {
  try {
    // 检查 MP3 文件是否存在
    const mp3Path = path.join(dir, `${title}.mp3`)
    return fs.existsSync(mp3Path)
  } catch (error) {
    console.error('检查文件失败:', error)
    return false
  }
})

