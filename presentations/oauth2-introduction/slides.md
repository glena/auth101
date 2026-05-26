---
title: Introduction to OAuth 2
description: A focused introduction to OAuth 2 endpoints, grants, exchanges, and request anatomy.
status: draft
order: 1
resources:
  - label: RFC 6749
    url: https://www.rfc-editor.org/info/rfc6749
  - label: RFC 9700
    url: https://www.rfc-editor.org/info/rfc9700
  - label: OAuth 2.1 Draft
    url: https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/15/
---

# Introduction to OAuth 2

OAuth 2 is a framework for delegated authorization.

- What the authorize endpoint does
- What the token endpoint does
- How grants and exchanges fit together
- How to read authorize and token requests

[RFC 6749](https://www.rfc-editor.org/info/rfc6749) · [RFC 9700](https://www.rfc-editor.org/info/rfc9700) · [OAuth 2.1 draft](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/15/)

::: notes
Frame this as an introduction to protocol mechanics, not a security deep dive. OAuth 2.0 is defined by RFC 6749, while RFC 9700 updates the security guidance. OAuth 2.1 is still a draft as of this deck, so mention it as consolidation of modern practice rather than a replacement RFC.
:::

---

## Why OAuth exists

OAuth lets a client get limited access without handling the resource owner's password.

```text
resource owner -> authorization server -> client -> resource server
```

::: notes
Keep the vocabulary precise. The resource owner is usually the user. The client is the application asking for delegated access. The authorization server issues tokens. The resource server accepts tokens. OAuth is about authorization and delegation; authentication is outside core OAuth unless OpenID Connect is added.
:::

---

## Two endpoints carry the core flow

<div class="cols">

<div class="callout">

### `/authorize`

Browser-facing request that asks for authorization.

</div>

<div class="callout">

### `/token`

Back-channel request that trades a grant for tokens.

</div>

</div>

::: notes
The authorize endpoint is normally reached through the user agent. The token endpoint is normally called directly by the client. This distinction matters because browser redirects expose parameters differently than server-to-server HTTP requests.
:::

---

## The authorize endpoint

The client sends the user to the authorization server.

```http
GET /authorize?
  response_type=code&
  client_id=calendar-web&
  redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&
  scope=calendar.read&
  state=7b3c...
```

::: notes
The authorization server authenticates the user however it chooses, asks for consent when appropriate, and redirects back to the client. OAuth does not standardize the login UI or the user's authentication method.
:::

---

## Authorize request: routing

- `client_id` identifies the client registration.
- `redirect_uri` tells the server where to send the result.

::: notes
The authorization server must know the client and validate the redirect URI. Exact redirect URI validation is a major security control because loose matching can lead to authorization code or token leakage.
:::

---

## Authorize request: permissions and binding

- `scope` describes the access the client is requesting.
- `state` is an opaque client value returned unchanged in the response.

::: notes
Scope is a request for a bounded permission set. The authorization server can grant less than requested. State is commonly used to bind the authorization response to the browser session and mitigate CSRF. State is not a substitute for redirect URI validation or PKCE.
:::

---

## Authorize request: response shape

- `response_type` selects what comes back from `/authorize`.
- `response_mode` selects how parameters are encoded in the response.

::: notes
In core OAuth 2.0, `response_type=code` returns an authorization code and `response_type=token` was used by the implicit flow. Modern guidance favors authorization code with PKCE and deprecates implicit-style token delivery in the browser. `response_mode` comes from extension specifications; common modes include query, fragment, and form_post.
:::

---

## The token endpoint

The client calls the authorization server directly.

```http
POST /token HTTP/1.1
Content-Type: application/x-www-form-urlencoded
Authorization: Basic ...

grant_type=authorization_code&
code=SplxlOBeZQQYbYS6WxSbIA&
redirect_uri=https%3A%2F%2Fclient.example%2Fcallback
```

::: notes
This endpoint is not a browser redirect. It is an HTTP request made by the client. Depending on the client type and configured method, the client may authenticate with HTTP Basic, a request body secret, a JWT assertion, or no secret for a public client.
:::

---

## Grant types are token inputs

A grant is the thing the client presents to get a token.

- Authorization code
- Client credentials
- Refresh token
- Extension grants

::: notes
RFC 6749 also defined implicit and resource owner password credentials. Modern guidance has moved away from both for new systems. Keep this slide focused on the idea: a grant type tells the token endpoint how to validate the request.
:::

---

## Exchanges are trades

OAuth is a sequence of controlled exchanges.

```text
authorization request -> authorization code
authorization code -> access token
refresh token -> new access token
client credentials -> access token
```

::: notes
Use "exchange" as plain language, not as a separate core OAuth object. The most important exchange in this deck is code for token, because it shows why `/authorize` and `/token` are separate.
:::

---

## Token request anatomy

- `grant_type` tells the server which validation rules apply.
- `code` is the authorization code when using the code grant.
- `redirect_uri` repeats the binding used in the authorization request.
- Client authentication proves the caller is the registered client when credentials can be kept.

::: notes
Token endpoint anatomy changes by grant type. For authorization code, the server validates the code, client binding, redirect URI binding, expiration, one-time use, and PKCE when present. Save detailed security validation for the later internals deck.
:::

---

## The mental model

`/authorize` creates a grant through the browser.

`/token` validates a grant and issues tokens through a back channel.

Grants describe why a token may be issued.

::: notes
Close by reinforcing separation of concerns. Browser-facing authorization is about user interaction and consent. Token exchange is about server-side validation and issuing credentials. The next deck can go deeper into response types and client authentication.
:::
