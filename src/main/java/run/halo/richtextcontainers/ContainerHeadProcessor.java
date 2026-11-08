package run.halo.richtextcontainers;

import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.thymeleaf.context.ITemplateContext;
import org.thymeleaf.model.AttributeValueQuotes;
import org.thymeleaf.model.ICloseElementTag;
import org.thymeleaf.model.IModel;
import org.thymeleaf.model.IProcessableElementTag;
import org.thymeleaf.processor.element.IElementModelStructureHandler;
import reactor.core.publisher.Mono;
import run.halo.app.theme.dialect.TemplateHeadProcessor;
import run.halo.app.theme.router.ModelConst;

/** Adds only local reader assets, and only to Halo content detail templates. */
@Component
public class ContainerHeadProcessor implements TemplateHeadProcessor {
    static final String CSS = "/plugins/richtext-containers/assets/frontend/frontend.css";
    static final String JS = "/plugins/richtext-containers/assets/frontend/frontend.js";
    // Halo 2.27.1 DefaultTemplateEnum.SINGLE_PAGE uses the logical ID "page".
    private static final Set<String> CONTENT_TEMPLATES = Set.of("post", "page");

    @Override
    public Mono<Void> process(ITemplateContext context, IModel model,
        IElementModelStructureHandler structureHandler) {
        // Halo sets this stable logical ID even for a custom post/page template filename.
        if (!(context.getVariable(ModelConst.TEMPLATE_ID) instanceof String templateId)
            || !CONTENT_TEMPLATES.contains(templateId)) {
            return Mono.empty();
        }
        var factory = context.getModelFactory();
        int insertionPoint = beforeClosingHead(model);
        if (!containsAsset(model, "link", "href", CSS)) {
            model.insert(insertionPoint++, factory.createStandaloneElementTag("link",
                Map.of("rel", "stylesheet", "href", CSS),
                AttributeValueQuotes.DOUBLE, false, true));
        }
        if (!containsAsset(model, "script", "src", JS)) {
            model.insert(insertionPoint++, factory.createOpenElementTag("script",
                Map.of("src", JS, "defer", "defer"), AttributeValueQuotes.DOUBLE, false));
            model.insert(insertionPoint, factory.createCloseElementTag("script"));
        }
        return Mono.empty();
    }

    private static int beforeClosingHead(IModel model) {
        for (int i = model.size() - 1; i >= 0; i--) {
            if (model.get(i) instanceof ICloseElementTag tag
                && "head".equalsIgnoreCase(tag.getElementCompleteName())) {
                return i;
            }
        }
        return model.size();
    }

    private static boolean containsAsset(IModel model, String element, String attribute,
        String value) {
        for (int i = 0; i < model.size(); i++) {
            if (model.get(i) instanceof IProcessableElementTag tag
                && element.equalsIgnoreCase(tag.getElementCompleteName())
                && value.equals(tag.getAttributeValue(attribute))) {
                return true;
            }
        }
        return false;
    }
}
