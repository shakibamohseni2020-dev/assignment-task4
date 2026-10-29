# Test script — login rejects valid email addresses

**Ticket:** moved from Volunteer to Failed by Ray (QA)
**Reported by:** Ray — "some users can't log in, the app says invalid email"
**Affected users named in the ticket:** Luigi Carluccio, John Silva

---

## Environment

| | |
|---|---|
| App | volunteam, Expo SDK 47 |
| Screen under test | Login |
| API | json-server + json-server-auth, `db.json` at the repo root |
| Device | Expo Go, and the web build for the quick passes |

## Before you start

1. Set `baseURL` in `src/services/api.ts` to your own machine's IP address.
2. Start the fake API:
   ```
   npx json-server --watch db.json --port 3333 --host <your-ip> -m ./node_modules/json-server-auth
   ```
3. Start the app with `npx expo start` and open it.
4. Every seeded account in `db.json` uses the password `123456`.

Each test starts from the Login screen with both fields empty.

---

## Test cases

### TC-01 — Luigi cannot log in (the reported bug)

| | |
|---|---|
| Steps | 1. Type `luigi@carluccio.it` in Email. 2. Type `123456` in Password. 3. Tap outside the field. 4. Tap **Log in**. |
| Expected | The app accepts the address and logs Luigi in, landing on the events map. |
| Before fix | ❌ "invalid email" appears beside the Email label, the field border turns red, no network request is sent. |
| After fix | ✅ Logs in and the map opens. |

### TC-02 — John cannot log in (the reported bug)

| | |
|---|---|
| Steps | Same as TC-01 with `john@silva.com.br`. |
| Expected | Logs in and the map opens. |
| Before fix | ❌ "invalid email", no request sent. |
| After fix | ✅ Logs in and the map opens. |

### TC-03 — An account that always worked still works (regression check)

| | |
|---|---|
| Steps | Same as TC-01 with `ulla.ulriksen@example.com`. |
| Expected | Logs in and the map opens. |
| Before fix | ✅ Works. |
| After fix | ✅ Still works. |

### TC-04 — Other country code domains

| | |
|---|---|
| Steps | Type `someone@example.ca`, then `someone@example.co.uk`, tapping outside the field each time. |
| Expected | No "invalid email" message. Log in fails at the server with "Cannot find user", because these accounts do not exist — that is the correct behaviour. |
| Before fix | ❌ "invalid email" for both, blocked before reaching the server. |
| After fix | ✅ No validation message; the request reaches the server. |

### TC-05 — Longer top level domains

| | |
|---|---|
| Steps | Type `someone@example.info`, then `someone@example.online`. |
| Expected | No "invalid email" message. |
| Before fix | ❌ "invalid email" for both. |
| After fix | ✅ No validation message. |

### TC-06 — Plus addressing

| | |
|---|---|
| Steps | Type `someone+volunteam@example.com`. |
| Expected | No "invalid email" message — gmail and others hand out addresses in this form. |
| Before fix | ❌ "invalid email". |
| After fix | ✅ No validation message. |

### TC-07 — Capitals and stray spaces

| | |
|---|---|
| Steps | Type `  LUIGI@CARLUCCIO.IT  ` including the spaces, password `123456`, tap **Log in**. |
| Expected | Logs in. The address is trimmed and lowercased before it is checked and before it is sent. |
| Before fix | ❌ "invalid email". |
| After fix | ✅ Logs in and the map opens. |

### TC-08 — Genuinely malformed addresses are still blocked

| | |
|---|---|
| Steps | Try each of `notanemail`, `@example.com`, `someone@`, `someone@example`, `some one@example.com`. |
| Expected | "invalid email" for every one of them, and no request is sent. |
| Before fix | ✅ Blocked. |
| After fix | ✅ Still blocked. |

### TC-09 — Short password is still blocked

| | |
|---|---|
| Steps | Enter `luigi@carluccio.it` and password `12345`, tap **Log in**. |
| Expected | "invalid password" beside the Password label, no request sent. |
| Before fix | ✅ Blocked. |
| After fix | ✅ Still blocked. |

### TC-10 — Wrong password gives a server error, not a validation error

| | |
|---|---|
| Steps | Enter `luigi@carluccio.it` and password `wrongpassword`, tap **Log in**. |
| Expected | The request is sent and an "Authentication Error" alert appears with the server's message. No "invalid email". |
| Before fix | ❌ Blocked at "invalid email" before the password was ever checked. |
| After fix | ✅ Alert shows the server's message. |

---

## Findings

Ten of the ten cases pass after the fix. Before it, six failed (TC-01, TC-02, TC-04, TC-05, TC-06, TC-07, TC-10).

Everything traced back to one function, `validateEmail` in `src/utils/index.ts`, and its regular expression:

```
/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{3})+$/
```

**Cause 1 — the top level domain had to be exactly three characters.**
`(\.\w{3})+` matches three word characters and nothing else. `.com` and `.org` fit,
so most accounts were fine and the problem looked random. Anything shorter
(`.it`, `.br`, `.ca`, `.uk`) or longer (`.info`, `.online`) was rejected. That is
exactly what Luigi and John have, and why only some users were affected.

**Cause 2 — the local part was too narrow.**
Only `\w` characters with single dots or hyphens were allowed, so an address
like `someone+volunteam@example.com` was rejected too. Nobody reported this yet,
but it would have produced the same confusing message.

Because `validateEmail` runs before `handleAuthentication`, affected users never
reached the API at all — which is why the error said "invalid email" rather than
anything from the server.

## Potential problems noticed while testing

- The message "invalid email" does not say what is wrong with the address, so a
  user with a perfectly good address has no way to act on it. Worth rewording.
- The same regular expression is the only thing standing between the form and
  the API. A unit test now covers it (`src/utils/__tests__/validateEmail.test.ts`),
  which is what should catch a regression here rather than a QA pass.
- No address is validated on the server side. The fake API accepts anything, so
  this check is the only one in the system.
