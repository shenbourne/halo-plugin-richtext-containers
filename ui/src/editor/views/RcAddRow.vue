<template>
  <div class="rc-add-row" contenteditable="false">
    <button type="button" :aria-label="label" :title="label" @mousedown.prevent @click="$emit('add')">+</button>
  </div>
</template>
<script setup lang="ts">
defineProps<{ label: string }>();
defineEmits<{ add: [] }>();
</script>
