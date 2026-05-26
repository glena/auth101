---
title: OAuth 2 Attack Vectors and OAuth 2.1
description: Common OWASP and OAuth attack vectors, practical prevention, and a deep dive into OAuth 2.1 recommendations.
status: draft
order: 4
resources:
  - label: OWASP OAuth2 Cheat Sheet
    url: https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html
  - label: RFC 9700
    url: https://www.rfc-editor.org/info/rfc9700
  - label: RFC 6819
    url: https://www.rfc-editor.org/info/rfc6819
  - label: OAuth 2.1 Draft
    url: https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/15/
---

# OAuth 2 Attack Vectors and OAuth 2.1

This deck turns the protocol into a threat model.

- OWASP OAuth attack classes
- OAuth-specific implementation failures
- Efficient prevention controls
- OAuth 2.1 recommendations and why they exist

[OWASP OAuth2 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html) · [RFC 9700](https://www.rfc-editor.org/info/rfc9700) · [RFC 6819](https://www.rfc-editor.org/info/rfc6819) · [OAuth 2.1 draft-15](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/15/)

::: notes
RFC 9700 is the stable OAuth Security Best Current Practice. OAuth 2.1 is still a draft, current as draft-15 when this deck was created, and consolidates many of these recommendations into the framework.
:::

---

## OWASP framing

OAuth incidents usually look like familiar web failures.

- Broken access control
- Identification and authentication failures
- Cryptographic failures
- Security misconfiguration
- Server-side request and redirect abuse

::: notes
OWASP's OAuth cheat sheet maps OAuth hardening back to best current practice. The point is not that OAuth creates entirely new classes of bugs; it composes web, browser, token, and identity risks in a way that amplifies mistakes.
:::

---

## OAuth-specific failures

The common pattern is broken binding.

- Code not bound to client
- Redirect not bound to registration
- State not bound to browser session
- Token not bound to intended resource
- Refresh token not bound to rotation state

::: notes
OAuth security is mostly about preserving relationships across hops. When one relationship is left implicit, attackers look for a way to swap, replay, or redirect it.
:::

---

## Attack: redirect URI manipulation

An attacker steers the authorization response.

```text
registered: https://client.example/cb
attacker:   https://client.example/cb/../open-redirect?to=...
```

::: notes
Prevent with exact redirect URI matching, no wildcard production redirects, and no open redirectors on registered redirect endpoints. Do not redirect with errors to an unvalidated URI.
:::

---

## Attack: authorization code interception

The attacker obtains the code before the client redeems it.

```text
front-channel code leak -> token exchange attempt
```

::: notes
Prevent with PKCE, short code lifetime, one-time use, redirect URI binding, and client binding. Treat code reuse as a possible compromise signal.
:::

---

## Attack: CSRF on callback

The victim's browser receives an attacker's response.

```text
victim session + attacker code = wrong account bound
```

::: notes
Prevent by generating high-entropy `state`, storing it with the browser session, and validating before token exchange. This is especially important for login flows built on OAuth or OIDC.
:::

---

## Attack: mix-up

The client confuses one authorization server for another.

```text
AS A response handled as AS B response
```

::: notes
Mitigations include using distinct redirect URIs per issuer, binding issuer metadata to the pending request, validating issuer identifiers when supported, and avoiding dynamic issuer selection without strong correlation.
:::

---

## Attack: token substitution

A token for one context is accepted in another.

- Wrong audience
- Wrong issuer
- Wrong resource
- Wrong client

::: notes
Resource servers must validate issuer, audience, expiration, scopes, token type, and signature or introspection status. Clients must not treat access tokens as authentication assertions; OIDC ID tokens fill that role.
:::

---

## Attack: implicit token leakage

The access token is exposed through the browser.

- URL fragments
- History and debugging tools
- JavaScript compromise
- Redirect mistakes

::: notes
The modern prevention is authorization code with PKCE. Content Security Policy and careful storage help, but they do not make implicit token delivery the preferred pattern.
:::

---

## Attack: refresh token replay

Long-lived credentials become a second password.

```text
stolen refresh token -> repeated access token minting
```

::: notes
Use refresh token rotation, reuse detection, sender-constrained tokens when possible, short idle lifetimes, and revocation on suspicious reuse.
:::

---

## Attack: weak client authentication

The token endpoint accepts the wrong proof.

- Public client treated as confidential
- Secret leaked in browser code
- Multiple methods accepted accidentally
- JWT assertion audience not checked

::: notes
Enforce one registered authentication method per client, keep secrets out of public clients, validate JWT assertion issuer, subject, audience, expiration, and replay identifier.
:::

---

## Attack: scope overgranting

The issued token is broader than the user's decision.

```text
requested: read
granted:   read write admin
```

::: notes
Apply allowlists per client, require consent or policy for sensitive scopes, and log high-risk grants. Least privilege matters more than a long scope catalog.
:::

---

## Efficient incident prevention

Prioritize controls that protect many flows.

- Exact redirect validation
- Authorization code with PKCE
- Strong state/session binding
- Strict token validation
- Refresh token rotation

::: notes
These controls reduce whole classes of incidents without relying on every application team remembering every edge case.
:::

---

## OAuth 2.1 in one slide

OAuth 2.1 consolidates modern OAuth practice.

- Code flow with PKCE as baseline
- Implicit removed
- Password grant removed
- Bearer token guidance integrated
- Redirect URI rules tightened

::: notes
As of May 26, 2026, the Datatracker page shows draft-ietf-oauth-v2-1-15. Treat it as a draft, but its recommendations align with the stable Security BCP in RFC 9700.
:::

---

## 2.1: code with PKCE

Every authorization code flow should use PKCE.

```text
code_challenge at /authorize
code_verifier at /token
```

::: notes
OAuth 2.1 incorporates PKCE into the framework instead of leaving it as an optional extension for only some public clients. This addresses code interception and improves defense in depth for confidential clients too.
:::

---

## 2.1: no implicit grant

Do not issue access tokens from `/authorize`.

```text
response_type=token -> legacy only
```

::: notes
Implicit was useful for older browser constraints. With code plus PKCE available to browser-based apps, front-channel token delivery is no longer the recommended design.
:::

---

## 2.1: no password grant

The client should not collect the user's password.

```text
grant_type=password -> removed from OAuth 2.1
```

::: notes
The resource owner password credentials grant trains users to give passwords to clients, prevents modern authentication steps, and bypasses authorization server UI and risk controls.
:::

---

## 2.1: redirect URI discipline

Redirect URI validation becomes non-negotiable.

- Register exact URIs
- Compare exact values
- Avoid wildcards
- Protect redirect endpoints

::: notes
The authorization response is only as safe as its destination. Exact matching also simplifies reasoning during incident response.
:::

---

## 2.1: bearer token handling

Bearer tokens are credentials.

- Transmit over TLS
- Do not log tokens
- Validate audience and issuer
- Keep lifetimes narrow

::: notes
Bearer means possession is enough unless the token is sender-constrained by another mechanism. Treat bearer token leaks as credential leaks.
:::

---

## 2.1: refresh tokens

Refresh tokens require active management.

- Rotate public-client refresh tokens
- Detect reuse
- Bind to client and authorization
- Revoke on compromise

::: notes
OAuth 2.1 and RFC 9700 encourage refresh token rotation or sender-constraining, especially where clients cannot keep long-term secrets.
:::

---

## 2.1: public clients

Public clients are not broken clients.

They need different controls:

- PKCE
- Exact redirect URIs
- No embedded secrets
- Platform-appropriate redirect patterns

::: notes
The mistake is pretending a public client can protect a client secret. Native and browser-based apps can still be secure when designed around public-client constraints.
:::

---

## 2.1: extension hygiene

Extensions must preserve binding.

- PAR for request integrity
- JAR for signed requests
- DPoP or mTLS for sender-constrained tokens
- Issuer identification for mix-up defenses

::: notes
Do not add advanced extensions as decoration. Each extension should solve a concrete threat model or deployment requirement.
:::

---

## Prevention checklist

Build these into platform defaults.

- Secure client registration profiles
- Centralized redirect URI validation
- Shared PKCE and state libraries
- Token validation middleware
- Security event logging

::: notes
The most efficient way to prevent incidents is to make secure behavior the easiest path. Application teams should not hand-roll OAuth validation.
:::

---

## The mental model

Most OAuth attacks exploit a missing proof.

OAuth 2.1 and RFC 9700 add the missing proofs to the default path.

::: notes
This transitions naturally into OIDC: once OAuth is used for login, the system also needs an identity assertion, nonce binding, and authentication context claims.
:::
