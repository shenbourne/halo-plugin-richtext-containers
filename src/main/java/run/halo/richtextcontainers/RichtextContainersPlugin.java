package run.halo.richtextcontainers;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import run.halo.app.plugin.BasePlugin;
import run.halo.app.plugin.PluginContext;

/** Lifecycle entry point; content is stored in Halo's native editor document. */
@Component
public class RichtextContainersPlugin extends BasePlugin {
    private static final Logger LOG = LoggerFactory.getLogger(RichtextContainersPlugin.class);

    public RichtextContainersPlugin(PluginContext context) {
        super(context);
    }

    @Override
    public void start() {
        LOG.info("Halo richtext-containers started");
    }

    @Override
    public void stop() {
        LOG.info("Halo richtext-containers stopped");
    }
}
