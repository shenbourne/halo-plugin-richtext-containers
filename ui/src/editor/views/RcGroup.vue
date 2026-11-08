<template>
  <NodeViewWrapper as="div" class="rc-editor-container rc-group" data-rc-group="v1">
    <div class="rc-meta" contenteditable="false">
      <strong>节 {{ location.index + 1 }}</strong>
      <RcItemActions :index="location.index" :count="location.count" item="节" @move="move" @remove="remove" />
    </div>
    <div class="rc-page-list">
      <NodeViewContent as="div" class="rc-body" />
      <RcAddRow label="添加页" class="rc-page-add" @add="addVertical" />
    </div>
  </NodeViewWrapper>
</template>
<script setup lang="ts">
import RcItemActions from './RcItemActions.vue';
import RcAddRow from './RcAddRow.vue';
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor';
import { addSlide, itemLocation, moveItem, removeGroup } from '../commands';
const props = defineProps(nodeViewProps);
const revision = ref(0);
function refreshLocation() { revision.value++; }
onMounted(() => props.editor.on('update', refreshLocation));
onBeforeUnmount(() => props.editor.off('update', refreshLocation));
const location = computed(() => { void revision.value; void props.node; return itemLocation(props.editor, props.getPos() ?? -1); });
function addVertical() { addSlide(props.editor, props.getPos() ?? -1, 'vertical'); }
function move(direction: -1 | 1) { moveItem(props.editor, props.getPos() ?? -1, direction); }
function remove() { removeGroup(props.editor, props.getPos() ?? -1, true); }
</script>
