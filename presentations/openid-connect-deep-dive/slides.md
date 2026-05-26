---
title: OpenID Connect Deep Dive
description: How OpenID Connect relates to OAuth 2, new authorization parameters and response types, ID Token claims, nonce, and authentication assurance.
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
---

# OpenID Connect Deep Dive

OIDC adds identity to OAuth 2.

- How OIDC builds on OAuth
- New authorization parameters and response types
- ID Token anatomy and claim validation
- `nonce`, `state`, and session binding
- Authentication restrictions and assurances

[OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0-errata2.html) · [Discovery](https://openid.net/specs/openid-connect-discovery-1_0-errata2.html) · [Multiple Response Types](https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html) · [RFC 6749](https://www.rfc-editor.org/info/rfc6749)

::: notes
Use OpenID Connect Core 1.0 incorporating errata set 2 as the main reference. Be precise: OAuth authorizes API access; OIDC authenticates the end user for the relying party by returning an ID Token.
:::

---

## OAuth versus OIDC

<div class="cols">

<div>

### OAuth 2

Delegated authorization for APIs.

</div>

<div>

### OIDC

Authentication layer on OAuth 2.

</div>

</div>

::: notes
OIDC does not replace OAuth. It profiles OAuth and adds ID Tokens, UserInfo, discovery, dynamic registration, and authentication-specific parameters.
:::

---

## OIDC changes the audience

The client is now a relying party.

```text
End user -> OpenID Provider -> Relying Party
```

::: notes
OpenID Provider, or OP, is the OIDC term for the authorization server that authenticates the user. Relying Party, or RP, is the OAuth client relying on the authentication result.
:::

---

## The `openid` scope

OIDC starts when `scope` includes `openid`.

```http
GET /authorize?
  response_type=code&
  scope=openid%20profile%20email&
  client_id=rp-web&
  redirect_uri=https%3A%2F%2Frp.example%2Fcb
```

::: notes
Without `openid`, this is an OAuth request, not an OIDC authentication request. Profile, email, address, and phone are optional standard scopes for requesting user claims.
:::

---

## New authorize parameters

OIDC adds authentication controls.

- `nonce`
- `prompt`
- `max_age`
- `login_hint`
- `acr_values`
- `claims`

::: notes
These parameters help the RP ask for a particular authentication interaction or claim result. The OP still applies local policy and may decline or return an error.
:::

---

## `response_type=code`

Authorization code flow returns the ID Token from `/token`.

```text
/authorize -> code
/token     -> id_token, access_token
```

::: notes
This is the modern default. Tokens are returned through the back channel, and the RP can authenticate at the token endpoint when it is confidential.
:::

---

## OIDC implicit response types

OIDC can return ID Tokens from `/authorize`.

```text
id_token
id_token token
```

::: notes
OIDC does not use OAuth's bare `token` response type because no ID Token would be returned. Modern security guidance still prefers code flow with PKCE over implicit-style browser token delivery.
:::

---

## OIDC hybrid response types

Hybrid returns some values up front and some later.

```text
code id_token
code token
code id_token token
```

::: notes
Hybrid flows were designed for clients that need an immediate front-channel authentication result plus later token endpoint exchange. They are more complex and require careful nonce and hash claim validation.
:::

---

## ID Token purpose

The ID Token is the authentication assertion.

```text
issuer says: subject authenticated for this audience
```

::: notes
Do not use an access token as a login assertion. Access tokens are for resource servers. ID Tokens are for the relying party and contain claims about authentication.
:::

---

## ID Token shape

An ID Token is usually a signed JWT.

```text
header.payload.signature
```

::: notes
OIDC Core defines ID Tokens as JWTs. The RP validates the signature using OP keys from discovery or configured metadata, then validates the claims.
:::

---

## Core identity claims

- `iss`: issuer
- `sub`: subject
- `aud`: relying party client ID
- `exp`: expiration
- `iat`: issued at

::: notes
These are foundational validation claims. `sub` is the stable identifier for the user at this issuer and should be treated as pairwise with `iss`; do not compare subjects across issuers without issuer context.
:::

---

## Audience and authorized party

`aud` tells who the token is for.

`azp` may identify the authorized party.

::: notes
If the ID Token has multiple audiences, OIDC Core requires `azp` in some cases so the RP can identify the party to which the token was issued. The RP must reject tokens not intended for its client ID.
:::

---

## Time and freshness claims

- `exp` rejects expired tokens
- `iat` supports age checks
- `auth_time` says when login happened

::: notes
When `max_age` is requested, the ID Token must include `auth_time`. RPs can also use `auth_time` for local reauthentication policies.
:::

---

## Flow binding claims

- `nonce`: binds ID Token to browser request
- `c_hash`: binds authorization code
- `at_hash`: binds access token

::: notes
`c_hash` and `at_hash` matter especially in implicit and hybrid flows where values arrive through the authorization endpoint. They let the RP verify that the code or access token belongs with the signed ID Token.
:::

---

## Claims relate to request parameters

```text
nonce      -> nonce claim
max_age    -> auth_time claim
acr_values -> acr claim
scope      -> profile claims
claims     -> requested claim set
```

::: notes
Request parameters are asks. The ID Token and UserInfo response are the results. The RP must validate required results and handle cases where optional requested claims are absent.
:::

---

## `state` versus `nonce`

<div class="cols">

<div>

### `state`

Binds redirect response to client session.

</div>

<div>

### `nonce`

Binds ID Token to authentication request.

</div>

</div>

::: notes
They are related but not interchangeable. State is returned as an authorization response parameter. Nonce is returned inside the signed ID Token. Use both in browser flows.
:::

---

## What nonce solves

Nonce prevents replayed ID Tokens.

```text
old id_token + wrong browser session -> rejected
```

::: notes
The RP stores nonce with the pending authentication request, then checks the ID Token nonce claim after token validation. The value must have enough entropy to resist guessing.
:::

---

## `prompt`

The RP can ask for interaction behavior.

```text
prompt=login
prompt=consent
prompt=none
prompt=select_account
```

::: notes
`prompt=none` is used for silent checks and must fail if user interaction is required. `prompt=login` asks the OP to reauthenticate the end user.
:::

---

## `max_age`

The RP sets maximum authentication age.

```text
max_age=300
```

::: notes
If the user's active authentication is older than the allowed age, the OP must attempt active reauthentication. The returned ID Token must include `auth_time`.
:::

---

## Authentication context

`acr` describes the authentication context class.

```json
{
  "acr": "urn:example:loa:2"
}
```

::: notes
The meaning of `acr` values is trust-framework specific. The RP should only require or interpret values it has agreed on with the OP.
:::

---

## Authentication methods

`amr` lists methods used.

```json
{
  "amr": ["pwd", "otp"]
}
```

::: notes
`amr` is useful for risk decisions but should not be treated as a universal assurance level. Method names are not enough without issuer policy and context.
:::

---

## Claims parameter

The RP can ask for specific claims.

```json
{
  "id_token": {
    "email_verified": { "essential": true }
  }
}
```

::: notes
The `claims` parameter allows more precise requests than scopes. Essential claims can cause an error if they cannot be supplied, depending on OP behavior and policy.
:::

---

## Validation checklist

- Discover issuer metadata
- Validate signature and algorithm
- Check `iss`, `aud`, `exp`, `iat`
- Check `nonce`
- Check `auth_time`, `acr`, `amr` when required

::: notes
Also handle key rotation and clock skew carefully. Validation must happen before creating a local application session.
:::

---

## The mental model

OAuth says what access was delegated.

OIDC says who authenticated and how the RP can verify it.

`state` protects the redirect; `nonce` protects the ID Token.

::: notes
Close by reinforcing separation: access tokens authorize API calls, ID Tokens establish a login session at the relying party.
:::
