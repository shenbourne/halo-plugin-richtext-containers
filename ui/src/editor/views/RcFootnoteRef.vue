<template>
  <NodeViewWrapper as="span" class="rc-footnote-ref" data-rc-footnote-ref="v1" contenteditable="false">
    <sup aria-hidden="true">脚注</sup>
    <select :value="node.attrs.key" aria-label="选择脚注名称" @change="setKey">
      <option value="">选择脚注</option>
      <option v-if="node.attrs.key && !options.some(option => option.key === node.attrs.key)" :value="node.attrs.key">未找到脚注</option>
      <option v-for="option in options" :key="option.key" :value="option.key">{{ option.label }}</option>
    </select>
    <button type="button" aria-label="删除脚注引用" title="删除引用" @mousedown.prevent @click="remove">×</button>
  </NodeViewWrapper>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from 'vue';
import { NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor';
import { removeNode, updateMetadata } from '../commands';
import { footnoteOptions } from '../footnote-options';
const props = defineProps(nodeViewProps);
const doc = shallowRef(props.editor.state.doc);
function refresh() { doc.value = props.editor.state.doc; }
props.editor.on('transaction', refresh);
onBeforeUnmount(() => props.editor.off('transaction', refresh));
const options = computed(() => footnoteOptions(doc.value));
function setKey(event: Event) {
  const select = event.target as HTMLSelectElement;
  if (!updateMetadata(props.editor, props.getPos() ?? -1, { key: select.value })) select.value = props.node.attrs.key;
}
function remove() { removeNode(props.editor, props.getPos() ?? -1); }
</script>
