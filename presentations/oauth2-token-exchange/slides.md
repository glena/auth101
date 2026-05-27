---
title: OAuth 2 Token Exchange
description: A focused introduction to RFC 8693 token exchange, common use cases, and the token endpoint request payload.
status: draft
order: 5
resources:
  - label: RFC 8693
    url: https://www.rfc-editor.org/info/rfc8693
  - label: RFC 6749
    url: https://www.rfc-editor.org/info/rfc6749
  - label: RFC 8707
    url: https://www.rfc-editor.org/info/rfc8707
  - label: OpenID Connect Core
    url: https://openid.net/specs/openid-connect-core-1_0.html
---

# OAuth 2 Token Exchange

RFC 8693 defines an extension grant for trading one security token for another.

- Purpose: exchange a validated input token for a target-specific output token
- Use cases: downstream APIs, narrowing, audience changes, format changes, delegation, and federation bootstrap
- `/token` request payload: extension grant plus subject, target, and requested output
- Parameter meaning: token types tell the server how to validate and what to issue

[RFC 8693](https://www.rfc-editor.org/info/rfc8693) · [RFC 6749](https://www.rfc-editor.org/info/rfc6749) · [RFC 8707](https://www.rfc-editor.org/info/rfc8707) · [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)

::: notes
Keep this deck scoped to token exchange as standardized by RFC 8693. RFC 6749 supplies the token endpoint and extension grant model. RFC 8707 gives additional background for resource indicators, which overlap with the `resource` parameter used by token exchange.

Purpose: exchange a validated input token for a target-specific output token. Token exchange is useful when the token a client already has is not the right credential for the next service, audience, subject relationship, or local security domain.

Use cases include downstream APIs, narrowing, audience changes, format changes, delegation, and federation bootstrap. The common shape is consistent: validate what came in, apply policy, then issue only what is appropriate for the next hop.

The `/token` request payload uses an extension grant plus subject, target, and requested output parameters. It is still the OAuth token endpoint, so client authentication, form encoding, token response rules, and error handling remain in play.

Parameter meaning is driven by token types. `subject_token_type` tells the server how to validate the presented token, while `requested_token_type` tells the server what kind of output token the client wants.
:::

---

## Purpose

Token exchange lets a client ask the authorization server for a token better suited to the next hop.

```text
validated input token + target context -> policy-controlled output token
```

::: notes
The core idea is not "refresh this token" or "mint anything from anything." The client presents a security token, the authorization server validates it, applies policy, and may issue a new token with a different audience, scope, token type, or subject/actor relationship.

Validated input token means the server has to understand the token type, issuer, signature or introspection result, lifetime, audience, and trust relationship before considering an exchange.

Target context means the requested `resource`, `audience`, `scope`, and output token type. This is where the client says what it needs next.

Policy-controlled output token means issuance is never automatic. The server decides whether this client may perform this exchange, whether this subject or actor relationship is allowed, and how narrow the result should be.
:::

---

## Extension grant

Token exchange is a `/token` request.

```text
grant_type = urn:ietf:params:oauth:grant-type:token-exchange
```

- Uses normal OAuth client authentication
- Uses form-encoded token endpoint input
- Returns a normal OAuth token response

::: notes
Treat this as another token endpoint grant type. The authorization server still authenticates the client according to registration and policy. The server then validates the presented token or tokens according to the declared token type and local trust rules.

Normal OAuth client authentication means confidential clients still authenticate with their registered method, and public clients are only allowed when policy explicitly permits the exchange.

Form-encoded token endpoint input means the request uses `application/x-www-form-urlencoded` parameters rather than a JSON body.

A normal OAuth token response means the response can include fields such as `access_token`, `token_type`, `expires_in`, `scope`, and token exchange's `issued_token_type`. Deployment-specific or OIDC responses may include additional fields by policy.
:::

---

## Main use cases

- Service-to-service: exchange an inbound user token for a downstream API token
- Narrowing: turn a broad token into a short-lived, least-privilege token
- Audience or resource change: issue a token for the next service, not the previous one
- Format change: convert between opaque, JWT, SAML, or local token formats
- Delegation or impersonation: represent who acts and for whom
- Federation bootstrap: exchange a trusted third-party `id_token` for local tokens

::: notes
Use cases often show up in distributed systems. A resource server receives a token for itself, then needs a token suitable for a backend service. A gateway may exchange a user token for a short-lived, narrower token. A system boundary may need a JWT, SAML assertion, or opaque access token depending on what the next service accepts.

Service-to-service exchange avoids forwarding a token to an audience that should not receive it. Each downstream service gets a token minted for its own audience and policy.

Narrowing reduces blast radius by removing unused scopes, shortening lifetime, or binding the issued token to a specific resource.

Audience or resource changes keep the `aud` or resource indicator aligned with the service that will actually consume the token.

Format changes bridge system boundaries. One service may require an opaque reference token, another may require a JWT, and a legacy federation boundary may require SAML.

Delegation or impersonation carries identity semantics. The issued token may preserve both the subject and actor, or it may intentionally treat the actor as the subject.

Federation bootstrap uses a trusted third-party `id_token` as the presented subject token. The local authorization server validates the external authentication event, maps the external subject to a local account, then issues local tokens for its own clients and APIs.
:::

---

## Downstream API example

```text
user -> frontend -> orders API -> invoices API
```

The orders API exchanges its incoming token for an invoices token.

- Input token: intended for orders API
- Output audience: invoices API
- Output scope: `invoices.read`
- Output lifetime: short

::: notes
This avoids sending a token intended for the orders API to the invoices API. It also lets the authorization server apply policy between services: whether orders may call invoices, which user authority may be carried forward, and how narrow the issued token should be.

Input token: intended for orders API. The orders API should not forward that same token to invoices because the audience and resource context are wrong.

Output audience: invoices API. The new token should identify invoices as the intended consumer.

Output scope: `invoices.read`. The issued token should carry only the permission needed for the downstream call, not the full authority of the original frontend token.

Output lifetime: short. Downstream tokens are often narrowly scoped and short-lived because they are minted for a specific service call path.
:::

---

## Use case: third-party sign-in

A client presents a trusted provider's `id_token` and asks the local authorization server for local tokens.

```text
third-party id_token -> local id_token + access token + optional refresh token
```

- Input: external authentication assertion
- Mapping: external subject to local account
- Output: tokens issued by this authorization server
- Boundary: trust the provider, not every `id_token`

::: notes
This pattern uses token exchange as an authentication bootstrap. A user authenticates at a trusted third-party OpenID Provider, the client receives an `id_token`, and the local authorization server exchanges that external assertion for tokens in the local security domain.

Input: external authentication assertion. The third-party `id_token` says the external provider authenticated a subject for a particular client audience at a particular time.

Mapping: external subject to local account. The local authorization server must map the external issuer and subject pair to an existing local account or a controlled account-provisioning flow.

Output: tokens issued by this authorization server. The local tokens should name the local issuer, local audience, local scopes, and local subject model; they are not just copies of the third-party claims.

Boundary: trust the provider, not every `id_token`. Only configured issuers, expected client audiences, allowed algorithms, valid signatures, acceptable freshness, and approved clients should be eligible for this exchange.
:::

---

## Third-party `id_token` request

```http
POST /token HTTP/1.1
Content-Type: application/x-www-form-urlencoded
Authorization: Basic ...

grant_type=urn:ietf:params:oauth:grant-type:token-exchange&
subject_token=eyJ...third-party-id-token...&
subject_token_type=urn:ietf:params:oauth:token-type:id_token&
audience=local-api&
scope=openid+profile+api.read&
requested_token_type=urn:ietf:params:oauth:token-type:access_token
```

::: notes
The `subject_token` is the third-party ID token. It is not used directly as a local session or API credential; it is presented to the local authorization server for validation and policy evaluation.

`subject_token_type=urn:ietf:params:oauth:token-type:id_token` tells the server to validate the input as an OpenID Connect ID token rather than as an OAuth access token.

`audience=local-api` asks for a local token intended for the local API. The output audience should be a resource in the local authorization server's trust domain.

`scope=openid+profile+api.read` asks for local identity and API authority using form-encoded spaces. The server may grant less than requested or reject scopes that the mapped account or client is not allowed to receive.

`requested_token_type=access_token` asks for an access token as the primary exchange result. If the deployment also issues a local ID token or refresh token, that is local OIDC and token policy layered on top of the exchange.
:::

---

## Validate the external login

Before issuing local tokens, validate:

- Issuer: configured third-party provider
- Signature and algorithm: trusted keys only
- Audience: token was minted for the expected client
- Lifetime and freshness: `exp`, `iat`, `auth_time`, and `nonce` policy
- Subject mapping: stable `(iss, sub)` to local account

::: notes
Issuer validation prevents accepting tokens from arbitrary OpenID Providers. The local authorization server should have explicit configuration for each trusted provider.

Signature and algorithm validation prevents accepting unsigned, weakly signed, or key-confused tokens. Use the provider's configured JWKS and reject unexpected algorithms.

Audience validation checks that the third-party ID token was minted for the client or integration expected by the local authorization server. A token issued to another app should not be redeemable here.

Lifetime and freshness checks include `exp` and `iat`; for login-sensitive exchanges, also consider `auth_time`, `max_age`, and `nonce` when those values were part of the original authentication request.

Subject mapping should use the pair `(iss, sub)`, not email alone. Email can change, be unverified, or collide across issuers; issuer plus subject is the stable external account key.
:::

---

## Issue local tokens

The output tokens belong to the local authorization server.

- Local issuer: this auth server, not the third-party provider
- Local audience: local client and APIs
- Local claims: mapped account, approved scopes, policy context
- Local session policy: refresh, rotation, revocation, and logout rules

::: notes
Local issuer means the output tokens are issued by this authorization server. APIs should validate them against local issuer metadata and local signing keys, not against the third-party provider.

Local audience means the tokens are intended for local clients and APIs. Do not preserve the third-party audience unless that is explicitly part of the local trust model.

Local claims should be derived from the mapped account and local authorization policy. Copying every third-party claim into local tokens can leak data and create accidental authorization semantics.

Local session policy controls whether a refresh token is issued, whether refresh token rotation is required, how revocation works, and how logout or account unlinking affects later exchanges.
:::

---

## Local token response

The exchange can bootstrap a local authenticated session.

```json
{
  "access_token": "eyJ...local-api...",
  "issued_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "openid profile api.read",
  "id_token": "eyJ...local-id-token...",
  "refresh_token": "r1..."
}
```

::: notes
The response can bootstrap a local authenticated session because the authorization server has accepted the external authentication assertion and converted it into local credentials.

`access_token` is the local API credential. It should be issued for local resource servers and local authorization policy.

`issued_token_type` identifies the primary token produced by the RFC 8693 exchange. In this example, the primary exchanged token is an access token.

`token_type=Bearer` tells the client how to present the access token. Sender-constrained designs would use different binding rules.

`expires_in` keeps the local API credential short-lived. Short access-token lifetime limits impact if the token leaks.

`scope` reports the local permissions actually granted. It may be narrower than the requested scope.

`id_token` is a local OpenID Connect identity assertion, not the third-party ID token replayed back to the client. Include it only when the local authorization server is also acting as an OpenID Provider for this client.

`refresh_token` is optional and policy-sensitive. If issued, use rotation, revocation, and account-linking rules so future local sessions still depend on local trust decisions.
:::

---

## Delegation and impersonation

Token exchange can express two different relationships.

| Relationship  | Meaning                         |
| ------------- | ------------------------------- |
| Delegation    | Actor acts for the subject      |
| Impersonation | Actor is treated as the subject |

::: notes
In delegation, the issued token can preserve both the subject and the actor. In impersonation, the token is interpreted as the subject in the target context. Do not blur these in implementation or logging; audit trails and authorization decisions depend on the distinction.

Delegation means "this actor is acting for this subject." It is useful when services need to preserve user context while making downstream calls.

Impersonation means "treat the actor as the subject." It can be useful for administrative tools or migration jobs, but it needs stronger policy controls and audit logging.
:::

---

## Request shape

```http
POST /token HTTP/1.1
Content-Type: application/x-www-form-urlencoded
Authorization: Basic ...

grant_type=urn:ietf:params:oauth:grant-type:token-exchange&
subject_token=eyJ...&
subject_token_type=urn:ietf:params:oauth:token-type:access_token&
resource=https%3A%2F%2Fapi.example%2Finvoices&
audience=invoices-api&
scope=invoices.read&
requested_token_type=urn:ietf:params:oauth:token-type:access_token
```

::: notes
The request body is `application/x-www-form-urlencoded`, not JSON. The client authentication shown with Basic is only one possible method; the registered client method controls what is valid.

`grant_type` selects token exchange and must exactly match the RFC 8693 extension grant value.

`subject_token` carries the input credential. Its validation rules come from `subject_token_type`.

`resource`, `audience`, and `scope` describe the requested output context. The server may reject overbroad or conflicting targets.

`requested_token_type` describes the preferred output token type. The server may issue a different supported type or reject the request by policy.
:::

---

## Required parameters

| Parameter            | Meaning                         |
| -------------------- | ------------------------------- |
| `grant_type`         | Selects RFC 8693 token exchange |
| `subject_token`      | Token being exchanged           |
| `subject_token_type` | Type of `subject_token`         |

::: notes
`grant_type` must be exactly `urn:ietf:params:oauth:grant-type:token-exchange`. `subject_token` represents the identity or authority on behalf of which the request is made. `subject_token_type` tells the authorization server how to validate and interpret the presented token, for example as an access token, refresh token, ID token, JWT, or SAML assertion.

`grant_type` is required because `/token` supports multiple grants. Without it, the server cannot select the token exchange validator.

`subject_token` is required because token exchange needs an input security token to validate. The server should protect logs from raw token values.

`subject_token_type` is required because the same string-shaped token could be a JWT access token, ID token, or another assertion. The type controls validation logic and policy.
:::

---

## Target parameters

| Parameter  | Meaning                |
| ---------- | ---------------------- |
| `resource` | Target resource URI    |
| `audience` | Logical target service |
| `scope`    | Requested permissions  |

::: notes
All three are optional. `resource` can appear more than once and uses absolute URI values without fragments. `audience` can appear more than once and names target services using values meaningful to the authorization server. `scope` is a space-delimited OAuth scope list for the token being requested. Broad combinations can be rejected with `invalid_target`.

`resource` identifies concrete protected resources, usually by URI. Use it when the issued token should be bound to a specific API or resource server.

`audience` identifies logical services or recipients using values meaningful to the authorization server. It often becomes, or influences, the `aud` claim in structured tokens.

`scope` requests permissions for the output token. It should be evaluated against the input token, client policy, subject policy, and requested target.
:::

---

## Output token parameter

`requested_token_type` asks what kind of token should be issued.

```text
urn:ietf:params:oauth:token-type:access_token
urn:ietf:params:oauth:token-type:refresh_token
urn:ietf:params:oauth:token-type:id_token
urn:ietf:params:oauth:token-type:jwt
urn:ietf:params:oauth:token-type:saml2
```

::: notes
This parameter is optional. If omitted, the authorization server chooses the issued token type based on policy and the requested target. Asking for a token type is not a guarantee that the server will issue it.

`access_token` asks for a token usable at a protected resource.

`refresh_token` asks for a credential that can obtain later tokens. This is higher risk and should be tightly limited.

`id_token` asks for an OpenID Connect identity assertion. Use it only when the exchange is part of an OIDC-aware design.

`jwt` asks for a generic JWT token type, which is not automatically the same thing as an OAuth access token or OIDC ID token.

`saml2` asks for a SAML 2.0 assertion, usually for legacy or enterprise federation boundaries.
:::

---

## Actor parameters

Use actor parameters when the issued token needs delegation context.

| Parameter          | Meaning                             |
| ------------------ | ----------------------------------- |
| `actor_token`      | Token representing the acting party |
| `actor_token_type` | Type of `actor_token`               |

::: notes
`actor_token` is optional. `actor_token_type` is required when `actor_token` is present and must not be sent otherwise. The authorization server validates both the subject and actor tokens and decides whether the requested delegation is allowed.

`actor_token` represents the acting party when that party is distinct from the subject. For example, a service may act for a user.

`actor_token_type` tells the server how to validate the actor token. It follows the same type-driven validation principle as `subject_token_type`.
:::

---

## Validation model

The authorization server validates:

- Client authentication and exchange permission
- Subject token type, issuer, audience, lifetime, and trust
- Actor token type and trust, when delegation is requested
- Requested target, scope, token type, and local issuance policy

::: notes
RFC 8693 leaves token-specific validation and trust models to deployments. The important implementation point is deterministic policy: which clients may exchange which tokens, for which targets, under which subject and actor relationships.

Client authentication and exchange permission are separate checks. A client can authenticate successfully and still be forbidden from exchanging this token type or requesting this target.

Subject token validation depends on the declared token type. For third-party ID tokens, validate OIDC issuer metadata, signature, audience, lifetime, and account mapping.

Actor token validation is required when delegation is requested. The server must verify that the actor is allowed to act for the subject.

Requested target, scope, token type, and local issuance policy determine what the server may issue. Overbroad combinations should be rejected or narrowed.
:::

---

## Token response

Successful responses use normal OAuth token response fields plus token exchange context.

```json
{
  "access_token": "eyJ...",
  "issued_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "token_type": "Bearer",
  "expires_in": 300,
  "scope": "invoices.read"
}
```

::: notes
`issued_token_type` tells the client what kind of token was actually issued. `token_type` describes how to use the token, such as Bearer. As with other token responses, return cache-prevention headers and avoid logging raw tokens.

`access_token` is the issued credential for the requested target. It should be validated by the intended resource server.

`issued_token_type` is the token exchange-specific field that identifies the type of token actually issued.

`token_type` describes how the client presents the token. `Bearer` means possession is sufficient unless sender-constraining is used.

`expires_in` communicates lifetime. Short lifetimes are common for exchanged tokens.

`scope` reports the granted scope, which may be narrower than requested.
:::
