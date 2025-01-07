<script setup lang="ts">
import UP from './up.vue'
import { useDownloadStore } from './store'

const store = useDownloadStore()
</script>

<template>
  <div class="w-screen h-screen">
    <UP />
  </div>
</template>
