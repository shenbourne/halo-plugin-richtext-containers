// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('keeps real Reveal controls clickable with scoped CSS and keyboard focus inside the deck', () => {
  const script = String.raw`
    import { build } from 'vite';
    import { chromium, expect } from '@playwright/test';
    const result = await build({ configFile: 'vite.frontend.config.ts', logLevel: 'silent', build: { write: false } });
    const output = (Array.isArray(result) ? result[0] : result).output;
    const css = output.find(asset => asset.fileName.endsWith('.css')).source;
    const js = output.find(asset => asset.fileName.endsWith('.js')).code;
    const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setContent('<style>body{margin:24px;font:16px system-ui}article{max-width:960px;margin:auto}</style><article><div data-rc-slides="v1"><div data-rc-group="v1"><div data-rc-slide="v1"><button id="body-control">Action</button></div><div data-rc-slide="v1">Second</div></div><div data-rc-group="v1"><div data-rc-slide="v1">Third</div></div></div></article>');
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ content: js });
      const engine = page.locator('.rc-slides__engine');
      await expect(engine).toHaveClass(/ready/);
      await expect(engine).toHaveCSS('position', 'absolute');
      await expect(engine).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      const geometry = await engine.evaluate(node => ({
        height: node.getBoundingClientRect().height,
        contentHeight: node.parentElement.querySelector('.rc-slides__content').getBoundingClientRect().height,
      }));
      expect(geometry.height).toBeGreaterThan(0);
      expect(geometry.height).toBe(geometry.contentHeight);
      const slides = page.locator('[data-rc-slide]');
      await page.locator('.navigate-down').click();
      await expect(slides.nth(1)).toBeVisible();
      await page.locator('.navigate-right').click();
      await expect(slides.nth(2)).toBeVisible();
      await engine.focus();
      await page.keyboard.press('Home');
      await expect(slides.nth(0)).toBeVisible();
      await page.locator('#body-control').focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Space');
      await expect(slides.nth(0)).toBeVisible();
      await engine.focus();
      await page.keyboard.press('ArrowDown');
      await expect(slides.nth(1)).toBeVisible();
      const fullscreenTarget = await engine.evaluate(node => {
        let target = '';
        node.requestFullscreen = async () => { target = 'engine'; };
        node.parentElement.requestFullscreen = async () => { target = 'deck'; };
        node.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true }));
        return target;
      });
      expect(fullscreenTarget).toBe('deck');
      for (const width of [780, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.locator('.navigate-right').click();
        await expect(slides.nth(2)).toBeVisible();
        await engine.focus();
        await page.keyboard.press('Home');
        await expect(slides.nth(0)).toBeVisible();
        await page.locator('.navigate-down').click();
        await expect(slides.nth(1)).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      }
      await page.setContent('<main><div class="post-content"><p style="text-align:right">正文<span data-rc-footnote-ref="v1" data-rc-key="legacy-key"></span></p><aside data-rc-footnote="v1" data-rc-key="legacy-key"><p>脚注预览内容</p></aside><p id="conclusion">结论</p></div><section id="comments">评论</section></main><footer>页脚</footer>');
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ content: js });
      await expect(page.locator('#conclusion + [data-rc-footnotes-list]')).toBeVisible();
      const reference = page.getByRole('link', { name: '转到脚注 1' });
      const preview = page.getByRole('tooltip');
      await page.mouse.move(0, 0);
      await reference.focus();
      await expect(preview).toHaveText('脚注预览内容');
      await reference.press('Escape');
      await expect(preview).toHaveCount(0);
      await reference.hover();
      await expect(preview).toHaveText('脚注预览内容');
      const previewBox = await preview.boundingBox();
      expect(previewBox.x).toBeGreaterThanOrEqual(0);
      expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(320);
      await reference.click();
      await expect(page.locator('[role="doc-footnote"]:target')).toBeVisible();
      expect(errors).toEqual([]);
      console.log('FRONTEND_BROWSER_PASS');
    } finally {
      await browser.close();
    }
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 45000,
  });
  expect(output).toContain('FRONTEND_BROWSER_PASS');
}, 50000);
