<template>
  <NodeViewWrapper as="aside" class="rc-editor-container rc-footnote" data-rc-footnote="v1">
    <div class="rc-meta" contenteditable="false">
      <strong>脚注内容</strong>
      <label>脚注名称<input :value="node.attrs.name || fallbackName" maxlength="96" @change="setName" placeholder="用于在引用中选择" /></label>
    </div>
    <NodeViewContent as="div" class="rc-body" />
  </NodeViewWrapper>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor';
import { updateMetadata } from '../commands';
import { footnoteOptions } from '../footnote-options';
const props = defineProps(nodeViewProps);
const fallbackName = computed(() => footnoteOptions(props.editor.state.doc)
  .find(option => option.key === props.node.attrs.key)?.name || '');
function setName(event: Event) {
  const input = event.target as HTMLInputElement;
  updateMetadata(props.editor, props.getPos() ?? -1, { name: input.value });
  input.value = props.editor.state.doc.nodeAt(props.getPos() ?? -1)?.attrs.name || fallbackName.value;
}
</script>
