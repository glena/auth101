---
title: OAuth 2 Response Types and Code Exchange
description: A focused look at response_type values, implicit versus code flow, client authentication, and the authorization code exchange.
status: draft
order: 2
resources:
  - label: RFC 6749
    url: https://www.rfc-editor.org/info/rfc6749
  - label: RFC 7636
    url: https://www.rfc-editor.org/info/rfc7636
  - label: RFC 7523
    url: https://www.rfc-editor.org/info/rfc7523
  - label: RFC 9700
    url: https://www.rfc-editor.org/info/rfc9700
---

# OAuth 2 Response Types and Code Exchange

Response types decide what returns from `/authorize`.

- `code` starts the authorization code flow
- `token` is the legacy implicit flow
- Client authentication depends on client type
- The code exchange is the main security checkpoint

[RFC 6749](https://www.rfc-editor.org/info/rfc6749) · [RFC 7636](https://www.rfc-editor.org/info/rfc7636) · [RFC 7523](https://www.rfc-editor.org/info/rfc7523) · [RFC 9700](https://www.rfc-editor.org/info/rfc9700)

::: notes
This deck narrows in on the choice made by `response_type`, then follows the authorization code back to the token endpoint. Treat implicit as historical and still important for recognizing legacy systems, not as a recommended choice for new applications.
:::

---

## `response_type` is a contract

It tells the authorization server what kind of result the client expects.

```http
GET /authorize?
  response_type=code&
  client_id=web-client&
  redirect_uri=https%3A%2F%2Fclient.example%2Fcb
```

::: notes
The authorization server must reject unsupported or invalid response types. In core OAuth 2.0, the key values are `code` and `token`. Extensions, including OpenID Connect, add combined values, but this deck stays on OAuth first.
:::

---

## `response_type=code`

The browser receives an authorization code.

```http
HTTP/1.1 302 Found
Location: https://client.example/cb?
  code=SplxlOBeZQQYbYS6WxSbIA&
  state=af0ifjsldkj
```

::: notes
The code is not a token. It is a short-lived grant bound to the client, redirect URI, and, in modern deployments, a PKCE challenge. The client still has to call `/token`.
:::

---

## Code flow separates channels

<div class="cols">

<div class="callout">

### Front channel

Browser redirect carries the code.

</div>

<div class="callout">

### Back channel

Client trades the code for tokens.

</div>

</div>

::: notes
The split limits what the browser sees. Tokens can be issued through the token endpoint instead of being placed directly in the redirect URL. This is one reason code flow is the modern default.
:::

---

## `response_type=token`

Implicit flow returns an access token from `/authorize`.

```http
HTTP/1.1 302 Found
Location: https://client.example/cb#
  access_token=2YotnFZFEjr1zCsicMWpAA&
  token_type=Bearer&
  expires_in=3600&
  state=af0ifjsldkj
```

::: notes
The fragment keeps the token out of the HTTP request to the client server, but it is still exposed to browser history, scripts running in the page, and other front-channel risks. RFC 9700 deprecates implicit-style token delivery for new designs.
:::

---

## Code versus implicit

<div class="cols">

<div>

### Code flow

- Code in redirect
- Tokens from `/token`
- Can authenticate client
- Works with PKCE

</div>

<div>

### Implicit flow

- Token in redirect
- No code exchange
- No client authentication
- Legacy browser pattern

</div>

</div>

::: notes
Do not overstate client authentication: public clients still cannot keep a secret in code flow, but the token endpoint can validate PKCE and other bindings. Confidential clients can authenticate during the exchange.
:::

---

## Why implicit faded

The token appears where browsers are weakest.

- URL handling
- JavaScript exposure
- Browser history
- Redirect and referrer mistakes

::: notes
Modern browsers and SPAs can use authorization code with PKCE. The original reason for implicit was that browser apps could not securely call the token endpoint; current guidance no longer treats that as sufficient justification.
:::

---

## Client types shape authentication

<div class="cols">

<div class="callout">

### Public

Cannot keep credentials confidential.

</div>

<div class="callout">

### Confidential

Can protect credentials or private keys.

</div>

</div>

::: notes
Native apps, SPAs, and browser-delivered code are public clients because secrets can be extracted. Server-side web apps and backend services can be confidential clients when they can protect credentials.
:::

---

## No authentication

Public clients use no client secret.

```http
POST /token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
client_id=spa-client&
code=SplxlOBeZQQYbYS6WxSbIA&
redirect_uri=https%3A%2F%2Fclient.example%2Fcb
```

::: notes
No authentication does not mean no validation. The authorization server still validates `client_id`, redirect URI, the authorization code binding, PKCE verifier, expiration, and single use.
:::

---

## `client_secret_basic`

The client authenticates with HTTP Basic.

```http
POST /token HTTP/1.1
Authorization: Basic d2ViLWNsaWVudDpzZWNyZXQ
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=SplxlOBeZQQYbYS6WxSbIA
```

::: notes
In RFC 6749, HTTP Basic is the default style for clients issued a password. The credentials are the client identifier and client secret, encoded for the Authorization header.
:::

---

## `client_secret_post`

The client sends credentials in the body.

```http
POST /token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=SplxlOBeZQQYbYS6WxSbIA&
client_id=web-client&
client_secret=s3cr3t
```

::: notes
This is allowed by OAuth 2.0 but generally less preferred than Basic because credentials travel in request bodies that are more often logged. If used, the token endpoint must require TLS and avoid logging sensitive form fields.
:::

---

## JWT client authentication

The client signs an assertion for the token endpoint.

```text
client_assertion_type =
  urn:ietf:params:oauth:client-assertion-type:jwt-bearer

client_assertion =
  signed JWT with iss, sub, aud, exp, jti
```

::: notes
RFC 7523 defines JWT bearer assertions for OAuth client authentication. `private_key_jwt` uses an asymmetric signature, while `client_secret_jwt` uses a shared secret. Private-key methods reduce shared-secret exposure and are preferred in higher assurance systems.
:::

---

## Authentication is registered

The server should know the client's method.

- Public client: `none`
- Shared secret: `client_secret_basic` or `client_secret_post`
- Signed assertion: `private_key_jwt` or `client_secret_jwt`

::: notes
The token endpoint should not guess authentication methods dynamically. Registration metadata tells the server which method is expected. Reject requests that mix methods or present credentials where none should be used.
:::

---

## Code exchange overview

```text
1. Client receives code at redirect_uri
2. Client calls /token
3. Server validates code and client
4. Server issues tokens
```

::: notes
This exchange is where the authorization server gets a direct request from the client. It can enforce client authentication, redirect URI matching, PKCE, code lifetime, and replay detection.
:::

---

## Token request anatomy

```http
POST /token HTTP/1.1
Content-Type: application/x-www-form-urlencoded
Authorization: Basic ...

grant_type=authorization_code&
code=SplxlOBeZQQYbYS6WxSbIA&
redirect_uri=https%3A%2F%2Fclient.example%2Fcb&
code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

::: notes
`grant_type` selects the authorization code validation path. `code` is the grant. `redirect_uri` is required when it was included in the authorization request and is commonly enforced as a binding. `code_verifier` proves possession of the PKCE verifier.
:::

---

## Server validation checklist

- Client exists and may use this grant
- Client authentication matches registration
- Code belongs to the client
- Redirect URI matches the original request
- PKCE verifier matches the stored challenge

::: notes
Also validate expiration, single use, issuer context, and any authorization server policy. On failure, return an OAuth error; do not partially issue tokens.
:::

---

## Token response

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store
Pragma: no-cache

{
  "access_token": "SlAV32hkKG",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "8xLOxBtZp8"
}
```

::: notes
Refresh token issuance is policy-driven. Public clients can receive refresh tokens in modern deployments, but the server should rotate or sender-constrain them where appropriate and apply risk-based limits.
:::

---

## Error response

Token endpoint failures are explicit.

```json
{
  "error": "invalid_grant",
  "error_description": "authorization code is invalid"
}
```

::: notes
Avoid leaking too much detail. `invalid_grant` covers invalid, expired, revoked, mismatched, or already-used authorization codes. Log precise reasons server-side for detection and debugging.
:::

---

## The mental model

`response_type` chooses the front-channel result.

Client authentication proves who is exchanging the grant.

The code exchange turns authorization into tokens.

::: notes
This bridges into the next deck: we will stop treating `/authorize` and `/token` as boxes and walk through how each endpoint should parse, validate, and reject requests.
:::
