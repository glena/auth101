---
title: OpenID Connect Deep Dive
description: How OpenID Connect relates to OAuth 2, discovery metadata, JWKS, authorization parameters, ID Token validation, nonce, and authentication assurance.
status: draft
order: 5
resources:
  - label: OpenID Connect Core
    url: https://openid.net/specs/openid-connect-core-1_0-errata2.html
  - label: OpenID Connect Discovery
    url: https://openid.net/specs/openid-connect-discovery-1_0-errata2.html
  - label: OAuth Multiple Response Types
    url: https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html
  - label: RFC 6749
    url: https://www.rfc-editor.org/info/rfc6749
  - label: RFC 8414
    url: https://www.rfc-editor.org/info/rfc8414
  - label: RFC 7517
    url: https://www.rfc-editor.org/info/rfc7517
---

# OpenID Connect Deep Dive

OIDC adds identity, discovery metadata, and ID Token validation rules to OAuth 2.

- OAuth base: OIDC profiles OAuth authorization code and token flows
- Relying Party role: the OAuth client relies on an OP login result
- Discovery: `.well-known` metadata tells the RP where endpoints and keys live
- Authorize parameters: `openid`, `nonce`, `prompt`, `max_age`, `acr_values`, `claims`
- ID Token validation: signature, issuer, audience, time, nonce, and assurance claims

[OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0-errata2.html) · [Discovery](https://openid.net/specs/openid-connect-discovery-1_0-errata2.html) · [Multiple Response Types](https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html) · [RFC 8414](https://www.rfc-editor.org/info/rfc8414) · [RFC 7517](https://www.rfc-editor.org/info/rfc7517)

::: notes
Use OpenID Connect Core 1.0 incorporating errata set 2 as the main reference. Use OIDC Discovery for `.well-known/openid-configuration`, RFC 8414 for OAuth authorization server metadata, and RFC 7517 for JSON Web Keys. Be precise: OAuth authorizes API access; OIDC authenticates the end user for the relying party by returning an ID Token.

OAuth base: OIDC profiles OAuth authorization code and token flows. The RP still uses `/authorize`, `/token`, `client_id`, redirect URI validation, scopes, and token endpoint client authentication.

Relying Party role: the OAuth client relies on an OP login result. The same application is called a client in OAuth and a Relying Party in OIDC when it consumes an ID Token.

Discovery: `.well-known` metadata tells the RP where endpoints and keys live. This prevents every RP from hard-coding authorization, token, UserInfo, and JWKS URLs separately.

Authorize parameters: `openid`, `nonce`, `prompt`, `max_age`, `acr_values`, and `claims` turn an OAuth authorization request into an authentication request with explicit login requirements.

ID Token validation: signature, issuer, audience, time, nonce, and assurance claims are the checks that make the authentication result trustworthy enough for a local session.
:::

---

## OAuth versus OIDC

<div class="cols">

<div>

### OAuth 2

Delegated authorization for APIs.

Client asks for access tokens.

</div>

<div>

### OIDC

Authentication layer on OAuth 2.

RP validates ID Tokens.

</div>

</div>

::: notes
OIDC does not replace OAuth. It profiles OAuth and adds ID Tokens, UserInfo, discovery, dynamic registration, and authentication-specific parameters.

OAuth 2 is about delegated API access. The client asks for access tokens so it can call resource servers on the resource owner's behalf.

OIDC is about authentication. The RP asks the OP to authenticate the end user and return an ID Token the RP can validate.

The same flow can produce both outcomes. In OIDC code flow, the RP receives an ID Token for login and may also receive an access token for UserInfo or API access.
:::

---

## OIDC changes the audience

The OAuth client is also an OIDC Relying Party.

```text
End user -> OpenID Provider authenticates
Relying Party <- validates ID Token result
```

::: notes
OpenID Provider, or OP, is the OIDC term for the authorization server that authenticates the user. Relying Party, or RP, is the OAuth client relying on the authentication result.

The phrase "also an OIDC Relying Party" matters. OIDC does not remove the OAuth client role; it adds an authentication-specific role for the same software when the request includes `openid` and the application consumes an ID Token.

The end user authenticates at the OP. The RP receives a signed ID Token and decides whether that authentication event is sufficient to create or update a local application session.

The audience changes because an ID Token is meant for the RP, not for an API resource server. The RP is the party that must validate and rely on the authentication result.
:::

---

## Client versus Relying Party

The same app can wear both names.

| Term | Focus |
| ---- | ----- |
| OAuth client | Registered app requesting delegated access and tokens |
| OIDC Relying Party | Same app relying on a verified user authentication result |

::: notes
OAuth client is the general OAuth term. It is the application registered with the authorization server, identified by `client_id`, using redirect URIs, requesting scopes, and receiving tokens for API access.

OIDC Relying Party is the OpenID Connect term for that application when it uses OIDC to authenticate the end user. It relies on the OP's ID Token and claims instead of collecting the user's credentials directly.

The terms overlap because OIDC is built on OAuth. In a code flow login, the RP is still the OAuth client that sends the authorization request, receives the code, calls `/token`, and validates the response.

The difference is what the application is trying to prove. As an OAuth client, it wants authorization to call APIs. As a Relying Party, it wants evidence of who authenticated and under what conditions.
:::

---

## What "relying" means

The RP trusts a specific OP's signed result after validation.

- It redirects the user to the OP instead of collecting credentials
- It validates the ID Token signature and required claims
- It maps `(iss, sub)` to a local account or session
- It accepts risk from the configured OP trust relationship

::: notes
"Relying" does not mean blindly accepting whatever token arrives. It means the application has a configured trust relationship with a specific OpenID Provider and is willing to base a local login decision on that provider's signed authentication result.

It redirects the user to the OP instead of collecting credentials. The OP handles the login ceremony, MFA, account selection, and authentication policy.

It validates the ID Token signature and required claims before relying on it. Validation includes issuer, audience, signature, algorithm, expiration, issued-at time, nonce, and any required authentication freshness or assurance claims.

It maps `(iss, sub)` to a local account or session. The stable key is usually `(iss, sub)`, not an email address by itself, because the same subject value can mean different users at different issuers.

It accepts risk from the configured OP trust relationship. If the OP account is compromised, the OP weakens its authentication policy, or the RP misconfigures validation, the RP's local login decision can be wrong.
:::

---

## The `openid` scope

OIDC starts when `scope` includes `openid`.

```http
GET /authorize?
  response_type=code&
  scope=openid%20profile%20email&
  client_id=rp-web&
  redirect_uri=https%3A%2F%2Frp.example%2Fcb&
  nonce=n-0S6_WzA2Mj
```

::: notes
Without `openid`, this is an OAuth request, not an OIDC authentication request. Profile, email, address, and phone are optional standard scopes for requesting user claims.

`scope=openid` is the switch that makes the request an OIDC authentication request. Without it, the server should treat the request as OAuth only and does not have to return an ID Token.

`profile` asks for common profile claims such as name, family name, given name, and picture. It does not guarantee every claim will be returned.

`email` asks for email-related claims such as `email` and `email_verified`. RPs should still validate whether email was verified before using it for account recovery or account linking.

`client_id=rp-web` identifies the registered RP. This value becomes important later because the ID Token `aud` must include this client ID.

`redirect_uri` is still an OAuth redirect URI and must match registration. OIDC does not loosen redirect URI rules.

`nonce` binds the ID Token to this browser authentication request. The RP stores it before redirecting and checks it after validating the ID Token.
:::

---

## New authorize parameters

OIDC adds authentication controls.

- `nonce`: bind the ID Token to this browser request
- `prompt`: request login, consent, silent check, or account selection behavior
- `max_age`: require recent authentication
- `login_hint`: hint which account the OP should show
- `acr_values`: request an authentication assurance class
- `claims`: request specific ID Token or UserInfo claims

::: notes
These parameters help the RP ask for a particular authentication interaction or claim result. The OP still applies local policy and may decline or return an error.

`nonce` is a replay defense for ID Tokens. It is especially important when any token or ID Token is returned through the browser front channel, and it remains useful in code flow to bind the authentication response to the pending request.

`prompt` controls interaction behavior. For example, `login` asks for reauthentication, `consent` asks for renewed consent, `none` asks for a silent result, and `select_account` asks the OP to show account choice.

`max_age` is an age limit in seconds for the user's active authentication. If the existing login is too old, the OP must reauthenticate the user and include `auth_time`.

`login_hint` is a usability hint, often an email address, username, or issuer-specific identifier. It is not proof of identity and should not bypass authentication.

`acr_values` requests one or more authentication context class references. The OP may satisfy, ignore, or reject the request depending on trust framework and policy.

`claims` lets the RP ask for specific claims and mark some as essential. It is more precise than scopes but still subject to OP policy and user consent.
:::

---

## `response_type=code`

Authorization code flow returns the ID Token from `/token`.

```text
/authorize -> code in browser redirect
/token     -> id_token + optional access_token
```

::: notes
This is the modern default. Tokens are returned through the back channel, and the RP can authenticate at the token endpoint when it is confidential.

`/authorize -> code` means the browser only receives a short-lived authorization code. This keeps tokens out of the front-channel URL.

`/token -> id_token + optional access_token` means the RP exchanges the code directly with the OP. The ID Token establishes login at the RP; an access token may be used for UserInfo or API access.

PKCE is expected for public clients and is commonly used by confidential clients as well. Client authentication still applies when the RP is confidential.
:::

---

## OIDC implicit response types

OIDC can return ID Tokens from `/authorize`.

```text
id_token       -> ID Token only in front channel
id_token token -> ID Token and access token in front channel
```

::: notes
OIDC does not use OAuth's bare `token` response type because no ID Token would be returned. Modern security guidance still prefers code flow with PKCE over implicit-style browser token delivery.

`id_token` returns an ID Token directly from the authorization endpoint. The RP must validate nonce and signature before creating a session.

`id_token token` returns both an ID Token and access token through the browser. This creates more exposure in browser history, logs, scripts, and redirect handling, so it is not the modern default.
:::

---

## OIDC hybrid response types

Hybrid returns some values up front and some later.

```text
code id_token       -> front-channel login proof plus later token call
code token          -> front-channel access token plus later token call
code id_token token -> all front-channel values plus later token call
```

::: notes
Hybrid flows were designed for clients that need an immediate front-channel authentication result plus later token endpoint exchange. They are more complex and require careful nonce and hash claim validation.

`code id_token` returns a code and ID Token at the authorization endpoint. The RP validates the ID Token immediately and later exchanges the code.

`code token` returns a code and access token at the authorization endpoint. This is unusual for modern designs and requires access-token hash validation.

`code id_token token` returns all three front-channel values. It has the most validation burden because the RP must bind the code and access token to the signed ID Token.
:::

---

## ID Token purpose

The ID Token is the authentication assertion.

```text
issuer says: subject authenticated for this RP audience at this time
```

::: notes
Do not use an access token as a login assertion. Access tokens are for resource servers. ID Tokens are for the relying party and contain claims about authentication.

`issuer` is the OP that authenticated the user and signed the ID Token. The RP must know and trust this issuer.

`subject` is the user's stable identifier at that issuer. The RP should store it with the issuer as `(iss, sub)`.

`audience` is the RP client ID. The ID Token is meant for the RP, not for an API.

`at this time` is represented by claims such as `iat`, `exp`, and sometimes `auth_time`. The RP must reject stale or expired assertions.
:::

---

## Discovery endpoint

OIDC discovery publishes OP metadata at a well-known URL.

```text
https://issuer.example/.well-known/openid-configuration
```

- Confirms the issuer identifier
- Lists authorization, token, UserInfo, and JWKS endpoints
- Advertises supported scopes, response types, claims, and algorithms

::: notes
The OpenID Provider Configuration document is the main OIDC `.well-known` endpoint. It is JSON metadata that lets the RP configure itself from the issuer URL.

The issuer identifier in the document must match the issuer the RP intended to use. Discovery should not silently turn one issuer into another.

The endpoint list tells the RP where to send authorization requests, token requests, UserInfo requests, and where to fetch public keys for signature validation.

Supported scopes, response types, claims, and algorithms help the RP know what the OP can do. They are capability metadata, not a substitute for registration policy.
:::

---

## OAuth authorization server metadata

OAuth also has a well-known metadata endpoint.

```text
https://issuer.example/.well-known/oauth-authorization-server
```

- Describes OAuth endpoints and capabilities
- May overlap with OIDC discovery fields
- Does not by itself make a server an OpenID Provider

::: notes
OAuth Authorization Server Metadata is related but not identical to OIDC Discovery. It describes OAuth authorization server metadata for OAuth clients and resource servers.

It may expose many of the same endpoint locations, such as authorization, token, revocation, introspection, and JWKS metadata.

It does not by itself make a server an OpenID Provider because OIDC requires support for OpenID Connect behavior such as `openid` scope, ID Tokens, and OIDC-specific metadata.

For OIDC login, the RP should use the OIDC discovery document for the OP it trusts.
:::

---

## JWKS endpoint

`jwks_uri` points to the OP's public signing keys.

```json
{
  "jwks_uri": "https://issuer.example/keys"
}
```

- Publishes public keys, not private keys
- Each key usually has `kid`, `kty`, `use`, `alg`, and key material
- RPs cache keys and refresh on rotation

::: notes
The JWKS endpoint returns a JSON Web Key Set. It is commonly served at a URL like `/jwks.json` or `/keys`, but the authoritative location is the `jwks_uri` value from discovery.

It publishes public keys, not private keys. The OP signs ID Tokens with a private key, and RPs verify signatures with the corresponding public key.

Each key usually has `kid` for key selection, `kty` for key type, `use` for intended use such as signature, `alg` for algorithm, and key material such as RSA modulus/exponent or elliptic curve coordinates.

RPs cache keys for performance and resilience. On key rotation, a token may arrive with an unfamiliar `kid`; the RP should refresh the JWKS and retry key selection before rejecting.
:::

---

## ID Token signature verification

Verify the JWT before trusting any claims.

```text
read header.alg and header.kid
select matching public key from jwks_uri
verify signature over header.payload
then validate claims
```

::: notes
Signature verification must happen before the RP trusts claims from the payload. The payload is just base64url-encoded JSON until the signature and claims are validated.

Read `header.alg` and `header.kid` from the JWT header. Reject `alg=none` unless a very specific profile explicitly allows unsigned ID Tokens, and do not accept algorithms outside the client's registered or expected set.

Select the matching public key from `jwks_uri` using `kid`, key type, intended use, and algorithm. If no key matches, refresh JWKS once to handle rotation.

Verify the signature over the exact `header.payload` bytes using the selected key and algorithm. Do not rewrite JSON or reserialize the token before verification.

Then validate claims such as `iss`, `aud`, `azp`, `exp`, `iat`, `nonce`, `auth_time`, `acr`, and `amr` according to the request and local policy.
:::

---

## ID Token shape

An ID Token is usually a signed JWT.

```text
header.payload.signature
  header: algorithm and key id
  payload: claims about authentication
  signature: OP proof over header.payload
```

::: notes
OIDC Core defines ID Tokens as JWTs. The RP validates the signature using OP keys from discovery or configured metadata, then validates the claims.

The header tells the RP which algorithm and key identifier the OP used. It is input to verification, not a trusted result by itself.

The payload carries claims about the issuer, subject, audience, times, nonce, and authentication event. These claims are not trusted until signature and claim validation pass.

The signature proves the OP signed the header and payload with a private key corresponding to a public key in the OP's JWKS.
:::

---

## Core identity claims

- `iss`: OP issuer URL that must match discovery
- `sub`: stable subject identifier within that issuer
- `aud`: RP client ID that must include this client
- `exp`: expiration time after which the token is invalid
- `iat`: issued-at time used for age and sanity checks

::: notes
These are foundational validation claims. `sub` is the stable identifier for the user at this issuer and should be treated as pairwise with `iss`; do not compare subjects across issuers without issuer context.

`iss` must exactly match the issuer the RP configured or discovered. Accepting a token from the wrong issuer is a login vulnerability.

`sub` identifies the authenticated end user at that issuer. Store and compare it together with `iss`.

`aud` must contain the RP's client ID. If the RP's client ID is absent, the token was not issued for this RP.

`exp` is the expiration timestamp. The RP rejects expired tokens, usually with small clock skew tolerance.

`iat` is the issue time. The RP can use it to reject tokens that are implausibly old, too far in the future, or outside local policy.
:::

---

## Audience and authorized party

`aud` tells who the ID Token is for.

`azp` identifies the authorized party when needed.

::: notes
If the ID Token has multiple audiences, OIDC Core requires `azp` in some cases so the RP can identify the party to which the token was issued. The RP must reject tokens not intended for its client ID.

`aud` is normally the RP's `client_id`. It can be a single string or an array depending on the token.

`azp` is used when the token has multiple audiences and the authorized party needs to be explicit. When present, it should match the RP's client ID in the cases required by OIDC Core.

Do not treat an ID Token as valid just because it has a trusted issuer. The audience check is what prevents a token issued to one RP from being replayed to another RP.
:::

---

## Time and freshness claims

- `exp`: reject expired ID Tokens
- `iat`: detect implausible or stale issuance
- `auth_time`: know when the user last authenticated

::: notes
When `max_age` is requested, the ID Token must include `auth_time`. RPs can also use `auth_time` for local reauthentication policies.

`exp` is a hard validity limit. After it passes, the ID Token should not be accepted for login.

`iat` supports age and clock checks. A token issued too far in the future or too old for local policy should be rejected.

`auth_time` is the time of user authentication at the OP. It is required when `max_age` is used and useful when the RP requires recent login for sensitive actions.
:::

---

## Flow binding claims

- `nonce`: binds ID Token to the RP's browser request
- `c_hash`: binds front-channel authorization code to the ID Token
- `at_hash`: binds front-channel access token to the ID Token

::: notes
`c_hash` and `at_hash` matter especially in implicit and hybrid flows where values arrive through the authorization endpoint. They let the RP verify that the code or access token belongs with the signed ID Token.

`nonce` is generated by the RP, stored with the pending request, and checked against the ID Token claim.

`c_hash` is a hash-derived value for the authorization code. In hybrid flows, it helps prove the code returned through the front channel belongs with the signed ID Token.

`at_hash` is a hash-derived value for the access token. In implicit and hybrid flows, it helps prove the access token returned through the front channel belongs with the signed ID Token.
:::

---

## Claims relate to request parameters

```text
nonce      -> nonce claim for replay defense
max_age    -> auth_time claim for freshness
acr_values -> acr claim for assurance class
scope      -> standard claim groups like profile or email
claims     -> exact requested ID Token or UserInfo claims
```

::: notes
Request parameters are asks. The ID Token and UserInfo response are the results. The RP must validate required results and handle cases where optional requested claims are absent.

`nonce` asks the OP to return the nonce in the ID Token. The RP rejects the token if it does not match the pending request.

`max_age` asks for authentication freshness. The resulting `auth_time` lets the RP verify the OP satisfied that freshness requirement.

`acr_values` asks for an assurance class. The resulting `acr` is meaningful only within an agreed trust framework.

`scope` asks for standard claim groups. The OP may put some claims in the ID Token and others behind UserInfo.

`claims` asks for a precise claim set. Essential claims need explicit handling if the OP cannot supply them.
:::

---

## `state` versus `nonce`

<div class="cols">

<div>

### `state`

Binds the authorization redirect to the RP session.

</div>

<div>

### `nonce`

Binds the ID Token to the authentication request.

</div>

</div>

::: notes
They are related but not interchangeable. State is returned as an authorization response parameter. Nonce is returned inside the signed ID Token. Use both in browser flows.

`state` protects the OAuth redirect response. The RP stores state with the pending browser session and checks the returned authorization response before processing the code or error.

`nonce` protects the ID Token. The RP stores nonce with the pending authentication request and checks the ID Token's signed `nonce` claim after validating the token.

Using only `state` does not prove the ID Token was minted for this authentication request. Using only `nonce` does not protect the authorization response routing. Use both.
:::

---

## What nonce solves

Nonce prevents replayed ID Tokens.

```text
old id_token + wrong browser session -> nonce mismatch -> rejected
```

::: notes
The RP stores nonce with the pending authentication request, then checks the ID Token nonce claim after token validation. The value must have enough entropy to resist guessing.

`old id_token` represents a validly signed token from an earlier login. Signature validity alone is not enough if the token is being replayed into the wrong browser flow.

`wrong browser session` means the callback belongs to a different pending login request than the one that produced the ID Token.

`nonce mismatch -> rejected` is the expected outcome. The RP should stop before creating a local session.
:::

---

## `prompt`

The RP can ask for interaction behavior.

```text
prompt=login          -> force user reauthentication
prompt=consent        -> ask for consent again
prompt=none           -> silent check, no UI allowed
prompt=select_account -> ask user to choose an account
```

::: notes
`prompt=none` is used for silent checks and must fail if user interaction is required. `prompt=login` asks the OP to reauthenticate the end user.

`prompt=login` asks the OP to actively reauthenticate the user even if an OP session already exists.

`prompt=consent` asks the OP to show a consent step again, useful when the RP needs a fresh approval record.

`prompt=none` asks the OP to complete silently. If login, consent, or account selection is required, the OP returns an error such as `login_required` or `interaction_required`.

`prompt=select_account` asks the OP to let the user choose which account to use, especially when multiple OP sessions are available.
:::

---

## `max_age`

The RP sets maximum authentication age.

```text
max_age=300 -> authentication must be no older than 5 minutes
```

::: notes
If the user's active authentication is older than the allowed age, the OP must attempt active reauthentication. The returned ID Token must include `auth_time`.

`max_age=300` is measured in seconds. It means the RP is asking the OP for an authentication event no more than five minutes old.

The OP enforces this by checking the user's current OP session. If it is too old, the OP reauthenticates the user.

The RP validates the result using `auth_time`. If `auth_time` is missing when `max_age` was requested, or if the age is too high, the RP should reject the login result.
:::

---

## Authentication context

`acr` describes the authentication context class.

```json
{
  "acr": "urn:example:loa:2"
}
```

The value is meaningful only inside an agreed trust framework.

::: notes
The meaning of `acr` values is trust-framework specific. The RP should only require or interpret values it has agreed on with the OP.

`acr` stands for Authentication Context Class Reference. It is a label for the class of authentication performed, such as a local level of assurance.

The value is not universal. `urn:example:loa:2` only means something if the RP and OP have agreed what that value represents.

An RP that requires an `acr` value should check the returned ID Token and decide what to do if the OP returns a different value or no value.
:::

---

## Authentication methods

`amr` lists methods used.

```json
{
  "amr": ["pwd", "otp"]
}
```

Methods describe what happened; they are not assurance by themselves.

::: notes
`amr` is useful for risk decisions but should not be treated as a universal assurance level. Method names are not enough without issuer policy and context.

`pwd` indicates password authentication. `otp` indicates a one-time password method. Other OPs may use other values.

`amr` can help an RP decide whether step-up is needed, but it does not automatically prove a regulatory assurance level.

Interpret `amr` together with `iss`, OP policy, `acr`, `auth_time`, and the RP's own risk rules.
:::

---

## Claims parameter

The RP can ask for specific claims.

```json
{
  "id_token": {
    "email_verified": { "essential": true },
    "acr": { "values": ["urn:example:loa:2"] }
  }
}
```

::: notes
The `claims` parameter allows more precise requests than scopes. Essential claims can cause an error if they cannot be supplied, depending on OP behavior and policy.

`id_token` tells the OP the RP wants these claims in the ID Token itself, not only from UserInfo.

`email_verified` marked as `essential` means the RP considers that claim required for this authentication result.

`acr` with `values` asks for one of the listed authentication context values. The OP may satisfy it, return a different value, or fail depending on policy and support.

The `claims` parameter is powerful but can be verbose. Use it for claims that are truly required for login decisions, not as a replacement for every profile attribute request.
:::

---

## Validation checklist

- Discover issuer metadata and `jwks_uri`
- Validate signature, key, and allowed algorithm
- Check `iss`, `aud`, `azp`, `exp`, and `iat`
- Check `nonce` against the pending request
- Check `auth_time`, `acr`, and `amr` when requested or required

::: notes
Also handle key rotation and clock skew carefully. Validation must happen before creating a local application session.

Discover issuer metadata and `jwks_uri` from the trusted issuer. The metadata gives the RP the endpoints and public key location it should use.

Validate signature, key, and allowed algorithm before trusting payload claims. Select the JWKS key by `kid` and reject unexpected algorithms.

Check `iss`, `aud`, `azp`, `exp`, and `iat` to ensure the token came from the expected issuer, was issued for this RP, and is within the valid time window.

Check `nonce` against the pending request to prevent replay into the wrong browser session.

Check `auth_time`, `acr`, and `amr` when requested or required by local policy. These claims drive freshness, assurance, and step-up decisions.
:::

---

## The mental model

OAuth says what access was delegated to a client.

OIDC says who authenticated and how the RP can verify it.

Discovery and JWKS tell the RP where to validate issuer metadata and signatures.

`state` protects the redirect; `nonce` protects the ID Token.

::: notes
Close by reinforcing separation: access tokens authorize API calls, ID Tokens establish a login session at the relying party.

OAuth says what access was delegated to a client. That is why access tokens are intended for resource servers and scopes describe API authority.

OIDC says who authenticated and how the RP can verify it. That is why ID Tokens are intended for the RP and carry authentication claims.

Discovery and JWKS tell the RP where to validate issuer metadata and signatures. The RP should not trust token claims without first anchoring validation to the expected issuer and key set.

`state` protects the redirect; `nonce` protects the ID Token. They solve adjacent but different binding problems.
:::
