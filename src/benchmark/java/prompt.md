"For Sure" is a fictional insurance company. Its website shows a price estimate that the browser asks from Jahia. Build the Jahia Java module that answers it.

The module:

- A Maven project in `./forsure-quote`, groupId `org.forsure`, artifactId `forsure-quote`.
- An action named `quote`, called on any page: `GET <page URL>.quote.do?product=<product>&age=<age>`.
- Anonymous visitors call it from the live site. Logged-in editors call it from the pages they edit too.
- `product` is `car`, `health` or `home`. `age` is a whole number from 18 to 99.
- The monthly premium is the base price of the product, multiplied by 1.5 under 25 years old, by 1.3 from 65 years old, by 1 otherwise, rounded to 2 decimals.
- The base prices come from the OSGi configuration `org.forsure.quote`, keys `car`, `health` and `home`. Without a configuration they are 45, 60 and 25. A change of the configuration applies without a redeployment.
- A valid request answers `200` with `Content-Type: application/json`: `{"product":"car","age":30,"monthlyPremium":45.0,"currency":"EUR"}`.
- An unknown product answers `400` with `{"error":"invalid-product"}`. A missing, non-numeric or out-of-range age answers `400` with `{"error":"invalid-age"}`. Errors are JSON whatever the `Accept` header of the request.
- Only `GET` gets a quote.
- Unit tests cover the price computation. `mvn package` passes.

Jahia runs at http://localhost:8080 (user `root`, password `root1234`). Deploy the module there, then prove every rule above with `curl` on `http://localhost:8080/sites/systemsite/home.quote.do`.

Work in full autonomy. Do not stop before the module is deployed and checked.
