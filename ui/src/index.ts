import { definePlugin } from '@halo-dev/ui-shared';
import { createContainerExtensions } from './editor/nodes';
import './editor/style.css';
import editorStyles from './editor/style.css?inline';
import stepsStyles from './steps.css?inline';

function installEditorStyles() {
  const id = 'richtext-containers-editor-styles';
  const existing = document.getElementById(id);
  const style = existing instanceof HTMLStyleElement ? existing : document.createElement('style');
  const css = editorStyles + '\n' + stepsStyles;
  if (style.textContent !== css) style.textContent = css;
  if (!existing) {
    style.id = id;
    document.head.append(style);
  }
}

export default definePlugin({
  extensionPoints: {
    'default:editor:extension:create': () => {
      // Keep the editor rules in sync with the node views even if Halo reuses
      // a separately cached console/style.css from a same-version package.
      installEditorStyles();
      return createContainerExtensions();
    },
  },
});
