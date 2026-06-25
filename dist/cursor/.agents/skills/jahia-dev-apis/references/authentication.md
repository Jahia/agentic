# Authentication Reference

Covers personal API tokens, OAuth 2.0 social login, SAML 2.0, and the UPA (username/password + MFA) module.

## Table of Contents

- [Personal API Tokens](#personal-api-tokens)
  - [Module installation](#module-installation)
  - [Creating a token via admin UI](#creating-a-token-via-admin-ui)
  - [Using tokens in API calls](#using-tokens-in-api-calls)
  - [Managing tokens](#managing-tokens)
  - [Managing tokens via GraphQL](#managing-tokens-via-graphql)
  - [Managing tokens via filesystem (Groovy)](#managing-tokens-via-filesystem-groovy)
- [OAuth 2.0 — Social Login](#oauth-20--social-login)
  - [Available connectors](#available-connectors)
  - [Required modules](#required-modules)
  - [Configuring a social connector](#configuring-a-social-connector)
  - [Mapping user fields](#mapping-user-fields)
  - [Adding social login buttons to pages](#adding-social-login-buttons-to-pages)
  - [Building a custom OAuth connector](#building-a-custom-oauth-connector)
- [SAML 2.0](#saml-20)
  - [Module installation](#module-installation-1)
  - [Creating a keystore](#creating-a-keystore)
  - [Configuring SAML in Site Settings](#configuring-saml-in-site-settings)
  - [Configuration file example](#configuration-file-example)
  - [Mapping users from IdP](#mapping-users-from-idp)
  - [Triggering SAML login](#triggering-saml-login)
  - [Private pages and SAML authentication](#private-pages-and-saml-authentication)
- [UPA — User Password Authentication Module](#upa--user-password-authentication-module)
  - [What it adds over default auth](#what-it-adds-over-default-auth)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Setup: login URL provider](#setup-login-url-provider)
  - [Authentication flow](#authentication-flow)
  - [Customization](#customization)
  - [Known limitations](#known-limitations)

---

## Personal API Tokens

Module ID: `personal-api-tokens`. Compatible with Jahia 8.0.1+. Tokens are stored in the JCR and persist across upgrades.

**Key concept:** A token is tied to its creator's account and inherits that user's permissions. Create one token per external service — if a token is compromised, revoke only that token without affecting others.

### Module installation

Install via **Jahia Administration > Modules and Extensions > Modules**. Requires the module to be deployed on the server (not per site).

### Creating a token via admin UI

1. Navigate to **Dashboard > My API tokens**.
2. Click **Create Token**.
3. Provide a **Name** (unique per user) and an optional **Expiration date**.
4. Click **Create**. The token string is shown **once only** — copy it immediately.

Access to this page requires the **"Personal api tokens"** server role permission. "Live role" or "Edit role" is not sufficient.

### Using tokens in API calls

Pass the token in the `Authorization` header prefixed with `APIToken`:

```
Authorization: APIToken <your-token-value>
```

**cURL example:**

```bash
curl -H "Authorization: APIToken XXXXXXXXXX" https://JAHIA_URL/modules/healthcheck
```

**Apollo Client (TypeScript) example:**

```typescript
export const apolloClient = (token: string): ApolloClient => {
  return new ApolloClient({
    link: new HttpLink({
      uri: `JAHIA_URL/modules/graphql`,
      headers: {
        authorization: `APIToken ${token}`
      }
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { fetchPolicy: 'no-cache' }
    }
  });
};
```

### Managing tokens

From **Dashboard > My API tokens**, you can view token name, access key, expiration date, and status. Actions: **Delete**, **Activate**, **Disable**.

Admins can manage other users' tokens at **Administration > Users and Roles > User API tokens** (requires the "Admin personal api tokens" server administration permission). Admins can disable/delete but cannot create tokens for other users.

### Managing tokens via GraphQL

Entry point: `admin.personalAPITokens`. Additional operations beyond the UI:

- `verifyToken` — check if a token is valid
- Update a token's name or expiry date

### Managing tokens via filesystem (Groovy)

Useful for automating token creation on first Jahia startup. Place Groovy scripts in `digital-factory-data/patches/groovy/`. Use the CLI tool to generate valid token strings:

```bash
git clone git@github.com:Jahia/personal-api-token
cd personal-api-token && mvn clean install
cd target && java -jar personal-api-tokens-1.6.0-cli.jar
# Output: {"token": "b765L5rY...", "key": "6fbeb92f-..."}
```

**Create a token via Groovy:**

```groovy
setResult("remove");
org.jahia.services.content.JCRTemplate.getInstance().doExecuteWithSystemSession({ session ->
    org.jahia.osgi.BundleUtils.getOsgiService("org.jahia.modules.apitokens.TokenService")
        .tokenBuilder("/users/root", "test-token12345", session)
        .setToken("kgHNm05iQV61I+GY3X5HVr13i866HAAsyou8G+eGubk=")
        .setActive(true)
        .setExpirationDate(new org.joda.time.DateTime('2021-12-31').toCalendar(Locale.getDefault()))
        .create()
    session.save();
})
```

**Delete a token via Groovy:**

```groovy
setResult("remove");
org.jahia.services.content.JCRTemplate.getInstance().doExecuteWithSystemSession({ session ->
    org.jahia.osgi.BundleUtils.getOsgiService("org.jahia.modules.apitokens.TokenService")
        .deleteToken("9201cd9b-4e62-415e-b523-e198dd7e4756", session)
    session.save();
})
```

**Update a token via Groovy:**

```groovy
setResult("remove");
org.jahia.services.content.JCRTemplate.getInstance().doExecuteWithSystemSession({ session ->
    def service = org.jahia.osgi.BundleUtils.getOsgiService("org.jahia.modules.apitokens.TokenService")
    def tokenDetails = service.getTokenDetails("9201cd9b-4e62-415e-b523-e198dd7e4756", session)
    tokenDetails.setActive(false)
    service.updateToken(tokenDetails, session)
    session.save();
})
```

`setResult("remove")` causes the Groovy script file to be deleted after execution.

---

## OAuth 2.0 — Social Login

### Available connectors

The Jahia OAuth module (compatible with Jahia 8.0.1+) bundles connectors for:

- Google
- Facebook
- LinkedIn
- GitHub
- FranceConnect

No code is required to use the built-in connectors; login buttons are added via drag-and-drop.

### Required modules

| Module | Purpose |
|--------|---------|
| Jahia Authentication | Backbone SSO framework |
| Jahia OAuth | OAuth connectors (Google, Facebook, etc.) |
| JCR Authentication Provider | Maps social profile attributes to Jahia user attributes |
| jExperience Auth data mapper | (Optional) Maps attributes to jExperience visitor profiles for personalization |

Install all required modules via **Jahia Administration > Modules and Extensions > Modules** before configuring.

### Configuring a social connector

1. Navigate to **Administration > Sites > Jahia Authentication**.
2. Expand the connector to configure (e.g., **Google Connector**).
3. Toggle **Activate**.
4. Fill in:
   - **ID Client** — your OAuth application's client ID
   - **Secret client** — your OAuth application's secret
   - **Scope** — data to request from users (e.g., `profile email` for GitHub, `public_profile` for Facebook, `r_emailaddress r_liteprofile` for LinkedIn)
   - **Callback URL** — where users are redirected after login. Must end with the connector-specific suffix, e.g., `.googleOAuthCallbackAction.do`. Example: `http://mysite.com/sites/digitall/home.googleOAuthCallbackAction.do`
5. Click **Save**.

After saving, the **Actions** button becomes available for user field mapping.

**Creating OAuth applications** (external provider consoles):

- Google: https://console.developers.google.com/apis/credentials/oauthclient
- Facebook: https://developers.facebook.com/apps/
- LinkedIn: https://www.linkedin.com/developers/
- GitHub: https://github.com/settings/developers
- FranceConnect: https://partenaires.franceconnect.gouv.fr/fcp/fournisseur-identite

### Mapping user fields

After configuring a connector, map the social login fields to Jahia user fields:

1. On the connector settings page, click **Actions**.
2. Expand the **JCR OAuth provider** section and toggle **Activate**.
3. In **Field from connector**, select social fields (e.g., First name, Last name, Google ID).
4. In **Field from provider**, select Jahia fields (e.g., First name, Last name, Login username mandatory).
5. Click **Save**.

### Adding social login buttons to pages

Add social login buttons like any Jahia component — find them under **Jahia OAuth button connector** in the **Select Content Type** dialog.

When Jahia OAuth is enabled, an **Authentication Results** page is created at `sites/_your-project_/oauth-result`. This page must be published.

### Building a custom OAuth connector

Requirements: OAuth 2.x protocol, knowledge of Jahia module development.

**Steps:**

1. Create a Jahia module.

2. Add dependencies to `pom.xml`:

```xml
<dependencies>
    <dependency>
        <groupId>org.jahia.modules</groupId>
        <artifactId>jahia-oauth</artifactId>
        <version>3.0.0</version>
        <scope>provided</scope>
    </dependency>
    <dependency>
        <groupId>org.jahia.modules</groupId>
        <artifactId>jahia-authentication</artifactId>
        <version>1.0.0</version>
        <scope>provided</scope>
    </dependency>
</dependencies>
```

3. Add node types to `definitions.cnd`:

```
[joant:myConnectorOAuthView] > jnt:content, jmix:authConnectorSettingView
[joant:myConnectorButton] > jnt:content, joamix:oauthButtonConnector
```

4. Register the OSGi service in your blueprint XML:

```xml
<osgi:reference id="jahiaOAuthService"
    interface="org.jahia.modules.jahiaoauth.service.JahiaOAuthService"
    availability="mandatory"/>

<osgi:service ref="MyConnectorImpl"
    interface="org.jahia.modules.jahiaoauth.service.ConnectorService">
    <osgi:service-properties>
        <entry key="connectorServiceName" value="MyConnectorApi"/>
    </osgi:service-properties>
</osgi:service>
```

The `connectorServiceName` must be consistent between the blueprint, the Spring file in Jahia OAuth module, and any JavaScript code in your module.

5. Create views for `joant:myConnectorOAuthView` (settings UI) and `joant:myConnectorButton` (login button).

**Action modules** execute logic after authentication (e.g., provision users). Two types:

- **Provider** — performs the login/connection
- **Data mapper** — stores user data (e.g., to jExperience profiles)

Implement `org.jahia.modules.jahiaauth.service.Mapper` for data mapper action modules.

---

## SAML 2.0

### Module installation

Deploy and install these three modules:

1. [SAML2 Authentication Valve](https://store.jahia.com/contents/modules-repository/org/jahia/modules/saml-authentication-valve.html)
2. [Jahia Authentication](https://store.jahia.com/contents/modules-repository/org/jahia/modules/jahia-authentication.html)
3. [JCR Authentication Provider](https://store.jahia.com/contents/modules-repository/org/jahia/modules/jcr-auth-provider.html)

### Creating a keystore

```bash
keytool -genkeypair \
    -alias jahiakeystorealias \
    -keypass changeit \
    -keystore sp.jks \
    -storepass changeit \
    -keyalg RSA \
    -keysize 2048 \
    -validity 3650
```

When prompted "What is your first and last name?", enter your Jahia site domain name (must match `jahia.server.name`).

### Configuring SAML in Site Settings

1. Navigate to **Administration > Sites > Jahia Authentication** and expand **SAML2 Settings**.
2. Toggle **Activate**.
3. Upload the **Identity Provider Metadata** XML file (from your IdP, e.g., Shibboleth, Google).
4. Fill in:
   - **Relying Party Identifier** — your SP identifier sent to the IdP
   - **Server Location** — public URL of your Jahia site (e.g., `http://localhost:8080`)
   - Keystore values (or leave keystore empty to auto-generate one using hostname as CN)
   - **Incoming Target URL** — where IdP returns SAML response (default: `/home.callback.saml`)
   - **Redirect after successful login** — Jahia relative URL (e.g., `/home.html`)
   - **Maximum authentication lifetime** — max age of IdP session before re-authentication
5. Select optional flags: Force authentication, Passive authentication, Sign authentication request, Requires signed assertions.
6. Select **Binding type** (e.g., `HTTP-POST`).
7. Click **Save**.

After saving, **Open Service Provider Metadata** becomes available for downloading SP metadata to share with the IdP.

### Configuration file example

SAML config is stored per-site in `karaf/etc`:

```properties
# SAML Configuration file - autogenerated
siteKey = digitall
enabled = true
identityProviderMetadata = ...
relyingPartyIdentifier = test-local
serverLocation = http://localhost:8080
keyStore = ...
keyStoreAlias = saml2clientconfiguration
keyStorePass = changeit
privateKeyPass = changeit
incomingTargetUrl = /home.callback.saml
postLoginPath = /home.html
maximumAuthenticationLifetime = 86400
forceAuth = false
passive = false
requireSignedAssertions = false
signAuthnRequest = true
bindingType = urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST
keyStoreType = PKCS12
mapperName = jcrOAuthProvider
```

### Mapping users from IdP

1. On the **SAML2 Settings** page, click **Mappers**.
2. Expand and activate the **JCR Authentication Provider** section.
3. In **Field from connector**, select IdP fields (e.g., Login).
4. In **Field from provider**, select Jahia fields (e.g., Login username mandatory).
5. Click **Save**.

### Triggering SAML login

Users are redirected to the IdP by calling `*.connect.saml?siteKey={sitekey}`:

```
http://localhost/sites/mySite/home.connect.saml?siteKey=mySite
```

You can also use a form component (included with the module) or embed the redirect in a JSP/template.

**Redirect to a specific page after login** using the `redirect` query param:

```
/sites/mySite/home.connect.saml?siteKey=mySite&redirect=/sites/mySite/about-us.html
```

The `siteKey` param is required unless the server name is mapped to a site in Jahia (even then, using `siteKey` is recommended).

**JSP form example:**

```jsp
<c:if test="${not renderContext.loggedIn}">
    <form action="${renderContext.mainResource.node.name}.connect.saml" method="GET">
        <input type="hidden" name="siteKey" value="${renderContext.site.siteKey}"/>
        <input type="hidden" name="redirect"
               value="${renderContext.mainResource.nodePath}.${renderContext.mainResource.templateType}"/>
        <input type="submit" value="${currentNode.displayableName}">
    </form>
</c:if>
```

Redirect URLs are filtered: only local URLs (no hostname) are accepted to prevent XSS.

### Private pages and SAML authentication

By default Jahia returns HTTP 404 for private pages to hide their existence. To redirect unauthenticated users to the SAML IdP instead, configure `jahia.properties`:

```properties
# authorizationError returns 401 for guests, 403 for authenticated users without permission
protectedResourceAccessStrategy=authorizationError
```

Then customize the 401 error page to include a link to `*.connect.saml`. For sites where the site root itself is private:

```bash
cp error_401.jsp <tomcat_home>/webapps/ROOT/errors/sites/<mySite>/error_401.jsp
```

**Common SAML authentication error causes:**

- Missing or wrong `siteKey` query param
- Missing or unreadable SAML configuration file for the site
- Wrong keystore or certificate configuration
- Mismatched Relying Party Identifier

Clients always receive HTTP 400 on authentication failure — check server logs for the root cause.

---

## UPA — User Password Authentication Module

### What it adds over default auth

The UPA module provides a custom username/password login flow with optional multi-factor authentication (MFA via email code). It replaces the default Jahia login page with a configurable React-based UI. It is not a full IdP replacement — prefer SAML or OpenID for enterprise SSO.

**Important:** Once the API module is enabled, it overrides the default login URL for **all sites** on the platform. The legacy `/cms/login` endpoint remains active and must be blocked at the reverse proxy for full security.

### Prerequisites

- Jahia 8.2.3 or higher
- GraphQL DXM Provider module (included in Jahia core)
- For MFA email code: working SMTP server and users must have `j:email` set
- For clusters: sticky sessions or distributed sessions required

### Installation

Two modules from the [Jahia Store](https://store.jahia.com/):

1. **API module** (`user-password-authentication-api-X.Y.Z.jar`) — provides GraphQL APIs; install and enable platform-wide
2. **UI module** (`user-password-authentication-ui-X.Y.Z.tgz`) — React-based login form; install and enable per site

### Setup: login URL provider

Configure where users are redirected when accessing protected resources (choose one option):

**Option A (recommended):** Set `loginUrl` in OSGi console (`org.jahia.modules.upa` configuration):
- Navigate to **Tools > OSGi Console > OSGi > Configuration**
- Set `loginUrl` to the login page URL (e.g., `/sites/mySite/login.html`)
- The URL must include the site key for email template resolution

**Option B:** Install the community *Site Settings - Customize Error Pages* module.

**Option C:** Implement a custom `LoginUrlProvider` interface.

After configuring the URL provider, create the login page in Page Builder, add the **UPA Authentication** component (`upaui:authentication`), publish the page, and verify it is accessible without authentication.

### Authentication flow

1. User accesses protected content → redirected to login page
2. User enters username/email and password
3. If MFA is enabled: user receives a code by email and enters it in a verification form
4. On success: user is redirected to the originally requested resource

MFA follows a two-step model per factor:
- **Prepare** — generates and sends the challenge (e.g., email code)
- **Verify** — validates the user's response

### Customization

**Custom MFA email template:** Create a view with selector `mailCodeView` at higher priority for `upa:mfaMailCode` node type. Use `{{CODE}}` placeholder for the verification code. Use inline CSS (email client compatibility).

**Custom UI:** Only the API module is strictly required. Copy the [UI module source](https://github.com/Jahia/user-password-authentication/tree/main/ui/) and customize it. The GraphQL APIs are available at `/modules/graphql-dxm-provider/tools/graphql-workspace.jsp`.

**Custom MFA factor:** Implement the `MfaFactorProvider` interface (experimental, subject to change).

### Known limitations

| Limitation | Detail |
|-----------|--------|
| Global login URL | `loginUrl` applies platform-wide, across all sites |
| Cluster lockout | Max failed attempts per cluster node: `((T-1) × N) + 1` where T = tries configured, N = node count |
| Multiple providers | Only one custom `LoginUrlProvider` can be active at a time |
| Legacy endpoint | `/cms/login` bypasses UPA; must be blocked at the proxy level |
