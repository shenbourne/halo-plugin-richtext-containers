import { definePlugin } from '@halo-dev/ui-shared';
import { createContainerExtensions } from './editor/nodes';
import './editor/style.css';
export default definePlugin({
  extensionPoints: { 'default:editor:extension:create': () => createContainerExtensions() },
});
