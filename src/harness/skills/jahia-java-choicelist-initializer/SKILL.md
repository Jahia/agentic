---
name: jahia-java-choicelist-initializer
description: Writes or reviews a choice list initializer in Java — the `ModuleChoiceListInitializer` that a CND names with `choicelist[key]` to fill a dropdown of Content Editor. Covers when Java is needed at all, the OSGi registration, the key as a contract with the CND, labels per locale, chaining with `resourceBundle` and `sort`, dependent fields, and what happens to content in production when the key or a value changes. Use when a property needs values computed from configuration, another system, the site or another field, or when a migrated JSP module still names an initializer in its CND.
argument-hint: "[what the list must contain]"
allowed-tools: Read
---

# Write a choice list initializer

A choice list initializer gives Content Editor the values of a dropdown. The CND names it by its
**key**:

```
- topic (string, choicelist[myModuleEventTopics])
```

Jahia calls the initializer each time an editor opens the form, switches its language, or changes a
field that the list depends on.

## 1. Decide if the list needs Java

A fixed list needs no Java. Declare the values in the CND and their labels in the resource bundle
(`jahia-cnd-author`):

```
- topic (string, choicelist[resourceBundle]) < 'conference', 'webinar', 'workshop'
```

Write an initializer only when the values are **computed**: from the OSGi configuration, from an
external system, from the site, or from another field of the form. A JavaScript module cannot
declare one. It ships in a Java bundle, and the CND of the JavaScript module names it by its key
(`jahia-dev-migrate-jsp`).

## 2. The class

```java
package org.example.mymodule;

import org.jahia.data.templates.JahiaTemplatesPackage;
import org.jahia.services.content.nodetypes.ExtendedPropertyDefinition;
import org.jahia.services.content.nodetypes.initializers.ChoiceListValue;
import org.jahia.services.content.nodetypes.initializers.ModuleChoiceListInitializer;
import org.jahia.utils.i18n.Messages;
import org.osgi.service.component.annotations.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Values of mymodule:event#topic. definitions.cnd names the key: never rename it in place. */
@Component(service = ModuleChoiceListInitializer.class, immediate = true)
public class EventTopicsInitializer implements ModuleChoiceListInitializer {

    public static final String KEY = "myModuleEventTopics";

    private static final Logger LOG = LoggerFactory.getLogger(EventTopicsInitializer.class);

    private static final List<String> TOPICS = List.of("conference", "webinar", "workshop");

    @Override
    public String getKey() {
        return KEY;
    }

    @Override
    public void setKey(String key) {
        // The key is fixed: the CND names it.
    }

    @Override
    public List<ChoiceListValue> getChoiceListValues(ExtendedPropertyDefinition epd, String param,
            List<ChoiceListValue> values, Locale locale, Map<String, Object> context) {
        List<ChoiceListValue> result = new ArrayList<>(TOPICS.size());
        JahiaTemplatesPackage module = null;
        try {
            module = epd != null ? epd.getDeclaringNodeType().getTemplatePackage() : null;
        } catch (RuntimeException e) {
            LOG.warn("No module for the labels of {}: the values keep their codes", KEY, e);
        }
        for (String topic : TOPICS) {
            String label = topic;
            if (module != null && locale != null) {
                try {
                    label = Messages.get(module, epd.getResourceBundleKey() + "." + topic, locale, topic);
                } catch (RuntimeException e) {
                    LOG.warn("No label for {} in {}", topic, locale, e);   // an exception would stop the form
                }
            }
            result.add(new ChoiceListValue(label, topic));
        }
        return result;
    }
}
```

`new ChoiceListValue(label, value)` takes the label first, then the value that the property stores.

The CND, in `src/main/resources/META-INF/definitions.cnd`:

```
[mymodule:event] > jnt:content, jmix:editorialContent, jmix:droppableContent
 - topic (string, choicelist[myModuleEventTopics])
```

The labels, in `src/main/resources/resources/<artifactId>.properties` and
`<artifactId>_fr.properties`. The key is `<prefix>_<type>.<property>.<value>`:

```properties
mymodule_event.topic.conference=Conférence
mymodule_event.topic.webinar=Webinaire
mymodule_event.topic.workshop=Atelier
```

**Write every character outside ASCII as `\uXXXX`.** Jahia reads the `.properties` files of a module
as ISO-8859-1. A UTF-8 `é` shows as `Ã©` in Content Editor.

| Rule                                          | Why                                                                                                                                                                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service = ModuleChoiceListInitializer.class` | Jahia collects initializers as services of this type.                                                                                                                                                                                  |
| A constant key, prefixed by the module        | All initializers of the platform share one map keyed by `getKey()`, the built-in ones included (`nodes`, `resourceBundle`, `users`…). A key that another module also uses replaces it, and stopping either module removes it for both. |
| `setKey` does nothing                         | Jahia reads `getKey()` when it registers and when it removes the service. The key must not change in between.                                                                                                                          |
| A **new** list each call                      | `resourceBundle` and `sort` change the values they receive. A shared static list would be relabelled for every caller.                                                                                                                 |
| A non-null label on every value               | `sort` compares the labels and fails on `null`.                                                                                                                                                                                        |

## 3. Labels without Java code

Return the stored value as its own label, and chain `resourceBundle` in the CND. It relabels each
value from the bundle of the module, with the same `<prefix>_<type>.<property>.<value>` keys:

```
- topic (string, choicelist[myModuleEventTopics,resourceBundle,sort])
```

Jahia runs the initializers in the order of the CND. Each one receives the list of the previous one
in `values`. `sort` sorts by label, so it comes last.

## 4. What Jahia passes

| Argument  | Content                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `epd`     | The property definition. Can be `null` when a legacy caller asks for the list.                                                                                           |
| `param`   | The text after `=` in the CND: `choicelist[myKey='a;b']` gives `a;b`. Empty without `=`.                                                                                 |
| `values`  | The output of the previous initializer of the chain. An empty list for the first one.                                                                                    |
| `locale`  | The locale of the labels. On Jahia 8.2.3.4 (jContent 3.5) it is the language of the **content** being edited, not the language of the interface. Use it for labels only. |
| `context` | `contextNode` (the edited node, `null` when the editor creates one), `contextParent`, `contextType`, and the values of dependent fields.                                 |

The nodes of the context come from the session of the editor, in the edit workspace. Use them, or
`contextNode.getSession()`, for every query: the editor then sees only what the editor may read.

### A list that depends on another field

```
- country (string, choicelist[myModuleCountries])
- region (string, choicelist[myModuleRegions,dependentProperties='country'])
```

When the editor changes `country`, Content Editor calls the initializer of `region` again, with the
current value of `country` in the context, as a `List<String>`. When the form opens, that value is
not in the context: read the stored value from the node.

```java
Object raw = context.get("country");
String country = raw instanceof List && !((List<?>) raw).isEmpty() ? String.valueOf(((List<?>) raw).get(0)) : null;
if (country == null && context.get("contextNode") instanceof JCRNodeWrapper) {
    country = ((JCRNodeWrapper) context.get("contextNode")).getPropertyAsString("country");
}
```

The client sends the context entries, and an entry it names `contextNode` replaces the edited node
with a list of strings. Check each type with `instanceof` before a cast, and treat each value as
input from the user.

## 5. The key and the values are a contract with the content

Jahia does not check the keys of a CND. A CND that names a key that nobody registers deploys with
no error, and the dropdown is empty and disabled.

When the list no longer holds a value that a node stores, Content Editor empties the field and marks
the form as changed. **If the editor then saves, Jahia removes the value from the content.** A
missing initializer, a renamed key or a removed value therefore erases data on the next save of each
node, not only in the dropdown.

| Change                            | Do                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Rename the key                    | Register the new key and keep the old one, with a second small class. Release. Change the CND. Remove the old key in a later release. |
| Remove a value                    | Migrate the content that stores it first, or keep the value in the list.                                                              |
| Remove the initializer            | Only after every CND that names it, in every module, has stopped naming it.                                                           |
| Deploy with a separate CND module | Start the Java bundle first. A form opened before shows an empty list.                                                                |

Store stable codes, never labels: labels change with the language and with the wording.

A choice list is not a validation. A GraphQL mutation or Java code can store any string in the
property. When a value must belong to a list, add a CND constraint (`< 'a', 'b'`) or a validator
(`jahia-java-validator`).

## 6. Cost and failures

- Jahia calls the initializer for every form open, every language switch and every change of a
  dependent field. Bound every query with a path and a limit.
- Give a remote call a connect and a request timeout, and cache its result with an expiry
  (`jahia-dev-java`, section 6). Keep the last good list when the remote fails, and never cache a
  failure.
- **Never throw.** An exception from an initializer stops the whole form, and the editor cannot open
  the content. Catch, log once, and return what you have.
- Never build JCR-SQL2, a path or a script from `param` or from the context
  (`jahia-dev-query-content`).
- Everything in a `ChoiceListValue` reaches the browser, its properties included. A label is text,
  never HTML.

## 7. Check it

Deploy, then open a content of the type in Content Editor, once per language, and open the dropdown.
The same list comes from the GraphQL API that Content Editor calls:

```graphql
{
  forms {
    editForm(uuidOrPath: "/sites/mysite/home/area-main/my-event", locale: "fr", uiLocale: "fr") {
      sections {
        fieldSets {
          fields {
            name
            valueConstraints {
              value {
                string
              }
              displayValue
            }
          }
        }
      }
    }
  }
}
```

## Review checklist

1. A constant key, prefixed by the module, equal to every `choicelist[…]` that names it, and unique
   among the built-in keys.
2. Null-safe for `epd`, `values`, `locale` and `contextNode`. An `instanceof` before each cast of the
   context.
3. The session of the context, never a system session without a check of the editor first
   (`jahia-java-security`).
4. A new list each call, a non-null label on each value, and no exception that escapes.
5. Labels in the bundle, with `\uXXXX` for every character outside ASCII.
6. A plan for the content when a key or a value changes.
