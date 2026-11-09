<template>
  <NodeViewWrapper as="div" class="rc-editor-container" data-rc-steps="v1">
    <div class="rc-meta" contenteditable="false">
      <strong>步骤</strong>
      <label>列表类型
        <select :value="node.attrs.numbered ? 'orderedList' : 'bulletList'" @change="setListType">
          <option value="orderedList">编号</option>
          <option value="bulletList">圆点</option>
        </select>
      </label>
    </div>
    <div class="rc-page-list">
      <NodeViewContent as="div" class="rc-body" />
      <RcAddRow label="添加步骤" class="rc-page-add" @add="append" />
    </div>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor';
import { appendStep, updateMetadata } from '../commands';
import RcAddRow from './RcAddRow.vue';

const props = defineProps(nodeViewProps);
function append() { appendStep(props.editor, props.getPos() ?? -1); }
function setListType(event: Event) {
  const input = event.target as HTMLSelectElement;
  if (input.value === 'orderedList' || input.value === 'bulletList') {
    updateMetadata(props.editor, props.getPos() ?? -1, { numbered: input.value === 'orderedList' });
  }
}
</script>
