# react-router in a UI extension

When the module imports `react-router` or `react-router-dom`, ask the developer which path to take.
Each path gives a module that works on the app-shell of its row.

| Path  | The module imports                                                         | It runs on        | `<jahia-depends>`                  |
| ----- | -------------------------------------------------------------------------- | ----------------- | ---------------------------------- |
| Full  | the v6 API of `react-router-dom-v5-compat`, and nothing else               | app-shell 4 and 5 | `app-shell=4.0,jahia-ui-root=1.13` |
| Light | the v5 API of `react-router`, and `Link` / `NavLink` of `react-router-dom` | app-shell 4       | `app-shell=4.0`                    |

jahia-ui-root 1.13.0 renders `CompatRouter`, and without it a module on the full path does not
start. Recommend the full path once 1.13.0 is released, and the light path until then. With 1.13.0,
modules of both paths run side by side on one Jahia.

On both paths the module renders no router: no `CompatRouter`, `BrowserRouter` or `Router`. Jahia
renders it, and a module that renders its own breaks inside a module that has one.

## The full path

1. Import only from `react-router-dom-v5-compat`, and only its v6 API: `Routes`, `Route`, `Outlet`,
   `Navigate`, `Link`, `NavLink`, `useNavigate`, `useParams`, `useLocation`, `useMatch`. Never
   `CompatRoute` or `CompatRouter`. Remove `react-router` and `react-router-dom` from
   `package.json`.
2. Register a `route` under the path `/x/*`, never `/x*`. The rest of the URL is `useParams()['*']`.
3. Give a nested `Routes` paths relative to the route that renders it: `:site/settings` under
   `/administration/*`, and an `index` route for the empty rest. An absolute path renders nothing.
4. Read no argument of `render()`. On app-shell 4 they are the v5 route props, and app-shell 5
   passes none. A screen reads `useParams()`, `useLocation()` and `useNavigate()`.
5. Rewrite what v6 removed: `history.listen` becomes a `useEffect` on `useLocation()`, and
   `withRouter` becomes the hooks. `history.block`, `Prompt` and `match.url` have no v6 equivalent.
6. `useParams()` also holds the params of every parent route, `*` included: read the keys by name.

| v5                                                      | v6                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `useHistory().push(to)`                                 | `useNavigate()(to)`                                           |
| `history.replace(to)`                                   | `navigate(to, {replace: true})`                               |
| `<Switch>`                                              | `<Routes>`                                                    |
| `<Route path="/administration/x" render={() => <X/>}/>` | `<Route path="x" element={<X/>}/>`                            |
| `<Route exact path="/administration" …/>`               | `<Route index element={…}/>`                                  |
| `<Redirect to={to}/>`                                   | `<Navigate replace to={to}/>`                                 |
| `useRouteMatch(path)`                                   | `useMatch(pattern)`                                           |
| `<NavLink activeClassName="x">`                         | `<NavLink className={({isActive}) => (isActive ? 'x' : '')}>` |

A module that renders the routes of other modules, such as the `adminRoute` of
jahia-administration, gives a v5 child no `match` through a v6 `Route`. Render that child through
`RouteWithTitle` of `@jahia/jahia-ui-root`, as the `element`, with the absolute path.

## The light path

1. Import from `react-router` each name it exports: `useHistory`, `useLocation`, `useParams`,
   `useRouteMatch`, `Route`, `Switch`, `Redirect`, `withRouter`. Import only `Link` and `NavLink`
   from `react-router-dom`, and declare both packages as step 4 of the skill states.
2. Convert v6 code back with the table of the full path, read from right to left.
3. Keep absolute paths in `Route`, because the v5 `Switch` matches the full URL.

The module moves to the full path before app-shell 5.
