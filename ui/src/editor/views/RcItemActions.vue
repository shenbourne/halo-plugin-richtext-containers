<template>
  <div class="rc-item-actions" @mousedown.prevent>
    <button type="button" :aria-label="`前移${item}`" :title="`前移${item}`" :disabled="index <= 0" @click="$emit('move', -1)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
    </button>
    <button type="button" :aria-label="`后移${item}`" :title="`后移${item}`" :disabled="index >= count - 1" @click="$emit('move', 1)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    <button v-if="count > 1" type="button" class="rc-item-delete" :aria-label="`删除${item}`" :title="`删除${item}`" @click="$emit('remove')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
    </button>
  </div>
</template>
<script setup lang="ts">
defineProps<{ item: string; index: number; count: number }>();
defineEmits<{ move: [direction: -1 | 1]; remove: [] }>();
</script>
