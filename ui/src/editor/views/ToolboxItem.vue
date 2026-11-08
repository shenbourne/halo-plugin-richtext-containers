<template>
  <HaloToolboxItem
    :editor="editor"
    :icon="icon"
    :title="title"
    :action="action"
    @mousedown.prevent
  />
</template>

<script setup lang="ts">
import { ToolboxItem as HaloToolboxItem } from '@halo-dev/richtext-editor';
import type { PropType } from 'vue';

type NativeProps = InstanceType<typeof HaloToolboxItem>['$props'];
defineProps({
  editor: { type: Object as PropType<NativeProps['editor']>, required: true },
  icon: { type: [Object, Function] as PropType<NativeProps['icon']>, required: true },
  title: String,
  action: Function as PropType<NativeProps['action']>,
});
</script>
