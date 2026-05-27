---
title: OAuth 2 Internals and Security
description: Step-by-step authorization and token endpoint processing, code flow validation, error handling, cookie and state binding, and PKCE security.
status: draft
order: 4
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

This deck opens the authorization server black box: what gets checked, when it gets checked, and why ordering matters.

- `/authorize`: parse and validate before user interaction
- `/token`: authenticate, validate grants, and issue credentials
- Code flow checkpoints: bind code, client, redirect URI, and PKCE
- Error routing: redirect only after the target is trusted
- Browser binding: cookies, state, session, and PKCE connect the flow

[RFC 6749](https://www.rfc-editor.org/info/rfc6749) · [RFC 7636](https://www.rfc-editor.org/info/rfc7636) · [RFC 9700](https://www.rfc-editor.org/info/rfc9700) · [OAuth 2.1 draft-15](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/15/)

::: notes
This deck is implementation-oriented but still specification-driven. OAuth 2.1 is a working-group draft, so cite it as draft-15 and use RFC 6749 plus RFC 9700 as the stable basis.

`/authorize`: parse and validate before user interaction. This covers the browser-facing request: the server has to parse parameters deterministically before it knows whether the request is safe to continue or whether it must stop locally.

`/token`: authenticate, validate grants, and issue credentials. This covers the back-channel exchange: this is where client authentication, grant validation, and token issuance happen.

Code flow checkpoints bind code, client, redirect URI, and PKCE. These checks keep an authorization code from being replayed, swapped, or redeemed by the wrong client.

Error routing means redirect only after the target is trusted. Redirect URI validation decides whether an error can safely be returned through the client's redirect URI or must be shown locally.

Browser binding means cookies, state, session, and PKCE connect the flow. These mechanisms explain how browser state is tied to the server-side grant and the token request.
:::

---

## `/authorize` starts with parsing

Read the request as protocol input, not as trusted app data. Every parameter feeds a later trust decision.

```http
GET /authorize?
  response_type=code&
  client_id=calendar-web&
  redirect_uri=https%3A%2F%2Fclient.example%2Fcb&
  scope=calendar.read&
  state=7b3c...
```

::: notes
The authorization endpoint usually accepts query parameters, but the important point is that parsing is part of validation. Do not let framework defaults silently repair or reinterpret protocol input; a browser-facing endpoint still needs strict protocol parsing.

For `response_type`, reject unsupported values early because it selects the rest of the endpoint behavior.

For `client_id`, require a single unambiguous value because every later policy decision is anchored to the registered client.

For `redirect_uri`, parse the value as a URI parameter but do not normalize it into a different target before comparison with registration data.

For `scope`, preserve the requested tokens exactly enough to make deterministic authorization and consent decisions.

For `state`, treat the value as opaque client data. The authorization server returns it but does not assign meaning to it; the client owns the correlation check.

Implementations should reject malformed encodings, duplicated parameters when ambiguity matters, unsupported methods if only GET is supported, and unexpected content types for POST variants.
:::

---

## Authorize step 1: client lookup

- Require one `client_id` to anchor policy
- Load registered metadata before request-specific checks
- Check the client is active and not disabled
- Check this client may use the requested grant and response type

::: notes
Do not continue with user interaction until the client is known and authorized to use the requested flow. Client status, allowed redirect URIs, allowed scopes, and allowed authentication methods all come from registration or server policy.

Require one `client_id` to anchor policy because the authorization request cannot be evaluated without knowing which client is asking. Reject missing, duplicated, or malformed values instead of guessing.

Load registered metadata before request-specific checks. This metadata controls redirect URIs, allowed response types, allowed grant types, whether PKCE is required, and any tenant or environment restrictions.

Check that the client is active and not disabled so deleted, suspended, rotated, or administratively disabled clients cannot continue to initiate flows.

Check that this client may use the requested grant and response type. A client registered only for code flow should not be able to opt into implicit or another extension by changing a request parameter.
:::

---

## Authorize step 2: redirect URI

Validate before redirecting.

- Exact match against one registered URI
- Reject registered callbacks with open redirect behavior
- Avoid wildcard host or path matching in production
- Preserve the validated value for later code binding

::: notes
Loose redirect matching is one of the highest-impact OAuth mistakes. The redirect URI is not just a return address; it is part of the security boundary for where codes, tokens, and error details are allowed to go.

Exact match against one registered URI means compare against the client's registered redirect URI after normal request parsing, not after helpful normalization that changes meaning. Do not accept prefix matches, suffix matches, mixed-case host surprises, decoded path traversal, query-parameter rewrites, or "same domain" assumptions. If multiple redirect URIs are registered and the request includes `redirect_uri`, the request value has to match one registered value exactly.

Reject registered callbacks with open redirect behavior. A registered redirect endpoint should not immediately forward to attacker-controlled URLs through parameters such as `next`, `return_to`, or `url`. Even if the authorization server matched the registered endpoint correctly, an open redirect inside the client can still carry the authorization response somewhere else.

Avoid wildcard host or path matching in production. Registrations like `https://*.example.com/callback` or broad path patterns turn redirect validation into a DNS, hosting, and path-ownership problem. If a platform needs many callbacks, prefer explicit registered URIs or a tightly governed dynamic registration process.

Preserve the validated value for later code binding. When issuing an authorization code, store the redirect URI value that was validated for this request and require the token request to present the same value when RFC 6749 requires it. This prevents a code issued for one callback from being redeemed through a different callback.

If the redirect URI is invalid, the authorization server must not redirect the browser to it with an error because that can leak data to an attacker-controlled endpoint. Show a local error page instead.
:::

---

## Error routing decision

First decide if the client redirect target is trusted.

```text
valid client + valid redirect_uri -> redirect OAuth error
unknown client or bad redirect_uri -> render local error page
```

::: notes
RFC 6749 makes redirect URI validation the branch point. Once the authorization server can identify the client and validate the redirect URI, it can inform the client through the redirect. Before that point, the server must treat the requested redirect target as untrusted.

`valid client + valid redirect_uri -> redirect OAuth error` means the server can use the OAuth error response format and send the browser back to the registered client endpoint. This is appropriate for request problems that occur after the return target is trusted.

`unknown client or bad redirect_uri -> render local error page` means the server cannot trust the requested return target. In that branch, redirecting would turn the authorization server into a data leak or open redirect helper.

The decision should happen before login, consent, or any UI that might reveal account information. A malformed or hostile request should not get to observe user-specific behavior.
:::

---

## Return through `redirect_uri`

After redirect URI validation, return OAuth errors to the client.

- `error`: stable machine-readable failure code
- `state`: exact echo when the request supplied it
- `error_description`: optional safe developer hint
- `error_uri`: optional stable public documentation link

::: notes
Use this path for user denial (`access_denied`) and validated-client request failures such as `invalid_request`, `unauthorized_client`, `unsupported_response_type`, and `invalid_scope`. For code flow, parameters go in the query component. For legacy implicit flow, parameters go in the fragment component.

`error` is the stable machine-readable OAuth failure code. Keep it to the registered vocabulary or extension-defined values so clients can handle it predictably.

`state` is an exact echo when the request supplied it. The authorization server should not parse, rewrite, or regenerate it because the client uses it to correlate the response with a pending browser session.

`error_description` is an optional safe developer hint and should be safe for a browser URL. Avoid secrets, internal exception text, stack traces, database identifiers, and anything that changes the security decision.

`error_uri` is an optional stable public documentation link. It should point to stable documentation, not request-specific diagnostics. Treat it as public help text for developers.
:::

---

## Render a local error page

Do not redirect when the redirect target is not trusted.

- Missing or invalid `client_id`: no trusted client record
- Missing required `redirect_uri`: no safe return target
- Mismatched `redirect_uri`: requested target is untrusted
- Malformed request: cannot make deterministic trust decisions

::: notes
The page should be for the resource owner, not for client automation. Keep it generic, avoid echoing attacker-supplied URLs as links, and put detailed diagnostics in server logs. This prevents the authorization endpoint from becoming an error-amplifying open redirector.

Missing or invalid `client_id` means there is no trusted client record. The server cannot know allowed redirect URIs, allowed response types, or whether the request is from a legitimate integration.

Missing `redirect_uri` when required is a trust failure for clients with multiple registered redirect URIs or policies that require an explicit value. The server should not guess where to send the browser.

An unregistered or mismatched `redirect_uri` means the requested target is untrusted. Even if the rest of the request looks plausible, returning data to that URI would violate the registered client boundary.

Malformed requests before trust is established should stop locally. This includes invalid encoding, ambiguous duplicate parameters, unsupported request shape, or anything else that prevents deterministic validation.
:::

---

## Authorize step 3: response type

`response_type` selects the processing branch.

```text
code   -> issue short-lived code for /token exchange
token  -> legacy implicit token response through browser
```

::: notes
Modern security guidance recommends authorization code with PKCE instead of implicit. Reject unsupported combinations and values that are not enabled for the client.

`code` means the authorization endpoint returns a short-lived authorization code for `/token` exchange. The client must exchange that code at the token endpoint, where the server can authenticate the client, verify PKCE, and enforce code binding.

`token` means the legacy implicit flow returns an access token through the browser redirect. New designs should avoid it because browser delivery exposes tokens to more places and skips the back-channel validation step.

Treat `response_type` as a branch selector, not as a loose string. Extension values are possible, but only when the authorization server implements them and the client is allowed to use them.
:::

---

## Authorize step 4: scope and resource

Validate requested authority.

- Parse requested scopes into known permission tokens
- Apply client policy before asking the user
- Apply user and organization policy at consent time
- Narrow grants to the approved subset when needed

::: notes
OAuth allows the authorization server to grant less than requested. If resource indicators or rich authorization requests are supported, validate those as separate structured inputs instead of overloading `scope`.

Parse requested scopes into known permission tokens according to the server's scope syntax and reject malformed or unknown values by policy. Do not treat scope strings as free-form text after this point.

Apply client policy before asking the user. Some clients may be limited to certain APIs, tenants, environments, or low-risk scopes regardless of what the user approves.

Apply user and organization policy at consent time. The resource owner may lack authority for a requested resource, or organization policy may require step-up, admin approval, or denial.

Narrow grants to the approved subset when needed. The response can represent the approved subset, but the server must be clear about what was actually granted so the client does not assume broader access.
:::

---

## Authorize step 5: state

Return `state` exactly when it was supplied so the client can match the callback to a pending request.

```http
Location: https://client.example/cb?
  code=abc&        # grant handle
  state=7b3c...    # client correlation value
```

::: notes
The authorization server treats `state` as opaque. The client uses it to bind the authorization response to the browser session and to detect unsolicited or swapped responses.

Return `state` exactly when supplied so the client can match the callback to a pending request. Exact means the same bytes after normal parameter decoding and response encoding, not a normalized JSON object or a server-generated replacement.

The example `code` is the server-created grant handle. It should be separate from `state`; the client should not infer authorization success from state alone.

The example `state` is the client's correlation value. A missing or mismatched state at the client callback should stop the client before it exchanges the code.
:::

---

## Authorize step 6: PKCE inputs

For code flow, store the challenge and method with the authorization code.

```text
code_challenge = BASE64URL(SHA256(code_verifier))  # front-channel proof
code_challenge_method = S256                       # verification rule
```

::: notes
PKCE is defined by RFC 7636. Modern guidance requires PKCE for public clients and strongly recommends it more broadly. Prefer `S256`; do not accept `plain` unless legacy compatibility explicitly requires it.

`code_challenge` is the transformed front-channel proof sent through the browser-facing authorization request. Store it with the authorization code so it can be checked later at the token endpoint.

`BASE64URL(SHA256(code_verifier))` is the `S256` transformation. Use unpadded base64url encoding and compare against the stored challenge according to the method recorded with the request.

`code_challenge_method` is the verification rule that tells the server how to verify the later `code_verifier`. Reject missing or unsupported methods according to client and server policy instead of guessing.
:::

---

## Authorize step 7: user session

Authenticate the user when policy requires it.

- Existing session must satisfy freshness and assurance policy
- Login method is local authorization-server behavior
- Consent depends on client, scope, resource, and policy
- Denial returns `access_denied` only when redirect is trusted

::: notes
OAuth does not define how the user logs in. The authorization server owns local authentication, step-up, account selection, and consent policy.

An existing session must satisfy freshness and assurance policy. Sensitive scopes may require recent authentication even when the user has a valid session cookie.

The login method is local authorization-server behavior and outside core OAuth. Passwords, passkeys, federation, MFA, and device posture are authorization-server concerns, not OAuth protocol parameters.

Consent depends on client, scope, resource, and policy. It may be required depending on client trust, requested scope, prior grants, and organization policy. Consent is a policy decision, not a substitute for protocol validation.

Denial returns `access_denied` only when redirect is trusted. If the redirect URI is not trusted, show the denial or failure locally without redirecting to an untrusted target.
:::

---

## Authorize step 8: issue the result

Create a short-lived, one-use code.

Bind it to:

- Client ID that initiated the flow
- Redirect URI validated at `/authorize`
- User and authorization decision from this interaction
- Scope and resource actually approved
- PKCE challenge needed to redeem the code

::: notes
The code should be high entropy, expire quickly, and be invalidated after successful use. Store only what the token endpoint needs to validate the exchange.

Bind the code to the client ID that initiated the flow so another client cannot redeem it even if it learns the code value.

Bind the code to the redirect URI validated at `/authorize`. The token endpoint can then reject attempts to redeem the same code under a different callback.

Bind the code to the user and authorization decision from this interaction so token issuance reflects the actual authenticated subject, approved scopes, denied scopes, and consent result.

Bind the code to the scope and resource actually approved so the token endpoint does not recompute authorization from a looser or attacker-supplied token request.

Bind the code to the PKCE challenge needed to redeem the code so a stolen code is not enough to get tokens without the verifier kept by the legitimate client.
:::

---

## `/token` starts stricter

The token endpoint is a back-channel API: stricter transport, stricter parsing, and no browser redirects.

```http
POST /token HTTP/1.1
Content-Type: application/x-www-form-urlencoded  # OAuth form body
Authorization: Basic ...                         # registered client auth
```

::: notes
Require TLS. Accept only intended methods and content types. Token endpoint request bodies contain secrets and grants; avoid logging raw bodies.

`POST /token` matters because token requests carry credentials and grant material in the request body. Do not support accidental GET behavior that leaks values into URLs, caches, or logs.

`Content-Type: application/x-www-form-urlencoded` is the normal OAuth token request encoding and signals the OAuth form body. Reject JSON or multipart requests unless a specific extension intentionally supports them.

`Authorization: Basic ...` is one common registered client authentication method. It must be checked against the client's registered authentication method instead of accepted as merely one possible hint.
:::

---

## Token step 1: parse form body

- Require `grant_type` to choose the validator
- Reject malformed form encoding before reading fields
- Reject duplicated security parameters deterministically
- Ignore or reject extension parameters only by explicit policy

::: notes
Parameter handling must be deterministic. Ambiguous duplicate `code`, `redirect_uri`, `client_id`, or authentication fields can create request smuggling-style bugs at the application layer.

Require `grant_type` to choose the validator because it selects the required parameter set. A token endpoint request without it has no well-defined semantics.

Reject malformed form encoding before reading fields. Different parsers can otherwise disagree about the same request body.

Reject duplicated security parameters deterministically, including `code`, `redirect_uri`, `client_id`, `client_secret`, `code_verifier`, and `grant_type`. First-value and last-value behavior should not decide security.

Ignore or reject extension parameters only by explicit policy. Rejecting is simpler and safer; ignoring can be acceptable only when the extension model and logging make that behavior intentional.
:::

---

## Token step 2: authenticate client

Match the registered method.

- `none`: public client, no shared secret
- `client_secret_basic`: secret in Authorization header
- `client_secret_post`: secret in form body
- JWT assertion: signed client authentication
- mTLS or extensions: sender-constrained authentication

::: notes
The server should enforce exactly the registered authentication method. A confidential client that fails authentication gets `invalid_client`. Public clients still identify themselves with `client_id` when needed.

`none` is for a public client with no shared secret. It is not failed authentication; it is a registered client type that relies on other checks such as PKCE and redirect URI binding.

`client_secret_basic` sends the secret in the Authorization header. Prefer it over body secrets when a shared secret is used, and reject simultaneous body credentials.

`client_secret_post` sends the secret in the form body. Support it only for clients registered to use it because request bodies are more likely to be logged by application tooling.

JWT assertion methods authenticate the client with a signed assertion. Validate issuer, subject, audience, expiry, signature, and replay protection according to the registered key material.

mTLS or extension methods sender-constrain authentication to a certificate, key, or external mechanism. Enforce the extension's binding rules instead of reducing it to a client ID lookup.
:::

---

## Token step 3: select grant validator

```text
grant_type=authorization_code -> validate code, redirect URI, PKCE
grant_type=refresh_token      -> validate refresh token and rotation
grant_type=client_credentials -> validate client-only authorization
```

::: notes
Each grant has separate required parameters and validation rules. Do not validate everything through one permissive path.

`grant_type=authorization_code` validates code, redirect URI, and PKCE. It requires the authorization code, client binding, redirect URI binding when applicable, and PKCE verification when present or required.

`grant_type=refresh_token` validates the refresh token and rotation state. It checks status, client binding, scope narrowing, and revocation policy.

`grant_type=client_credentials` validates client-only authorization. It issues tokens for the client itself, not for a resource owner, and should be limited to scopes the client is allowed to hold directly.

Unknown grant types should fail cleanly. Extension grants need explicit implementation and registration policy.
:::

---

## Code validator: load the code

Find the authorization code record.

- Exists as an authorization code record
- Not expired according to short code lifetime
- Not already used in a prior token exchange
- Issued by this authorization server and environment

::: notes
Treat missing, expired, reused, and mismatched codes as `invalid_grant`. Reuse may indicate interception; revoke related tokens when policy calls for it.

Exists as an authorization code record means the submitted code resolves to a real authorization code record issued by this server. Do not reveal whether a specific code was ever valid.

Not expired according to short code lifetime means the code is still inside its allowed validity window. Authorization codes should usually live for minutes, not hours.

Not already used in a prior token exchange enforces one-time use. Marking a code consumed should be atomic with token issuance to prevent parallel redemption.

Issued by this authorization server and environment prevents cross-issuer confusion and stale environment mix-ups. Codes from another issuer, tenant, region, or environment should not validate.
:::

---

## Code validator: bind the client

The exchanger must be the original client that received the code.

```text
code.client_id == authenticated_client.id  # original client only
```

::: notes
For public clients, the authenticated identity may be the `client_id` in the body plus PKCE proof. For confidential clients, it is the authenticated client credentials or assertion.

`code.client_id` is the original client that started the authorization request and received the authorization code.

`authenticated_client.id` is the client identity established at the token endpoint. For confidential clients, it comes from successful authentication; for public clients, it comes from the submitted `client_id` and must still match the stored code.

The comparison prevents code substitution between clients. A malicious client should not be able to trick a legitimate client or user into producing a code and then redeem it as itself.
:::

---

## Code validator: bind redirect URI

Compare against the redirect URI validated during the authorize request.

```text
token.redirect_uri == code.redirect_uri  # same callback as /authorize
```

::: notes
This prevents a code issued for one redirect URI from being redeemed under another. RFC 6749 requires `redirect_uri` at the token endpoint when it was present in the authorization request.

`token.redirect_uri` is the value supplied in the token request and should be the same callback as `/authorize`. It should be parsed deterministically and compared to the stored value, not reselected from the client's registration list.

`code.redirect_uri` is the original redirect URI value validated at the authorization endpoint and stored with the code.

If the authorization request omitted `redirect_uri` because the client had exactly one registered value and policy allowed omission, store the effective redirect URI decision so later validation remains explicit.
:::

---

## Code validator: verify PKCE

```text
BASE64URL(SHA256(code_verifier)) == code_challenge  # proves verifier holder
```

::: notes
Use constant-time comparison where practical. Reject missing verifier when the code has a stored challenge. Reject wrong method, malformed verifier, or verifier outside the allowed character and length rules.

`code_verifier` is the secret value held by the client until the token request and proves the requester is the verifier holder. It should have enough entropy and satisfy the RFC 7636 length and character rules.

`BASE64URL(SHA256(code_verifier))` is recomputed by the token endpoint when the stored method is `S256`.

`code_challenge` is the stored value from the authorization request. The token endpoint compares the recomputed challenge to this stored value and rejects mismatches as `invalid_grant`.
:::

---

## Code validator: issue tokens

Only after all checks pass:

- Mark code as consumed in the same transaction
- Issue access token from the stored authorization decision
- Optionally issue refresh token under rotation policy
- Return `no-store` headers to prevent token caching

::: notes
Mark the code as consumed transactionally with token issuance. Race conditions can otherwise allow one code to mint multiple token sets.

Mark code as consumed in the same transaction, before or atomically with successful token persistence. If token issuance fails, the system needs a clear retry policy that does not reopen replay windows.

Issue an access token from the stored authorization decision only after every grant, client, redirect, and PKCE check succeeds. The token should reflect the stored authorization decision, not new request parameters.

Optionally issue a refresh token under rotation policy when the client type, grant, scope, and policy allow long-lived access. Apply rotation or sender-constraining where appropriate.

Return `no-store` headers to prevent token caching by intermediaries and browser tooling.
:::

---

## Cookie handling

OAuth browser steps rely on local session cookies.

- `HttpOnly`: keep session handles away from scripts
- `Secure`: send cookies only over HTTPS
- `SameSite=Lax` or stronger: fit the redirect journey
- Narrow path and domain: reduce cross-app exposure

::: notes
The authorization server uses cookies for its own login session. The client may use cookies to remember pending OAuth requests. Cookie attributes are not OAuth parameters, but they are essential to keeping state binding and login sessions intact.

`HttpOnly` keeps session handles away from scripts and reduces exposure to script access. It is useful for session cookies and opaque pending-request handles that JavaScript does not need to read.

`Secure` sends cookies only over HTTPS. OAuth deployments should treat non-TLS browser hops as out of bounds for production.

`SameSite=Lax` or stronger should fit the redirect journey. This helps limit cross-site cookie sending while still allowing common top-level redirect flows. Test stricter settings against the actual login and callback journey.

Narrow path and domain settings reduce cross-app exposure by limiting where cookies are sent. Avoid broad parent-domain cookies when separate apps or tenants share the same registrable domain.
:::

---

## State and session binding

Store pending request data server-side.

```text
browser cookie -> opaque pending request id
pending request -> state, redirect target, code_verifier, expiry
```

::: notes
Prefer storing sensitive request context server-side and putting only an opaque handle in the browser cookie. If data is stored client-side, protect integrity and confidentiality as appropriate.

`browser cookie -> opaque pending request id` means the browser stores only a random handle. Losing that handle should not reveal scopes, redirect targets, verifier values, or user decisions.

`pending request -> state, redirect target, code_verifier, expiry` means the server-side record carries the sensitive correlation data. The client checks this record when the callback arrives and expires it when the flow is too old.

Store enough context to reject swapped callbacks: issuer, client configuration, redirect target, state, PKCE verifier or challenge as appropriate, and expiration.
:::

---

## What `state` prevents

`state` connects the response to the request.

- CSRF against the callback: unsolicited response
- Login initiation confusion: wrong request or issuer
- Response injection: attacker-supplied code or error
- Accidental tab mix-ups: concurrent browser flows

::: notes
Generate high-entropy state per authorization request. Check it before exchanging the code. State does not prove the code belongs to the client; PKCE, redirect URI, and client binding handle that.

CSRF against the callback means an unsolicited response. It is the classic state threat: an attacker tries to cause the client to process a response the user did not initiate in that browser session.

Login initiation confusion means the wrong request or issuer is being completed. It happens when a response from one login attempt is attached to another user action, account, issuer, or tenant.

Response injection means an attacker-supplied code or error reaches the callback. State helps the client reject unsolicited responses before token exchange.

Accidental tab mix-ups are concurrent browser flows. They are common in real browsers, and per-request state lets the client distinguish two simultaneous authorization attempts from the same user.
:::

---

## What PKCE prevents

PKCE protects the code in transit.

```text
attacker gets code        -> front-channel value leaked
attacker lacks verifier   -> back-channel proof missing
token request fails       -> challenge comparison rejects it
```

::: notes
PKCE was created for public clients, especially native apps, where authorization codes could be intercepted. RFC 9700 and OAuth 2.1 make it part of the modern baseline.

`attacker gets code -> front-channel value leaked` models interception through a custom URI scheme, malicious app link handler, browser history exposure, logs, or another place the front-channel response can be observed.

`attacker lacks verifier -> back-channel proof missing` is the core protection. The verifier was created by the legitimate client and was not sent through the authorization redirect.

`token request fails -> challenge comparison rejects it` because the authorization server recomputes the challenge from the submitted verifier and compares it to the value stored with the code.
:::

---

## PKCE flow

```text
1. Client creates high-entropy code_verifier
2. Client sends derived code_challenge at /authorize
3. Server stores challenge and method with code
4. Client sends verifier at /token
5. Server compares derived verifier value to challenge
```

::: notes
The verifier is never sent through the authorization redirect. That is the security property: the value needed to redeem the code stays with the client until the back-channel token request.

Step 1 creates a high-entropy `code_verifier` before the browser leaves the client.

Step 2 sends only the derived `code_challenge` and method to `/authorize`, so the front channel does not expose the verifier.

Step 3 stores the challenge and method with the authorization code record, binding this code to that future proof.

Step 4 sends the verifier at `/token`, over the back channel together with the authorization code and client identity.

Step 5 compares the derived verifier value to the stored challenge. A mismatch means the requester may have the code but not the original proof.
:::

---

## Security failure posture

Fail closed and route errors by endpoint.

- `invalid_request`: malformed or ambiguous input
- `unauthorized_client`: client not allowed for this flow
- `access_denied`: user or policy declined
- `unsupported_response_type`: response branch unavailable
- `invalid_scope`: requested authority unacceptable
- `invalid_grant`: grant failed token validation
- `invalid_client`: client authentication failed

::: notes
Use redirect-based errors only when the redirect URI has been validated. Render authorization endpoint errors locally when the client or redirect target is not trustworthy. Use token endpoint JSON errors for token failures. Keep detailed diagnostics in server logs, not browser-visible error descriptions.

`invalid_request` covers malformed or ambiguous input: malformed, missing, duplicated, or otherwise invalid parameters.

`unauthorized_client` means the client is not allowed for this flow: the client is known but not allowed to use the requested flow, response type, or grant.

`access_denied` means the user or policy declined. It is the normal result when the resource owner or authorization policy declines the request.

`unsupported_response_type` means the response branch is unavailable: the authorization server or this client does not support the requested `response_type`.

`invalid_scope` means the requested authority is unacceptable: the requested scope is unknown, malformed, disallowed, or otherwise unacceptable.

`invalid_grant` means the grant failed token validation. It is used at the token endpoint for bad authorization codes, refresh tokens, expired grants, reused grants, redirect URI mismatches, and similar grant-validation failures.

`invalid_client` means client authentication failed or is missing for a client that must authenticate.
:::

---

## The mental model

Authorization endpoint validates the request and creates a bound grant record.

Token endpoint validates that grant record and issues credentials.

Cookies, state, and PKCE bind the browser journey to the back-channel exchange.

::: notes
This sets up the attack-vector deck: most OAuth incidents are failures of binding, redirect validation, token handling, or legacy flow choices.

The authorization endpoint validates the request and creates a bound grant record. It should leave behind a compact record that says who asked, which user approved, which redirect target was used, which scope and resource were approved, and which PKCE challenge applies.

The token endpoint validates that grant record and issues credentials. It should not trust fresh browser-facing inputs to recreate the authorization decision.

Cookies, state, and PKCE bind the browser journey to the back-channel exchange. Cookies keep local session and pending-request context, state correlates the callback, and PKCE proves the token requester is the client that started the flow.
:::
