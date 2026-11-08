<template>
  <NodeViewWrapper as="div" class="rc-editor-container rc-tabs" data-rc-tabs="v1">
    <div class="rc-meta" contenteditable="false">
      <strong>选项卡</strong>
      <RcSyncSelect label="同步组" fallback="不同步" :value="node.attrs.sync"
        :choices="node.attrs.syncChoices" :commit="setSync" />
    </div>
    <NodeViewContent as="div" class="rc-body" />
    <RcAddRow label="添加标签页" @add="add" />
  </NodeViewWrapper>
</template>
<script setup lang="ts">
import RcAddRow from './RcAddRow.vue';
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor';
import { addTab, updateMetadata } from '../commands';
import RcSyncSelect from './RcSyncSelect.vue';
const props = defineProps(nodeViewProps);
function setSync(sync: string, syncChoices: string[]) {
  return updateMetadata(props.editor, props.getPos() ?? -1, { sync, syncChoices });
}
function add() { addTab(props.editor, props.getPos() ?? -1); }
</script>
