<template>
  <NodeViewWrapper as="div" class="rc-editor-container rc-slides" data-rc-slides="v1">
    <div class="rc-meta" contenteditable="false">
      <strong>幻灯片</strong>
      <label>主题<select :value="node.attrs.theme" @change="set('theme', $event)"><option value="auto">自动</option><option value="light">浅色</option><option value="dark">深色</option></select></label>
      <label>切换<select :value="node.attrs.transition" @change="set('transition', $event)"><option value="none">无</option><option value="slide">滑动</option><option value="fade">淡入淡出</option></select></label>
      <label><input type="checkbox" :checked="node.attrs.numbers" @change="set('numbers', $event)" />页码</label>
      <label><input type="checkbox" :checked="node.attrs.progress" @change="set('progress', $event)" />进度</label>
      <label><input type="checkbox" :checked="node.attrs.controls" @change="set('controls', $event)" />控件</label>
    </div>
    <NodeViewContent as="div" class="rc-body" />
    <RcAddRow label="添加节" class="rc-section-add" @add="addHorizontal" />
  </NodeViewWrapper>
</template>
<script setup lang="ts">
import RcAddRow from './RcAddRow.vue';
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor';
import { addSlide, updateMetadata } from '../commands';
const props = defineProps(nodeViewProps);
function set(key: string, event: Event) {
  const input = event.target as HTMLInputElement;
  updateMetadata(props.editor, props.getPos() ?? -1, { [key]: input.type === 'checkbox' ? input.checked : input.value });
}
function addHorizontal() { addSlide(props.editor, props.getPos() ?? -1, 'horizontal'); }
</script>
