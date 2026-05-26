---
title: OAuth 2 Internals and Security
description: Step-by-step authorization and token endpoint processing, code flow validation, error handling, cookie and state binding, and PKCE security.
status: draft
order: 3
resources:
  - label: RFC 6749
    url: https://www.rfc-editor.org/info/rfc6749
  - label: RFC 7636
    url: https://www.rfc-editor.org/info/rfc7636
  - label: RFC 9700
    url: https://www.rfc-editor.org/info/rfc9700
  - label: OAuth 2.1 Draft
    url: https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/15/
---

# OAuth 2 Internals and Security

This deck opens the authorization server black box.

- `/authorize` parsing and validation
- `/token` parsing and validation
- Code flow security checkpoints
- Error routing and redirect URI validation
- Cookie, state, session, and PKCE binding

[RFC 6749](https://www.rfc-editor.org/info/rfc6749) · [RFC 7636](https://www.rfc-editor.org/info/rfc7636) · [RFC 9700](https://www.rfc-editor.org/info/rfc9700) · [OAuth 2.1 draft-15](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/15/)

::: notes
This deck is implementation-oriented but still specification-driven. OAuth 2.1 is a working-group draft, so cite it as draft-15 and use RFC 6749 plus RFC 9700 as the stable basis.
:::

---

## `/authorize` starts with parsing

Read the request as protocol input, not as trusted app data.

```http
GET /authorize?
  response_type=code&
  client_id=calendar-web&
  redirect_uri=https%3A%2F%2Fclient.example%2Fcb&
  scope=calendar.read&
  state=7b3c...
```

::: notes
The authorization endpoint usually accepts query parameters. Implementations should reject malformed encodings, duplicated parameters when ambiguity matters, unsupported methods if only GET is supported, and unexpected content types for POST variants.
:::

---

## Authorize step 1: client lookup

- Require `client_id`
- Load registered metadata
- Check client is active
- Check grant and response type are allowed

::: notes
Do not continue with user interaction until the client is known and authorized to use the requested flow. Client status, allowed redirect URIs, allowed scopes, and allowed authentication methods all come from registration or server policy.
:::

---

## Authorize step 2: redirect URI

Validate before redirecting.

- Exact match registered URI
- No open redirect patterns
- No wildcard surprises
- Preserve original value for code binding

::: notes
Loose redirect matching is one of the highest-impact OAuth mistakes. If the redirect URI is invalid, the authorization server must not redirect the browser to it with an error because that can leak data to an attacker-controlled endpoint.
:::

---

## Error routing decision

First decide if the client redirect target is trusted.

```text
valid client + valid redirect_uri -> redirect error
unknown client or bad redirect_uri -> local error page
```

::: notes
RFC 6749 makes redirect URI validation the branch point. Once the authorization server can identify the client and validate the redirect URI, it can inform the client through the redirect. Before that point, the server must treat the requested redirect target as untrusted.
:::

---

## Return through `redirect_uri`

After redirect URI validation, return OAuth errors to the client.

- `error`
- `state`, when supplied
- Optional safe `error_description`
- Optional stable `error_uri`

::: notes
Use this path for user denial (`access_denied`) and validated-client request failures such as `invalid_request`, `unauthorized_client`, `unsupported_response_type`, and `invalid_scope`. For code flow, parameters go in the query component. For legacy implicit flow, parameters go in the fragment component. Return the exact state value if the request included one.
:::

---

## Render a local error page

Do not redirect when the redirect target is not trusted.

- Missing or invalid `client_id`
- Missing `redirect_uri` when required
- Unregistered or mismatched `redirect_uri`
- Malformed request before trust is established

::: notes
The page should be for the resource owner, not for client automation. Keep it generic, avoid echoing attacker-supplied URLs as links, and put detailed diagnostics in server logs. This prevents the authorization endpoint from becoming an error-amplifying open redirector.
:::

---

## Authorize step 3: response type

`response_type` selects the processing branch.

```text
code   -> issue authorization code
token  -> legacy implicit token response
```

::: notes
Modern security guidance recommends authorization code with PKCE instead of implicit. Reject unsupported combinations and values that are not enabled for the client.
:::

---

## Authorize step 4: scope and resource

Validate requested authority.

- Parse requested scopes
- Apply client policy
- Apply user policy
- Narrow grants when needed

::: notes
OAuth allows the authorization server to grant less than requested. If resource indicators or rich authorization requests are supported, validate those as separate structured inputs instead of overloading `scope`.
:::

---

## Authorize step 5: state

Return `state` exactly when it was supplied.

```http
Location: https://client.example/cb?
  code=abc&
  state=7b3c...
```

::: notes
The authorization server treats `state` as opaque. The client uses it to bind the authorization response to the browser session and to detect unsolicited or swapped responses.
:::

---

## Authorize step 6: PKCE inputs

For code flow, store the challenge with the code.

```text
code_challenge = BASE64URL(SHA256(code_verifier))
code_challenge_method = S256
```

::: notes
PKCE is defined by RFC 7636. Modern guidance requires PKCE for public clients and strongly recommends it more broadly. Prefer `S256`; do not accept `plain` unless legacy compatibility explicitly requires it.
:::

---

## Authorize step 7: user session

Authenticate the user when policy requires it.

- Existing session is acceptable only if fresh enough
- Login method is outside core OAuth
- Consent may be required
- Denial is a valid outcome

::: notes
OAuth does not define how the user logs in. The authorization server owns local authentication, step-up, account selection, and consent policy.
:::

---

## Authorize step 8: issue the result

Create a short-lived, one-use code.

Bind it to:

- Client ID
- Redirect URI
- User and authorization decision
- Scope and resource
- PKCE challenge

::: notes
The code should be high entropy, expire quickly, and be invalidated after successful use. Store only what the token endpoint needs to validate the exchange.
:::

---

## `/token` starts stricter

The token endpoint is a back-channel API.

```http
POST /token HTTP/1.1
Content-Type: application/x-www-form-urlencoded
Authorization: Basic ...
```

::: notes
Require TLS. Accept only intended methods and content types. Token endpoint request bodies contain secrets and grants; avoid logging raw bodies.
:::

---

## Token step 1: parse form body

- Require `grant_type`
- Reject malformed form encoding
- Reject duplicated security parameters
- Ignore or reject unsupported extension parameters by policy

::: notes
Parameter handling must be deterministic. Ambiguous duplicate `code`, `redirect_uri`, `client_id`, or authentication fields can create request smuggling-style bugs at the application layer.
:::

---

## Token step 2: authenticate client

Match the registered method.

- `none`
- `client_secret_basic`
- `client_secret_post`
- JWT assertion
- mTLS or other extension methods

::: notes
The server should enforce exactly the registered authentication method. A confidential client that fails authentication gets `invalid_client`. Public clients still identify themselves with `client_id` when needed.
:::

---

## Token step 3: select grant validator

```text
grant_type=authorization_code -> code validator
grant_type=refresh_token      -> refresh validator
grant_type=client_credentials -> client validator
```

::: notes
Each grant has separate required parameters and validation rules. Do not validate everything through one permissive path.
:::

---

## Code validator: load the code

Find the authorization code record.

- Exists
- Not expired
- Not already used
- Issued by this authorization server

::: notes
Treat missing, expired, reused, and mismatched codes as `invalid_grant`. Reuse may indicate interception; revoke related tokens when policy calls for it.
:::

---

## Code validator: bind the client

The exchanger must be the original client.

```text
code.client_id == authenticated_client.id
```

::: notes
For public clients, the authenticated identity may be the `client_id` in the body plus PKCE proof. For confidential clients, it is the authenticated client credentials or assertion.
:::

---

## Code validator: bind redirect URI

Compare against the authorize request.

```text
token.redirect_uri == code.redirect_uri
```

::: notes
This prevents a code issued for one redirect URI from being redeemed under another. RFC 6749 requires `redirect_uri` at the token endpoint when it was present in the authorization request.
:::

---

## Code validator: verify PKCE

```text
BASE64URL(SHA256(code_verifier)) == code_challenge
```

::: notes
Use constant-time comparison where practical. Reject missing verifier when the code has a stored challenge. Reject wrong method, malformed verifier, or verifier outside the allowed character and length rules.
:::

---

## Code validator: issue tokens

Only after all checks pass:

- Mark code as consumed
- Issue access token
- Optionally issue refresh token
- Return `no-store` response headers

::: notes
Mark the code as consumed transactionally with token issuance. Race conditions can otherwise allow one code to mint multiple token sets.
:::

---

## Cookie handling

OAuth browser steps rely on local session cookies.

- `HttpOnly`
- `Secure`
- `SameSite=Lax` or stronger by design
- Narrow path and domain

::: notes
The authorization server uses cookies for its own login session. The client may use cookies to remember pending OAuth requests. Cookie attributes are not OAuth parameters, but they are essential to keeping state binding and login sessions intact.
:::

---

## State and session binding

Store pending request data server-side.

```text
browser cookie -> pending request id
pending request -> state, redirect target, code_verifier
```

::: notes
Prefer storing sensitive request context server-side and putting only an opaque handle in the browser cookie. If data is stored client-side, protect integrity and confidentiality as appropriate.
:::

---

## What `state` prevents

`state` connects the response to the request.

- CSRF against the callback
- Login initiation confusion
- Response injection
- Accidental tab mix-ups

::: notes
Generate high-entropy state per authorization request. Check it before exchanging the code. State does not prove the code belongs to the client; PKCE, redirect URI, and client binding handle that.
:::

---

## What PKCE prevents

PKCE protects the code in transit.

```text
attacker gets code
attacker lacks verifier
token request fails
```

::: notes
PKCE was created for public clients, especially native apps, where authorization codes could be intercepted. RFC 9700 and OAuth 2.1 make it part of the modern baseline.
:::

---

## PKCE flow

```text
1. Client creates code_verifier
2. Client sends code_challenge at /authorize
3. Server stores challenge with code
4. Client sends verifier at /token
5. Server compares verifier to challenge
```

::: notes
The verifier is never sent through the authorization redirect. That is the security property: the value needed to redeem the code stays with the client until the back-channel token request.
:::

---

## Security failure posture

Fail closed and route errors by endpoint.

- `invalid_request`
- `unauthorized_client`
- `access_denied`
- `unsupported_response_type`
- `invalid_scope`
- `invalid_grant`
- `invalid_client`

::: notes
Use redirect-based errors only when the redirect URI has been validated. Render authorization endpoint errors locally when the client or redirect target is not trustworthy. Use token endpoint JSON errors for token failures. Keep detailed diagnostics in server logs, not browser-visible error descriptions.
:::

---

## The mental model

Authorization endpoint validates the request and creates a bound grant.

Token endpoint validates the grant and issues credentials.

Cookies, state, and PKCE bind the browser journey to the back-channel exchange.

::: notes
This sets up the attack-vector deck: most OAuth incidents are failures of binding, redirect validation, token handling, or legacy flow choices.
:::
