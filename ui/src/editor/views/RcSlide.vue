<template>
  <NodeViewWrapper as="div" class="rc-editor-container rc-slide" data-rc-slide="v1">
    <div class="rc-meta" contenteditable="false">
      <strong>页 {{ location.index + 1 }}</strong>
      <label>标题<input :value="node.attrs.title" maxlength="180" @change="setTitle" /></label>
      <button type="button" :disabled="groupLocation.index <= 0" @mousedown.prevent @click="moveGroup(-1)">移至上一节</button>
      <button type="button" :disabled="groupLocation.index >= groupLocation.count - 1" @mousedown.prevent @click="moveGroup(1)">移至下一节</button>
      <RcItemActions :index="location.index" :count="location.count" item="页" @move="move" @remove="remove" />
    </div>
    <NodeViewContent as="div" class="rc-body" />
  </NodeViewWrapper>
</template>
<script setup lang="ts">
import RcItemActions from './RcItemActions.vue';
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor';
import { ancestorPos, itemLocation, moveItem, moveSlideToGroup, removeItem, updateMetadata } from '../commands';
const props = defineProps(nodeViewProps);
function pos() { return props.getPos() ?? -1; }
const revision = ref(0);
function refreshLocation() { revision.value++; }
onMounted(() => props.editor.on('update', refreshLocation));
onBeforeUnmount(() => props.editor.off('update', refreshLocation));
const location = computed(() => { void revision.value; void props.node; return itemLocation(props.editor, pos()); });
const groupLocation = computed(() => { void revision.value; void props.node; return itemLocation(props.editor, ancestorPos(props.editor, pos(), 'rcGroup')); });
function setTitle(e: Event) { updateMetadata(props.editor, pos(), { title: (e.target as HTMLInputElement).value }); }
function move(direction: -1 | 1) { moveItem(props.editor, pos(), direction); }
function moveGroup(direction: -1 | 1) { moveSlideToGroup(props.editor, pos(), groupLocation.value.index + direction); }
function remove() { removeItem(props.editor, pos(), true); }
</script>
