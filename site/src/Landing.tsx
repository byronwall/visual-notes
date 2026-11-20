import { createSignal, For, onCleanup, onMount } from "solid-js";
import { BYRON, EXCHANGE, GITHUB, MORE, POSTS, RULES, STACK } from "./content";
import { Tour } from "./Tour";

export function Landing() {
  // The bar gets its bottom rule only once content scrolls under it.
  const [stuck, setStuck] = createSignal(false);
  const onScroll = () => setStuck(scrollY > 4);
  onMount(() => {
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
  });
  onCleanup(() => removeEventListener("scroll", onScroll));

  return (
    <>
      <header class="nav" classList={{ stuck: stuck() }}>
        <div class="nav-row">
          <a class="brand" href="#top">
            <Logo />
            Visual Notes
          </a>
          <nav aria-label="Sections">
            <a href="#tour">Tour</a>
            <a href="#agents">Agents</a>
            <a href="#built">How it's built</a>
            <a class="nav-gh" href={GITHUB}>
              <GitHubIcon />
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section class="hero">
          <h1>
            A notes app that turns voice memos into tasks, and that <em>agents can work in.</em>
          </h1>
          <div class="hero-side">
            <p class="lede">
              Visual Notes holds my notes, recordings, tasks, research, and people. I built it and use it
              every day. Agents connect over MCP and read and edit the same notes I do.
            </p>
            <div class="cta">
              <a class="button primary" href="#tour">
                Take the tour
              </a>
              <a class="button" href={GITHUB}>
                <GitHubIcon />
                Source
              </a>
            </div>
          </div>
        </section>

        <Tour />
        <p class="demo-note">
          Every screenshot uses a demo database with invented notes. Click one to see it full size.
        </p>

        <section class="more" aria-labelledby="more-title">
          <h2 id="more-title">Also in the app</h2>
          <dl>
            <For each={MORE}>
              {([name, text]) => (
                <div>
                  <dt>{name}</dt>
                  <dd>{text}</dd>
                </div>
              )}
            </For>
          </dl>
        </section>

        <section class="agents" id="agents">
          <div class="agents-copy">
            <h2>Agents work in the same notes</h2>
            <p>
              The app serves an MCP endpoint, so ChatGPT or Claude can do nearly everything I can do in the
              UI: more than 60 tools across notes, tasks, collections, research, pathways, people, events, the
              archive, and search. A few rules keep that safe enough to leave on.
            </p>
            <ul class="rules">
              <For each={RULES}>
                {([lead, rest]) => (
                  <li>
                    <strong>{lead}</strong> {rest}
                  </li>
                )}
              </For>
            </ul>
          </div>

          <figure class="exchange">
            <ol>
              <For each={EXCHANGE}>
                {(step) => (
                  <li class={step.kind}>
                    {step.kind === "calls" ? (
                      <For each={step.calls}>
                        {(c) => (
                          <div class="call">
                            <code class="tool">{c.tool}</code>
                            <code class="args">{args(c.args)}</code>
                            <span class="result">{c.result}</span>
                          </div>
                        )}
                      </For>
                    ) : (
                      <>
                        <span class="who">{step.kind === "user" ? "Me" : "Agent"}</span>
                        <p>{step.text}</p>
                      </>
                    )}
                  </li>
                )}
              </For>
            </ol>
            <figcaption>
              An example exchange against the demo data, with the real tool names and arguments.
            </figcaption>
          </figure>
        </section>

        <section class="built" id="built">
          <div class="built-copy">
            <h2>How it's built</h2>
            <p>
              One SolidStart app and one Postgres database on my own server. Notes are markdown stored as
              blocks with IDs. Tasks, collection rows, and events are notes or point back to one, so search
              and the agent connector reach all of it through the same records.
            </p>
            <p>
              My own copy holds about 6,300 notes. The repo has about 1,100 commits since October 2025, 766 of
              them in the last three months. There is no hosted version to sign up for; the source is public.
            </p>
            <dl class="stack">
              <For each={STACK}>
                {([k, v]) => (
                  <div>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                )}
              </For>
            </dl>
          </div>
          <div class="posts">
            <h3>Write-ups on byroni.us</h3>
            <ul>
              <For each={POSTS}>
                {(p) => (
                  <li>
                    <a href={p.href}>{p.title}</a>
                    <time dateTime={p.date}>{formatDate(p.date)}</time>
                    <p>{p.note}</p>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </section>
      </main>

      <footer class="footer">
        <div class="footer-row">
          <span>
            Built by <a href={BYRON}>Byron Wall</a>
          </span>
          <span class="footer-links">
            <a href={`${BYRON}/projects/visual-notes`}>Project page</a>
            <a href={GITHUB}>GitHub</a>
          </span>
        </div>
      </footer>
    </>
  );
}

/** Quoted values never break across lines, so a date or ID stays whole when the args wrap. */
const args = (text: string) =>
  text.split(/("[^"]*")/).map((part) => (part.startsWith('"') ? <span class="nowrap">{part}</span> : part));

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function Logo() {
  return (
    <img
      class="logo"
      src={`${import.meta.env.BASE_URL}android-chrome-192x192.png`}
      alt=""
      width="28"
      height="28"
    />
  );
}

function GitHubIcon() {
  return (
    <svg class="gh" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}
