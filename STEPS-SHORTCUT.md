# Steps auto-sync: iPhone Shortcut → Chaos & Control

A web app can't read Apple Health. The workaround is a Shortcut that reads today's step total from Health and opens the app with the number in the link:

```
https://YOUR-APP-URL/?steps=8432&date=2026-10-05
```

When the app loads with that link, it saves the steps for that date, shows a toast ("8,432 steps synced · Mon, Oct 5"), opens the STEPS tab and removes the numbers from the address bar. `#steps=8432&date=2026-10-05` works the same way, and so do numbers with commas or decimals (`8,432`, `8432.0`). If `date` is missing, the steps go to today.

Replace `YOUR-APP-URL` with the real address once the app is hosted, for example `https://breckyn.github.io/chaos-control/`.

---

## ⚠️ Read this first: iPhone keeps two separate copies of the data

On iPhone, an app added to the Home Screen with **Open as Web App** turned on gets **its own storage, separate from Safari**. A Shortcut's **Open URL** action opens the link in Safari (or your default browser), not in the Home Screen app. So with a plain `https://` link, the steps get saved into Safari's copy of the app, and the Home Screen icon won't see them.

Pick one of these setups. **Test it once with a fake number before relying on it.**

| Setup | Steps sync with no typing? | Trade-off |
|---|---|---|
| **A. Home Screen web app + `webapp://` link** (try this first) | Yes, if your iOS version passes the `?steps=` part through | Apple doesn't document `webapp://`. Some iOS versions open the app but drop everything after the domain. |
| **B. Home Screen bookmark that opens in Safari** (most reliable) | Yes | When adding to the Home Screen, turn **Open as Web App OFF**. The icon then opens a Safari tab, which shares storage with the Shortcut's links. You'll see Safari's toolbar. |
| **C. Clipboard hand-off** (fallback) | One tap | The Shortcut copies the number, opens the app, and you tap **PASTE STEPS FROM SHORTCUT** on the STEPS tab, then **Allow Paste**. |

**Use one browser and one icon.** Clock-ins, food and skills are stored wherever you use the app. Don't use the app in Safari and in the Home Screen app at the same time.

---

## Build the Shortcut (about 3 minutes)

Open the **Shortcuts** app → **+** (top right) → name it **C&C Steps**.

1. **Find Health Samples**
   - Search the action list for "Find Health Samples".
   - Tap **Type** → **Steps**.
   - Add a filter: **Start Date** **is today**.
   - **Group By: Day**. This returns one summed total for today, and it lets Health remove double counts when an iPhone and an Apple Watch both log steps.
   - Leave **Limit** off.
2. **Get Details of Health Samples** → **Value**. This gives the summed step count.
   - Alternative if you skip "Group By": add **Calculate Statistics** → **Sum** of Health Samples. This can double-count when a watch is paired.
3. **Round Number** → **Ones place**. Shortcuts sometimes returns decimals like 8432.4, and the app accepts those anyway.
4. **Format Date**
   - Date: **Current Date**
   - Date Format: **Custom**, format string `yyyy-MM-dd` (lowercase `yyyy`, capital `MM`, lowercase `dd`).
5. **Text**. Type your link and insert the two variables from the steps above:
   - **Setup A:** `webapp://YOUR-APP-DOMAIN/PATH/?steps=[Rounded Number]&date=[Formatted Date]`
     (no `https`; copy the domain and path exactly as the Home Screen app uses them, e.g. `webapp://breckyn.github.io/chaos-control/?steps=…`)
   - **Setup B:** `https://YOUR-APP-URL/?steps=[Rounded Number]&date=[Formatted Date]`
   - **Setup C:** `CCSTEPS [Rounded Number] [Formatted Date]`. Then add **Copy to Clipboard** (input: Text), and after it a second **Text** action holding `webapp://YOUR-APP-DOMAIN/PATH/` (or the `https://` URL).
6. **Open URLs**, with the Text from step 5 as input.

Tap ▶︎ to run it once. Check that the app shows the toast and that the number matches the Health app (**Health → Browse → Activity → Steps → today**). The first run asks for permission to read Steps, so tap **Allow**.

> Want yesterday's full total instead (useful if he goes to bed late)? In step 1 use **Start Date is yesterday**, and in step 4 use **Adjust Date** (subtract 1 day) before **Format Date**.

## Run it automatically every night (~9 PM)

1. Shortcuts → **Automation** tab → **+** (or **New Automation**).
2. Choose **Time of Day** → **9:00 PM** → **Daily**.
3. Select **Run Immediately** (iOS 17 and later) and turn **Notify When Run** off. On older iOS versions, turn off **Ask Before Running**.
4. Pick the **C&C Steps** shortcut (or add the action **Run Shortcut → C&C Steps**) → **Done**.

At 9 PM the phone opens the app for a moment and the steps land. If the phone is locked at that moment, iOS may hold the "open URL" step until it's unlocked. That's normal. You can also run it again any time; a later run overwrites that day's number with the newer total.

## If a day is missed

**MORE → Settings → Fix steps (manual override)**: pick a date, type the number, save. Only use this as a fallback.

---

## Android

**Health Connect has no web API**, so a website or PWA can't read steps on Android at all. Options:

- **Automation app:** Tasker (with a Health Connect plugin), Automate, or MacroDroid with a step source. Read today's steps, then open
  `https://YOUR-APP-URL/?steps=%STEPS&date=%DATE` (date as `yyyy-MM-dd`) on a daily 9 PM time trigger.
  On Android, the installed app and Chrome share the same storage, so the plain `https://` link works.
- **Small native wrapper:** for example a Trusted Web Activity or Capacitor build of this same app, with a Health Connect plugin that reads steps directly. That's a real (small) Android project that needs the Play Store or sideloading.
- **Manual fallback:** MORE → Fix steps.

## What the app does with the number

- Saves `{ date: { n: steps, t: savedAt, src: "shortcut" } }` in this browser's localStorage. Nothing is sent anywhere.
- STEPS tab: blue ring against the 10,000 goal, a green tick at the 8,000 minimum, a 7-day bar chart, and 7-day plus this-week averages.
- On rest days (Wed/Sat/Sun), 8,000+ steps plus **LOG REST / WALK** earns ½ day credit on the bonus meter.
