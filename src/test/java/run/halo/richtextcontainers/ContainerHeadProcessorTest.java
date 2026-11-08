package run.halo.richtextcontainers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.context.ITemplateContext;
import org.thymeleaf.dialect.AbstractProcessorDialect;
import org.thymeleaf.model.IModel;
import org.thymeleaf.processor.IProcessor;
import org.thymeleaf.processor.element.AbstractElementModelProcessor;
import org.thymeleaf.processor.element.IElementModelStructureHandler;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.StringTemplateResolver;

/** Executes the actual Halo extension against Thymeleaf's real parsed head model. */
class ContainerHeadProcessorTest {
    private static final String CSS =
        "/plugins/richtext-containers/assets/frontend/frontend.css";
    private static final String JS =
        "/plugins/richtext-containers/assets/frontend/frontend.js";

    @ParameterizedTest
    @ValueSource(strings = {"post", "page"})
    void injectsLocalAssetsInsideContentHead(String templateId) {
        String html = render(templateId, "<meta charset=\"utf-8\"><title>正文</title>", 1);
        assertEquals(1, occurrences(html, CSS));
        assertEquals(1, occurrences(html, JS));
        assertTrue(html.contains("rel=\"stylesheet\""));
        assertTrue(html.contains("defer=\"defer\""));
        assertTrue(html.indexOf(CSS) < html.indexOf("</head>"));
        assertTrue(html.indexOf(JS) < html.indexOf("</head>"));
        assertTrue(html.contains("</script></head>"));
        assertTrue(html.contains("<title>正文</title>"));
        assertTrue(html.contains("<body><p>原始内容</p></body>"));
        assertFalse(html.contains("https://"));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "index", "archives", "category", "tag", "author",
        "console", "login", "error", "post-list", "single_page", "plugin:example:post"})
    void leavesNonContentTemplatesUntouched(String templateId) {
        String html = render(templateId, "<title>列表</title>", 1);
        assertFalse(html.contains("/plugins/richtext-containers/"));
        assertTrue(html.contains("<head><title>列表</title></head>"));
    }

    @Test
    void ignoresUnexpectedTemplateIdType() {
        assertFalse(render(Map.of("name", "post"), "", 1).contains(CSS));
    }

    @Test
    void repeatedProcessingDoesNotDuplicateEitherAsset() {
        String html = render("post", "<title>幂等</title>", 3);
        assertEquals(1, occurrences(html, CSS));
        assertEquals(1, occurrences(html, JS));
    }

    @Test
    void keepsExistingStylesheetAndAddsMissingScript() {
        String html = render("post", "<link rel=\"stylesheet\" href=\"" + CSS + "\">", 2);
        assertEquals(1, occurrences(html, CSS));
        assertEquals(1, occurrences(html, JS));
    }

    @Test
    void keepsExistingScriptAndAddsMissingStylesheet() {
        String html = render("page", "<script src=\"" + JS + "\"></script>", 2);
        assertEquals(1, occurrences(html, CSS));
        assertEquals(1, occurrences(html, JS));
    }

    @Test
    void doesNotMistakeInlineScriptTextForLoadedResources() {
        String html = render("post", "<script>const example = '" + JS + "';</script>", 1);
        assertTrue(html.contains("src=\"" + JS + "\""));
        assertEquals(1, occurrences(html, CSS));
    }

    private String render(Object templateId, String head, int repetitions) {
        var resolver = new StringTemplateResolver();
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCacheable(false);
        var engine = new TemplateEngine();
        engine.setTemplateResolver(resolver);
        engine.addDialect(new TestDialect(repetitions));
        var context = new Context(Locale.SIMPLIFIED_CHINESE);
        if (templateId != null) {
            context.setVariable("_templateId", templateId);
        }
        return engine.process("<!DOCTYPE html><html><head>" + head
            + "</head><body><p>原始内容</p></body></html>", context);
    }

    private static int occurrences(String text, String needle) {
        return (text.length() - text.replace(needle, "").length()) / needle.length();
    }

    private static final class TestDialect extends AbstractProcessorDialect {
        private final int repetitions;

        TestDialect(int repetitions) {
            super("Halo head bridge", "rc", 1000);
            this.repetitions = repetitions;
        }

        @Override
        public Set<IProcessor> getProcessors(String prefix) {
            return Set.of(new HeadBridge(repetitions));
        }
    }

    private static final class HeadBridge extends AbstractElementModelProcessor {
        private final int repetitions;
        private final ContainerHeadProcessor processor = new ContainerHeadProcessor();

        HeadBridge(int repetitions) {
            super(TemplateMode.HTML, null, "head", false, null, false, 1000);
            this.repetitions = repetitions;
        }

        @Override
        protected void doProcess(ITemplateContext context, IModel model,
            IElementModelStructureHandler structureHandler) {
            for (int i = 0; i < repetitions; i++) {
                processor.process(context, model, structureHandler).block();
            }
        }
    }
}
