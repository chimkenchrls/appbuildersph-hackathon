# OwlSet

Clear agreements. Controlled revisions. Confident freelancing.

OwlSet is an Android app for freelancers. It turns a client conversation into a confirmed project
scope, checks later client requests against that scope, and helps draft a change proposal when a
request goes beyond it. Data stays in a local database on the phone, and the AI can run on the phone
itself with no internet connection.

- **Website and interactive demo:** https://owlsetph.vercel.app
- **Platform:** Android (the release is an installable APK). The website is a landing page only.
- **Mascot:** Kwagi, an owl. His name joins *kwago* (owl) and *wagi* (win).

---

## For moderators: testing OwlSet

There are two ways to try it.

| Option | What you get | Time | Needs |
| --- | --- | --- | --- |
| **A. Install the APK** | The real app on your phone, with on-device AI | 15 to 30 minutes, mostly the model download | An Android phone |
| **B. Build from source** | The same app, built on your computer | 30 to 60 minutes | Node.js 22, Android Studio |

### Option A: install the APK (recommended)

**What you need**

- An Android phone. For on-device AI, the team's guidance is at least 8 GB of RAM and about
  8 GB of free storage. Phones with less memory can still use the app with the network AI
  option below, or with no AI.
- The APK: `<ADD APK DOWNLOAD LINK HERE>`
- The AI model file, about 2.1 GB (see [Installing the AI model](#installing-the-ai-model-one-time)).

**Steps**

1. **Install.** Download the APK on the phone and open it. Android will ask you to allow installs
   from your browser or file manager; allow it for this one install.
2. **First launch.** Go through the three onboarding screens and enter a name and role. You land on
   **Projects**, which already contains one demo project ("Demo: Acme Studios website").
3. **Add the AI model.** This is a one-time setup; follow
   [Installing the AI model](#installing-the-ai-model-one-time) below.
4. **Optional: prove it is offline.** Turn on airplane mode before the walkthrough.

#### Installing the AI model (one time)

OwlSet does not include a model inside the APK, to keep the app download small. You download one
model file and import it into the app once. After that it stays in the app and works without
internet, including after you close and reopen OwlSet.

| | |
| --- | --- |
| **Model** | `qwen2.5-3b-instruct-q4_k_m` (Qwen2.5 3B Instruct, 4-bit quantized) |
| **File** | `qwen2.5-3b-instruct-q4_k_m.gguf` |
| **Size** | 2,104,932,768 bytes, about 2.1 GB (the app shows it as 1.96 GB) |
| **Direct download** | https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf?download=true |

**Part 1: download the file to the phone**

1. Connect the phone to Wi‑Fi. The file is 2.1 GB.
2. On the phone, open the direct download link above in a browser. The download starts by itself;
   no account is needed.
3. Wait for it to finish. The file lands in the phone's **Downloads** folder as
   `qwen2.5-3b-instruct-q4_k_m.gguf`.

You can also download it on a computer and copy it to the phone over USB. Any folder on the phone works.

**Part 2: put the model inside OwlSet**

1. Open OwlSet and go to the **Settings** tab.
2. Under **AI Inference Engine**, choose **On-Device**.
3. Tap **Import .gguf Model**.
4. In the file picker, open **Downloads** and select `qwen2.5-3b-instruct-q4_k_m.gguf`.
5. Wait while OwlSet copies the file into its own storage. Keep the app open; this takes a minute
   or two. When it finishes you see *Model "qwen2.5-3b-instruct-q4_k_m.gguf" imported … and activated*.
6. Tap **Test On-Device**. "On-Device Test Passed" with a time means the model is working.

That's it. You do not repeat this unless you uninstall the app or use **Import .gguf Model** again
to switch models.

Good to know:

- **Have about 4.5 GB free after the download has finished.** Android first hands OwlSet a
  temporary copy of the file, and OwlSet then saves its own copy, so the import briefly needs
  room for two more copies. Once the import has succeeded you can delete the original from
  Downloads and get 2.1 GB back.
- **The first answer is the slowest**, because the model has to load into memory. Later answers
  in the same session are faster.
- **Free Model RAM** in Settings unloads the model from memory without deleting it. Use it if the
  phone feels slow after testing.
- **Uninstalling OwlSet deletes the imported model** along with the app's data.

**No model, or a phone with little memory?** You have two alternatives:

- **Network AI.** Run [LM Studio](https://lmstudio.ai) on a computer on the same Wi‑Fi, load a
  model, and start its local server with "serve on local network" enabled. In OwlSet open
  **Settings → AI Inference Engine → Network**, enter `http://<computer LAN IP>:1234/v1`
  and the model ID LM Studio shows, then tap **Test Connection**.
- **No AI.** Creating a project still works: OwlSet falls back to a rule-based extractor and labels
  the draft "Drafted by the rule-based fallback, not AI". Checking a new request needs AI and will
  say so if none is available.

### Option B: build from source

```sh
git clone https://github.com/chimkenchrls/appbuildersph-hackathon.git
cd appbuildersph-hackathon
npm ci
```

Then build and install a development build on a connected Android phone or a running emulator:

```sh
npx expo run:android
```

This needs Node.js 22 (`>=22.13.0 <23`) and Android Studio with an Android SDK and NDK (its bundled
JDK is enough). The first build compiles the native AI library and can take 15 minutes or more.
The team builds with EAS, so this local route has had less testing.

Notes:

- **Expo Go is not supported.** The app uses native modules (on-device inference, SQLite) that Expo
  Go does not include.
- **Cloud builds with EAS** use the team's Expo project (`app.json` names its owner and project
  ID), so they only work for team members. To build with your own EAS account, remove `owner` and
  `extra.eas.projectId` from `app.json` first, then run
  `npx eas-cli@latest build --platform android --profile preview`.
- **An emulator** can run the app, but a 3B model on an emulator is very slow. Use the Network AI
  option there: the emulator reaches LM Studio on the host at `http://10.0.2.2:1234/v1`.
- Copy `.env.example` to `.env` only if you want to preset the LM Studio address. Nothing in it is secret.

### What to test: a 5-minute walkthrough

Use this fictional conversation:

> Client: I need five responsive pages: Home, About, Services, Portfolio, and Contact, with a contact form.
> Freelancer: The proposed fee is PHP 15,000, the timeline is two weeks, and two revision rounds are included.
> Client: Approved. Let's proceed.

| # | Do this | You should see |
| --- | --- | --- |
| 1 | **Projects → New Project.** Enter a name, paste the conversation, tap **Create scope draft**. | A draft with the five pages, the contact form, PHP 15,000, two weeks and two revision rounds. The screen says whether AI or the rule-based fallback drafted it. |
| 2 | Review the draft. Edit anything. Tap **Release & Confirm Scope**. | **Agreement v1** is saved. Its requirements get IDs such as `REQ-01`. |
| 3 | On the project overview, tap **Add new client request**. Paste: *"Can you also add customer accounts so regulars can log in?"* Tap **Analyze & draft proposal**. | The request is classified, for example as a **potential addition**, with the requirement IDs it was compared against. It is labelled as an AI suggestion for you to review. |
| 4 | Tap **Prepare change proposal**. Enter your own fee and extra days. | An editable message to the client. OwlSet does not set prices; the numbers are yours. |
| 5 | Tap **Copy message** or **Share message**. | The message is copied, or Android's share sheet opens. Nothing is sent automatically. |
| 6 | Back on the overview, tap **View Legal Contract**. | A service agreement generated from the confirmed scope, shareable as PDF or text. |
| 7 | Close the app completely and reopen it. | The project, agreement and request are still there. |

To start again, use **Settings → Reset Workspace Baseline**.

### Troubleshooting

| Problem | What to do |
| --- | --- |
| "The selected file is not a GGUF model" | The download is incomplete or the wrong file. Download it again; the finished file should be about 2.1 GB (2,104,932,768 bytes). |
| "Not enough free storage to import this model" | The import needs room for its own copies of the file. Free up space so about 4.5 GB is available, then import again. |
| The AI is very slow, or the app closes while it thinks | The phone is short on memory. Close other apps, tap **Free Model RAM** in Settings and try again, or switch to Network AI. |
| "This is too long for the on-device model" | The on-device context window is 2,048 tokens. Shorten the pasted conversation or request. |
| LM Studio cannot be reached | Phone and computer must be on the same Wi‑Fi. Use the computer's LAN IP, not `localhost`. Enable "serve on local network" in LM Studio and allow it through the firewall. |
| `npm ci` fails | Check `node --version`. The project needs Node.js 22. |

---

## AI disclosure

### AI inside the app

| | |
| --- | --- |
| **Model** | Qwen2.5-3B-Instruct (about 3 billion parameters), by Alibaba Cloud's Qwen team |
| **File used** | `qwen2.5-3b-instruct-q4_k_m.gguf`: GGUF format, 4-bit quantized (Q4_K_M), about 2.1 GB, imported by the user |
| **Runtime** | [`llama.rn`](https://github.com/mybigday/llama.rn) (llama.cpp for React Native), on the phone's CPU, 2,048-token context |
| **Where it runs** | On the device. Conversations, agreements and requests are not sent to any server. |
| **Model licence** | Qwen Research License. Check its terms before any commercial use. |

The app loads any GGUF model the user imports, so it is not tied to this one. During development
the team also used LM Studio on a computer as a stand-in for on-device inference, with other local
Qwen models. That path remains in the app as the **Network** option. No cloud AI service is
called at any point.

What the model is used for, and its limits:

- It **drafts** a scope from a conversation and **suggests** how a new request compares with the
  confirmed scope. Both are labelled as AI output and need the freelancer's review.
- It does not confirm agreements, set prices, or send anything. The freelancer does.
- Its answers are validated against a fixed structure before they are shown. An answer that does
  not fit is reported as an error, not displayed.
- A 3B model can misread a conversation. Treat every draft as a starting point.

### AI used to build the project

| Tool | Used for |
| --- | --- |
| **ChatGPT** (OpenAI) | AI-assisted programming |
| **Claude** (Anthropic) | AI-assisted programming |
| **Gemini** (Google) | AI-assisted programming, and generating the initial artwork for Kwagi, the mascot |

The team reviewed, tested and is responsible for all code and content in this repository.

---

## What OwlSet does

- **BriefCraft:** drafts deliverables, budget, timeline, revision terms, exclusions and tax
  treatment from a pasted client conversation.
- **Kasunduan Vault:** stores confirmed agreements as versions with stable requirement IDs
  (`REQ-01`, `REQ-02`, …) in a local SQLite database. A confirmed agreement's terms cannot be edited.
- **ScopeGuard:** compares a new client request with the confirmed agreement and classifies each
  item as included, a potential addition, or needing clarification, citing the requirements it used.
- **ChangeDesk:** turns potential additions into a change proposal with the freelancer's own fee
  and extra days.
- **Contract generator:** produces a service agreement from the confirmed scope, with clauses that
  refer to Philippine law (see the limitation below).
- **Sharing:** uses Android's share sheet. OwlSet has no server and sends nothing by itself.

## Known limitations

- **Device verification is still in progress.** The team's offline acceptance checklist is in
  [docs/verification](docs/verification/2026-10-10-offline-device-acceptance.md). Until a completed
  run is recorded there, treat on-device performance as unverified across phones.
- **Android only.** iOS is not built or tested. The web target is a landing page.
- **The contract generator is not legal advice.** Its wording has not been reviewed by a lawyer.
  Have a professional check any contract before relying on it.
- **Money is stored in whole currency units**, not centavos.
- **The on-device context is small** (2,048 tokens), so long conversations must be shortened.
- **A new model import replaces the current one** without test-running it first.

## Privacy

OwlSet has no accounts, no analytics and no backend. Projects, agreements, requests and proposals
are stored in a SQLite database inside the app's private storage. With **On-Device** AI, nothing
leaves the phone. With **Network** AI, text is sent only to the computer you point it at on
your own network. Uninstalling the app deletes its data.

---

## For developers

### Technical stack

- React Native `0.86.3`, Expo SDK 57, TypeScript (strict), Expo Router
- `expo-sqlite` with WAL mode and ordered migrations in `src/database/migrations/`
- Zod validation for stored records and for model output
- `llama.rn` for on-device inference, and an LM Studio HTTP adapter for development; a hybrid
  adapter chooses between them (`src/llm/adapters/`)

### Run and check

```sh
npm ci
npx expo start --dev-client   # with a development build installed
npm run web                   # the landing page, at localhost

npm run lint
npm run typecheck
npm test
npm run check:dependencies
npx expo-doctor
npm run build:web
```

Set `EXPO_PUBLIC_SAKLAW_FIXTURES=1` to run the screens on labelled in-memory demo data and prepared
AI output, with no database or model. Tests use the same fixtures.

For LM Studio, set `EXPO_PUBLIC_LM_STUDIO_URL` to the server's `/v1` address and
`EXPO_PUBLIC_LM_STUDIO_MODEL` to an ID listed by `/v1/models`. Explicit environment values override
settings saved in the app. Restart Metro with `npx expo start --clear` after changing `.env`.

### Layout

```text
src/
  app/                 Expo Router routes (thin)
  screens/
    RootScreen(.web)   Entry: the workspace on native, the landing page on web
    workspace/         The app's screens: Projects, New Project, Scope Draft, Overview, Settings, …
    routed/            Screens opened by route, and their web redirects
  components/          ui/ (kit), workspace/ (app chrome), landing/, kwagi/ (mascot)
  features/  hooks/    Feature hooks and shared hooks
  database/            SQLite client, migrations, repositories, demo seed
  llm/                 Engine contracts, adapters (on-device, LM Studio, hybrid), prompts, JSON parser
  services/
    domain/            BriefCraft, ScopeGuard, ChangeDesk, contract, vault, export, share, bootstrap
    backend/ fixtures/ Adapters the screens call, and their in-memory test doubles
  safety/              Validation of model output, estimates and stored records
  constants/ types/ utils/
tests/                 Jest suites (unit, SQLite integration, screens)
demo/                  The promotional video, a separate Remotion project (see demo/README.md)
docs/                  Deployment, decisions, verification checklists, specs and plans
```

Further reading: [PROJECT.md](PROJECT.md) (product), [ARCHITECTURE.md](ARCHITECTURE.md),
[BACKEND.md](BACKEND.md), [FRONTEND.md](FRONTEND.md), [MASCOT.md](MASCOT.md), [ROADMAP.md](ROADMAP.md).

### Web deployment

The landing page is published to Vercel by GitHub Actions, only for a commit that CI has verified
on `main`. The workflow rebuilds that commit, publishes it and smoke-checks the live site. Setup,
recovery and rollback are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Publishing the website does
not deliver the Android app.

### Android APK builds

```sh
npx eas-cli@latest build --platform android --profile preview   # test build
npx eas-cli@latest build --platform android --profile apk       # release candidate
```

Both produce a standalone `.apk`. New native dependencies require a new build. Persistence and
integration decisions are recorded in [docs/decisions](docs/decisions) and
[docs/superpowers](docs/superpowers).
