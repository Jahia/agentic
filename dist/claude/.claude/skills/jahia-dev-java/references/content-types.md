# Jahia Content Types (CND) Reference

## Table of Contents
1. [CND file basics](#1-cnd-file-basics)
2. [Property types and selectors](#2-property-types-and-selectors)
3. [Property keywords](#3-property-keywords)
4. [Child node declarations](#4-child-node-declarations)
5. [Mixins](#5-mixins)
6. [Key built-in mixins reference](#6-key-built-in-mixins-reference)
7. [Choicelist initializers](#7-choicelist-initializers)
8. [Enhancing content types for editors](#8-enhancing-content-types-for-editors)
9. [Modifying existing definitions](#9-modifying-existing-definitions)
10. [Module definition checks](#10-module-definition-checks)

---

## 1. CND file basics

CND = Compact Namespace and Node Type Definition (Apache Jackrabbit standard).

File location: `src/main/resources/META-INF/definitions.cnd`

### Namespace declaration (required first)
```cnd
<ns = 'http://www.example.org/ns/1.0'>
```

Jahia built-in namespaces:
- `<jnt = 'http://www.jahia.org/jahia/nt/1.0'>` — node types
- `<jmix = 'http://www.jahia.org/jahia/mix/1.0'>` — mixins
- `<j = 'http://www.jahia.org/jahia/1.0'>` — core properties
- `<mix = 'http://www.jcp.org/jcr/mix/1.0'>` — JCR standard mixins

### Minimal content type definition
```cnd
<myns = 'http://www.example.org/myns/1.0'>

[myns:myContent] > jnt:content, jmix:editorialContent
- title (string) i18n mandatory
- body (string, richtext) i18n
- publishDate (date)
```

All user-editable content types MUST inherit from `jnt:content`.
Add `jmix:editorialContent` to make the type visible in jContent.

---

## 2. Property types and selectors

### Base property types

| CND type | Content Editor renders as |
|----------|--------------------------|
| `string` | Text input |
| `long` | Number field (integer) |
| `double` | Number field (decimal) |
| `boolean` | Checkbox |
| `date` | Date picker |
| `weakreference` | Node picker (UUID reference, not enforced) |

### String selectors

| Selector | Renders as |
|----------|-----------|
| `string` | Plain text input |
| `string, textarea` | Multi-line textarea |
| `string, richtext` | CKEditor WYSIWYG |
| `string, choicelist` | Dropdown list |
| `string, color` | Color picker |

### Date selectors

| Selector | Renders as |
|----------|-----------|
| `date, datetimepicker` | Date + time picker |
| `date, datepicker` | Date-only picker |

---

## 3. Property keywords

| Keyword | Effect |
|---------|--------|
| `i18n` / `internationalized` | Property has separate value per language |
| `mandatory` | Field required before saving |
| `multiple` | Allows multiple values |
| `hidden` | Not shown in UI; only set programmatically |
| `protected` | Read-only in UI; only set programmatically |
| `autocreated` | Automatically created with default or blank value |
| `primary` | Used as node label in JCR browser |
| `indexed=no` | Not indexed for search |
| `nofulltext` | Indexed but excluded from full-text search |
| `boost=N` | Search weight multiplier (1.0–5.0) |
| `analyzer=keyword` | Indexed word-by-word |
| `facetable` | Enables faceted search on this property |

---

## 4. Child node declarations

```cnd
[myns:article] > jnt:content, jmix:editorialContent
+ * (jmix:droppableContent) = jmix:droppableContent version  # Any droppable content
+ media (jnt:file)                                            # Single named child
+ * (jnt:paragraph)                                          # Multiple children
+ section1 (jnt:contentList)                                 # Named child list
```

---

## 5. Mixins

A mixin adds properties/child nodes to a type without inheritance conflicts:

```cnd
[myns:myMixin] mixin
- extraProp (string) i18n
```

Apply to a content type:
```cnd
[myns:article] > jnt:content, jmix:editorialContent, myns:myMixin
```

Create a custom component category:
```cnd
<mymix = 'http://example.org/mymix/1.0'>

[mymix:myComponents] > jmix:droppableContent mixin
```

---

## 6. Key built-in mixins reference

### Content visibility / organization

| Mixin | Purpose |
|-------|---------|
| `jmix:editorialContent` | Makes type visible in jContent; enables versioning |
| `jmix:droppableContent` | Base for component category folders |
| `jmix:list` | Declares a list component with built-in mechanisms |
| `mix:title` | Syncs system name with `jcr:title` |
| `jmix:mainResource` | Enables full-page display |
| `jmix:hiddenNode` | Node not visible in Jahia managers |

### Content behavior

| Mixin | Purpose |
|-------|---------|
| `jmix:cache` | Exposes cache expiration controls in the editor UI |
| `jmix:bindedComponent` | Defines a component that binds/links to another component |

### Component categories (out-of-the-box)

| Mixin | Component folder |
|-------|-----------------|
| `jmix:basicContent` | Content > Basic |
| `jmix:multimediaContent` | Content > Multimedia |
| `jmix:structuredContent` | Content > Structured |
| `jmix:listContent` | Lists |
| `jmix:siteComponent` | Site Components |
| `jmix:editorialContent` | All editorial content |

---

## 7. Choicelist initializers

### Built-in initializers

```cnd
# Static values from resource bundle
- contract (string, choicelist[resourceBundle]) < contract1, contract2, contract3

# JCR node tree
- theme (weakreference, choicelist[nodes='$currentSite/files/themes;jnt:folder'])
- category (weakreference, choicelist[nodes='/sites/systemsite/categories;jnt:category'])

# Chained initializers
- view (string, choicelist[templates,resourceBundle,image])
```

**Resource bundle keys format:**
```properties
jnt_article.contract.contract1 = Fixed-term contract
jnt_article.contract.contract2 = Indefinite duration
```
Format: `{nodeTypeName_with_colon_as_underscore}.{propertyName}.{value} = Label`

### Custom choicelist initializer

```java
@Component(service = {ModuleChoiceListInitializer.class})
public class MyChoiceListInitializer implements ModuleChoiceListInitializer {

    @Override
    public String getKey() {
        return "myCustomList";  // Used in CND as choicelist[myCustomList]
    }

    @Override
    public List<ChoiceListValue> getChoiceListValues(
            ExtendedPropertyDefinition epd, String param,
            List<ChoiceListValue> values, Locale locale,
            Map<String, Object> context) {
        List<ChoiceListValue> result = new ArrayList<>();
        result.add(new ChoiceListValue("Display Label", "storedValue"));
        return result;
    }
}
```

---

## 8. Enhancing content types for editors

### Labels and i18n

```properties
# In src/main/resources/resources/ModuleName.properties
myns_myContent.title = Title
myns_myContent.body = Body text
myns_myContent.publishDate = Publication date
```

### Icons
Place at `src/main/resources/icons/myns_myContent.png` (replace `:` with `_`).

### Constraints
```cnd
- size (string) < 'small', 'medium', 'large'
- rating (long) < '[1,5]'
```

---

## 9. Modifying existing definitions

### Safe modifications (non-destructive)
- Adding new optional properties to an existing type
- Adding a new mixin to an existing type
- Adding new child node definitions
- Changing property constraints or default values

### Dangerous modifications (require migration)
- Renaming a property
- Changing a property type (e.g., string to date)
- Removing a property that has existing content
- Changing the supertype hierarchy

### Overriding built-in definitions

```cnd
[myns:pageExtension] mixin
  extends = jnt:page
- myCustomProp (string) i18n
```

### Migration scripts

Groovy scripts in `src/main/resources/META-INF/patches/` run once on deployment.
Naming convention: `7.0.0.0-SNAPSHOT-1_myMigration.groovy`

---

## 10. Module definition checks

When deploying a module, Jahia checks CND changes. To bypass during development (NOT for production):
```properties
# In jahia.properties
jahia.jackrabbit.overrideNodeTypes = true
```
