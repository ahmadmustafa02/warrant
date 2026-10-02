import type { ReactNode } from 'react';
import { MeasuredRates } from './MeasuredRates';

function BrandIcon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true" role="img">
      <title>{label}</title>
      {children}
    </svg>
  );
}

function LangChainMark() {
  return (
    <BrandIcon label="LangChain">
      <path
        fill="currentColor"
        d="M13.796 0a6.93 6.93 0 0 0-4.91 2.019L5.451 5.455l3.273 3.27 3.432-3.432a2.284 2.284 0 0 1 3.277 0 2.28 2.28 0 0 1 0 3.275L12 12.001l3.273 3.273 3.433-3.435c2.692-2.692 2.692-7.127 0-9.82A6.92 6.92 0 0 0 13.796 0m-5.07 8.728-3.433 3.434c-2.692 2.693-2.692 7.126 0 9.819A6.92 6.92 0 0 0 10.203 24a6.93 6.93 0 0 0 4.911-2.02l3.432-3.432-3.271-3.272-3.433 3.433a2.284 2.284 0 0 1-3.277 0 2.28 2.28 0 0 1 0-3.276L12 12z"
      />
    </BrandIcon>
  );
}

function VercelMark() {
  return (
    <BrandIcon label="Vercel">
      <path fill="currentColor" d="m12 1.608 12 20.784H0Z" />
    </BrandIcon>
  );
}

function HuggingFaceMark() {
  return (
    <BrandIcon label="Hugging Face">
      <path
        fill="#FFD21E"
        d="M12.025 1.13c-5.77 0-10.449 4.647-10.449 10.378 0 1.112.178 2.181.503 3.185.064-.222.203-.444.416-.577a.96.96 0 0 1 .524-.15c.293 0 .584.124.84.284.278.173.48.408.71.694.226.282.458.611.684.951v-.014c.017-.324.106-.622.264-.874s.403-.487.762-.543c.3-.047.596.06.787.203s.31.313.4.467c.15.257.212.468.233.542.01.026.653 1.552 1.657 2.54.616.605 1.01 1.223 1.082 1.912.055.537-.096 1.059-.38 1.572.637.121 1.294.187 1.967.187.657 0 1.298-.063 1.921-.178-.287-.517-.44-1.041-.384-1.581.07-.69.465-1.307 1.081-1.913 1.004-.987 1.647-2.513 1.657-2.539.021-.074.083-.285.233-.542.09-.154.208-.323.4-.467a1.08 1.08 0 0 1 .787-.203c.359.056.604.29.762.543s.247.55.265.874v.015c.225-.34.457-.67.683-.952.23-.286.432-.52.71-.694.257-.16.547-.284.84-.285a.97.97 0 0 1 .524.151c.228.143.373.388.43.625l.006.04a10.3 10.3 0 0 0 .534-3.273c0-5.731-4.678-10.378-10.449-10.378M8.327 6.583a1.5 1.5 0 0 1 .713.174 1.487 1.487 0 0 1 .617 2.013c-.183.343-.762-.214-1.102-.094-.38.134-.532.914-.917.71a1.487 1.487 0 0 1 .69-2.803m7.486 0a1.487 1.487 0 0 1 .689 2.803c-.385.204-.536-.576-.916-.71-.34-.12-.92.437-1.103.094a1.487 1.487 0 0 1 .617-2.013 1.5 1.5 0 0 1 .713-.174m-10.68 1.55a.96.96 0 1 1 0 1.921.96.96 0 0 1 0-1.92m13.838 0a.96.96 0 1 1 0 1.92.96.96 0 0 1 0-1.92M8.489 11.458c.588.01 1.965 1.157 3.572 1.164 1.607-.007 2.984-1.155 3.572-1.164.196-.003.305.12.305.454 0 .886-.424 2.328-1.563 3.202-.22-.756-1.396-1.366-1.63-1.32q-.011.001-.02.006l-.044.026-.01.008-.03.024q-.018.017-.035.036l-.032.04a1 1 0 0 0-.058.09l-.014.025q-.049.088-.11.19a1 1 0 0 1-.083.116 1.2 1.2 0 0 1-.173.18q-.035.029-.075.058a1.3 1.3 0 0 1-.251-.243 1 1 0 0 1-.076-.107c-.124-.193-.177-.363-.337-.444-.034-.016-.104-.008-.2.022q-.094.03-.216.087-.06.028-.125.063l-.13.074q-.067.04-.136.086a3 3 0 0 0-.135.096 3 3 0 0 0-.26.219 2 2 0 0 0-.12.121 2 2 0 0 0-.106.128l-.002.002a2 2 0 0 0-.09.132l-.001.001a1.2 1.2 0 0 0-.105.212q-.013.036-.024.073c-1.139-.875-1.563-2.317-1.563-3.203 0-.334.109-.457.305-.454m.836 10.354c.824-1.19.766-2.082-.365-3.194-1.13-1.112-1.789-2.738-1.789-2.738s-.246-.945-.806-.858-.97 1.499.202 2.362c1.173.864-.233 1.45-.685.64-.45-.812-1.683-2.896-2.322-3.295s-1.089-.175-.938.647 2.822 2.813 2.562 3.244-1.176-.506-1.176-.506-2.866-2.567-3.49-1.898.473 1.23 2.037 2.16c1.564.932 1.686 1.178 1.464 1.53s-3.675-2.511-4-1.297c-.323 1.214 3.524 1.567 3.287 2.405-.238.839-2.71-1.587-3.216-.642-.506.946 3.49 2.056 3.522 2.064 1.29.33 4.568 1.028 5.713-.624m5.349 0c-.824-1.19-.766-2.082.365-3.194 1.13-1.112 1.789-2.738 1.789-2.738s.246-.945.806-.858.97 1.499-.202 2.362c-1.173.864.233 1.45.685.64.451-.812 1.683-2.896 2.322-3.295s1.089-.175.938.647-2.822 2.813-2.562 3.244 1.176-.506 1.176-.506 2.866-2.567 3.49-1.898-.473 1.23-2.037 2.16c-1.564.932-1.686 1.178-1.464 1.53s3.675-2.511 4-1.297c.323 1.214-3.524 1.567-3.287 2.405.238.839 2.71-1.587 3.216-.642.506.946-3.49 2.056-3.522 2.064-1.29.33-4.568 1.028-5.713-.624"
      />
    </BrandIcon>
  );
}

function OpenAIMark() {
  return (
    <BrandIcon label="OpenAI">
      <path
        fill="currentColor"
        d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
      />
    </BrandIcon>
  );
}

function GroqMark() {
  return (
    <BrandIcon label="Groq">
      <path
        fill="currentColor"
        d="M12.036 2c-3.853-.035-7 3-7.036 6.781-.035 3.782 3.055 6.872 6.908 6.907h2.42v-2.566h-2.292c-2.407.028-4.38-1.866-4.408-4.23-.029-2.362 1.901-4.298 4.308-4.326h.1c2.407 0 4.358 1.915 4.365 4.278v6.305c0 2.342-1.944 4.25-4.323 4.279a4.375 4.375 0 0 1-3.033-1.252l-1.851 1.818A7 7 0 0 0 12.029 22h.092c3.803-.056 6.858-3.083 6.879-6.816v-6.5C18.907 4.963 15.817 2 12.036 2z"
      />
    </BrandIcon>
  );
}

function AnthropicMark() {
  return (
    <BrandIcon label="Anthropic">
      <path
        fill="currentColor"
        d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"
      />
    </BrandIcon>
  );
}

function GeminiMark() {
  return (
    <BrandIcon label="Gemini">
      <defs>
        <linearGradient id="gemini-mark" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0" stopColor="#4B8BFF" />
          <stop offset="0.5" stopColor="#E04B6A" />
          <stop offset="1" stopColor="#F0B429" />
        </linearGradient>
      </defs>
      <path
        fill="url(#gemini-mark)"
        d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"
      />
    </BrandIcon>
  );
}

const stacks = [
  { name: 'LangChain', mark: <LangChainMark /> },
  { name: 'Vercel AI SDK', mark: <VercelMark /> },
  { name: 'Hugging Face Agents', mark: <HuggingFaceMark /> },
] as const;

const providers = [
  { name: 'GPT', mark: <OpenAIMark /> },
  { name: 'Groq', mark: <GroqMark /> },
  { name: 'Anthropic', mark: <AnthropicMark /> },
  { name: 'Gemini', mark: <GeminiMark /> },
] as const;

function Chip({ name, mark }: { name: string; mark: ReactNode }) {
  return (
    <span className="inline-flex min-h-12 items-center gap-3 rounded-lg border border-white/15 px-4 text-sm text-white/90">
      {mark}
      {name}
    </span>
  );
}

export function MeasuredProof() {
  return (
    <section className="hero-visual relative overflow-hidden bg-black px-5 py-28">
      <video
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] w-full object-cover object-bottom"
        src={'/Animate_image_with_glowing_parti\u2026_20261002222324.mp4'}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto w-full max-w-5xl text-center">
        <p className="text-[11px] font-medium tracking-[0.28em] text-white/45 uppercase">
          Measured, not claimed
        </p>
        <h2
          className="mx-auto mt-6 max-w-4xl font-medium"
          style={{
            fontSize: 'clamp(3.25rem, 5.4vw, 4.75rem)',
            lineHeight: 0.98,
            letterSpacing: '-0.045em',
          }}
        >
          Protection you can
          <br />
          actually test.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/55">
          Warrant blocks unauthorized tool calls, then measures attack-stop and
          benign-pass across real agent stacks.
        </p>

        <div className="hero-visual-inner mt-14 rounded-2xl border border-white/15 bg-black/80 p-7 text-left sm:p-10">
          <MeasuredRates />

          <div className="mt-10 border-t border-white/10 pt-7">
            <p className="text-[11px] font-medium tracking-[0.18em] text-white/40 uppercase">
              Evaluated across agent stacks
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {stacks.map((item) => (
                <Chip key={item.name} name={item.name} mark={item.mark} />
              ))}
            </div>
          </div>

          <div className="mt-7">
            <p className="text-[11px] font-medium tracking-[0.18em] text-white/40 uppercase">
              Model providers
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {providers.map((item) => (
                <Chip key={item.name} name={item.name} mark={item.mark} />
              ))}
            </div>
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 border-t border-white/10 pt-5 text-center text-sm tracking-wide text-white/45">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                d="M7.5 10.5V8.2a4.5 4.5 0 0 1 9 0v2.3M6.5 10.5h11v8.2h-11z"
              />
            </svg>
            Same agent. Same attacks. Guard OFF → ENFORCE.
          </p>
        </div>
      </div>
    </section>
  );
}
