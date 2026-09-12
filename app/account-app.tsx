"use client";

import { useEffect, useRef, useState } from "react";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";

import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { Leaf, ShieldCheck, Smartphone, ArrowRight } from "lucide-react";

import { firebaseConfigured, firebaseServices } from "../lib/firebase";

import { Data, applyCommitments, iso } from "../lib/budget";

import { validData } from "../lib/validation";

import Dashboard from "./dashboard";

const blank: Data = {
  commitmentsVersion: 1,
  salary: { gross: 0, tax: 0, deductions: 0, payday: 5 },
  bills: [],
  expenses: [],
  pay: [],
};

function errorText(error: unknown) {
  const code = (error as { code?: string })?.code;

  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  )
    return "The email or password is incorrect.";

  if (code === "auth/email-already-in-use")
    return "An account already uses that email. Sign in or reset your password.";

  if (code === "auth/weak-password")
    return "Choose a stronger password with at least 8 characters.";

  if (code === "auth/too-many-requests")
    return "Too many attempts. Please wait before trying again.";

  if (code === "auth/operation-not-allowed")
    return "Email/password sign-in needs to be enabled for this app.";

  if (code === "permission-denied")
    return "Your budget could not be accessed. Check that the private Firestore rules have been published.";

  if (code === "auth/network-request-failed" || code === "unavailable")
    return "Could not connect. Check your internet connection and try again.";

  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export default function AccountApp() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(firebaseConfigured),
    [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseConfigured) return;

    try {
      return onAuthStateChanged(
        firebaseServices().auth,
        (u) => {
          setUser(u);
          setLoading(false);
        },
        (e) => {
          setError(errorText(e));
          setLoading(false);
        },
      );
    } catch (e) {
      setError(errorText(e));
      setLoading(false);
    }
  }, []);

  if (loading)
    return (
      <div className="account-loading" role="status">
        Opening your workspace…
      </div>
    );

  if (user) return <CloudBudget key={user.uid} user={user} />;

  return <Landing initialError={error} />;
}

function Landing({ initialError }: { initialError: string }) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(initialError),
    [failed, setFailed] = useState(!!initialError);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setFailed(false);

    const fields = new FormData(event.currentTarget),
      email = String(fields.get("email")).trim(),
      password = String(fields.get("password") || "");

    try {
      const { auth } = firebaseServices();

      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setMessage(
          "If an account uses this email, a password reset link will arrive shortly.",
        );
      } else if (mode === "signup") {
        if (password !== fields.get("confirm"))
          throw Error("The passwords do not match.");
        const fullName=String(fields.get('fullName')||'').trim();
        if(!fullName)throw Error('Enter your full name.');
        const credential=await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user,{displayName:fullName});
        window.dispatchEvent(new Event('weekly-profile-updated'));
      } else await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setFailed(true);
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="landing">
      <section className="landing-story">
        <a className="brand" href="/">
          <span>
            <Leaf size={24} />
          </span>
          weekly<span className="brand-dot">.</span>
        </a>
        <div className="landing-copy">
          <span className="eyebrow">A LITTLE CLARITY. EVERY PAYDAY.</span>
          <h1>
            Your money. <br />A little more <br />
            <em>peace of mind.</em>
          </h1>
          <p>
            Give your paycheck a plan. Make room for bills, everyday moments,
            and the things you’re working toward.
          </p>
          <div className="landing-benefit">
            <Smartphone />
            <span>
              One budget, wherever life takes you.
              <small>Pick up on your phone, computer, or tablet.</small>
            </span>
          </div>
          <div className="landing-benefit">
            <ShieldCheck />
            <span>
              A space of your own.
              <small>Your account. Your budget. Your next chapter.</small>
            </span>
          </div>
        </div>
        <p className="landing-footer">Small plans. More room to breathe.</p>
      </section>
      <section className="login-side">
        <div className="login-card">
          <span className="eyebrow">WELCOME TO YOUR WORKSPACE</span>
          <h2>
            {mode === "signup"
              ? "Make yourself at home."
              : mode === "reset"
                ? "A fresh way back in."
                : "Welcome back."}
          </h2>
          <p>
            {mode === "signup"
              ? "Create an account for your own private budget."
              : mode === "reset"
                ? "We’ll email you a link to reset your password."
                : "Sign in to pick up where you left off."}
          </p>
          {!firebaseConfigured && (
            <div className="auth-message" role="status">
              Sign-in is not available yet. The app owner needs to finish
              connecting the account service.
            </div>
          )}
          <form onSubmit={submit}>
            <fieldset disabled={busy || !firebaseConfigured}>
              {mode==='signup'&&<label>Full name<input name="fullName" autoComplete="name" maxLength={100} required/></label>}
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </label>
              {mode !== "reset" && (
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    minLength={mode === "signup" ? 8 : undefined}
                    required
                  />
                </label>
              )}
              {mode === "signup" && (
                <label>
                  Confirm password
                  <input
                    type="password"
                    name="confirm"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
              )}
              {message && (
                <div
                  className="auth-message"
                  role={failed ? "alert" : "status"}
                >
                  {message}
                </div>
              )}
              <button className="primary" type="submit">
                {busy
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "reset"
                      ? "Send reset link"
                      : "Sign in"}
                <ArrowRight size={18} />
              </button>
            </fieldset>
          </form>
          {mode === "login" && (
            <button
              disabled={busy}
              className="text-btn"
              onClick={() => {
                setMode("reset");
                setMessage("");
              }}
            >
              Forgot your password?
            </button>
          )}
          <div className="login-switch">
            {mode === "login" ? "New to Weekly?" : "Already have an account?"}{" "}
            <button
              disabled={busy}
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setMessage("");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function CloudBudget({ user }: { user: User }) {
  const [data, setData] = useState<Data | null>(null),
    [revision, setRevision] = useState(0),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [failed, setFailed] = useState<Data | null>(null),
    [online, setOnline] = useState(true),
    [retry, setRetry] = useState(0),
    [legacy, setLegacy] = useState<Data | null>(null);

  const [profileName,setProfileName]=useState(user.displayName||'');
  const [profileError,setProfileError]=useState('');
  const [profileBusy,setProfileBusy]=useState(false);
  async function saveName(name:string){
    const clean=name.trim();if(!clean||clean.length>100)throw Error('Enter a name of 1 to 100 characters.');
    await updateProfile(user,{displayName:clean});setProfileName(clean);
  }
  useEffect(()=>{const refresh=()=>setProfileName(user.displayName||'');window.addEventListener('weekly-profile-updated',refresh);return()=>window.removeEventListener('weekly-profile-updated',refresh);},[user]);
  const lock = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("weekly-v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (validData(parsed)) setLegacy(parsed);
      }
    } catch {
      /* Import through a JSON backup remains available. */
    }
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    setError("");
    setLoaded(false);

    const { db } = firebaseServices();

    return onSnapshot(
      doc(db, "budgets", user.uid),
      { includeMetadataChanges: true },
      (snapshot) => {
        // Wait for a server-confirmed snapshot before enabling edits or onboarding.

        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites)
          return;

        if (!snapshot.exists()) {
          setData(null);
          setRevision(0);
          setLoaded(true);
          return;
        }

        const value = snapshot.data();

        if (
          !validData(value.data) ||
          !Number.isInteger(value.revision) ||
          value.revision < 1
        ) {
          setError(
            "The saved budget has an unsupported format. It has not been overwritten.",
          );
          return;
        }

        setData(value.data);
        setRevision(value.revision);
        setLoaded(true);
      },
      (e) => {
        setError(errorText(e));
        setLoaded(false);
      },
    );
  }, [user.uid, retry]);

  async function save(next: Data) {
    if (lock.current) return;

    if (!online) {
      setFailed(next);
      setError("You are offline. This change has not been saved.");
      return;
    }

    lock.current = true;
    setBusy(true);
    setError("");

    const expected = revision;

    try {
      if (!validData(next))
        throw Error("This change contains invalid budget data.");

      const { db } = firebaseServices(),
        reference = doc(db, "budgets", user.uid);

      await runTransaction(db, async (transaction) => {
        const current = await transaction.get(reference);

        if ((current.exists() ? current.data().revision : 0) !== expected)
          throw Error(
            "Your budget changed on another device. This change was not saved. Review the latest budget and try again.",
          );

        transaction.set(reference, {
          data: next,
          revision: expected + 1,
          updatedAt: serverTimestamp(),
        });
      });

      setFailed(null);
    } catch (e) {
      setFailed(next);
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function change(action: React.SetStateAction<Data>) {
    if (data && !lock.current)
      void save(typeof action === "function" ? action(data) : action);
  }

  async function logout() {
    try {
      await signOut(firebaseServices().auth);
    } catch (e) {
      setError(errorText(e));
    }
  }

  function exportFailed() {
    if (!failed) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(failed, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "weekly-unsaved-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {(!data||!loaded||failed||error||!profileName)&&<div className="account-session"><span>{user.email}</span><button className="secondary" disabled={busy} onClick={logout}>Sign out</button></div>}
      {!profileName?<section className="account-state card"><h1>Make this space yours.</h1><p>Add your full name to personalize your workspace.</p><form onSubmit={async e=>{e.preventDefault();const name=String(new FormData(e.currentTarget).get('fullName')||'');setProfileBusy(true);try{await saveName(name);}catch{setProfileError('Could not save your name. Please try again.');}finally{setProfileBusy(false);}}}><label>Full name<input name="fullName" autoComplete="name" maxLength={100} required/></label><button className="primary" disabled={profileBusy}>{profileBusy?'Saving...':'Continue'}</button>{profileError&&<p role="alert">{profileError}</p>}</form></section>:failed ? (
        <section className="account-state card">
          <h2>Your change was not saved.</h2>
          <p role="alert">{error}</p>
          <p>
            Your previous cloud data is safe. Download the attempted change
            before returning if you want to keep a copy.
          </p>
          <button className="primary" onClick={exportFailed}>
            Download unsaved change
          </button>
          <button
            className="secondary"
            onClick={() => {
              setFailed(null);
              setError("");
              setRetry((v) => v + 1);
            }}
          >
            Discard change and reload
          </button>
        </section>
      ) : error ? (
        <section className="account-state card">
          <h2>We couldn’t open your budget.</h2>
          <p role="alert">{error}</p>
          <button className="primary" onClick={() => setRetry((v) => v + 1)}>
            Try again
          </button>
        </section>
      ) : !loaded ? (
        <div className="account-loading" role="status">
          {online
            ? "Loading your saved budget…"
            : "Connect to the internet to open your budget."}
        </div>
      ) : !data ? (
        <section className="account-state card">
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h1>Let’s make it yours.</h1>
          <p>Start a private budget with your own income and payments.</p>
          <button
            className="primary"
            disabled={busy || !online}
            onClick={() => save(blank)}
          >
            Start an empty budget
          </button>
          {legacy && (
            <>
              <hr />
              <h3>Bring your existing budget</h3>
              <p>
                This browser has a previous Weekly budget. Import it only if it
                belongs to you. It will be saved to{" "}
                <strong>{user.email}</strong>, including your existing payments
                and Friday commitments. The local copy stays intact.
              </p>
              <button
                className="secondary"
                disabled={busy || !online}
                onClick={() => save(applyCommitments(legacy, iso(new Date())))}
              >
                Import this browser’s budget
              </button>
            </>
          )}
        </section>
      ) : (
        <div inert={busy || !online}>
          <Dashboard data={data} setData={change} profileName={profileName} email={user.email||""} onSignOut={logout} onSaveName={saveName} syncStatus={busy?"Saving...":online?"Connected":"Offline"} />
        </div>
      )}
      {busy && (
        <div className="save-indicator" role="status">
          Saving your budget…
        </div>
      )}
    </>
  );
}
