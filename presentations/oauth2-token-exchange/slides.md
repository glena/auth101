---
title: OAuth 2 Token Exchange
description: A focused introduction to RFC 8693 token exchange, common use cases, and the token endpoint request payload.
status: draft
order: 3
resources:
  - label: RFC 8693
    url: https://www.rfc-editor.org/info/rfc8693
  - label: RFC 6749
    url: https://www.rfc-editor.org/info/rfc6749
  - label: RFC 8707
    url: https://www.rfc-editor.org/info/rfc8707
---

# OAuth 2 Token Exchange

RFC 8693 defines an extension grant for trading one security token for another.

- Purpose and boundaries
- Main use cases
- `/token` request payload
- Parameter-by-parameter meaning

[RFC 8693](https://www.rfc-editor.org/info/rfc8693) · [RFC 6749](https://www.rfc-editor.org/info/rfc6749) · [RFC 8707](https://www.rfc-editor.org/info/rfc8707)

::: notes
Keep this deck scoped to token exchange as standardized by RFC 8693. RFC 6749 supplies the token endpoint and extension grant model. RFC 8707 gives additional background for resource indicators, which overlap with the `resource` parameter used by token exchange.
:::

---

## Purpose

Token exchange lets a client ask the authorization server for a token better suited to the next hop.

```text
current token + target context -> new token
```

::: notes
The core idea is not "refresh this token" or "mint anything from anything." The client presents a security token, the authorization server validates it, applies policy, and may issue a new token with a different audience, scope, token type, or subject/actor relationship.
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
:::

---

## Main use cases

- Service-to-service downstream calls
- Narrowing broad frontend tokens
- Changing audience or resource
- Changing token format
- Delegation or impersonation

::: notes
Use cases often show up in distributed systems. A resource server receives a token for itself, then needs a token suitable for a backend service. A gateway may exchange a user token for a short-lived, narrower token. A system boundary may need a JWT, SAML assertion, or opaque access token depending on what the next service accepts.
:::

---

## Downstream API example

```text
user -> frontend -> orders API -> invoices API
```

The orders API exchanges its incoming token for an invoices token.

- Audience: invoices API
- Scope: `invoices.read`
- Lifetime: short

::: notes
This avoids sending a token intended for the orders API to the invoices API. It also lets the authorization server apply policy between services: whether orders may call invoices, which user authority may be carried forward, and how narrow the issued token should be.
:::

---

## Delegation and impersonation

Token exchange can express two different relationships.

| Relationship | Meaning |
| --- | --- |
| Delegation | Actor acts for the subject |
| Impersonation | Actor is treated as the subject |

::: notes
In delegation, the issued token can preserve both the subject and the actor. In impersonation, the token is interpreted as the subject in the target context. Do not blur these in implementation or logging; audit trails and authorization decisions depend on the distinction.
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
:::

---

## Required parameters

| Parameter | Meaning |
| --- | --- |
| `grant_type` | Selects RFC 8693 token exchange |
| `subject_token` | Token being exchanged |
| `subject_token_type` | Type of `subject_token` |

::: notes
`grant_type` must be exactly `urn:ietf:params:oauth:grant-type:token-exchange`. `subject_token` represents the identity or authority on behalf of which the request is made. `subject_token_type` tells the authorization server how to validate and interpret the presented token, for example as an access token, refresh token, ID token, JWT, or SAML assertion.
:::

---

## Target parameters

| Parameter | Meaning |
| --- | --- |
| `resource` | Target resource URI |
| `audience` | Logical target service |
| `scope` | Requested permissions |

::: notes
All three are optional. `resource` can appear more than once and uses absolute URI values without fragments. `audience` can appear more than once and names target services using values meaningful to the authorization server. `scope` is a space-delimited OAuth scope list for the token being requested. Broad combinations can be rejected with `invalid_target`.
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
:::

---

## Actor parameters

Use actor parameters when the issued token needs delegation context.

| Parameter | Meaning |
| --- | --- |
| `actor_token` | Token representing the acting party |
| `actor_token_type` | Type of `actor_token` |

::: notes
`actor_token` is optional. `actor_token_type` is required when `actor_token` is present and must not be sent otherwise. The authorization server validates both the subject and actor tokens and decides whether the requested delegation is allowed.
:::

---

## Validation model

The authorization server validates:

- Client authentication and policy
- Subject token type and trust
- Actor token type and trust, when present
- Requested target, scope, and token type

::: notes
RFC 8693 leaves token-specific validation and trust models to deployments. The important implementation point is deterministic policy: which clients may exchange which tokens, for which targets, under which subject and actor relationships.
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
:::
