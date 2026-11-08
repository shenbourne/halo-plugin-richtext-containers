<template>
  <div ref="root" class="rc-sync-select" @focusout="leave" @keydown.esc.stop.prevent="escape">
    <button ref="trigger" type="button" :aria-expanded="open" :aria-label="`${label}：${value || fallback}`" @click="toggle">
      {{ label }}：{{ value || fallback }} <span aria-hidden="true">▾</span>
    </button>
    <div v-if="open" class="rc-sync-popup" role="group" :aria-label="label">
      <button class="rc-sync-choice" type="button" :aria-pressed="!value" @click="select('')">{{ fallback }}</button>
      <div v-for="option in options" :key="option" class="rc-sync-row">
        <template v-if="editing === option">
          <input v-model="draft" :aria-label="`编辑${label}`" maxlength="180"
            @keydown.enter.stop="saveOnEnter" />
          <button type="button" aria-label="保存" title="保存" @click="save">✓</button>
        </template>
        <template v-else>
          <button class="rc-sync-choice" type="button" :aria-pressed="value === option" @click="select(option)">{{ option }}</button>
          <button type="button" :aria-label="`编辑 ${option}`" title="编辑" @click="edit(option)">✎</button>
          <button type="button" :aria-label="`删除 ${option}`" title="删除" @click="remove(option)">×</button>
        </template>
      </div>
      <div v-if="editing === ''" class="rc-sync-row">
        <input v-model="draft" :aria-label="`添加${label}`" maxlength="180"
          @keydown.enter.stop="saveOnEnter" />
        <button type="button" aria-label="保存" title="保存" @click="save">✓</button>
      </div>
      <button v-else class="rc-sync-add" type="button" :aria-label="`添加${label}`" title="添加" @click="edit('')">+</button>
      <div v-if="error" class="rc-error" role="alert">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
  label: string; value: string; fallback: string; suggested?: string;
  choices: string[]; commit: (value: string, choices: string[]) => boolean;
}>();
const root = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
const open = ref(false);
const editing = ref<string | null>(null);
const draft = ref('');
const error = ref('');
const options = computed(() => [...new Set([...props.choices, props.value].filter(Boolean))]);

function reset() { editing.value = null; error.value = ''; }
function close() { open.value = false; reset(); }
function outside(event: PointerEvent) { if (open.value && !root.value?.contains(event.target as Node)) close(); }
onMounted(() => root.value?.ownerDocument.addEventListener('pointerdown', outside));
onBeforeUnmount(() => root.value?.ownerDocument.removeEventListener('pointerdown', outside));
function toggle() { if (open.value) close(); else open.value = true; }
function leave(event: FocusEvent) { if (event.relatedTarget && !root.value?.contains(event.relatedTarget as Node)) close(); }
function escape() {
  if (editing.value !== null) reset(); else close();
  trigger.value?.focus();
}
async function edit(option: string) {
  editing.value = option;
  error.value = '';
  draft.value = option || props.suggested || '';
  await nextTick();
  const input = root.value?.querySelector('input');
  input?.focus();
  input?.select();
}
function commit(value: string, choices: string[]) {
  if (props.commit(value, choices)) return true;
  error.value = '同步值重复，请使用不同的同步值或标签名。';
  return false;
}
function select(value: string) {
  if (commit(value, options.value)) { close(); trigger.value?.focus(); }
}
function saveOnEnter(event: KeyboardEvent) {
  if (!event.isComposing) { event.preventDefault(); save(); }
}
function save() {
  const previous = editing.value;
  if (previous === null) return;
  const value = draft.value.trim();
  if (!value) { error.value = '请输入名称。'; return; }
  if (value !== previous && options.value.includes(value)) { error.value = '该名称已存在。'; return; }
  const choices = previous ? options.value.map(option => option === previous ? value : option) : [...options.value, value];
  if (commit(!previous || props.value === previous ? value : props.value, choices)) {
    reset();
    trigger.value?.focus();
  }
}
function remove(option: string) {
  if (commit(props.value === option ? '' : props.value, options.value.filter(value => value !== option))) {
    reset();
    trigger.value?.focus();
  }
}
</script>
