---
name: jahia-java-permissions
description: Declares a permission of a Jahia module in `permissions.xml`, grants it to a role in `roles.xml`, and checks it from Java on the right node — an Action, a GraphQL field, a service. Covers where the files go, the parent that decides who holds the permission, what an install or an update of the module changes, the node each check style reads, and how to test with real users. Use when a module needs its own permission, when code names a permission, or when you review an access check.
argument-hint: "[who must be allowed to do what]"
allowed-tools: Read
---

# Declare and check a module permission

A permission is a name that a role holds on a node, and that the role passes down to the nodes
below. Code asks "does the current user hold `myModuleReportsView` on this node?". The answer
depends on the declaration (`permissions.xml`), on the roles that hold it (`roles.xml` or the
administration), and on the node the code asks about.

`jahia-java-security` says which surface needs which check. This skill declares the permission and
places the check.

## 1. Declare it

`src/main/import/permissions.xml` in the Java module:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<permissions xmlns:jcr="http://www.jcp.org/jcr/1.0">
    <admin jcr:primaryType="jnt:permission">
        <myModuleAdmin jcr:primaryType="jnt:permission"/>
    </admin>
    <site-admin jcr:primaryType="jnt:permission">
        <myModuleReportsView jcr:primaryType="jnt:permission"/>
    </site-admin>
</permissions>
```

The labels, in `src/main/resources/resources/<artifactId>.properties`:

```properties
label.permission.myModuleAdmin=Administer my module
label.permission.myModuleReportsView=View the reports of my module
```

- The file goes in `src/main/import/`. The build packs it into `META-INF/import.zip`, which Jahia
  imports. A file in `src/main/resources/META-INF/` is never imported.
- Prefix every name with the module. Permission names are global: two modules that declare the same
  name share one permission.
- Jahia imports the permissions under `/modules/<artifactId>/<version>/permissions/`, not under
  `/permissions`.
- A JavaScript module has no `src/main/import/`. Declare its permissions in the Java bundle that
  carries its server code.

## 2. The parent decides who holds it

A role that holds a parent holds every child. A role that holds a child does not hold the parent.

| Parent                | Held at once by        | Use for                                              |
| --------------------- | ---------------------- | ---------------------------------------------------- |
| `admin`               | `server-administrator` | A server operation: a cache, a configuration, a job. |
| `site-admin`          | `site-administrator`   | An operation on one site.                            |
| A new node at the top | nobody                 | A permission that only the roles you name may hold.  |

Another parent of the core tree is held by the roles that list it, or one of its parents, in
`j:permissionNames`. Read `/roles` before you choose it: a role can hold more than its name says.

To give it to another role, add the role in `src/main/import/roles.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<roles jcr:primaryType="jnt:roles"
       xmlns:jcr="http://www.jcp.org/jcr/1.0"
       xmlns:j="http://www.jahia.org/jahia/1.0"
       xmlns:jnt="http://www.jahia.org/jahia/nt/1.0">
    <editor jcr:primaryType="jnt:role" j:permissionNames="myModuleReportsView"/>
</roles>
```

The element name is the path of the role under `/roles`. Some core roles are nested: the role
`editor-in-chief` is `/roles/editor/editor-in-chief`, so it is written inside `<editor>`. A flat
`<editor-in-chief>` would create another role.

## 3. Install and update

| Event                                 | Effect                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| First install                         | Jahia imports both files. The roles hold the permission at once.                         |
| An update of the module               | Jahia imports `permissions.xml` again, so a permission added in a later release appears. |
| A permission removed from `roles.xml` | **Nothing.** The import adds names to a role and never removes one.                      |
| A restart without an update           | Nothing is imported again.                                                               |

To take a permission away from a role, remove it in the roles screen of the administration, or
write a migration. Editing `roles.xml` is not enough.

## 4. Check it on the right node

Jahia grants a role on a node: a server role on `/`, a site role on the site node. A check reads one
node, and the answer is "yes" only if the role was granted on that node or above.

| Check                                                              | Node it reads                                 |
| ------------------------------------------------------------------ | --------------------------------------------- |
| `node.hasPermission("myModuleReportsView")`                        | `node`                                        |
| `setRequiredPermission("myModuleReportsView")` in an Action        | The node of the URL, which the caller chooses |
| `@GraphQLRequiresPermission("myModuleAdmin")`                      | `/`                                           |
| `@GraphQLRequiresPermission("perm/sites/mysite")`                  | `/sites/mysite`                               |
| `jcr:hasPermission` in a JSP, `hasPermission` in a JavaScript view | The node you pass, for display only           |

A site permission checked on `/` fails for every site role. **`@GraphQLRequiresPermission` with a
site permission refuses a site administrator and an editor**, even when they hold it on the site.
Check a site permission in the code, on the site of the node.

An Action. Jahia checks the permission on the node of the URL before `doExecute`:

```java
@Activate
public void activate() {
    setName("myModuleReport");
    setRequireAuthenticatedUser(true);
    setRequiredMethods("GET");
    setRequiredPermission("myModuleReportsView");
}
```

When the action then writes a node other than the node of the URL, check that node too.

A site check and a server check in a service or a GraphQL field, with the session of the caller.
Each one answers `false` on any failure, so a caller cannot fail open:

```java
package org.example.mymodule;

import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.content.decorator.JCRSiteNode;

import javax.jcr.RepositoryException;

public final class MyModulePermissions {

    private MyModulePermissions() {
    }

    /** True when the current user holds myModuleReportsView on the site of the node. */
    public static boolean canViewReports(JCRNodeWrapper node) {
        try {
            JCRSiteNode site = node.getResolveSite();
            return site != null && site.hasPermission("myModuleReportsView");
        } catch (RepositoryException e) {
            return false;
        }
    }

    /** True when the current user holds myModuleAdmin on the root node. */
    public static boolean isModuleAdmin() {
        try {
            return JCRSessionFactory.getInstance().getCurrentUserSession().getNode("/").hasPermission("myModuleAdmin");
        } catch (RepositoryException e) {
            return false;
        }
    }
}
```

The caller refuses when the answer is `false`: a GraphQL field throws
`new DataFetchingException("Permission denied")`, an Action answers 403.

- Refuse on any exception. A `catch` that lets the request through opens the operation to everyone.
- Check a node the caller cannot own, such as the site or the parent container. A user holds the
  `owner` role on their own user node, with read and write rights there.
- A check in a view only hides markup. The Action or the GraphQL field behind it checks again.
- `isRoot()` names one account. It is not a permission check.

## 5. A permission that no module declares

A name that no `permissions.xml` declares is refused to **everyone, root included**. The Action
answers 403, and the log says `Unknown privilege {}<name>`. A typo in the name, or a name changed in
the code and not in the file, gives exactly that.

Find each literal passed to `hasPermission`, `setRequiredPermission` and
`@GraphQLRequiresPermission`, and find it in a `permissions.xml` of the module or of a module it
depends on.

## 6. Check it with real users

Root and the members of the administrators group pass every check on a declared permission. A test
as root proves nothing.

1. Deploy. The JCR has `/modules/<artifactId>/<version>/permissions/site-admin/myModuleReportsView`,
   and `/roles/editor` lists the name in `j:permissionNames`.
2. Create a user with the role on the site, and a user without it.
3. Call the surface as each user, and as a guest:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -u editor-user:<password> http://localhost:8080/cms/render/live/en/sites/mysite/home.myModuleReport.do   # 200
curl -s -o /dev/null -w '%{http_code}\n' -u plain-user:<password>  http://localhost:8080/cms/render/live/en/sites/mysite/home.myModuleReport.do   # 403
curl -s -o /dev/null -w '%{http_code}\n'                          http://localhost:8080/cms/render/live/en/sites/mysite/home.myModuleReport.do   # 401
```

A `.do` request of a logged-in user also passes the CSRF guard, which redirects a request without
its token (`jahia-dev-java`, section 4). A `302` to `error.html` is the CSRF guard, not the
permission.

## Review checklist

1. Every permission named in code is declared, with the prefix of the module.
2. The parent gives the permission to the roles intended, and to no others.
3. Each check reads the node that the rule is about: `/` for a server permission, the site or the
   changed node for a site permission. No site permission in `@GraphQLRequiresPermission`.
4. No check that fails open, no `isRoot()` as an administrator check.
5. Tests as a user with the role, a user without it, and a guest.
