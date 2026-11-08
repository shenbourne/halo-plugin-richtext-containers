<template>
  <NodeViewWrapper as="aside" class="rc-editor-container rc-hint" :data-rc-kind="node.attrs.kind" data-rc-hint="v1">
    <div class="rc-meta" contenteditable="false">
      <strong>提示容器</strong>
      <label>类型<select :value="node.attrs.kind" @change="setKind"><option value="important">重要</option><option value="info">信息</option><option value="note">注释</option><option value="tip">提示</option><option value="warning">注意</option><option value="caution">警告</option><option value="details">详情</option></select></label>
      <label>标题<input :value="node.attrs.title" maxlength="180" @change="setTitle" placeholder="留空使用类型默认标题" /></label>
      <label v-if="node.attrs.kind === 'details'"><input type="checkbox" :checked="node.attrs.open" @change="setOpen" />默认展开</label>
    </div>
    <NodeViewContent as="div" class="rc-body" />
  </NodeViewWrapper>
</template>
<script setup lang="ts">
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor';
import { updateMetadata } from '../commands';
const props = defineProps(nodeViewProps);
function setKind(e: Event) { updateMetadata(props.editor, props.getPos() ?? -1, { kind: (e.target as HTMLSelectElement).value }); }
function setTitle(e: Event) { updateMetadata(props.editor, props.getPos() ?? -1, { title: (e.target as HTMLInputElement).value }); }
function setOpen(e: Event) { updateMetadata(props.editor, props.getPos() ?? -1, { open: (e.target as HTMLInputElement).checked }); }
</script>
