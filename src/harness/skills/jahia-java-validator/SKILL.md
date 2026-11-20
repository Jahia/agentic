---
name: jahia-java-validator
description: Writes or reviews a node validator in Java — a `JCRNodeValidatorDefinition` that maps a node type to a `JCRNodeValidator` bean checked with Bean Validation annotations each time a node of that type is saved. Covers when a CND constraint is enough, the OSGi registration, the getter names that attach an error to a field, a constraint across several properties, translated messages, which save paths run the validator and which skip it, and how Content Editor and GraphQL show the refusal. Use when a rule spans several properties, needs a specific translated message, or needs context that a CND constraint cannot express.
argument-hint: "[the rule to enforce]"
allowed-tools: Read
---

# Write a node validator

A node validator refuses a save that breaks a rule. Jahia runs it when a session saves a node of
the type it is registered for, and the save fails with a message under the field in Content Editor.

## 1. Decide if the rule needs Java

A CND constraint needs no Java, and Content Editor checks it in the form (`jahia-cnd-author`):

| Rule                        | CND                                    |
| --------------------------- | -------------------------------------- |
| Required                    | `mandatory` (a value of spaces passes) |
| A pattern                   | `< '^[a-z0-9-]+$'`                     |
| A range of numbers or dates | `< '[1,10]'`                           |
| A fixed list                | `< 'a', 'b'`                           |

Write a validator only when the rule:

- spans **several properties**: the end date after the start date, one of two fields;
- needs a check a pattern cannot express well: not blank, an e-mail, a URL with an allowed scheme;
- needs a **specific, translated message**;
- needs context: other nodes, the site, an OSGi service.

## 2. The classes

The definition registers the validator for a node type:

```java
package org.example.mymodule.validation;

import org.jahia.services.content.decorator.validation.JCRNodeValidatorDefinition;
import org.osgi.service.component.annotations.Component;

import java.util.Map;

@Component(service = JCRNodeValidatorDefinition.class, immediate = true)
public class EventValidatorDefinition extends JCRNodeValidatorDefinition {

    @Override
    public Map<String, Class> getValidators() {
        return Map.of("mymodule:event", EventValidator.class);
    }
}
```

The validator is a bean that Bean Validation reads. Jahia builds one for each saved node:

```java
package org.example.mymodule.validation;

import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.decorator.validation.JCRNodeValidator;

import javax.jcr.RepositoryException;
import javax.validation.constraints.NotBlank;
import java.util.Calendar;

@EndAfterStart(propertyName = "endDate")
public class EventValidator implements JCRNodeValidator {

    private final JCRNodeWrapper node;

    public EventValidator(JCRNodeWrapper node) {
        this.node = node;
    }

    // The getter name is the property name: getVenue() checks "venue".
    @NotBlank(message = "{my-module.validation.venue.notBlank}")
    public String getVenue() {
        return node.getPropertyAsString("venue");
    }

    public Calendar getStartDate() {
        return getDate("startDate");
    }

    public Calendar getEndDate() {
        return getDate("endDate");
    }

    private Calendar getDate(String name) {
        try {
            return node.hasProperty(name) ? node.getProperty(name).getDate() : null;
        } catch (RepositoryException e) {
            return null;
        }
    }
}
```

A rule across several properties is a constraint on the class:

```java
package org.example.mymodule.validation;

import javax.validation.Constraint;
import javax.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.TYPE;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

@Target(TYPE)
@Retention(RUNTIME)
@Constraint(validatedBy = EndAfterStartValidator.class)
@Documented
public @interface EndAfterStart {

    String message() default "{my-module.validation.endAfterStart}";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    /** Jahia attaches the error to this property, so Content Editor shows it under the field. */
    String propertyName();
}
```

```java
package org.example.mymodule.validation;

import javax.validation.ConstraintValidator;
import javax.validation.ConstraintValidatorContext;
import java.util.Calendar;

public class EndAfterStartValidator implements ConstraintValidator<EndAfterStart, EventValidator> {

    @Override
    public boolean isValid(EventValidator event, ConstraintValidatorContext context) {
        Calendar start = event.getStartDate();
        Calendar end = event.getEndDate();
        return start == null || end == null || !end.before(start);
    }
}
```

In the POM, Bean Validation is `provided`, because Jahia exports it:

```xml
<dependency>
  <groupId>javax.validation</groupId>
  <artifactId>validation-api</artifactId>
  <version>2.0.1.Final</version>
  <scope>provided</scope>
</dependency>
```

| Rule                                                    | Why                                                                                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Override `getValidators()` and return class literals    | Jahia never gives a DS component its module, so the string map of `setValidators` cannot load the classes.                                                    |
| A public constructor that takes only a `JCRNodeWrapper` | Jahia skips a validator without it, and logs a line.                                                                                                          |
| The constructor only stores the node                    | An exception in the constructor makes Jahia skip the validator: the save passes.                                                                              |
| Getters never throw                                     | An exception in a getter or in `isValid` fails the save with a generic error. Use `hasProperty`, not `getProperty` alone.                                     |
| Only `javax.validation.constraints.*`                   | Jahia does not export the Hibernate Validator annotations to modules.                                                                                         |
| Register your own node type or mixin                    | Jahia keeps one validator per node type for the whole platform. A second module on the same type replaces the first, and stopping either removes it for both. |

The validator also runs on the subtypes of the type, and on every type that uses the mixin.

## 3. Attach each error to a field

Content Editor shows an error under a field only when the error names a property of the form. An
error with no property shows only `An error occurred when saving the content`: the editor never
reads your message, and has no field to fix.

| Error from                      | Property it names                                                      |
| ------------------------------- | ---------------------------------------------------------------------- |
| An annotation on `getVenue()`   | `venue`                                                                |
| An annotation on `isVenue()`    | `venue`                                                                |
| An annotation on `isTooLong()`  | No property: `tooLong` is not a property of the type                   |
| An annotation on `getJ_title()` | `j:title`: Jahia turns the first `_` into `:`                          |
| A constraint on the class       | Its `propertyName` attribute. Without it, the error names no property. |

## 4. Messages

- Write the template as `{key}`. Prefix the key with the module: Jahia searches the bundles of every
  module, and the first one that has the key wins.
- Put the key in `src/main/resources/resources/<artifactId>.properties`, and in one file per
  language, `<artifactId>_fr.properties`. Write every character outside ASCII as `\uXXXX`: Jahia
  reads these files as ISO-8859-1.
- `{min}`, `{max}` or any attribute of the annotation is replaced. `{0}` is not.
- A missing key shows `{my-module.validation.venue.notBlank}` to the editor.
- **The language of the message is the preferred language of the user**, set in the user's profile.
  It is neither the language of the content nor the `Accept-Language` header. Through the MCP
  server, the message is in the default language of the server.

## 5. Which saves run the validator

Jahia runs the validator in `session.save()`, for each node that the session **created** or whose
**properties it changed**. A refused save writes nothing.

| Path                                                 | Validator runs                                                |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| Content Editor                                       | Yes                                                           |
| GraphQL `mutation { jcr { … } }`                     | Yes                                                           |
| The MCP tools `content.create` and `content.update`  | Yes                                                           |
| Java code that saves a `JCRSessionWrapper`           | Yes, unless the code called `session.setSkipValidation(true)` |
| Import of content                                    | Yes, without the `DefaultSkipOnImportGroup` group             |
| Any later change of **another** property of the node | Yes: the whole node is checked again                          |
| Publication                                          | **No**                                                        |
| Move, rename, reorder, delete, `addMixin` alone      | **No**                                                        |
| A write through `getRealNode()`                      | **No**                                                        |

So a validator guards the editing of content. It is not a security control:

- A value that must never reach a page unsafe is encoded when it is rendered, whatever the
  validator says.
- A new rule over existing content blocks every later save of the nodes that break it, even a
  change of another field. Find those nodes before you deploy, and fix them, or skip the rule on
  import with `groups = DefaultSkipOnImportGroup.class`.
- A rule that depends on another node is not checked again when only that other node changes.
- Keep queries and remote calls out of the validator: it runs synchronously on every changed node
  of every save. When one is needed, put the constraint in `groups = AdvancedGroup.class`: Jahia
  runs that group only when the cheap constraints pass.

## 6. How the refusal reaches the caller

**Content Editor** shows the message under the field and keeps the form open.

**The MCP server** answers the tool call with `isError: true`, the code `validation`, and the
messages of every refused property in one text.

**GraphQL** answers HTTP 200, with the refused fields still reporting `true` in `data`. The refusal
is in `errors`:

```json
{
  "errors": [
    {
      "errorType": "GqlConstraintViolationException",
      "extensions": {
        "constraintViolations": [
          {
            "propertyName": "venue",
            "nodePath": "/sites/mysite/home/area-main/my-event",
            "constraintMessage": "The venue cannot be blank.",
            "locale": null
          }
        ]
      }
    }
  ],
  "data": { "jcr": { "mutateNode": { "mutateProperty": { "setValue": true } } } }
}
```

A client reads `errors`, never only `data`.

**Java code** catches `CompositeConstraintViolationException` and reads `getErrors()`. The session
still holds the refused changes: call `session.refresh(false)` before it saves anything else.

## 7. Check it

1. Deploy, and create a valid node: the save passes.
2. Send an invalid value through GraphQL. Expect `GqlConstraintViolationException`, the right
   `propertyName`, and the stored value unchanged.
3. Open the node in Content Editor, enter the invalid value and save. Expect the message under the
   field.
4. Repeat step 3 as a user whose preferred language is another one. Expect the translated message.

## Review checklist

1. A CND constraint was considered first, and the reason to use Java is stated.
2. `getValidators()` returns class literals for a node type or a mixin of the module.
3. A constructor `(JCRNodeWrapper)` that only stores the node. Getters that never throw.
4. Every error names a property: getter names, or a `propertyName` on each class constraint.
5. Every message is `{<module>.…}`, with the key in every language file, written in ASCII.
6. Only `javax.validation.*`, `provided`.
7. No security decision rests on the validator alone. Existing content was checked against the new
   rule.
