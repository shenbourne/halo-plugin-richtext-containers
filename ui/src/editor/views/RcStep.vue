<template>
  <NodeViewWrapper as="div" class="rc-editor-container rc-step">
    <div class="rc-meta" contenteditable="false">
      <strong>{{ location.index + 1 }}</strong>
      <label>标题<input :value="node.attrs.title" maxlength="180" @change="setTitle" /></label>
      <RcItemActions :index="location.index" :count="location.count" item="步骤" @move="move" @remove="remove" />
    </div>
    <NodeViewContent as="div" class="rc-body" />
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor';
import { itemLocation, moveItem, removeItem, updateMetadata } from '../commands';
import RcItemActions from './RcItemActions.vue';

const props = defineProps(nodeViewProps);
function pos() { return props.getPos() ?? -1; }
const revision = ref(0);
function refreshLocation() { revision.value++; }
onMounted(() => props.editor.on('update', refreshLocation));
onBeforeUnmount(() => props.editor.off('update', refreshLocation));
const location = computed(() => { void revision.value; void props.node; return itemLocation(props.editor, pos()); });
function setTitle(event: Event) { updateMetadata(props.editor, pos(), { title: (event.target as HTMLInputElement).value }); }
function move(direction: -1 | 1) { moveItem(props.editor, pos(), direction); }
function remove() { removeItem(props.editor, pos(), true); }
</script>
