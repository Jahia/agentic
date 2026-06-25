# Jahia UI Extensions Reference

## Table of Contents
1. [Overview: two extension layers](#1-overview-two-extension-layers)
2. [Component registry](#2-component-registry)
3. [Content Editor JSON overrides](#3-content-editor-json-overrides)
4. [jContent UI extension points](#4-jcontent-ui-extension-points)
5. [Adding UI actions](#5-adding-ui-actions)
6. [Adding settings pages (admin routes)](#6-adding-settings-pages-admin-routes)
7. [Custom selector types](#7-custom-selector-types)
8. [Custom picker configuration](#8-custom-picker-configuration)
9. [Dynamic forms in Content Editor](#9-dynamic-forms-in-content-editor)
10. [CKEditor customization](#10-ckeditor-customization)
11. [Debugging JSON overrides and registry](#11-debugging-json-overrides-and-registry)

---

## 1. Overview: two extension layers

| Mechanism | What it controls | Format |
|-----------|-----------------|--------|
| **Content Editor JSON overrides** | Form layout, field visibility, labels, sections, field order | JSON files in module JAR |
| **Component registry** | Actions, accordions, nav items, selectors, routes, settings pages | JavaScript (React/JSX) |

The component registry lives in the JavaScript layer. JSON overrides live in the Java module under `META-INF/jahia-content-editor-forms/`.

---

## 2. Component registry

```javascript
import { registry } from '@jahia/ui-extender';

registry.add('action', 'myAction', myActionObj, {
    targets: ['contentActions:5'],
    label: 'myModule:myAction.label'
});

registry.addOrReplace('adminRoute', 'mySettings', {
    targets: ['administration-sites:10'],
    label: 'myModule:settings.label',
    isSelectable: true,
    iframeUrl: window.contextJsParameters.contextPath + '/cms/adminframe/default/en/settings.myPage.html'
});

const existing = registry.get('action', 'createContent');
const allActions = registry.find({ target: 'contentActions' });
registry.remove('action', 'myAction');
```

### Registration timing

```javascript
import { registry } from '@jahia/ui-extender';
import register from './myModule.register';

export default function () {
    registry.add('callback', 'myModule', {
        targets: ['jahiaApp-init:50'],
        callback: register
    });
}
```

### Common registry types

| Type | Purpose |
|------|---------|
| `action` | UI action in menus, headers, or toolbars |
| `selectorType` | Custom field input in Content Editor |
| `adminRoute` | Admin panel page |
| `route` | Custom top-level route |
| `primary-nav-item` | Top-level navigation entry |
| `accordionItem` | Secondary navigation accordion in jContent |
| `callback` | Initialization callback |

---

## 3. Content Editor JSON overrides

### File location

```
src/main/resources/META-INF/jahia-content-editor-forms/
    forms/          # Form-level overrides (by nodetype)
    fieldsets/      # Fieldset-level overrides (by mixin or type)
```

Naming convention: replace `:` with `_` — `jnt:article` → `jnt_article.json`

### Form override structure

```json
{
  "nodeType": "myns:myContent",
  "priority": 2.0,
  "hasPreview": true,
  "sections": [
    {
      "name": "content",
      "fieldSets": [
        {
          "name": "<main>",
          "rank": 1.0,
          "fields": [
            {
              "name": "jcr:title",
              "declaringNodeType": "mix:title",
              "rank": 1.0,
              "labelKey": "myModule:label.title"
            },
            {
              "name": "myProp",
              "hide": false,
              "mandatory": true
            }
          ]
        }
      ]
    },
    { "name": "classification", "hide": true },
    { "name": "layout", "hide": true }
  ]
}
```

### Key override actions

| Goal | JSON |
|------|------|
| Hide a section | `{"name": "layout", "hide": true}` |
| Hide a field | In field: `"hide": true` |
| Make a field mandatory | In field: `"mandatory": true` |
| Reorder a field | In field: `"rank": 3.0` |
| Change a field label | In field: `"labelKey": "basename:myKey"` |

### `declaringNodeType` requirement

Use when the field comes from a mixin or parent type:

```json
{
  "name": "j:invalidLanguages",
  "declaringNodeType": "jmix:i18n",
  "hide": false
}
```

### Known limitations

- `multiple` and `i18n` properties CANNOT be overridden by JSON
- `valueConstraints` for choicelists can only remove existing items, not add new ones

---

## 4. jContent UI extension points

### Adding an accordion

```javascript
const baseAccordion = registry.get('accordionItem', 'pages');
registry.add('accordionItem', 'myCustomAccordion', baseAccordion, {
    targets: ['jcontent:99'],
    label: 'myModule:accordion.label',
    rootPath: '/sites/{site}/contents/my-section',
    requiredSitePermission: 'myCustomPermission',
    isEnabled: (siteKey) => siteKey !== 'systemsite',
    treeConfig: Object.assign({}, baseAccordion.treeConfig, { hideRoot: false })
});
```

**Important:** Always use `Object.assign({}, base.nestedObj, {...})` when overriding nested config objects.

---

## 5. Adding UI actions

### Available action targets

| Target | Location |
|--------|----------|
| `contentItemContextActions` | Right-click menu on content items |
| `contentItemActions` | Three-dot menu on content items |
| `browseControlBar` | Three-dot menu in header |
| `headerPrimaryActions` | Header primary action buttons |
| `selectedContentActions` | Actions for selected content |
| `publishMenu` | Publish dropdown menu items |

### Registering an action

```javascript
registry.add('action', 'myCustomAction', {
    buttonLabel: 'myModule:actions.myAction.label',
    targets: ['contentItemActions:5', 'contentItemContextActions:5'],
    showOnNodeTypes: ['jnt:article', 'jnt:page'],
    requiredPermission: ['jcr:modifyProperties'],
    onClick: ({ path, paths, client, notificationContext }) => {
        console.log('Action on:', path);
    }
});
```

---

## 6. Adding settings pages (admin routes)

```javascript
registry.add('adminRoute', 'mySettings', {
    targets: ['administration-sites:50'],
    requiredPermission: 'adminTemplates',
    label: 'myModule:settings.label',
    isSelectable: true,
    render: () => <MySettingsPage/>
});
```

### iFrame-based admin route

```javascript
registry.add('adminRoute', 'myLegacySettings', {
    targets: ['administration-server-systemComponents:10'],
    requiredPermission: 'adminTemplates',
    label: 'myModule:legacy.label',
    isSelectable: true,
    iframeUrl: window.contextJsParameters.contextPath +
        '/cms/adminframe/default/$lang/settings.myLegacyPage.html?redirect=false'
});
```

### Administration target groups

| Target group | Description |
|-------------|-------------|
| `administration-server-usersAndRoles` | Server > Users and Roles |
| `administration-server-systemComponents` | Server > System Components |
| `administration-sites` | Sites section |

---

## 7. Custom selector types

```javascript
registry.add('selectorType', 'MyColorPicker', {
    targets: ['BuiltInTypes:10'],
    cmp: MyColorPickerComponent,
    supportedTypes: ['String'],
});
```

Reference in CND:
```cnd
- myColor (string, MyColorPicker)
```

---

## 8. Custom picker configuration

```javascript
registry.add('pickerConfig', 'myPicker', {
    accordionItem: 'pages',
    searchSelectorType: ['jnt:article', 'jnt:page'],
    selectableTypes: ['jnt:article'],
    openableTypes: ['jnt:page', 'jnt:contentFolder']
});
```

Reference in CND:
```cnd
- relatedArticle (weakreference, picker[type='myPicker'])
```

---

## 9. Dynamic forms in Content Editor

Implement `DynamicFieldSetExtractor` for server-side dynamic forms:

```java
@Component(service = DynamicFieldSetExtractor.class)
public class MyDynamicExtractor implements DynamicFieldSetExtractor {

    @Override
    public Set<String> getExtendedNodeTypesToFill(JCRNodeWrapper node,
            ExtendedNodeType primaryNodeType, Locale locale, RenderContext ctx) {
        String category = node.getPropertyAsString("myCategory");
        if ("premium".equals(category)) {
            return Collections.singleton("myns:premiumFields");
        }
        return Collections.emptySet();
    }
}
```

---

## 10. CKEditor customization

### CKEditor 5 (Jahia 8.2+)

```javascript
registry.add('ckeditor5Plugin', 'myPlugin', {
    plugin: MyCKEditorPlugin,
    config: { toolbar: { items: ['myButton'] } }
});
```

### CKEditor 4 (legacy)

Place custom configuration in `src/main/resources/javascript/ckeditor/config.js`.

---

## 11. Debugging JSON overrides and registry

### Checking JSON override registration

Look in Jahia startup logs for `StaticDefinitionsRegistry` entries:
```
INFO  [StaticDefinitionsRegistry] - Successfully loaded static form for name myns:myContent
```

### Querying the generated form via GraphQL

```graphql
{
  forms {
    editForm(uiLocale: "en", locale: "en", uuidOrPath: "/sites/mySite/home/myContent") {
      sections {
        name
        fieldSets { name fields { name selectorType mandatory hide } }
      }
    }
  }
}
```

### Inspecting the component registry in browser console

```javascript
window.jahia.uiExtender.registry.find({ type: 'action' });
window.jahia.uiExtender.registry.get('accordionItem', 'pages');
window.jahia.uiExtender.registry.find({ target: 'contentItemActions' });
```
