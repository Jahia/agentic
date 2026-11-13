/*
 * Copies the value of an old property into the new property that replaces it, on every node of a
 * type. Edit the five settings below, run once with DRY_RUN = true, read the log, then run with
 * DRY_RUN = false. Run it again: it must report only alreadyDone.
 *
 * - Writes the default workspace only. Live gets the value at the next publication, and the view
 *   reads the old property until then (the fallback of the skill), so visitors see no change.
 * - Idempotent: a node that already has the new property is skipped.
 * - Non-internationalized properties only. For an i18n property, write through
 *   node.getOrCreateI18N(locale) for each language of the site.
 */
import javax.jcr.Value
import javax.jcr.query.Query
import org.jahia.services.content.JCRCallback
import org.jahia.services.content.JCRSessionWrapper
import org.jahia.services.content.JCRTemplate
import org.jahia.services.usermanager.JahiaUserManagerService
import org.slf4j.LoggerFactory

final boolean DRY_RUN = true
final String NODE_TYPE = "jdmix:menuLimits"   // the type or mixin that declares both properties
final String OLD = "hideHome"
final String NEW = "hideHomePage"
// Reproduce exactly what the view did with the old value. Return null to skip a value: it is logged.
final Closure convert = { Value value -> value.getString() == "Yes" }

final int BATCH = 500
final def logger = LoggerFactory.getLogger("migrate-property")
final def root = JahiaUserManagerService.getInstance().lookupRootUser().getJahiaUser()

JCRTemplate.getInstance().doExecuteWithSystemSessionAsUser(root, "default", null, { JCRSessionWrapper session ->
    def counts = [migrated: 0, alreadyDone: 0, noValue: 0, skipped: 0, locked: 0]
    def nodes = session.getWorkspace().getQueryManager()
            .createQuery("SELECT * FROM [" + NODE_TYPE + "] WHERE ISDESCENDANTNODE('/sites')", Query.JCR_SQL2)
            .execute().getNodes()

    nodes.each { node ->
        if (node.hasProperty(NEW)) {
            counts.alreadyDone++
            return
        }
        if (!node.hasProperty(OLD)) {
            // The fallback of the view handles a missing old value: nothing to write
            counts.noValue++
            return
        }
        def oldValue = node.getProperty(OLD).getValue()
        def newValue = convert(oldValue)
        if (newValue == null) {
            logger.warn("{} has {}='{}', which convert does not map: skipped", node.getPath(), OLD, oldValue.getString())
            counts.skipped++
            return
        }
        if (node.isLocked()) {
            // Usually an editor holding the node open in Content Editor; the system session writes through it
            logger.warn("{} is locked by {}: migrated anyway, tell its editor before they save", node.getPath(), node.getLockOwner())
            counts.locked++
        }
        logger.info("{}: {}='{}' -> {}={}{}", node.getPath(), OLD, oldValue.getString(), NEW, newValue, DRY_RUN ? " (dry run)" : "")
        counts.migrated++
        if (!DRY_RUN) {
            session.checkout(node)
            node.setProperty(NEW, newValue)
            if (counts.migrated % BATCH == 0) {
                session.save()
            }
        }
    }

    if (!DRY_RUN) {
        session.save()
    }
    logger.info("{} {} -> {} done{}: {}", NODE_TYPE, OLD, NEW, DRY_RUN ? " (dry run, nothing saved)" : "", counts)
    return null
} as JCRCallback)
