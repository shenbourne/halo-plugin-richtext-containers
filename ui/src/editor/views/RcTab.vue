<template>
  <NodeViewWrapper as="div" class="rc-editor-container rc-tab" data-rc-tab="v1">
    <div class="rc-meta" contenteditable="false">
      <strong>标签页 {{ location.index + 1 }}</strong>
      <label>标签<input :value="node.attrs.title" maxlength="180" @change="setTitle" /></label>
      <label><input type="checkbox" :checked="isDefault" :disabled="isDefault" @change="setDefault" />设为默认</label>
      <RcSyncSelect label="同步值" :fallback="title" :suggested="title" :value="node.attrs.value"
        :choices="node.attrs.syncChoices" :commit="setValue" />
      <RcItemActions :index="location.index" :count="location.count" item="标签页" @move="move" @remove="remove" />
      <span v-if="error" class="rc-error" role="alert">{{ error }}</span>
    </div>
    <NodeViewContent as="div" class="rc-body" />
  </NodeViewWrapper>
</template>
<script setup lang="ts">
import RcItemActions from './RcItemActions.vue';
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@halo-dev/richtext-editor';
import { ancestorPos, moveItem, removeItem, updateMetadata, itemLocation } from '../commands';
import RcSyncSelect from './RcSyncSelect.vue';
const props = defineProps(nodeViewProps);
const error = ref('');
function pos() { return props.getPos() ?? -1; }
const revision = ref(0);
function refreshLocation() { revision.value++; }
onMounted(() => props.editor.on('update', refreshLocation));
onBeforeUnmount(() => props.editor.off('update', refreshLocation));
const location = computed(() => { void revision.value; void props.node; return itemLocation(props.editor, pos()); });
const title = computed(() => props.node.attrs.title || `标签页 ${location.value.index + 1}`);
const isDefault = ref(false);
function refreshDefault() {
  const parent = ancestorPos(props.editor, pos(), 'rcTabs');
  isDefault.value = parent >= 0 && props.editor.state.doc.nodeAt(parent)?.attrs.defaultId === props.node.attrs.id;
}
onMounted(() => { refreshDefault(); props.editor.on('transaction', refreshDefault); });
onBeforeUnmount(() => { props.editor.off('transaction', refreshDefault); });
function setTitle(event: Event) {
  const input = event.target as HTMLInputElement;
  const ok = updateMetadata(props.editor, pos(), { title: input.value });
  error.value = ok ? '' : '同步值重复，已恢复原值。请使用不同的同步值或标签名。';
  if (!ok) input.value = props.node.attrs.title;
}
function setValue(value: string, syncChoices: string[]) {
  return updateMetadata(props.editor, pos(), { value, syncChoices });
}
function setDefault() { updateMetadata(props.editor, ancestorPos(props.editor, pos(), 'rcTabs'), { defaultId: props.node.attrs.id }); }
function move(direction: -1 | 1) { moveItem(props.editor, pos(), direction); }
function remove() {
  removeItem(props.editor, pos(), true);
}
</script>
