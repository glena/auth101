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

## Key terminology

| Term | Meaning |
|---|---|
| **Resource owner** | The user who owns the data |
| **Client** | The application requesting access |
| **Authorization server** | Issues tokens after authenticating the owner |
| **Resource server** | Hosts the protected data; accepts tokens |
| **Scope** | A named permission the client is asking for |
| **Access token** | Short-lived credential used to call the resource server |
| **Refresh token** | Long-lived credential used to get new access tokens |

::: notes
These terms come directly from RFC 6749 and are used consistently throughout the spec. Being precise here pays off when reading actual requests and responses — each parameter name maps to one of these roles.
:::

---

## Why OAuth exists

OAuth lets a client access data and perform operations on a resource owner's behalf — without the client ever handling the resource owner's password.

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

Browser-facing request that asks for authorization — these are often called **interactive flows**.

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

## Authorize request: `client_id`

`client_id` identifies the client registration.

<pre><code>GET /authorize?
  <mark>client_id=calendar-web</mark>&amp;
  response_type=code&amp;
  redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&amp;
  scope=calendar.read&amp;
  state=7b3c...</code></pre>

::: notes
The client_id maps to a registered client entry that includes the allowed redirect URIs, grant types, and other configuration.
:::

---

## Authorize request: `redirect_uri`

`redirect_uri` tells the server where to send the result.

<pre><code>GET /authorize?
  client_id=calendar-web&amp;
  response_type=code&amp;
  <mark>redirect_uri=https%3A%2F%2Fclient.example%2Fcallback</mark>&amp;
  scope=calendar.read&amp;
  state=7b3c...</code></pre>

::: notes
Exact redirect URI validation is a major security control because loose matching can lead to authorization code or token leakage.
:::

---

## Authorize request: `scope`

`scope` describes the access the client is requesting.

<pre><code>GET /authorize?
  client_id=calendar-web&amp;
  response_type=code&amp;
  redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&amp;
  <mark>scope=calendar.read</mark>&amp;
  state=7b3c...</code></pre>

::: notes
Scope is a request for a bounded permission set. The authorization server can grant less than requested.
:::

---

## Authorize request: `state`

`state` is an opaque client value returned unchanged in the response.

<pre><code>GET /authorize?
  client_id=calendar-web&amp;
  response_type=code&amp;
  redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&amp;
  scope=calendar.read&amp;
  <mark>state=7b3c...</mark></code></pre>

::: notes
State binds the authorization response to the browser session, mitigating CSRF. It is not a substitute for redirect URI validation or PKCE.
:::

---

## Authorize request: `response_type`

`response_type` selects what comes back from `/authorize`.

<pre><code>GET /authorize?
  client_id=calendar-web&amp;
  <mark>response_type=code</mark>&amp;
  redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&amp;
  scope=calendar.read&amp;
  state=7b3c...</code></pre>

::: notes
`response_type=code` returns an authorization code. `response_type=token` was used by the now-deprecated implicit flow. Modern guidance favors authorization code with PKCE.
:::

---

## `response_type` values

| Value | What you get | Notes |
|---|---|---|
| `code` | Authorization code | Standard; exchange it at `/token` |
| `token` | Access token directly | Implicit flow — deprecated |

::: notes
`code` is the only value recommended by current guidance. The implicit `token` value delivers the access token directly in the URL fragment, exposing it to browser history and referrer headers. Extension specifications such as OpenID Connect define additional values.
:::

---

## Authorize request: `response_mode`

`response_mode` selects how parameters are encoded in the response.

<pre><code>GET /authorize?
  client_id=calendar-web&amp;
  response_type=code&amp;
  redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&amp;
  scope=calendar.read&amp;
  state=7b3c...&amp;
  <mark>response_mode=query</mark></code></pre>

::: notes
`response_mode` comes from extension specifications. Common modes are query (params in URL), fragment (hash), and form_post (HTTP POST body).
:::

---

## `response_mode` values

| Value | How the response is delivered |
|---|---|
| `query` | Parameters appended to the redirect URI as a query string |
| `fragment` | Parameters appended to the redirect URI as a URL fragment |
| `form_post` | Parameters sent as an HTTP POST body to the redirect URI |

::: notes
`query` is the default for `response_type=code` and keeps the authorization code in the URL query string. `fragment` was the default for the implicit flow — the token lands in the hash, which the browser does not send to the server but is still readable by page scripts. `form_post` avoids exposing parameters in the URL entirely; the authorization server POSTs the response to the redirect URI, which makes it suitable when the response payload is large or must not appear in logs.
:::

---

## Authorize request: `prompt`

`prompt` controls whether the authorization server shows UI to the user.

| Value | Behavior |
|---|---|
| `none` | No UI shown; return an error if interaction is needed |
| `login` | Force the user to re-authenticate |
| `consent` | Force the consent screen even if already granted |
| `select_account` | Ask the user to pick an account |

::: notes
`prompt` is not part of core OAuth 2.0 — it originates from OpenID Connect but is widely supported by authorization servers regardless. `none` is commonly used for silent token renewal: if the server can satisfy the request without interaction it will, otherwise it returns `login_required` or `interaction_required`. `consent` is useful when you need a fresh consent record, for example before a sensitive operation.
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

A grant represents a principal's authorization for the client to act on their behalf. The client presents it to get a token.

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

## Authorization code exchange request anatomy

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

`/token` code exchange: validates a grant and issues tokens through a back channel.

Grants describe why a token may be issued.

::: notes
Close by reinforcing separation of concerns. Browser-facing authorization is about user interaction and consent. Token exchange is about server-side validation and issuing credentials. The next deck can go deeper into response types and client authentication.
:::
